require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Resend } = require("resend");
const twilio = require("twilio");
const crypto = require("crypto");

const {
  Admin,
  Employee,
  Order,
  Notification,
} = require("./models");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  })
);
app.use(express.json({ limit: "1mb" }));

const otpStore = new Map();
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createToken(payload) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in backend/.env");
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function adminToken(admin) {
  return createToken({
    id: admin._id.toString(),
    role: "admin",
  });
}

function employeeToken(employee) {
  return createToken({
    id: employee._id.toString(),
    role: "employee",
    adminId: employee.adminId.toString(),
  });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  try {
    if (!token || !process.env.JWT_SECRET) {
      return res.status(401).json({
        message: "Please log in again.",
      });
    }

    req.user = jwt.verify(token, process.env.JWT_SECRET);

    if (!req.user.id || !["admin", "employee"].includes(req.user.role)) {
      return res.status(401).json({
        message: "Invalid login session. Please log in again.",
      });
    }

    next();
  } catch {
    return res.status(401).json({
      message: "Your session expired. Please log in again.",
    });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      message: "Admin access is required.",
    });
  }

  req.adminId = req.user.id;
  next();
}

function requireEmployee(req, res, next) {
  if (req.user?.role !== "employee") {
    return res.status(403).json({
      message: "Employee access is required.",
    });
  }

  req.employeeId = req.user.id;
  req.adminId = req.user.adminId;
  next();
}

function publicAdmin(admin) {
  return {
    id: admin._id,
    cateringServiceName: admin.cateringServiceName,
    adminName: admin.adminName,
    email: admin.email,
    mobile: admin.mobile,
  };
}

function publicEmployee(employee) {
  return {
    _id: employee._id,
    name: employee.name,
    mobile: employee.mobile,
    city: employee.city,
    adminId: employee.adminId,
    mustChangePassword: employee.mustChangePassword,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    message: "Event Roster API is running",
  });
});

// ---------------- ADMIN EMAIL OTP ----------------

app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const email = cleanText(req.body.email).toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: "Enter a valid email address.",
      });
    }

    if (!resend) {
      return res.status(503).json({
        message:
          "Email OTP is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL in backend/.env.",
      });
    }

    if (!process.env.RESEND_FROM_EMAIL) {
      return res.status(503).json({
        message: "RESEND_FROM_EMAIL is missing in backend/.env.",
      });
    }

    if (await Admin.findOne({ email })) {
      return res.status(409).json({
        message: "This email is already registered. Please log in.",
      });
    }

    const code = crypto.randomInt(100000, 1000000).toString();

    otpStore.set(email, {
      code,
      expires: Date.now() + 10 * 60 * 1000,
    });

    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: email,
      subject: "Your Event Roster verification code",
      html: `
        <div style="font-family:Arial,sans-serif">
          <h2>Event Roster</h2>
          <p>Your email verification code is:</p>
          <h1 style="letter-spacing:6px">${code}</h1>
          <p>This code expires in 10 minutes.</p>
        </div>
      `,
    });

    if (result.error) {
      otpStore.delete(email);
      console.error("Resend OTP error:", result.error);

      return res.status(502).json({
        message: `Could not send OTP: ${
          result.error.message || "Check Resend API key and sender settings."
        }`,
      });
    }

    return res.json({
      message: "Verification code sent to your email.",
    });
  } catch (error) {
    console.error("Send OTP error:", error);

    return res.status(500).json({
      message: "Could not send verification code. Check backend terminal.",
    });
  }
});

// ---------------- ADMIN REGISTER ----------------

app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      cateringServiceName,
      adminName,
      email,
      mobile,
      password,
      otp,
    } = req.body;

    const normalizedEmail = cleanText(email).toLowerCase();
    const storedOtp = otpStore.get(normalizedEmail);

    if (
      !storedOtp ||
      storedOtp.expires < Date.now() ||
      storedOtp.code !== String(otp || "").trim()
    ) {
      return res.status(400).json({
        message: "OTP is invalid or expired. Request a new code.",
      });
    }

    if (
      !cleanText(cateringServiceName) ||
      !cleanText(adminName) ||
      !cleanText(mobile) ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        message:
          "Complete all fields. Password must be at least 8 characters.",
      });
    }

    if (await Admin.findOne({ email: normalizedEmail })) {
      return res.status(409).json({
        message: "This email is already registered.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await Admin.create({
      cateringServiceName: cleanText(cateringServiceName),
      adminName: cleanText(adminName),
      email: normalizedEmail,
      mobile: cleanText(mobile),
      passwordHash,
    });

    otpStore.delete(normalizedEmail);

    return res.status(201).json({
      token: adminToken(admin),
      admin: publicAdmin(admin),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This email is already registered.",
      });
    }

    console.error("Admin registration error:", error);

    return res.status(500).json({
      message: "Could not register account.",
    });
  }
});

