const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  city: { type: String, required: true, trim: true },
  peopleNeeded: { type: Number, required: true, min: 1 },
  eventDateTime: { type: Date, required: true },
  assignedEmployees: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employee" }],
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
}, { timestamps: true });

const adminSchema = new mongoose.Schema({
  cateringServiceName: { type: String, required: true, trim: true },
  adminName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

const Admin = mongoose.model("Admin", adminSchema);
const Employee = mongoose.model("Employee", employeeSchema);
const Order = mongoose.model("Order", orderSchema);

module.exports = { Admin, Employee, Order };
