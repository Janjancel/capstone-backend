

// const mongoose = require("mongoose");

// const SellRequestSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//   name: String,
//   contact: String,
//   price: Number,
//   description: String,
//   images: {
//     front: { type: String, default: null },
//     side: { type: String, default: null },
//     back: { type: String, default: null },
//   },
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

// Shared monthly counter (atomic)
const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true }, // e.g., 'sell:10-25'
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

const SellRequestSchema = new mongoose.Schema({
  // Custom formatted ID: MM-S-####-YY (e.g., 10-S-0001-25)
  selId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    match: [/^\d{2}-S-\d{4}-\d{2}$/, "Invalid selId format (MM-S-####-YY)"],
  },

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

// Auto-generate selId as MM-S-####-YY using a monthly counter
SellRequestSchema.pre("validate", async function (next) {
  try {
    if (this.selId) return next();

    const base = this.createdAt ? new Date(this.createdAt) : new Date();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const yy = String(base.getFullYear() % 100).padStart(2, "0");

    const key = `sell:${mm}-${yy}`;
    const doc = await Counter.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const seqStr = String(doc.seq).padStart(4, "0");
    this.selId = `${mm}-S-${seqStr}-${yy}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.models.SellRequest || mongoose.model("SellRequest", SellRequestSchema);
