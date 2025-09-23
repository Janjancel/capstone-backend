const express = require("express");
const router = express.Router();
const FeaturedItem = require("../models/FeaturedItem");
const Item = require("../models/Item");

// GET all featured items (with item details populated)
router.get("/", async (req, res) => {
  try {
    const featured = await FeaturedItem.find()
      .populate("item") // ✅ get full item details
      .sort({ featuredAt: -1 });
    res.json(featured);
  } catch (err) {
    console.error("Error fetching featured items:", err);
    res.status(500).json({ error: "Failed to fetch featured items" });
  }
});

// POST add an item as featured
router.post("/:itemId", async (req, res) => {
  try {
    const item = await Item.findById(req.params.itemId);
    if (!item) return res.status(404).json({ error: "Item not found" });

    // Check if already featured
    const existing = await FeaturedItem.findOne({ item: item._id });
    if (existing) {
      return res.status(400).json({ error: "Item is already featured" });
    }

    const newFeatured = new FeaturedItem({ item: item._id });
    await newFeatured.save();

    res.status(201).json(newFeatured);
  } catch (err) {
    console.error("Error adding featured item:", err);
    res.status(500).json({ error: "Failed to add featured item" });
  }
});

// DELETE remove item from featured
router.delete("/:itemId", async (req, res) => {
  try {
    const removed = await FeaturedItem.findOneAndDelete({ item: req.params.itemId });
    if (!removed) {
      return res.status(404).json({ error: "Featured item not found" });
    }
    res.json({ message: "Item removed from featured" });
  } catch (err) {
    console.error("Error removing featured item:", err);
    res.status(500).json({ error: "Failed to remove featured item" });
  }
});

module.exports = router;
