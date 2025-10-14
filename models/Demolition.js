

// const mongoose = require("mongoose");

// const DemolitionSchema = new mongoose.Schema({
//   userId: { type: String, required: true },
//   name: { type: String, required: true },
//   contact: { type: String, required: true },
//   price: { type: Number, required: true },
//   description: { type: String, required: true },
//   images: {
//     front: { type: String, default: null },
//     side: { type: String, default: null },
//     back: { type: String, default: null },
//   },
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

// Shared counter model (atomic monthly sequences)
const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true }, // e.g., 'demolish:10-25'
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

const DemolitionSchema = new mongoose.Schema({
  // Custom formatted ID: MM-D-####-YY (e.g., 10-D-0001-25)
  demolishId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    match: [/^\d{2}-D-\d{4}-\d{2}$/, "Invalid demolishId format (MM-D-####-YY)"],
  },

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

// Auto-generate demolishId (MM-D-####-YY) using a monthly counter
DemolitionSchema.pre("validate", async function (next) {
  try {
    if (this.demolishId) return next();

    const base = this.createdAt ? new Date(this.createdAt) : new Date();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const yy = String(base.getFullYear() % 100).padStart(2, "0");

    const key = `demolish:${mm}-${yy}`;
    const doc = await Counter.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const seqStr = String(doc.seq).padStart(4, "0");
    this.demolishId = `${mm}-D-${seqStr}-${yy}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.models.Demolition || mongoose.model("Demolition", DemolitionSchema);
