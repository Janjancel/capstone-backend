const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const { authMiddleware } = require('../middleware/authMiddleware');

// Create a review (for Unika Antika, not orders)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    const userId = req.user && req.user._id;

    if (typeof rating !== 'number' || rating < 0 || rating > 5) {
      return res.status(400).json({ error: 'Rating is required and must be a number between 0 and 5.' });
    }
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const review = new Review({
      userId,
      rating,
      feedback,
    });

    await review.save();
    return res.status(201).json({ message: 'Review saved', review });
  } catch (err) {
    console.error('Error saving review:', err);
    return res.status(500).json({ error: 'Failed to save review.' });
  }
});

// Get all reviews (public)
router.get('/', async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 }).populate('userId', 'name email');
    res.json(reviews);
  } catch (err) {
    console.error('Failed to fetch reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

module.exports = router;

