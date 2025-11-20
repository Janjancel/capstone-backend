
// // models/Order.js
// const mongoose = require("mongoose");

// // --- Counter model (shared, atomic monthly sequences) ---
// const counterSchema = new mongoose.Schema({
//   key: { type: String, unique: true, index: true }, // e.g., 'order:10-25'
//   seq: { type: Number, default: 0 },
// });
// const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// const orderSchema = new mongoose.Schema({
//   // Custom formatted ID: MM-O-####-YY  (e.g., 10-O-0001-25)
//   orderId: {
//     type: String,
//     unique: true,
//     required: true,
//     trim: true,
//     match: [/^\d{2}-O-\d{4}-\d{2}$/, "Invalid orderId format (MM-O-####-YY)"],
//   },

//   userId: String,
//   items: [
//     {
//       id: String,
//       name: String,
//       quantity: Number,
//       price: Number,
//       subtotal: Number,
//       image: String, // Cloudinary URL
//       images: [String],
//     },
//   ],
//   total: Number,             // items subtotal total
//   deliveryFee: { type: Number, default: 0 }, // computed delivery fee
//   grandTotal: { type: Number, default: 0 },  // total + deliveryFee
//   address: Object,
//   // keep old misspelled field for compatibility
//   coodrinates: {
//     lat: Number,
//     lng: Number,
//   },
//   // new correctly spelled coordinates field
//   coordinates: {
//     lat: Number,
//     lng: Number,
//   },
//   status: { type: String, default: "Pending" },
//   createdAt: { type: Date, default: Date.now },
//   cancelledAt: Date,
// }, { timestamps: false });

// /**
//  * Auto-generate orderId as MM-O-####-YY
//  */
// orderSchema.pre("validate", async function (next) {
//   try {
//     if (this.orderId) return next(); // keep preset values (must match regex)

//     const base = this.createdAt ? new Date(this.createdAt) : new Date();
//     const mm = String(base.getMonth() + 1).padStart(2, "0");
//     const yy = String(base.getFullYear() % 100).padStart(2, "0");

//     const key = `order:${mm}-${yy}`;
//     const doc = await Counter.findOneAndUpdate(
//       { key },
//       { $inc: { seq: 1 } },
//       { new: true, upsert: true, setDefaultsOnInsert: true }
//     );

//     const seqStr = String(doc.seq).padStart(4, "0");
//     this.orderId = `${mm}-O-${seqStr}-${yy}`;
//     next();
//   } catch (err) {
//     next(err);
//   }
// });

// module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);


const mongoose = require("mongoose");

// --- Counter model (shared, atomic monthly sequences) ---
const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true }, // e.g., 'order:10-25'
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

const orderSchema = new mongoose.Schema({
  // Custom formatted ID: MM-O-####-YY  (e.g., 10-O-0001-25)
  orderId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    match: [/^\d{2}-O-\d{4}-\d{2}$/, "Invalid orderId format (MM-O-####-YY)"],
  },

  userId: String,
  items: [
    {
      id: String,
      name: String,
      quantity: Number,
      price: Number,
      subtotal: Number,
      image: String, // Cloudinary URL
      images: [String],
    },
  ],
  total: Number,             // items subtotal total
  deliveryFee: { type: Number, default: 0 }, // computed delivery fee

  // new discount field (nullable by default)
  // store as Number (e.g. amount or percent depending on your application logic)
  discount: { type: Number, default: null },

  grandTotal: { type: Number, default: 0 },  // total + deliveryFee
  address: Object,
  // keep old misspelled field for compatibility
  coodrinates: {
    lat: Number,
    lng: Number,
  },
  // new correctly spelled coordinates field
  coordinates: {
    lat: Number,
    lng: Number,
  },
  status: { type: String, default: "Pending" },
  createdAt: { type: Date, default: Date.now },
  cancelledAt: Date,
}, { timestamps: false });

/**
 * Auto-generate orderId as MM-O-####-YY
 */
orderSchema.pre("validate", async function (next) {
  try {
    if (this.orderId) return next(); // keep preset values (must match regex)

    const base = this.createdAt ? new Date(this.createdAt) : new Date();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const yy = String(base.getFullYear() % 100).padStart(2, "0");

    const key = `order:${mm}-${yy}`;
    const doc = await Counter.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const seqStr = String(doc.seq).padStart(4, "0");
    this.orderId = `${mm}-O-${seqStr}-${yy}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);
