// const mongoose = require("mongoose");

// const notificationSchema = new mongoose.Schema({
//   userId: String,
//   orderId: String,
//   status: String,
//   message: String,
//   role: String,
//   read: { type: Boolean, default: false },
//   createdAt: { type: Date, default: Date.now }
// });

// module.exports = mongoose.model("Notification", notificationSchema);

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true, trim: true },

    // Optional: relevant when the notification is tied to an order
    orderId: { type: String, trim: true },

    status: { type: String, trim: true },
    message: { type: String, trim: true },
    role: { type: String, trim: true },

    // NEW: what this notification is for
    for: {
      type: String,
      enum: ["order", "sell", "demolish"],
      required: true,
      index: true,
    },

    read: { type: Boolean, default: false, index: true },

    // Keep original createdAt behavior intact
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    minimize: true, // keep schema lean without changing behavior
  }
);

// Helpful compound index for common inbox queries
notificationSchema.index({ userId: 1, for: 1, read: 1, createdAt: -1 });

module.exports =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);
