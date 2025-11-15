const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Item = require("../models/Item");

/**
 * NOTE: this router expects body parsing middleware (express.json()) to be applied
 * in your app (e.g. app.use(express.json())).
 *
 * Cart schema expected: cartItems: [{ id: String/ObjectId, quantity: Number }]
 */

/**
 * GET /:userId
 * Get cart for a specific user but ONLY include cart items whose Item.availability === true.
 * Returns { cartItems: [{ id, quantity, item: <ItemDoc> }, ...] } or { cartItems: [] }.
 */
router.get("/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const cart = await Cart.findOne({ userId });

    if (!cart || !Array.isArray(cart.cartItems) || cart.cartItems.length === 0) {
      return res.status(200).json({ cartItems: [] });
    }

    // Collect IDs from cart
    const ids = cart.cartItems.map((ci) => String(ci.id));

    // Find only available items
    const availableItems = await Item.find({
      _id: { $in: ids },
      availability: true,
    }).lean();

    // Create lookup map by string id
    const availableMap = new Map(availableItems.map((it) => [String(it._id), it]));

    // Build filtered cartItems: only those with available item docs
    const filteredCartItems = cart.cartItems
      .map((ci) => {
        const idStr = String(ci.id);
        const itemDoc = availableMap.get(idStr);
        if (!itemDoc) return null; // not available or deleted
        return {
          id: idStr,
          quantity: ci.quantity,
          item: itemDoc, // include full item doc (lean)
        };
      })
      .filter(Boolean);

    return res.status(200).json({ cartItems: filteredCartItems });
  } catch (err) {
    console.error("Failed to fetch cart:", err);
    return res.status(500).json({ error: "Failed to fetch cart" });
  }
});

/**
 * POST /:userId/add
 * Add an item to a user's cart (create cart if missing).
 * Body: { itemId }
 */
router.post("/:userId/add", async (req, res) => {
  const userId = req.params.userId;
  const { itemId } = req.body;

  if (!itemId) return res.status(400).json({ error: "itemId is required" });

  try {
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, cartItems: [{ id: itemId, quantity: 1 }] });
    } else {
      const index = cart.cartItems.findIndex((i) => String(i.id) === String(itemId));
      if (index !== -1) {
        cart.cartItems[index].quantity += 1;
      } else {
        cart.cartItems.push({ id: itemId, quantity: 1 });
      }
    }

    await cart.save();
    return res.status(200).json({ message: "Item added to cart", cart });
  } catch (error) {
    console.error("Add to cart failed:", error);
    return res.status(500).json({ error: "Failed to add item to cart" });
  }
});

/**
 * PUT /:userId/update
 * Update quantity of an item in user's cart.
 * Body: { id, quantity }
 */
router.put("/:userId/update", async (req, res) => {
  const userId = req.params.userId;
  const { id, quantity } = req.body;

  if (!id || typeof quantity !== "number") {
    return res.status(400).json({ error: "id and numeric quantity are required" });
  }

  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    const item = cart.cartItems.find((i) => String(i.id) === String(id));
    if (!item) return res.status(404).json({ error: "Item not found in cart" });

    item.quantity = quantity;

    // Optionally remove if quantity <= 0
    if (item.quantity <= 0) {
      cart.cartItems = cart.cartItems.filter((i) => String(i.id) !== String(id));
    }

    await cart.save();
    return res.status(200).json({ message: "Item quantity updated", cart });
  } catch (err) {
    console.error("Update cart item failed:", err);
    return res.status(500).json({ error: "Failed to update cart item" });
  }
});

/**
 * PUT /:userId/remove
 * Remove specific items from a user's cart.
 * Body: { removeItems: [itemId1, itemId2, ...] }
 */
router.put("/:userId/remove", async (req, res) => {
  const userId = req.params.userId;
  const { removeItems } = req.body;

  if (!Array.isArray(removeItems)) {
    return res.status(400).json({ error: "removeItems must be an array of item ids" });
  }

  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    const removeSet = new Set(removeItems.map((x) => String(x)));
    cart.cartItems = cart.cartItems.filter((i) => !removeSet.has(String(i.id)));

    await cart.save();
    return res.status(200).json({ message: "Items removed from cart", cart });
  } catch (err) {
    console.error("Remove items from cart failed:", err);
    return res.status(500).json({ error: "Failed to remove items from cart" });
  }
});

/**
 * DELETE /:userId
 * Clear entire cart for a user (set cartItems to []).
 */
