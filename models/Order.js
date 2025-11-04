// // models/Order.js
// const mongoose = require("mongoose");

// // ---- Counter model (monthly atomic sequences) ----
// const counterSchema = new mongoose.Schema({
//   key: { type: String, unique: true, index: true }, // e.g., 'order:10-25'
//   seq: { type: Number, default: 0 },
// });
// const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// // ---- Bring in Item model (adjust the path if your models are organized differently) ----
// const Item = require("./Item"); // e.g., "../models/Item" if needed

// /**
//  * OrderItem snapshot schema
//  * Accepts Cart-like input ({ id, quantity }) and is hydrated to a full snapshot before validation.
//  */
// const orderItemSchema = new mongoose.Schema(
//   {
//     id: { type: String, required: true }, // Item._id or your custom Item.itemId
//     name: { type: String, required: true },
//     description: String,
//     price: { type: Number, required: true },
//     quantity: { type: Number, required: true, min: 1 },

//     images: { type: [String], default: [] },
//     image: String, // primary (images[0] fallback)

//     categories: { type: [String], default: [] },
//     condition: Number, // 1–10 scale (optional)
//     origin: String,
//     age: String,
//   },
//   { _id: false }
// );

// const orderSchema = new mongoose.Schema(
//   {
//     // Custom formatted ID: MM-O-####-YY (e.g., 10-O-0001-25)
//     orderId: {
//       type: String,
//       unique: true,
//       required: true,
//       trim: true,
//       match: [/^\d{2}-O-\d{4}-\d{2}$/, "Invalid orderId format (MM-O-####-YY)"],
//     },

//     userId: { type: String, required: true },

//     /**
//      * Pass items like Cart: [{ id, quantity }]
//      * We’ll hydrate these into full snapshots (name, price, images, …) pre-validate.
//      */
//     items: {
//       type: [orderItemSchema],
//       validate: {
//         validator: (arr) => Array.isArray(arr) && arr.length > 0,
//         message: "Order must contain at least one item",
//       },
//       required: true,
//     },

//     total: { type: Number, required: true }, // auto-computed pre-validate

//     address: { type: Object, default: {} },
//     status: { type: String, default: "Pending" },

//     createdAt: { type: Date, default: Date.now },
//     cancelledAt: Date,
//   },
//   { timestamps: false }
// );

// /* ------------------------ Helpers ------------------------ */

// /** Clean string URL array */
// function cleanUrlArray(arr) {
//   if (!Array.isArray(arr)) return [];
//   return arr
//     .map((x) => (typeof x === "string" ? x.trim() : null))
//     .filter(Boolean);
// }

// /** Build a full snapshot for a single item using the catalog doc + desired quantity */
// function snapshotFromCatalog(doc, id, quantity) {
//   const images = cleanUrlArray(doc.images || []);
//   const primary = (images[0] && images[0].trim()) || (typeof doc.image === "string" ? doc.image.trim() : undefined);

//   return {
//     id: String(id),
//     name: doc.name,
//     description: doc.description || "",
//     price: Number(doc.price) || 0,
//     quantity: Math.max(1, Number(quantity) || 1),

//     images,
//     image: primary,

//     categories: Array.isArray(doc.categories) ? doc.categories : [],
//     condition: typeof doc.condition === "number" ? doc.condition : undefined,
//     origin: doc.origin,
//     age: doc.age,
//   };
// }

// /** Hydrate cart-like items [{id, quantity}] -> full snapshots; also normalizes existing snapshots */
// async function hydrateItemsIfNeeded(itemsInput) {
//   if (!Array.isArray(itemsInput) || itemsInput.length === 0) {
//     throw new Error("Order must contain at least one item");
//   }

//   // Determine which need hydration (missing name or price)
//   const needsHydration = itemsInput.filter((it) => !(it && it.name && Number.isFinite(it.price)));
//   if (needsHydration.length === 0) {
//     // Already snapshots; just normalize image/quantity
//     return itemsInput.map((it) => {
//       const images = cleanUrlArray(it.images || []);
//       return {
//         ...it,
//         quantity: Math.max(1, Number(it.quantity) || 1),
//         images,
//         image: it.image || images[0] || undefined,
//       };
//     });
//   }

