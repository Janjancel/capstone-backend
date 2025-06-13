const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: String,
  orderId: String,
  status: String,
  message: String,
  role: String,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notification", notificationSchema);
