// lib/reserveForCart.js
const mongoose = require("mongoose");
const Item = require("../models/Item");
const Cart = require("../models/Cart");

async function reserveForCart(userId, itemId, opts = { sessionPreferred: true }) {
  const sessionCapable = mongoose.connection.client && mongoose.connection.client.topology && mongoose.startSession;
  let session = null;

  try {
    if (opts.sessionPreferred && sessionCapable) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    // Try flip item availability -> false only if currently true
    const findUpdateOpts = session ? { session, new: true } : { new: true };
    const updatedItem = await Item.findOneAndUpdate(
      { _id: itemId, availability: true },
      { $set: { availability: false } },
      findUpdateOpts
    ).lean();

    // If not flipped above, fetch current availability to reflect snapshot
    let currentAvailability;
    if (updatedItem) currentAvailability = false;
    else {
      const itemDoc = await Item.findById(itemId).select("availability").lean().session ? undefined : null;
      // better fetch with session if available:
      const fetchOpts = session ? { session } : undefined;
      const item = await Item.findById(itemId, null, fetchOpts).select("availability").lean();
      currentAvailability = item ? Boolean(item.availability) : false;
    }

    // Ensure cart exists and cartItem entry exists & update snapshot
    // If cart doesn't exist we still add cart in calling route; here we'll update snapshot if cart has the item.
    const updateCartOpts = session ? { session } : undefined;
    await Cart.updateOne(
      { userId, "cartItems.id": itemId },
      { $set: { "cartItems.$.availability": currentAvailability } },
      updateCartOpts
    );

    if (session) await session.commitTransaction();
    if (session) session.endSession();

    return { success: true, reserved: !!updatedItem, availability: currentAvailability };
  } catch (err) {
    if (session) {
      try { await session.abortTransaction(); } catch (e) { /* ignore */ }
      session.endSession();
    }
    return { success: false, error: err };
  }
}

module.exports = reserveForCart;
