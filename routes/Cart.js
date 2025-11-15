
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

