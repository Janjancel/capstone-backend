// backend/routes/reviews.js
const express = require("express");
const router = express.Router();
const Review = require("../models/Review");

// Create a review
router.post("/", async (req, res) => {
  try {
    // Minimal validation: rating required and must be between 1 and 5
    const { rating } = req.body;
    if (rating === undefined || rating === null) {
      return res.status(400).json({ message: "Rating is required" });
    }
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return res.status(400).json({ message: "Rating must be a number between 1 and 5" });
    }

    const review = new Review(req.body);
    await review.save();
    res.status(201).json(review);
  } catch (err) {
    console.error("Failed to create review:", err);
    res.status(500).json({ message: "Failed to create review" });
  }
});

// Get all reviews for a specific user (most recent first)
router.get("/users/:userId/reviews", async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    console.error("Failed to get user reviews:", err);
    res.status(500).json({ message: "Failed to get reviews" });
  }
});

// Update a review (partial update) for a specific user
router.patch("/users/:userId/reviews/:reviewId", async (req, res) => {
  try {
    const updated = await Review.findOneAndUpdate(
      { _id: req.params.reviewId, userId: req.params.userId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    res.json(updated);
  } catch (err) {
    console.error("Failed to update review:", err);
    res.status(500).json({ message: "Failed to update review" });
  }
});

// Delete all reviews for a user
router.delete("/users/:userId/reviews", async (req, res) => {
  try {
    await Review.deleteMany({ userId: req.params.userId });
    res.json({ message: "All reviews cleared for user" });
  } catch (err) {
    console.error("Failed to clear user reviews:", err);
    res.status(500).json({ message: "Failed to clear reviews" });
  }
});

// Get a single review by id
router.get("/:id", async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    res.json(review);
  } catch (err) {
    console.error("Failed to get review:", err);
    res.status(500).json({ message: "Failed to get review" });
  }
});

// ✅ Get all reviews (for admin dashboard)
router.get("/", async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    console.error("Error fetching reviews:", err);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

module.exports = router;
