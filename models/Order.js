
// // models/Order.js
// const mongoose = require("mongoose");

// // --- Counter model (shared, atomic monthly sequences) ---
// const counterSchema = new mongoose.Schema({
//   key: { type: String, unique: true, index: true }, // e.g., 'order:10-25'
//   seq: { type: Number, default: 0 },
// });
// const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// /**
//  * OrderItem snapshot
//  * - `id` matches Cart.cartItems[].id (your itemId)
//  * - `quantity` matches Cart.cartItems[].quantity
//  * - name/price/images/image are captured at checkout time
//  * - subtotal auto-computed (quantity * price) if not provided
//  */
// const orderItemSchema = new mongoose.Schema(
//   {
//     id: { type: String, required: true },       // SAME key as Cart.cartItems[].id
//     quantity: { type: Number, required: true, min: 1 },

//     // snapshot fields (from Item at checkout time)
//     name: { type: String, required: true },
//     price: { type: Number, required: true, min: 0 },
//     image: { type: String, default: null },     // primary image (fallback: first of images[])
//     images: { type: [String], default: [] },    // full gallery (optional)

//     subtotal: { type: Number, required: true, min: 0 }, // auto-filled if missing
//   },
//   { _id: false }
// );

// const orderSchema = new mongoose.Schema(
//   {
//     // Custom formatted ID: MM-O-####-YY  (e.g., 10-O-0001-25)
//     orderId: {
//       type: String,
//       unique: true,
//       required: true,
//       trim: true,
//       match: [/^\d{2}-O-\d{4}-\d{2}$/, "Invalid orderId format (MM-O-####-YY)"],
//     },

//     // link to cart owner (Cart.userId is unique per user)
//     userId: { type: String, required: true, index: true },

//     // cart-connected items
//     items: {
//       type: [orderItemSchema],
//       default: [],
//       validate: [
//         (arr) => Array.isArray(arr) && arr.length > 0,
//         "Order must have at least one item.",
//       ],
//     },

//     // totals
//     total: { type: Number, required: true, min: 0 }, // auto-computed if missing

//     // keep the same semantics as your existing code (free-form address object)
//     address: { type: mongoose.Schema.Types.Mixed, default: {} },

//     // lifecycle
//     status: {
//       type: String,
//       enum: [
//         "Pending",
//         "Confirmed",
//         "Preparing",
//         "Shipping",
//         "Delivered",
//         "Cancellation Requested",
//         "Cancelled",
//       ],
//       default: "Pending",
//       index: true,
//     },
//     createdAt: { type: Date, default: Date.now, index: true },
//     cancelledAt: Date,
//   },
//   { timestamps: false }
// );

// /**
//  * Auto-generate orderId as MM-O-####-YY
//  * - MM = current month (01–12)
//  * - #### = zero-padded monthly sequence
//  * - YY = last two digits of year
//  * - 'O' stands for Order
//  */
// orderSchema.pre("validate", async function (next) {
//   try {
//     // ---------- ID generation (kept intact) ----------
//     if (!this.orderId) {
//       const base = this.createdAt ? new Date(this.createdAt) : new Date();
//       const mm = String(base.getMonth() + 1).padStart(2, "0");
//       const yy = String(base.getFullYear() % 100).padStart(2, "0");

//       const key = `order:${mm}-${yy}`;
//       const doc = await Counter.findOneAndUpdate(
//         { key },
//         { $inc: { seq: 1 } },
//         { new: true, upsert: true, setDefaultsOnInsert: true }
//       );

//       const seqStr = String(doc.seq).padStart(4, "0");
//       this.orderId = `${mm}-O-${seqStr}-${yy}`;
//     }

//     // ---------- Item normalization + totals ----------
//     if (Array.isArray(this.items)) {
//       for (const it of this.items) {
//         if (!it) continue;

//         // if primary image is missing, take the first non-empty images[] entry
//         if (!it.image && Array.isArray(it.images) && it.images.length > 0) {
//           const first = it.images.find((u) => typeof u === "string" && u.trim());
//           if (first) it.image = first.trim();
//         }

//         // ensure subtotal (quantity * price)
//         if (typeof it.subtotal !== "number" || Number.isNaN(it.subtotal)) {
//           const q = Number(it.quantity || 0);
//           const p = Number(it.price || 0);
//           it.subtotal = +(q * p).toFixed(2);
//         }
//       }
//     }

//     // compute total if missing
//     if (typeof this.total !== "number" || Number.isNaN(this.total)) {
//       const sum = (this.items || []).reduce(
//         (acc, it) => acc + (Number(it.subtotal) || 0),
//         0
//       );
//       this.total = +sum.toFixed(2);
//     }

//     next();
//   } catch (err) {
//     next(err);
//   }
// });

// // helpful indexes
// orderSchema.index({ orderId: 1 }, { unique: true });
// orderSchema.index({ userId: 1, createdAt: -1 });

// /**
//  * Utility: build Order.items[] from Cart.cartItems[] plus an Item snapshot lookup.
//  * - cartItems: [{ id, quantity }]
//  * - snapshotLookup: { [id]: { name, price, images?, image? } }
//  *   (you can prebuild this from your Item collection)
//  */
// orderSchema.statics.buildItemsFromCart = function (cartItems = [], snapshotLookup = {}) {
//   return cartItems.map(({ id, quantity }) => {
//     const snap = snapshotLookup[id] || {};
//     const images = Array.isArray(snap.images) ? snap.images : (snap.image ? [snap.image] : []);
//     const primary = snap.image || images.find((u) => typeof u === "string" && u.trim()) || null;

//     const price = Number(snap.price || 0);
//     const qty = Number(quantity || 0);
//     const subtotal = +(price * qty).toFixed(2);

//     return {
//       id,
//       quantity: qty,
//       name: String(snap.name || "Untitled Item"),
//       price,
//       image: primary,
//       images,
//       subtotal,
//     };
//   });
// };

// module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);



// const mongoose = require("mongoose");

// const orderSchema = new mongoose.Schema({
//   userId: String,
//   items: [
//     {
//       name: String,
//       quantity: Number,
//       price: Number,
//       image: String, // store Cloudinary URL here
//     },
//   ],
//   total: Number,
//   address: Object,
//   status: { type: String, default: "Pending" },
//   createdAt: { type: Date, default: Date.now },
//   cancelledAt: Date,
// });

// module.exports = mongoose.model("Order", orderSchema);


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
      name: String,
      quantity: Number,
      price: Number,
      image: String, // Cloudinary URL
    },
  ],
  total: Number,
  address: Object,
  status: { type: String, default: "Pending" },
  createdAt: { type: Date, default: Date.now },
  cancelledAt: Date,
}, { timestamps: false });

/**
 * Auto-generate orderId as MM-O-####-YY
 * - MM = current month (01–12)
 * - #### = zero-padded monthly sequence
 * - YY = last two digits of year
 * - 'O' stands for Order
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
