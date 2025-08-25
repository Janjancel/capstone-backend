// const mongoose = require("mongoose");

// const ItemSchema = new mongoose.Schema({
//   name: String,
//   description: String,
//   price: String,
//   origin: String,
//   age: String,
//   image: String,
//   createdAt: Date,
// });

// module.exports = mongoose.model("Item", ItemSchema);

const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  origin: String,
  age: String,
  image: { type: String }, // Cloudinary URL
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Item", ItemSchema);