// ---------------- ADMIN LOGIN ----------------

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = cleanText(req.body.email).toLowerCase();
    const password =
      typeof req.body.password === "string" ? req.body.password : "";

    const admin = await Admin.findOne({ email });

    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return res.status(401).json({
        message: "Email or password is incorrect.",
      });
    }

    return res.json({
      token: adminToken(admin),
      role: "admin",
      admin: publicAdmin(admin),
    });
  } catch (error) {
    console.error("Admin login error:", error);

    return res.status(500).json({
      message: "Could not log in.",
    });
  }
});

// ---------------- EMPLOYEE LOGIN ----------------

app.post("/api/auth/employee/login", async (req, res) => {
  try {
    const mobile = cleanText(req.body.mobile);
    const password =
      typeof req.body.password === "string" ? req.body.password : "";

    const employee = await Employee.findOne({ mobile }).select(
      "+passwordHash"
    );

    if (
      !employee ||
      !employee.passwordHash ||
      !(await bcrypt.compare(password, employee.passwordHash))
    ) {
      return res.status(401).json({
        message: "Mobile number or password is incorrect.",
      });
    }

    const admin = await Admin.findById(employee.adminId);

    if (!admin) {
      return res.status(403).json({
        message: "Your catering admin account could not be found.",
      });
    }

    return res.json({
      token: employeeToken(employee),
      role: "employee",
      employee: publicEmployee(employee),
      admin: publicAdmin(admin),
    });
  } catch (error) {
    console.error("Employee login error:", error);

    return res.status(500).json({
      message: "Could not log in as employee.",
    });
  }
});

// ---------------- ADMIN: EMPLOYEES ----------------

app.get("/api/employees", requireAuth, requireAdmin, async (req, res) => {
  try {
    const employees = await Employee.find({
      adminId: req.adminId,
    }).sort({ createdAt: -1 });

    return res.json(employees.map(publicEmployee));
  } catch (error) {
    console.error("Load employees error:", error);

    return res.status(500).json({
      message: "Could not load employees.",
    });
  }
});

app.post("/api/employees", requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = cleanText(req.body.name);
    const mobile = cleanText(req.body.mobile);
    const city = cleanText(req.body.city);

    if (!name || !mobile || !city) {
      return res.status(400).json({
        message: "Complete all employee fields.",
      });
    }

    if (await Employee.findOne({ mobile })) {
      return res.status(409).json({
        message: "An employee account already exists with this mobile number.",
      });
    }

    // Temporary password is returned only when the account is created.
    // The admin must securely give it to the employee.
    const temporaryPassword = crypto.randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const employee = await Employee.create({
      name,
      mobile,
      city,
      passwordHash,
      mustChangePassword: true,
      adminId: req.adminId,
    });

    return res.status(201).json({
      employee: publicEmployee(employee),
      temporaryPassword,
      message:
        "Employee account created. Share the temporary password securely.",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An employee account already exists with this mobile number.",
      });
    }

    console.error("Add employee error:", error);

    return res.status(500).json({
      message: "Could not add employee.",
    });
  }
});

app.put("/api/employees/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = cleanText(req.body.name);
    const mobile = cleanText(req.body.mobile);
    const city = cleanText(req.body.city);

    if (!name || !mobile || !city) {
      return res.status(400).json({
        message: "Complete all employee fields.",
      });
    }

    const existingMobile = await Employee.findOne({
      mobile,
      _id: { $ne: req.params.id },
    });

    if (existingMobile) {
      return res.status(409).json({
        message: "This mobile number belongs to another employee account.",
      });
    }

    const employee = await Employee.findOneAndUpdate(
      {
        _id: req.params.id,
        adminId: req.adminId,
      },
      { name, mobile, city },
      { new: true, runValidators: true }
    );

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found.",
      });
    }

    return res.json(publicEmployee(employee));
  } catch (error) {
    console.error("Update employee error:", error);

    return res.status(500).json({
      message: "Could not update employee.",
    });
  }
});

