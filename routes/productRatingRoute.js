const express = require('express');
const router = express.Router();
const ProductRating = require('../models/ProductRatings');

// Create a product rating
router.post('/', async (req, res) => {
  try {
    const { user, product, order, rating, review } = req.body;
    if (typeof rating !== 'number' || rating < 0 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 0 and 5.' });
    }
    const newRating = new ProductRating({ user, product, order, rating, review });
    await newRating.save();
    res.status(201).json(newRating);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product rating.' });
  }
});

// Get ratings for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const ratings = await ProductRating.find({ product: req.params.productId });
    res.json(ratings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ratings.' });
  }
});

// Get ratings by user
router.get('/user/:userId', async (req, res) => {
  try {
    const ratings = await ProductRating.find({ user: req.params.userId });
    res.json(ratings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user ratings.' });
  }
});

module.exports = router;
