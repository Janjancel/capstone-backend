const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: String,
  origin: String,
  age: String,
  image: String,
  createdAt: Date,
});

module.exports = mongoose.model("Item", ItemSchema);
