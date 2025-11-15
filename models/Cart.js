// const mongoose = require("mongoose");

// const CartSchema = new mongoose.Schema({
//   userId: String,
//   cartItems: [{ id: String, quantity: Number }],
// });

// module.exports = mongoose.model("Cart", CartSchema);

  // const mongoose = require("mongoose");

  // const CartSchema = new mongoose.Schema({
  //   userId: { type: String, required: true, unique: true },
  //   cartItems: [
  //     {
  //       id: { type: String, required: true },
  //       quantity: { type: Number, default: 1 },
  //     }
  //   ],
  // });

  // module.exports = mongoose.model("Cart", CartSchema);

  // models/Cart.js
// const mongoose = require("mongoose");

// const CartSchema = new mongoose.Schema({
//   userId: { type: String, required: true, unique: true },
//   cartItems: [
//     {
//       id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
//       quantity: { type: Number, default: 1 },
//       addedAt: { type: Date, default: Date.now },
//     },
//   ],
// });

// const Cart = mongoose.models.Cart || mongoose.model("Cart", CartSchema);
// module.exports = Cart;

// models/Cart.js  (or wherever your Cart schema is defined)
// models/Cart.js
// models/Cart.js
const mongoose = require("mongoose");

// ----------------- Cart item schema -----------------
const CartItemSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
  quantity: { type: Number, default: 1 },
  addedAt: { type: Date, default: Date.now },

  // Snapshot of the item's availability at the time of adding/reservation.
  availability: { type: Boolean, required: true },
});

// ----------------- Cart schema -----------------
const CartSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  cartItems: [CartItemSchema],
});

// ----------------- Helper -----------------
function asString(x) {
  return x ? String(x) : x;
}

// ----------------- Statics (reserveItem & releaseItem) -----------------
// Keep your previous robust implementations available for routes/controllers.
// If you already have them elsewhere, you can import/require those instead.
// Minimal delegations are left here as placeholders (you can replace them with full implementations).

CartSchema.statics.reserveItem = async function (userId, itemObjectId, quantity = 1) {
  // If you already implemented the robust reserveItem earlier, paste it here.
  // For safety, call the same logic via the static if desired.
  // Placeholder: delegate to existing logic via require to avoid duplication:
  const impl = require("./cart_statics_impl").reserveItem; // optional: adjust if you don't have this file
  if (impl) return impl.call(this, userId, itemObjectId, quantity);
  throw new Error("reserveItem implementation missing. Paste your robust implementation here.");
};

CartSchema.statics.releaseItem = async function (userId, itemObjectId) {
  const impl = require("./cart_statics_impl").releaseItem; // optional
  if (impl) return impl.call(this, userId, itemObjectId);
  throw new Error("releaseItem implementation missing. Paste your robust implementation here.");
};

// ----------------- Post findOneAndUpdate hook (Option B) -----------------
/**
 * This hook runs after Model.findOneAndUpdate(..., { new: true }) and attempts:
 *  - If $push.cartItems was used: reserve the pushed item(s) (Item.availability: true -> false)
 *    and update the cart snapshot for the matched cartItems entry.
 *  - If $pull.cartItems was used: release the pulled item(s) (Item.availability: false -> true) best-effort.
 *
 * Caveats:
 *  - This is best-effort and cannot provide full multi-doc transactional guarantees.
 *  - The hook expects the query to return the updated document (new: true).
 */
CartSchema.post("findOneAndUpdate", async function (doc) {
  if (!doc) return; // nothing to do

  try {
    const Item = require("../models/Item");
    // In post middleware, `this` is the query
    const update = typeof this.getUpdate === "function" ? this.getUpdate() : null;

    // Collect pushed item ids (support both direct object and $each form)
    const pushedIds = [];
    if (update && update.$push && update.$push.cartItems) {
      const pushed = update.$push.cartItems;
      if (pushed && pushed.$each && Array.isArray(pushed.$each)) {
        for (const el of pushed.$each) {
          if (el && el.id) pushedIds.push(asString(el.id));
        }
      } else if (pushed && pushed.id) {
        pushedIds.push(asString(pushed.id));
      }
    }

    // Collect pulled item ids (support { $pull: { cartItems: { id: <id> } } } or $pull: { cartItems: { $in: [...] } })
    const pulledIds = [];
    if (update && update.$pull && update.$pull.cartItems) {
      const pull = update.$pull.cartItems;
      if (pull && pull.id) {
        pulledIds.push(asString(pull.id));
      } else if (pull && pull.$in && Array.isArray(pull.$in)) {
        for (const el of pull.$in) pulledIds.push(asString(el));
      } else if (pull && pull.$elemMatch && pull.$elemMatch.id) {
        pulledIds.push(asString(pull.$elemMatch.id));
      }
    }

    // Fallback: if no explicit $push present, best-effort assume last item in doc was added
    if (pushedIds.length === 0) {
      const last = doc.cartItems && doc.cartItems.length ? doc.cartItems[doc.cartItems.length - 1] : null;
      if (last) {
        pushedIds.push(asString(last.id));
      }
    }

    // Reserve pushed ids (best-effort). For each pushed id, attempt to set availability:true->false.
    // If succeeded, update the cart snapshot for the first matching cartItems entry whose availability !== false.
    for (const id of pushedIds) {
      if (!id) continue;
      try {
        const updated = await Item.findOneAndUpdate({ _id: id, availability: true }, { $set: { availability: false } }, { new: true }).lean();
        if (updated) {
          // Update snapshot on cart: set the first matching cartItems entry's availability to updated.availability
          // We only update when the cartItem's availability isn't already false to avoid clobbering earlier snapshots.
          await mongoose.model("Cart").updateOne(
            { _id: doc._id, "cartItems.id": id, "cartItems.availability": { $ne: false } },
            { $set: { "cartItems.$.availability": Boolean(updated.availability) } }
          );
        } else {
          // Item was already reserved or not found — ensure cart snapshot reflects current availability
          const cur = await Item.findById(id).select("availability").lean();
          const curAvail = cur ? Boolean(cur.availability) : false;
          await mongoose.model("Cart").updateOne(
            { _id: doc._id, "cartItems.id": id, "cartItems.availability": { $ne: curAvail } },
            { $set: { "cartItems.$.availability": curAvail } }
          );
        }
      } catch (err) {
        console.error(`Post-findOneAndUpdate: failed reserving item ${id}:`, err);
        // continue to next id (best-effort)
      }
    }

    // Release pulled ids (best-effort): set availability false->true for items removed from the cart
    for (const id of pulledIds) {
      if (!id) continue;
      try {
        await Item.findOneAndUpdate({ _id: id, availability: false }, { $set: { availability: true } }, { new: true });
      } catch (err) {
        console.error(`Post-findOneAndUpdate: failed releasing item ${id}:`, err);
      }
    }
  } catch (err) {
    console.error("Cart post-findOneAndUpdate hook failed:", err);
  }
});

// ---------- Instance helper: listItems (populated view) ----------
CartSchema.methods.listItems = async function () {
  await this.populate({ path: "cartItems.id", select: "name price availability itemId" });
  return this.cartItems.map((ci) => ({
    id: ci.id._id,
    itemId: ci.id.itemId,
    name: ci.id.name,
    price: ci.id.price,
    reservedSnapshot: ci.availability,
    currentAvailability: ci.id.availability,
    quantity: ci.quantity,
    addedAt: ci.addedAt,
  }));
};

// Export model
module.exports = mongoose.models.Cart || mongoose.model("Cart", CartSchema);
