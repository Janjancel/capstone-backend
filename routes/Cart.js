
const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart");

// Get cart for user
router.get("/:userId", async (req, res) => {
  const userId = req.params.userId;
  const cart = await Cart.findOne({ userId });
  res.json(cart || { cartItems: [] });
});

// Add or update item in cart
router.post("/:userId/add", async (req, res) => {
  const userId = req.params.userId;
  const { itemId } = req.body;

  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = new Cart({ userId, cartItems: [] });
  }

  const index = cart.cartItems.findIndex((i) => i.id === itemId);
  if (index !== -1) {
    cart.cartItems[index].quantity += 1;
  } else {
    cart.cartItems.push({ id: itemId, quantity: 1 });
  }

  await cart.save();
  res.sendStatus(200);
});

// Update quantity of an item
router.put("/:userId/update", async (req, res) => {
  const userId = req.params.userId;
  const { id, quantity } = req.body;

  const cart = await Cart.findOne({ userId });
  if (!cart) return res.status(404).json({ error: "Cart not found" });

  const item = cart.cartItems.find((i) => i.id === id);
  if (item) {
    item.quantity = quantity;
    await cart.save();
    res.sendStatus(200);
  } else {
    res.status(404).json({ error: "Item not found in cart" });
  }
});

// Remove specific items
router.put("/:userId/remove", async (req, res) => {
  const userId = req.params.userId;
  const { removeItems } = req.body;

  const cart = await Cart.findOne({ userId });
  if (!cart) return res.status(404).json({ error: "Cart not found" });

  cart.cartItems = cart.cartItems.filter((i) => !removeItems.includes(i.id));
  await cart.save();
  res.sendStatus(200);
});

// Clear entire cart (optional)
router.delete("/:userId", async (req, res) => {
  await Cart.findOneAndUpdate({ userId: req.params.userId }, { cartItems: [] });
  res.sendStatus(200);
});

// Add item to user's cart (create cart if missing)
router.post("/:userId/add", async (req, res) => {
  const { itemId } = req.body;
  const { userId } = req.params;

  try {
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, cartItems: [{ id: itemId, quantity: 1 }] });
    } else {
      const index = cart.cartItems.findIndex(i => i.id === itemId);
      if (index !== -1) {
        cart.cartItems[index].quantity += 1;
      } else {
        cart.cartItems.push({ id: itemId, quantity: 1 });
      }
    }

    await cart.save();
    res.status(200).json({ message: "Item added to cart" });
  } catch (error) {
    console.error("Add to cart failed:", error);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});

// GET /api/carts/:userId
router.get('/:userId', async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    res.json(cart || { cartItems: [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

module.exports = router;

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