router.delete("/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    await Cart.findOneAndUpdate({ userId }, { cartItems: [] }, { upsert: true });
    return res.status(200).json({ message: "Cart cleared" });
  } catch (err) {
    console.error("Failed to clear cart:", err);
    return res.status(500).json({ error: "Failed to clear cart" });
  }
});

/**
 * DELETE /remove-item/:itemId
 * Remove a specific item from ALL carts (useful if an item is deleted or becomes unavailable).
 * Uses $pull for an efficient multi-document update.
 */
router.delete("/remove-item/:itemId", async (req, res) => {
  const { itemId } = req.params;
  if (!itemId) return res.status(400).json({ error: "itemId is required" });

  try {
    const result = await Cart.updateMany({}, { $pull: { cartItems: { id: itemId } } });
    return res.status(200).json({
      message: "Item removed from all carts",
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("Failed to remove item from all carts:", err);
    return res.status(500).json({ error: "Failed to remove item from carts" });
  }
});

module.exports = router;



// const express = require("express");
// const router = express.Router();
// const Cart = require("../models/Cart");

// // Get cart for user
// router.get("/:userId", async (req, res) => {
//   const userId = req.params.userId;
//   const cart = await Cart.findOne({ userId });
//   res.json(cart || { cartItems: [] });
// });

// // Add or update item in cart
// router.post("/:userId/add", async (req, res) => {
//   const userId = req.params.userId;
//   const { itemId } = req.body;

//   let cart = await Cart.findOne({ userId });
//   if (!cart) {
//     cart = new Cart({ userId, cartItems: [] });
//   }

//   const index = cart.cartItems.findIndex((i) => i.id === itemId);
//   if (index !== -1) {
//     cart.cartItems[index].quantity += 1;
//   } else {
//     cart.cartItems.push({ id: itemId, quantity: 1 });
//   }

//   await cart.save();
//   res.sendStatus(200);
// });

// // Update quantity of an item
// router.put("/:userId/update", async (req, res) => {
//   const userId = req.params.userId;
//   const { id, quantity } = req.body;

//   const cart = await Cart.findOne({ userId });
//   if (!cart) return res.status(404).json({ error: "Cart not found" });

//   const item = cart.cartItems.find((i) => i.id === id);
//   if (item) {
//     item.quantity = quantity;
//     await cart.save();
//     res.sendStatus(200);
//   } else {
//     res.status(404).json({ error: "Item not found in cart" });
//   }
// });

// // Remove specific items
// router.put("/:userId/remove", async (req, res) => {
//   const userId = req.params.userId;
//   const { removeItems } = req.body;

//   const cart = await Cart.findOne({ userId });
//   if (!cart) return res.status(404).json({ error: "Cart not found" });

//   cart.cartItems = cart.cartItems.filter((i) => !removeItems.includes(i.id));
//   await cart.save();
//   res.sendStatus(200);
// });

// // Clear entire cart (optional)
// router.delete("/:userId", async (req, res) => {
//   await Cart.findOneAndUpdate({ userId: req.params.userId }, { cartItems: [] });
//   res.sendStatus(200);
// });

// // Add item to user's cart (create cart if missing)
// router.post("/:userId/add", async (req, res) => {
//   const { itemId } = req.body;
//   const { userId } = req.params;

//   try {
//     let cart = await Cart.findOne({ userId });

//     if (!cart) {
//       cart = new Cart({ userId, cartItems: [{ id: itemId, quantity: 1 }] });
//     } else {
//       const index = cart.cartItems.findIndex(i => i.id === itemId);
//       if (index !== -1) {
//         cart.cartItems[index].quantity += 1;
//       } else {
//         cart.cartItems.push({ id: itemId, quantity: 1 });
//       }
//     }

//     await cart.save();
//     res.status(200).json({ message: "Item added to cart" });
//   } catch (error) {
//     console.error("Add to cart failed:", error);
//     res.status(500).json({ error: "Failed to add item to cart" });
//   }
// });

// // GET /api/carts/:userId
// router.get('/:userId', async (req, res) => {
//   try {
//     const cart = await Cart.findOne({ userId: req.params.userId });
//     res.json(cart || { cartItems: [] });
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to fetch cart' });
//   }
// });

// module.exports = router;


//===================================
//BELOW IS THE ROUTE FOR ADD TO CART > ITEM AVAILABILITY="FALSE"

// const express = require("express");
// const mongoose = require("mongoose");
// const router = express.Router();
// const Cart = require("../models/Cart");
// const Item = require("../models/Item");

// // Get cart for user
// router.get("/:userId", async (req, res) => {
//   try {
//     const cart = await Cart.findOne({ userId: req.params.userId });
//     res.json(cart || { cartItems: [] });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to fetch cart" });
//   }
// });

// /**
//  * Add item to cart and reserve it atomically.
//  * Expects body: { itemId }
//  */
// router.post("/:userId/add", async (req, res) => {
//   const { userId } = req.params;
//   const { itemId } = req.body;

//   const session = await mongoose.startSession();
//   try {
//     let result = await session.withTransaction(async () => {
//       // 1) Try to reserve item: only succeed if availability === true
//       const reserved = await Item.findOneAndUpdate(
//         { _id: itemId, availability: true },
//         { $set: { availability: false } },
//         { new: true, session }
//       );

//       if (!reserved) {
//         // item was already reserved/unavailable
//         // abort transaction by throwing
//         const err = new Error("Item unavailable");
//         err.status = 409;
//         throw err;
//       }

//       // 2) Find or create cart and add the item
//       let cart = await Cart.findOne({ userId }).session(session);
//       if (!cart) {
//         cart = new Cart({ userId, cartItems: [{ id: itemId, quantity: 1 }] });
//       } else {
//         const index = cart.cartItems.findIndex(i => i.id === String(itemId));
//         if (index !== -1) {
//           // If you expect only unique items, you might not want to increment quantity.
//           // Here we increment but availability was already set false above so it's ok.
//           cart.cartItems[index].quantity += 1;
//         } else {
//           cart.cartItems.push({ id: itemId, quantity: 1 });
//         }
//       }
//       await cart.save({ session });
//       return { reserved, cart };
//     }); // end transaction

//     // if we get here, transaction committed
//     res.status(200).json({ message: "Item added to cart and reserved" });
//   } catch (error) {
//     // if error.status === 409 it means unavailable; else 500
//     if (error.status === 409) {
//       res.status(409).json({ error: "Item is not available" });
//     } else {
//       console.error("Add to cart failed:", error);
//       res.status(500).json({ error: "Failed to add item to cart" });
//     }
//   } finally {
//     session.endSession();
//   }
// });

// /**
//  * Remove specific items from cart and release availability
//  * Expects body: { removeItems: [itemId1, itemId2, ...] }
//  */
// router.put("/:userId/remove", async (req, res) => {
//   const userId = req.params.userId;
//   const { removeItems } = req.body; // array of ids

//   const session = await mongoose.startSession();
//   try {
//     await session.withTransaction(async () => {
//       const cart = await Cart.findOne({ userId }).session(session);
//       if (!cart) throw Object.assign(new Error("Cart not found"), { status: 404 });

//       // Keep track of actually removed item ids to release
//       const toRemove = cart.cartItems
//         .filter(i => removeItems.includes(i.id))
//         .map(i => i.id);

//       // Remove them from cart
//       cart.cartItems = cart.cartItems.filter(i => !removeItems.includes(i.id));
//       await cart.save({ session });

//       // Release availability for each removed item (set availability:true)
//       // Use updateMany for efficiency if many ids
//       if (toRemove.length > 0) {
//         await Item.updateMany(
//           { _id: { $in: toRemove } },
//           { $set: { availability: true } },
//           { session }
//         );
//       }
//     });

//     res.sendStatus(200);
//   } catch (err) {
//     console.error(err);
//     if (err.status === 404) res.status(404).json({ error: "Cart not found" });
//     else res.status(500).json({ error: "Failed to remove items from cart" });
//   } finally {
//     session.endSession();
//   }
// });

// /**
//  * Clear entire cart and release availability for contained items
//  */
// router.delete("/:userId", async (req, res) => {
//   const userId = req.params.userId;

//   const session = await mongoose.startSession();
//   try {
//     await session.withTransaction(async () => {
//       const cart = await Cart.findOne({ userId }).session(session);
//       if (!cart) {
//         // nothing to clear
//         return;
//       }

//       const itemIds = cart.cartItems.map(i => i.id);

//       // clear cart
//       cart.cartItems = [];
//       await cart.save({ session });

//       if (itemIds.length > 0) {
//         await Item.updateMany(
//           { _id: { $in: itemIds } },
//           { $set: { availability: true } },
//           { session }
//         );
//       }
//     });

//     res.sendStatus(200);
//   } catch (err) {
//     console.error("Clear cart failed:", err);
//     res.status(500).json({ error: "Failed to clear cart" });
//   } finally {
//     session.endSession();
//   }
// });

// module.exports = router;
