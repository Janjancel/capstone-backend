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

const mongoose = require("mongoose");

const DemolitionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  contact: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, required: true },
  images: {
    front: { type: String, default: null },
    side: { type: String, default: null },
    back: { type: String, default: null },
  },
  location: {
    lat: { type: Number },
    lng: { type: Number },
  },
  status: { type: String, default: "pending" },
  scheduledDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Demolition", DemolitionSchema);
