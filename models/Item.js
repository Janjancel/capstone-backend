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

// const mongoose = require("mongoose");

// const ItemSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   description: String,
//   price: { type: Number, required: true },
//   origin: String,
//   age: String,
//   // image: { type: String }, // Cloudinary URL
//   images: [String], // ✅ array of URLs
//   category: { type: String, required: true }, // ✅ add this
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model("Item", ItemSchema);

const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  origin: String,
  age: String,
  images: [String], // ✅ array of URLs
  category: {
    type: String,
    enum: [
      "Table",
      "Chair",
      "Flooring",
      "Cabinet",
      "Post",
      "Scraps",
      "Stones",
      "Windows",
      "Bed",
    ],
    default: "Uncategorized", // ✅ fallback if not set
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Item", ItemSchema);
