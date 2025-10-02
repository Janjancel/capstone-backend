const mongoose = require("mongoose");

const SellRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  contact: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, required: true },
  image: { type: String, default: null }, // URL from Cloudinary
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined", "ocular_scheduled"],
    default: "pending",
  },
  scheduledDate: { type: Date, default: null }, // For ocular visits
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SellRequest", SellRequestSchema);

