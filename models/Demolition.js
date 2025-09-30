// const mongoose = require("mongoose");

// const DemolitionSchema = new mongoose.Schema({
//   userId: { type: String, required: true },
//   name: { type: String, required: true },
//   contact: { type: String, required: true },
//   price: { type: Number, required: true },
//   description: { type: String, required: true },
//   image: { type: String }, // optional base64
//   location: {
//     lat: { type: Number },
//     lng: { type: Number },
//   },
//   status: { type: String, default: "pending" },
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model("Demolition", DemolitionSchema);

// const mongoose = require("mongoose");

// const DemolitionSchema = new mongoose.Schema({
//   userId: { type: String, required: true },
//   name: { type: String, required: true },
//   contact: { type: String, required: true },
//   price: { type: Number, required: true },
//   description: { type: String, required: true },
//   image: { type: String },
//   location: {
//     lat: { type: Number },
//     lng: { type: Number },
//   },
//   status: { type: String, default: "pending" },
//   scheduledDate: { type: Date },
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model("Demolition", DemolitionSchema);

const mongoose = require("mongoose");

const DemolitionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  contact: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, required: true },
  images: {
    front: { type: String, required: true },
    back: { type: String, required: true },
    side: { type: String, required: true },
  },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  notes: {
    type: String,
    default: "Upload photos of front, back, side, for faster approval",
  },
  status: { type: String, default: "pending" },
  scheduledDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Demolition", DemolitionSchema);