//   // Unique ids that require hydration
//   const ids = [...new Set(needsHydration.map((it) => String(it.id)).filter(Boolean))];

//   // Try find by _id
//   let found = await Item.find({ _id: { $in: ids } }).lean().catch(() => []);
//   const foundIds = new Set(found.map((d) => String(d._id)));

//   // For any missing, try by custom itemId
//   const missingIds = ids.filter((x) => !foundIds.has(x));
//   if (missingIds.length) {
//     const foundByItemId = await Item.find({ itemId: { $in: missingIds } }).lean().catch(() => []);
//     found = found.concat(foundByItemId);
//   }

//   // Build lookup by both _id and itemId for resilience
//   const catalog = new Map();
//   for (const d of found) {
//     catalog.set(String(d._id), d);
//     if (d.itemId) catalog.set(String(d.itemId), d);
//   }

//   // Build final snapshots
//   return itemsInput.map((it) => {
//     // If it's already a full snapshot (has name+price), just normalize
//     if (it && it.name && Number.isFinite(it.price)) {
//       const images = cleanUrlArray(it.images || []);
//       return {
//         ...it,
//         quantity: Math.max(1, Number(it.quantity) || 1),
//         images,
//         image: it.image || images[0] || undefined,
//       };
//     }

//     // Hydrate from catalog using id (supports _id OR itemId)
//     const src = catalog.get(String(it.id));
//     if (!src) {
//       throw new Error(`Item not found for id "${it.id}"`);
//     }
//     return snapshotFromCatalog(src, it.id, it.quantity);
//   });
// }

// /* ------------------------ Hooks ------------------------ */

// /**
//  * Pre-validate:
//  * - Accept Cart-like input for items and hydrate to full snapshots
//  * - Ensure primary image is set
//  * - Compute total from snapshots
//  */
// orderSchema.pre("validate", async function (next) {
//   try {
//     // 1) Hydrate items (Cart-like -> full snapshots), or normalize existing snapshots
//     this.items = await hydrateItemsIfNeeded(this.items);

//     // 2) Compute total (always from hydrated snapshots)
//     this.total = this.items.reduce(
//       (sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0),
//       0
//     );

//     next();
//   } catch (err) {
//     next(err);
//   }
// });

// /**
//  * Pre-validate:
//  * Auto-generate orderId as MM-O-####-YY, using monthly counter.
//  */
// orderSchema.pre("validate", async function (next) {
//   try {
//     if (this.orderId) return next(); // keep preset if already provided (must match regex)

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

// /* ------------------------ Static convenience ------------------------ */
// /**
//  * Create an order directly from a Cart document shape:
//  *   await Order.createFromCart({ userId, cartItems, address })
//  * cartItems: [{ id, quantity }]
//  */
// orderSchema.statics.createFromCart = async function ({ userId, cartItems, address = {}, createdAt }) {
//   if (!userId) throw new Error("userId is required");
//   if (!Array.isArray(cartItems) || cartItems.length === 0) throw new Error("cartItems must be a non-empty array");

//   // We pass cartItems into `items`; the hook hydrates them
//   return this.create({
//     userId,
//     items: cartItems,
//     address,
//     createdAt: createdAt || new Date(),
//     // orderId and total are auto-generated in hooks
//   });
// };

// module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);


// models/Order.js
const mongoose = require("mongoose");

// --- Counter model (shared, atomic monthly sequences) ---
const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true }, // e.g., 'order:10-25'
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

/**
 * OrderItem snapshot
 * - `id` matches Cart.cartItems[].id (your itemId)
 * - `quantity` matches Cart.cartItems[].quantity
 * - name/price/images/image are captured at checkout time
 * - subtotal auto-computed (quantity * price) if not provided
 */
const orderItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },       // SAME key as Cart.cartItems[].id
    quantity: { type: Number, required: true, min: 1 },

    // snapshot fields (from Item at checkout time)
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: null },     // primary image (fallback: first of images[])
    images: { type: [String], default: [] },    // full gallery (optional)

    subtotal: { type: Number, required: true, min: 0 }, // auto-filled if missing
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // Custom formatted ID: MM-O-####-YY  (e.g., 10-O-0001-25)
    orderId: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      match: [/^\d{2}-O-\d{4}-\d{2}$/, "Invalid orderId format (MM-O-####-YY)"],
    },

    // link to cart owner (Cart.userId is unique per user)
    userId: { type: String, required: true, index: true },

    // cart-connected items
    items: {
      type: [orderItemSchema],
      default: [],
      validate: [
        (arr) => Array.isArray(arr) && arr.length > 0,
        "Order must have at least one item.",
      ],
    },

    // totals
    total: { type: Number, required: true, min: 0 }, // auto-computed if missing

    // keep the same semantics as your existing code (free-form address object)
    address: { type: mongoose.Schema.Types.Mixed, default: {} },

    // lifecycle
    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Preparing",
        "Shipping",
        "Delivered",
        "Cancellation Requested",
        "Cancelled",
      ],
      default: "Pending",
      index: true,
    },
    createdAt: { type: Date, default: Date.now, index: true },
    cancelledAt: Date,
  },
  { timestamps: false }
);

/**
 * Auto-generate orderId as MM-O-####-YY
 * - MM = current month (01–12)
 * - #### = zero-padded monthly sequence
 * - YY = last two digits of year
 * - 'O' stands for Order
 */
orderSchema.pre("validate", async function (next) {
  try {
    // ---------- ID generation (kept intact) ----------
    if (!this.orderId) {
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
    }

    // ---------- Item normalization + totals ----------
    if (Array.isArray(this.items)) {
      for (const it of this.items) {
        if (!it) continue;

        // if primary image is missing, take the first non-empty images[] entry
        if (!it.image && Array.isArray(it.images) && it.images.length > 0) {
          const first = it.images.find((u) => typeof u === "string" && u.trim());
          if (first) it.image = first.trim();
        }

        // ensure subtotal (quantity * price)
        if (typeof it.subtotal !== "number" || Number.isNaN(it.subtotal)) {
          const q = Number(it.quantity || 0);
          const p = Number(it.price || 0);
          it.subtotal = +(q * p).toFixed(2);
        }
      }
    }

    // compute total if missing
    if (typeof this.total !== "number" || Number.isNaN(this.total)) {
      const sum = (this.items || []).reduce(
        (acc, it) => acc + (Number(it.subtotal) || 0),
        0
      );
      this.total = +sum.toFixed(2);
    }

    next();
  } catch (err) {
    next(err);
  }
});

// helpful indexes
orderSchema.index({ orderId: 1 }, { unique: true });
orderSchema.index({ userId: 1, createdAt: -1 });

/**
 * Utility: build Order.items[] from Cart.cartItems[] plus an Item snapshot lookup.
 * - cartItems: [{ id, quantity }]
 * - snapshotLookup: { [id]: { name, price, images?, image? } }
 *   (you can prebuild this from your Item collection)
 */
orderSchema.statics.buildItemsFromCart = function (cartItems = [], snapshotLookup = {}) {
  return cartItems.map(({ id, quantity }) => {
    const snap = snapshotLookup[id] || {};
    const images = Array.isArray(snap.images) ? snap.images : (snap.image ? [snap.image] : []);
    const primary = snap.image || images.find((u) => typeof u === "string" && u.trim()) || null;

    const price = Number(snap.price || 0);
    const qty = Number(quantity || 0);
    const subtotal = +(price * qty).toFixed(2);

    return {
      id,
      quantity: qty,
      name: String(snap.name || "Untitled Item"),
      price,
      image: primary,
      images,
      subtotal,
    };
  });
};

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);
