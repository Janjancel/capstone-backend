const mongoose = require("mongoose");

const SellRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: String,
  contact: String,
  price: Number,
  description: String,
  image: String, // base64
  location: {
    lat: Number,
    lng: Number,
  },
  // status: { type: String, default: "pending" },
  status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SellRequest", SellRequestSchema);
