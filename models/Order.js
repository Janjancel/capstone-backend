

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

// models/Order.js
const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const cloudinary = require("../config/cloudinary");
const multer = require("multer");
const { Readable } = require("stream");

// Multer setup (store file in memory before upload to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ---------- Helpers: normalize image URL from various shapes ----------
function getFirstUrl(candidate) {
  if (!candidate) return null;

  if (typeof candidate === "string" && candidate.trim()) return candidate.trim();

  if (Array.isArray(candidate)) {
    const found = candidate.find((c) => typeof c === "string" && c.trim().length > 0);
    if (found) return found.trim();
    for (const c of candidate) {
      const nested = getFirstUrl(c);
      if (nested) return nested;
    }
    return null;
  }

  if (typeof candidate === "object") {
    const priorityKeys = ["front", "main", "cover", "primary", "side", "back", "url"];
    for (const k of priorityKeys) {
      if (k in candidate) {
        const nested = getFirstUrl(candidate[k]);
        if (nested) return nested;
      }
    }
    for (const k in candidate) {
      const nested = getFirstUrl(candidate[k]);
      if (nested) return nested;
    }
  }

  return null;
}

function pickImageUrlFromItem(item) {
  return getFirstUrl(item?.images) || getFirstUrl(item?.image) || null;
}
// ---------------------------------------------------------------------

/**
 * POST /api/orders
 * Accepts multipart/form-data with:
 * - userId           (string)
 * - items            (JSON string or array; each must have id/itemId/_id, name, price, quantity, images/image)
 * - address          (JSON string or object)
 * - notes            (string, optional)
 * - images[]         (file(s) optional; if provided and count === items.length, they map by index)
 */
router.post("/", upload.array("images"), async (req, res) => {
  try {
    // --- 0) Validate userId presence early
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    // 1) Upload any incoming files to Cloudinary (optional)
    let uploadedItems = [];
    if (req.files && req.files.length > 0) {
      uploadedItems = await Promise.all(
        req.files.map(
          (file) =>
            new Promise((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream(
                { folder: "orders" },
                (error, result) => {
                  if (error) return reject(error);
                  resolve(result.secure_url);
                }
              );
              Readable.from(file.buffer).pipe(uploadStream);
            })
        )
      );
    }

    // 2) Parse items payload safely (supports stringified or array)
    let rawItems;
    if (Array.isArray(req.body.items)) {
      rawItems = req.body.items;
    } else {
      try {
        rawItems = JSON.parse(req.body.items || "[]");
      } catch (e) {
        return res.status(400).json({ error: "Bad JSON in 'items' field", details: e.message });
      }
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ error: "Order must include at least one item." });
    }

    // Match uploaded images to items by index only if counts match
    const useIndexMapping = uploadedItems.length > 0 && uploadedItems.length === rawItems.length;

    // 3) Normalize items to match the OrderItem schema (id, quantity>=1, price, subtotal, image, images[])
    const items = rawItems.map((item, idx) => {
      const idCandidate = item?.id ?? item?.itemId ?? item?._id;
      if (!idCandidate) {
        // Force a readable error so the client sees it
        throw new Error("Each item must include an 'id' (or 'itemId' / '_id').");
      }

      // be strict: quantity must be >= 1 (your schema enforces min:1)
      const qtyRaw = Number(item.quantity);
      const qty = Number.isFinite(qtyRaw) && qtyRaw >= 1 ? qtyRaw : NaN; // triggers validation error later if NaN

      const priceRaw = Number(item.price);
      const price = Number.isFinite(priceRaw) && priceRaw >= 0 ? priceRaw : NaN;

      // Prefer uploaded image (index-mapped), else pick from item payload
      const uploadedUrl = useIndexMapping ? uploadedItems[idx] : undefined;
      const normalizedUrl = uploadedUrl || pickImageUrlFromItem(item);

      const images = [];
      if (normalizedUrl) images.push(normalizedUrl);

      // subtotal must be present (model requires it), compute here as source-of-truth
      const subtotal = +( (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(price) ? price : 0) ).toFixed(2);

      return {
        id: String(idCandidate),
        name: item?.name || "Untitled Item",
        quantity: qty,            // if invalid, Mongoose will throw a ValidationError (min:1)
        price: price,             // if invalid, Mongoose will throw
        subtotal,                 // present as required
        image: typeof normalizedUrl === "string" ? normalizedUrl : undefined,
        images,                   // optional gallery
      };
    });

    // 4) Compute total safely on server
    const total = items.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0);

    // 5) Parse address (string or object)
    let address = {};
    if (typeof req.body.address === "string") {
      try {
        address = JSON.parse(req.body.address || "{}");
      } catch (e) {
        return res.status(400).json({ error: "Bad JSON in 'address' field", details: e.message });
      }
    } else {
      address = req.body.address || {};
    }

    const notes = typeof req.body.notes === "string" ? req.body.notes : "";

    // 6) Create and save order
    const newOrder = new Order({
      userId,
      items,
      total,
      address,
      notes,
    });

    // Save with one retry on duplicate orderId (very rare but safer)
    try {
      await newOrder.save();
    } catch (err) {
      // Duplicate orderId (race) → try once more
      if (err?.name === "MongoServerError" && err?.code === 11000 && /orderId/.test(err?.message || "")) {
        // clear the generated ID so pre('validate') generates a fresh one
        newOrder.orderId = undefined;
        await newOrder.save();
      } else {
        throw err;
      }
    }

    return res.status(201).json(newOrder);
  } catch (error) {
    console.error("Order creation error:", error);

    // Return clearer messages so the client toast shows the root cause
    if (error?.name === "ValidationError") {
      return res.status(400).json({ error: "Validation failed", details: error.message });
    }
    if (error?.name === "SyntaxError") {
      return res.status(400).json({ error: "Bad JSON in payload", details: error.message });
    }
    if (error?.name === "MongoServerError" && error?.code === 11000) {
      return res.status(409).json({ error: "Duplicate key error", details: error.message });
    }

    return res.status(500).json({ error: "Failed to create order", details: error?.message || String(error) });
  }
});

// Get all orders (admin)
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Fetch all orders error:", error);
    res.status(500).json({ error: "Failed to fetch orders", details: error?.message });
  }
});

// Get orders for a specific user
router.get("/user/:userId", async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Fetch user orders error:", error);
    res.status(500).json({ error: "Failed to fetch user orders", details: error?.message });
  }
});

// Get order by ID
router.get("/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (error) {
    console.error("Fetch order by ID error:", error);
    res.status(500).json({ error: "Failed to fetch order", details: error?.message });
  }
});

// Update order status
router.put("/:id/status", async (req, res) => {
  const { status } = req.body;
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!updatedOrder) return res.status(404).json({ error: "Order not found" });
    res.json(updatedOrder);
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ error: "Failed to update order status", details: error?.message });
  }
});

// Request order cancellation
router.patch("/:id/cancel", async (req, res) => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "Cancellation Requested", cancelledAt: new Date() },
      { new: true }
    );
    if (!updatedOrder) return res.status(404).json({ error: "Order not found" });
    res.json(updatedOrder);
  } catch (error) {
    console.error("Cancel order request error:", error);
    res.status(500).json({ error: "Failed to request cancellation", details: error?.message });
  }
});

module.exports = router;
