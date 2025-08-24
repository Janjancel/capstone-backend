const mongoose = require("mongoose");


const orderSchema = new mongoose.Schema({
  userId: String,
  items: Array,
  total: Number,
  address: Object,
  status: { type: String, default: "Pending" },
  createdAt: { type: Date, default: Date.now },
  cancelledAt: Date,
});

module.exports = mongoose.model("Order", orderSchema);