app.delete(
  "/api/employees/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const employee = await Employee.findOneAndDelete({
        _id: req.params.id,
        adminId: req.adminId,
      });

      if (!employee) {
        return res.status(404).json({
          message: "Employee not found.",
        });
      }

      await Order.updateMany(
        { adminId: req.adminId },
        { $pull: { assignedEmployees: employee._id } }
      );

      await Notification.deleteMany({
        employeeId: employee._id,
        adminId: req.adminId,
      });

      return res.json({ message: "Employee deleted." });
    } catch (error) {
      console.error("Delete employee error:", error);

      return res.status(500).json({
        message: "Could not delete employee.",
      });
    }
  }
);

// ---------------- EMPLOYEE: PROFILE ----------------

app.get(
  "/api/employee/me",
  requireAuth,
  requireEmployee,
  async (req, res) => {
    try {
      const employee = await Employee.findOne({
        _id: req.employeeId,
        adminId: req.adminId,
      });

      const admin = await Admin.findById(req.adminId);

      if (!employee || !admin) {
        return res.status(404).json({
          message: "Employee or catering admin not found.",
        });
      }

      return res.json({
        employee: publicEmployee(employee),
        admin: publicAdmin(admin),
      });
    } catch (error) {
      console.error("Employee profile error:", error);

      return res.status(500).json({
        message: "Could not load employee profile.",
      });
    }
  }
);

// ---------------- EMPLOYEE: CHANGE PASSWORD ----------------

app.post(
  "/api/employee/change-password",
  requireAuth,
  requireEmployee,
  async (req, res) => {
    try {
      const currentPassword =
        typeof req.body.currentPassword === "string"
          ? req.body.currentPassword
          : "";
      const newPassword =
        typeof req.body.newPassword === "string"
          ? req.body.newPassword
          : "";

      if (newPassword.length < 8) {
        return res.status(400).json({
          message: "New password must be at least 8 characters.",
        });
      }

      const employee = await Employee.findOne({
        _id: req.employeeId,
        adminId: req.adminId,
      }).select("+passwordHash");

      if (!employee) {
        return res.status(404).json({
          message: "Employee not found.",
        });
      }

      if (!(await bcrypt.compare(currentPassword, employee.passwordHash))) {
        return res.status(401).json({
          message: "Current password is incorrect.",
        });
      }

      employee.passwordHash = await bcrypt.hash(newPassword, 12);
      employee.mustChangePassword = false;
      await employee.save();

      return res.json({
        message: "Password changed successfully.",
      });
    } catch (error) {
      console.error("Change employee password error:", error);

      return res.status(500).json({
        message: "Could not change password.",
      });
    }
  }
);

// ---------------- ADMIN: ORDERS ----------------

app.get("/api/orders", requireAuth, requireAdmin, async (req, res) => {
  try {
    const orders = await Order.find({
      adminId: req.adminId,
    })
      .populate("assignedEmployees")
      .sort({ eventDateTime: 1 });

    return res.json(orders);
  } catch (error) {
    console.error("Load orders error:", error);

    return res.status(500).json({
      message: "Could not load orders.",
    });
  }
});

app.post("/api/orders", requireAuth, requireAdmin, async (req, res) => {
  try {
    const city = cleanText(req.body.city);
    const peopleNeeded = Number(req.body.peopleNeeded);
    const eventDateTime = new Date(req.body.eventDateTime);

    if (
      !city ||
      !Number.isInteger(peopleNeeded) ||
      peopleNeeded < 1 ||
      Number.isNaN(eventDateTime.getTime())
    ) {
      return res.status(400).json({
        message: "Enter city, number of staff, and a valid date/time.",
      });
    }

    const order = await Order.create({
      city,
      peopleNeeded,
      eventDateTime,
      assignedEmployees: [],
      adminId: req.adminId,
    });

    return res.status(201).json(order);
  } catch (error) {
    console.error("Create order error:", error);

    return res.status(500).json({
      message: "Could not create order.",
    });
  }
});

// ---------------- ADMIN: ASSIGN EMPLOYEES ----------------

