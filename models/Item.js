

// const mongoose = require("mongoose");

// const ItemSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   description: String,
//   price: { type: Number, required: true },
//   origin: String,
//   age: String,
//   images: [String], // ✅ array of URLs
//   category: {
//     type: String,
//     enum: [
//       "Table",
//       "Chair",
//       "Flooring",
//       "Cabinet",
//       "Post",
//       "Scraps",
//       "Stones",
//       "Windows",
//       "Bed",
//     ],
//     default: "Uncategorized", // ✅ fallback if not set
//     required: true,
//   },
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model("Item", ItemSchema);

const mongoose = require("mongoose");

// Shared monthly counter (atomic)
const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true }, // e.g., 'item:10-25'
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

const ItemSchema = new mongoose.Schema({
  // Custom formatted ID: MM-I-####-YY (e.g., 10-I-0001-25)
  itemId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    match: [/^\d{2}-I-\d{4}-\d{2}$/, "Invalid itemId format (MM-I-####-YY)"],
  },

  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  origin: String,
  age: String,
  images: [String], // array of URLs
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
      "Uncategorized", // include this since it's the default
    ],
    default: "Uncategorized",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

// Auto-generate itemId as MM-I-####-YY using a monthly counter
ItemSchema.pre("validate", async function (next) {
  try {
    if (this.itemId) return next();

    const base = this.createdAt ? new Date(this.createdAt) : new Date();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const yy = String(base.getFullYear() % 100).padStart(2, "0");

    const key = `item:${mm}-${yy}`;
    const doc = await Counter.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const seqStr = String(doc.seq).padStart(4, "0");
    this.itemId = `${mm}-I-${seqStr}-${yy}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.models.Item || mongoose.model("Item", ItemSchema);
