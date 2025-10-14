
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
