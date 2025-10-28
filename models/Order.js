

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
//       name: String,
//       quantity: Number,
//       price: Number,
//       image: String, // Cloudinary URL
//     },
//   ],
//   total: Number,
//   address: Object,
//   status: { type: String, default: "Pending" },
//   createdAt: { type: Date, default: Date.now },
//   cancelledAt: Date,
// }, { timestamps: false });

// /**
//  * Auto-generate orderId as MM-O-####-YY
//  * - MM = current month (01–12)
//  * - #### = zero-padded monthly sequence
//  * - YY = last two digits of year
//  * - 'O' stands for Order
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

/**
 * OrderItem snapshot
 * - Mirrors Cart { id, quantity } but also captures Item attributes at checkout time
 * - image: single primary image (auto-derived from images[0] if missing)
 * - images: full array of URLs from Item (optional)
 */
const orderItemSchema = new mongoose.Schema(
  {
    // Same key used in Cart so it's easy to pass through
    id: { type: String, required: true }, // Item._id or custom id used in your app

    // Snapshot of product data at time of purchase
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },

    // images: array from Item; image: primary for convenience
    images: { type: [String], default: [] },
    image: String, // will be set to images[0] if missing

    // Optional extra attributes from Item
    categories: { type: [String], default: [] },
    condition: Number, // 1–10 scale from Item
    origin: String,
    age: String,
  },
  { _id: false }
);

// Minimal cart-like line item (input-friendly)
const cartLineSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    quantity: { type: Number, default: 1, min: 1 },
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

    userId: { type: String, required: true },

    // NEW: Accepts cart-like input lines, same shape as Cart: [{ id, quantity }]
    // You can pass either `cartItems` or put raw `{id,quantity}` into `items`—both work.
    cartItems: { type: [cartLineSchema], default: [] },

    // Line items (full snapshot stored on the order)
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "Order must contain at least one item",
      },
      required: true,
    },

    total: { type: Number, required: true }, // auto-computed if not provided

    address: { type: Object, default: {} },
    status: { type: String, default: "Pending" },

    createdAt: { type: Date, default: Date.now },
    cancelledAt: Date,
  },
  { timestamps: false }
);

/**
 * Helper: safely fetch Item model if registered
 */
function getItemModelOrThrow() {
  try {
    return mongoose.model("Item");
  } catch (_) {
    if (mongoose.models.Item) return mongoose.models.Item;
    throw new Error("Item model is not registered; cannot hydrate cart-like items into order snapshots.");
  }
}

/**
 * FIRST pre-validate: Hydrate cart-like input ({id, quantity}) into full snapshots.
 * Works with either:
 *  - `cartItems: [{ id, quantity }, ...]`, OR
 *  - `items: [{ id, quantity }, ...]` (missing name/price => treated as cart-like)
 */
orderSchema.pre("validate", async function (next) {
  try {
    // Detect if `items` look like raw cart lines (missing snapshot fields)
    const itemsLookRaw =
      Array.isArray(this.items) &&
      this.items.length > 0 &&
      this.items.some((li) => !li || li.name == null || li.price == null);

    // Decide source of raw lines
    let rawLines = [];
    if (itemsLookRaw) {
      rawLines = this.items.map((x) => ({ id: x.id, quantity: Number(x.quantity) || 1 }));
      this.items = []; // will replace with snapshots
    } else if ((!this.items || this.items.length === 0) && Array.isArray(this.cartItems) && this.cartItems.length) {
      rawLines = this.cartItems.map((x) => ({ id: x.id, quantity: Number(x.quantity) || 1 }));
    }

    // Nothing to hydrate
    if (!rawLines.length) return next();

    // Merge duplicates by id
    const merged = new Map();
    for (const { id, quantity } of rawLines) {
      if (!id) continue;
      const q = Math.max(1, Number(quantity) || 1);
      merged.set(id, (merged.get(id) || 0) + q);
    }
    const ids = Array.from(merged.keys());

    const Item = getItemModelOrThrow();
    const { Types } = mongoose;
    const objectIds = ids.filter((s) => Types.ObjectId.isValid(s)).map((s) => new Types.ObjectId(s));
    const codes = ids.filter((s) => !Types.ObjectId.isValid(s));

    // Try to match by _id (ObjectId) OR by custom codes like itemId / id
    const docs = await Item.find({
      $or: [
        objectIds.length ? { _id: { $in: objectIds } } : null,
        codes.length ? { itemId: { $in: codes } } : null,
        codes.length ? { id: { $in: codes } } : null,
      ].filter(Boolean),
    }).lean();

    // Index found docs by several keys for flexible lookups
    const byKey = new Map();
    for (const d of docs) {
      const keys = [d?._id ? String(d._id) : null, d?.itemId, d?.id].filter(Boolean);
      for (const k of keys) if (!byKey.has(k)) byKey.set(k, d);
    }

    // Build snapshots
    const snapshots = [];
    const missing = [];
    for (const id of ids) {
      const doc = byKey.get(id);
      if (!doc) {
        missing.push(id);
        continue;
      }
      const quantity = merged.get(id);
      const images = Array.isArray(doc.images) ? doc.images : [];
      const primary =
        (typeof doc.image === "string" && doc.image.trim()) ||
        (images.find((u) => typeof u === "string" && u.trim()) || undefined);

      const name = doc.name ?? doc.title ?? doc.itemName;
      const price = Number(doc.price ?? doc.currentPrice);

      if (name == null || !Number.isFinite(price)) {
        missing.push(id); // required snapshot fields absent
        continue;
      }

      snapshots.push({
        id,
        name,
        description: doc.description ?? doc.desc ?? undefined,
        price,
        quantity,
        images,
        image: primary,
        categories: Array.isArray(doc.categories) ? doc.categories : [],
        condition: typeof doc.condition === "number" ? doc.condition : undefined,
        origin: doc.origin,
        age: doc.age,
      });
    }

    if (missing.length) {
      const err = new mongoose.Error.ValidationError(this);
      err.addError(
        "items",
        new mongoose.Error.ValidatorError({
          path: "items",
          message: `Order references items that could not be hydrated or lack required fields: ${missing.join(", ")}`,
        })
      );
      return next(err);
    }

    this.items = snapshots;
    return next();
  } catch (err) {
    return next(err);
  }
});

/**
 * Normalize items before validation:
 * - Ensure each item's `image` is set (use images[0] if missing)
 * - Compute `total` from items if not explicitly set
 */
orderSchema.pre("validate", function (next) {
  try {
    if (Array.isArray(this.items)) {
      this.items = this.items.map((it) => {
        const clone = { ...it };
        if (!clone.image) {
          const first = Array.isArray(clone.images)
            ? clone.images.find((u) => typeof u === "string" && u.trim())
            : null;
          if (first) clone.image = String(first).trim();
        }
        return clone;
      });
    }

    if (!Number.isFinite(this.total)) {
      this.total = (this.items || []).reduce(
        (sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0),
        0
      );
    }

    next();
  } catch (err) {
    next(err);
  }
});

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
