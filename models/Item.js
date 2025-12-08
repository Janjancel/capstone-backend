

// const mongoose = require("mongoose");

// // Shared monthly counter (atomic)
// const counterSchema = new mongoose.Schema({
//   key: { type: String, unique: true, index: true }, // e.g., 'item:10-25'
//   seq: { type: Number, default: 0 },
// });
// const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// // One source of truth for allowed categories
// const CATEGORIES = [
//   "Table",
//   "Chair",
//   "Flooring",//remove
//   "Cabinet",
//   "Post",
//   "Scraps",
//   "Stones",
//   "Windows", //railings, doors, others+-
//   "Bed", //bed
//   "Uncategorized", // keep as default option
// ];

// const ItemSchema = new mongoose.Schema({
//   // Custom formatted ID: MM-I-####-YY (e.g., 10-I-0001-25)
//   itemId: {
//     type: String,
//     unique: true,
//     required: true,
//     trim: true,
//     match: [/^\d{2}-I-\d{4}-\d{2}$/, "Invalid itemId format (MM-I-####-YY)"],
//   },

//   name: { type: String, required: true },
//   description: String,
//   price: { type: Number, required: true },

//   // 1–10 condition rating
//   condition: {
//     type: Number,
//     required: true,
//     min: [1, "Condition must be at least 1"],
//     max: [10, "Condition cannot exceed 10"],
//   },

//   origin: String,
//   age: String,
//   images: [String], // array of URLs

//   // ✅ NEW: allow multiple categories
//   categories: {
//     type: [{ type: String, enum: CATEGORIES }],
//     default: ["Uncategorized"],
//     validate: {
//       validator: (arr) => Array.isArray(arr) && arr.length > 0,
//       message: "At least one category is required",
//     },
//     index: true,
//   },

//   // ✅ NEW: availability flag (default true)
//   availability: {
//     type: Boolean,
//     default: true,
//     index: true,
//   },

//   // ✅ NEW: quantity field (default 1)
//   quantity: {
//     type: Number,
//     default: 1,
//     min: [0, "Quantity cannot be negative"],
//     validate: {
//       validator: Number.isInteger,
//       message: "Quantity must be an integer",
//     },
//     index: true,
//   },

//   createdAt: { type: Date, default: Date.now, index: true },
// });

// // Backward-friendly virtual: .category -> first categories entry
// ItemSchema.virtual("category").get(function () {
//   return Array.isArray(this.categories) && this.categories.length
//     ? this.categories[0]
//     : "Uncategorized";
// });

// // Auto-generate itemId as MM-I-####-YY using a monthly counter
// ItemSchema.pre("validate", async function (next) {
//   try {
//     if (this.itemId) return next();

//     const base = this.createdAt ? new Date(this.createdAt) : new Date();
//     const mm = String(base.getMonth() + 1).padStart(2, "0");
//     const yy = String(base.getFullYear() % 100).padStart(2, "0");

//     const key = `item:${mm}-${yy}`;
//     const doc = await Counter.findOneAndUpdate(
//       { key },
//       { $inc: { seq: 1 } },
//       { new: true, upsert: true, setDefaultsOnInsert: true }
//     );

//     const seqStr = String(doc.seq).padStart(4, "0");
//     this.itemId = `${mm}-I-${seqStr}-${yy}`;
//     next();
//   } catch (err) {
//     next(err);
//   }
// });

// const Item = mongoose.models.Item || mongoose.model("Item", ItemSchema);
// module.exports = Item;
// module.exports.CATEGORIES = CATEGORIES;


const mongoose = require("mongoose");

// Shared monthly counter (atomic)
const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true }, // e.g., 'item:10-25'
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// One source of truth for allowed categories
const CATEGORIES = [
  "Table",
  "Chair",
  "Cabinet",
  "Post",
  "Scraps",
  "Stones",
  "Windows",
  "Railings", // added
  "Doors",    // added
  "Others",   // added
  "Uncategorized", // keep as default option
];

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

  // 1–10 condition rating
  condition: {
    type: Number,
    required: true,
    min: [1, "Condition must be at least 1"],
    max: [10, "Condition cannot exceed 10"],
  },

  origin: String,
  age: String,
  images: [String], // array of URLs

  // ✅ NEW: allow multiple categories
  categories: {
    type: [{ type: String, enum: CATEGORIES }],
    default: ["Uncategorized"],
    validate: {
      validator: (arr) => Array.isArray(arr) && arr.length > 0,
      message: "At least one category is required",
    },
    index: true,
  },

  // ✅ NEW: availability flag (default true)
  availability: {
    type: Boolean,
    default: true,
    index: true,
  },

  // ✅ NEW: quantity field (default 1)
  quantity: {
    type: Number,
    default: 1,
    min: [0, "Quantity cannot be negative"],
    validate: {
      validator: Number.isInteger,
      message: "Quantity must be an integer",
    },
    index: true,
  },

  createdAt: { type: Date, default: Date.now, index: true },
});

// Backward-friendly virtual: .category -> first categories entry
ItemSchema.virtual("category").get(function () {
  return Array.isArray(this.categories) && this.categories.length
    ? this.categories[0]
    : "Uncategorized";
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

const Item = mongoose.models.Item || mongoose.model("Item", ItemSchema);
module.exports = Item;
module.exports.CATEGORIES = CATEGORIES;
