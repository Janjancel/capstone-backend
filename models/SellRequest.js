

// const mongoose = require("mongoose");

// const SellRequestSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//   name: String,
//   contact: String,
//   price: Number,
//   description: String,
//   image: String,
//   location: {
//     lat: { type: Number },
//     lng: { type: Number },
//   },
//   status: {
//     type: String,
//     enum: ["pending", "accepted", "declined", "ocular_scheduled"],
//     default: "pending",
//   },
//   ocularVisit: { type: Date, default: null },
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model("SellRequest", SellRequestSchema);

const mongoose = require("mongoose");

const SellRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: String,
  contact: String,
  price: Number,
  description: String,
  images: {
    front: { type: String, default: null },
    side: { type: String, default: null },
    back: { type: String, default: null },
  },
  location: {
    lat: { type: Number },
    lng: { type: Number },
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined", "ocular_scheduled"],
    default: "pending",
  },
  ocularVisit: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SellRequest", SellRequestSchema);
