const mongoose = require("mongoose");

const SaleSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  total: { type: Number, required: true },
  items: { type: Array, required: true },
  deliveredAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("Sale", SaleSchema);