app.put(
  "/api/orders/:id/assign",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const ids = Array.isArray(req.body.employeeIds)
        ? [...new Set(req.body.employeeIds.map(String))]
        : [];

      const order = await Order.findOne({
        _id: req.params.id,
        adminId: req.adminId,
      });

      if (!order) {
        return res.status(404).json({
          message: "Order not found.",
        });
      }

      if (ids.length > order.peopleNeeded) {
        return res.status(400).json({
          message: `This order needs only ${order.peopleNeeded} employees.`,
        });
      }

      const employees = await Employee.find({
        _id: { $in: ids },
        adminId: req.adminId,
      });

      if (employees.length !== ids.length) {
        return res.status(400).json({
          message:
            "One or more employees do not belong to your catering account.",
        });
      }

      const previousIds = order.assignedEmployees.map(String);
      order.assignedEmployees = employees.map((employee) => employee._id);
      await order.save();

      const admin = await Admin.findById(req.adminId);
      const dateText = new Date(order.eventDateTime).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      });

      // Create in-app notifications for newly assigned employees.
      const newlyAssigned = employees.filter(
        (employee) => !previousIds.includes(employee._id.toString())
      );

      if (newlyAssigned.length) {
        await Notification.insertMany(
          newlyAssigned.map((employee) => ({
            employeeId: employee._id,
            adminId: req.adminId,
            orderId: order._id,
            message: `Hi ${employee.name}, you are assigned to ${order.city}. Date & Time: ${dateText}. Catering service: ${admin.cateringServiceName}. Admin: ${admin.adminName}.`,
          }))
        );
      }

      let sms = {
        sent: false,
        reason: "SMS is not configured. In-app notifications were created.",
      };

      if (
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_PHONE_NUMBER &&
        employees.length
      ) {
        try {
          const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
          );

          const outcomes = await Promise.allSettled(
            newlyAssigned.map((employee) =>
              client.messages.create({
                from: process.env.TWILIO_PHONE_NUMBER,
                to: employee.mobile,
                body: `${admin.adminName}\nHi ${employee.name}, you are assigned to ${order.city}. Date & Time: ${dateText}`,
              })
            )
          );

          const sentCount = outcomes.filter(
            (outcome) => outcome.status === "fulfilled"
          ).length;

          sms = {
            sent: sentCount > 0,
            sentCount,
            total: newlyAssigned.length,
            reason:
              "Assignment saved. Check Twilio delivery status for SMS results.",
          };
        } catch (error) {
          console.error("Twilio SMS error:", error);
          sms = {
            sent: false,
            reason: "Assignment saved, but SMS could not be sent.",
          };
        }
      }

      const populatedOrder = await order.populate("assignedEmployees");

      return res.json({
        order: populatedOrder,
        sms,
        notificationCount: newlyAssigned.length,
      });
    } catch (error) {
      console.error("Assign employees error:", error);

      return res.status(500).json({
        message: "Could not assign employees.",
      });
    }
  }
);

// ---------------- EMPLOYEE: ASSIGNMENTS ----------------

app.get(
  "/api/employee/assignments",
  requireAuth,
  requireEmployee,
  async (req, res) => {
    try {
      const employee = await Employee.findOne({
        _id: req.employeeId,
        adminId: req.adminId,
      });

      if (!employee) {
        return res.status(404).json({
          message: "Employee not found.",
        });
      }

      const orders = await Order.find({
        adminId: req.adminId,
        assignedEmployees: employee._id,
      })
        .populate("adminId", "adminName cateringServiceName mobile")
        .sort({ eventDateTime: 1 });

      return res.json(
        orders.map((order) => ({
          _id: order._id,
          city: order.city,
          peopleNeeded: order.peopleNeeded,
          eventDateTime: order.eventDateTime,
          admin: order.adminId,
        }))
      );
    } catch (error) {
      console.error("Employee assignments error:", error);

      return res.status(500).json({
        message: "Could not load assignments.",
      });
    }
  }
);

// ---------------- EMPLOYEE: NOTIFICATIONS ----------------

app.get(
  "/api/employee/notifications",
  requireAuth,
  requireEmployee,
  async (req, res) => {
    try {
      const notifications = await Notification.find({
        employeeId: req.employeeId,
        adminId: req.adminId,
      })
        .sort({ createdAt: -1 })
        .limit(100);

      return res.json(notifications);
    } catch (error) {
      console.error("Employee notifications error:", error);

      return res.status(500).json({
        message: "Could not load notifications.",
      });
    }
  }
);

app.patch(
  "/api/employee/notifications/:id/read",
  requireAuth,
  requireEmployee,
  async (req, res) => {
    try {
      const notification = await Notification.findOneAndUpdate(
        {
          _id: req.params.id,
          employeeId: req.employeeId,
          adminId: req.adminId,
        },
        { isRead: true },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({
          message: "Notification not found.",
        });
      }

      return res.json(notification);
    } catch (error) {
      console.error("Mark notification read error:", error);

      return res.status(500).json({
        message: "Could not update notification.",
      });
    }
  }
);

app.use((error, _req, res, _next) => {
  console.error("Unhandled API error:", error);

  res.status(500).json({
    message: "Unexpected server error.",
  });
});

async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing in backend/.env");
    process.exit(1);
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error(
      "Set JWT_SECRET in backend/.env to a random secret of at least 32 characters."
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Event Roster API running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

startServer();