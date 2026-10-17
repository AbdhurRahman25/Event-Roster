require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Resend } = require("resend");
const twilio = require("twilio");
const { Admin, Employee, Order } = require("./models");

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

const otpStore = new Map(); // In-memory OTP storage; use Redis in production.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    if (!token) throw new Error("Missing token");
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Please log in again." });
  }
}
function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}
function issueToken(admin) {
  return jwt.sign({ id: admin._id.toString(), email: admin.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

app.get("/api/health", (_req, res) => res.json({ ok: true, message: "Event Roster API is running" }));

app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const email = cleanText(req.body.email).toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address." });
    if (!resend) return res.status(503).json({ message: "Email OTP is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL in backend/.env." });
    const existing = await Admin.findOne({ email });
    if (existing) return res.status(409).json({ message: "This email is already registered. Please log in." });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(email, { code, expires: Date.now() + 10 * 60 * 1000 });
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: email,
      subject: "Your Event Roster verification code",
      html: `<div style="font-family:Arial,sans-serif"><h2>Event Roster</h2><p>Your email verification code is:</p><h1 style="letter-spacing:6px">${code}</h1><p>This code expires in 10 minutes. If you did not request this, ignore this email.</p></div>`
    });
    if (result.error) {
      otpStore.delete(email);
      return res.status(502).json({ message: "Could not send OTP. Check your Resend sender configuration." });
    }
    res.json({ message: "Verification code sent to your email." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Could not send verification code." });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { cateringServiceName, adminName, email, mobile, password, otp } = req.body;
    const normalizedEmail = cleanText(email).toLowerCase();
    const stored = otpStore.get(normalizedEmail);
    if (!stored || stored.expires < Date.now() || stored.code !== String(otp || "").trim()) {
      return res.status(400).json({ message: "OTP is invalid or expired. Request a new code." });
    }
    if (!cleanText(cateringServiceName) || !cleanText(adminName) || !cleanText(mobile) || !password || String(password).length < 8) {
      return res.status(400).json({ message: "Complete all fields. Password must be at least 8 characters." });
    }
    if (await Admin.findOne({ email: normalizedEmail })) return res.status(409).json({ message: "This email is already registered." });
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await Admin.create({
      cateringServiceName: cleanText(cateringServiceName),
      adminName: cleanText(adminName),
      email: normalizedEmail,
      mobile: cleanText(mobile),
      passwordHash
    });
    otpStore.delete(normalizedEmail);
    res.status(201).json({
      token: issueToken(admin),
      admin: { id: admin._id, cateringServiceName: admin.cateringServiceName, adminName: admin.adminName, email: admin.email, mobile: admin.mobile }
    });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: "This email is already registered." });
    console.error(e);
    res.status(500).json({ message: "Could not register account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = cleanText(req.body.email).toLowerCase();
    const admin = await Admin.findOne({ email });
    if (!admin || !(await bcrypt.compare(req.body.password || "", admin.passwordHash))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }
    res.json({
      token: issueToken(admin),
      admin: { id: admin._id, cateringServiceName: admin.cateringServiceName, adminName: admin.adminName, email: admin.email, mobile: admin.mobile }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Could not log in." });
  }
});

app.get("/api/employees", auth, async (req, res) => {
  try { res.json(await Employee.find({ adminId: req.admin.id }).sort({ createdAt: -1 })); }
  catch { res.status(500).json({ message: "Could not load employees." }); }
});

app.post("/api/employees", auth, async (req, res) => {
  try {
    const { name, mobile, city } = req.body;
    if (!cleanText(name) || !cleanText(mobile) || !cleanText(city)) return res.status(400).json({ message: "Complete all employee fields." });
    const employee = await Employee.create({ name: cleanText(name), mobile: cleanText(mobile), city: cleanText(city), adminId: req.admin.id });
    res.status(201).json(employee);
  } catch { res.status(500).json({ message: "Could not add employee." }); }
});

app.put("/api/employees/:id", auth, async (req, res) => {
  try {
    const { name, mobile, city } = req.body;
    const employee = await Employee.findOneAndUpdate(
      { _id: req.params.id, adminId: req.admin.id },
      { name: cleanText(name), mobile: cleanText(mobile), city: cleanText(city) },
      { new: true, runValidators: true }
    );
    if (!employee) return res.status(404).json({ message: "Employee not found." });
    res.json(employee);
  } catch { res.status(500).json({ message: "Could not update employee." }); }
});

app.delete("/api/employees/:id", auth, async (req, res) => {
  try {
    const employee = await Employee.findOneAndDelete({ _id: req.params.id, adminId: req.admin.id });
    if (!employee) return res.status(404).json({ message: "Employee not found." });
    await Order.updateMany({ adminId: req.admin.id }, { $pull: { assignedEmployees: employee._id } });
    res.json({ message: "Employee deleted." });
  } catch { res.status(500).json({ message: "Could not delete employee." }); }
});

app.get("/api/orders", auth, async (req, res) => {
  try { res.json(await Order.find({ adminId: req.admin.id }).populate("assignedEmployees").sort({ eventDateTime: 1 })); }
  catch { res.status(500).json({ message: "Could not load orders." }); }
});

app.post("/api/orders", auth, async (req, res) => {
  try {
    const city = cleanText(req.body.city);
    const peopleNeeded = Number(req.body.peopleNeeded);
    const eventDateTime = new Date(req.body.eventDateTime);
    if (!city || !Number.isInteger(peopleNeeded) || peopleNeeded < 1 || Number.isNaN(eventDateTime.getTime())) {
      return res.status(400).json({ message: "Enter city, number of staff, and a valid date/time." });
    }
    const order = await Order.create({ city, peopleNeeded, eventDateTime, assignedEmployees: [], adminId: req.admin.id });
    res.status(201).json(order);
  } catch { res.status(500).json({ message: "Could not create order." }); }
});

app.put("/api/orders/:id/assign", auth, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.employeeIds) ? req.body.employeeIds : [];
    const order = await Order.findOne({ _id: req.params.id, adminId: req.admin.id });
    if (!order) return res.status(404).json({ message: "Order not found." });
    const employees = await Employee.find({ _id: { $in: ids }, adminId: req.admin.id });
    order.assignedEmployees = employees.map(e => e._id);
    await order.save();

    let sms = { sent: false, reason: "Twilio is not configured; assignments were saved without sending SMS." };
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const admin = await Admin.findById(req.admin.id);
      const dateText = new Date(order.eventDateTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      const outcomes = await Promise.allSettled(employees.map(e => client.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: e.mobile,
        body: `${admin.adminName}\nHi ${e.name}, you are assigned in ${order.city}. Date & Time: ${dateText}`
      })));
      const sentCount = outcomes.filter(o => o.status === "fulfilled").length;
      sms = { sent: sentCount > 0, sentCount, total: employees.length, reason: sentCount === employees.length ? "SMS sent." : "Some SMS messages could not be sent. Check mobile numbers and Twilio configuration." };
    }
    res.json({ order: await order.populate("assignedEmployees"), sms });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Could not assign employees." });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Unexpected server error." });
});

const port = process.env.PORT || 4000;
mongoose.connect(process.env.MONGODB_URI || "")
  .then(() => {
    console.log("MongoDB connected");
    app.listen(port, () => console.log(`Event Roster API running on http://localhost:${port}`));
  })
  .catch(err => {
    console.error("MongoDB connection failed. Check MONGODB_URI in backend/.env", err.message);
    process.exit(1);
  });
