const express = require("express");
const router = express.Router();
const Demolition = require("../models/Demolition");

// GET /api/demolish - Fetch all demolition requests
router.get("/", async (req, res) => {
  try {
    const requests = await Demolition.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error("❌ Failed to fetch requests:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/demolish - Create new demolition request
router.post("/", async (req, res) => {
  try {
    console.log("📦 Incoming payload:", JSON.stringify(req.body, null, 2));

    const { userId, name, contact, price, description, image, location } = req.body;

    if (!userId || !name || !contact || !price || !description || !location?.lat || !location?.lng) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newRequest = new Demolition({
      userId,
      name,
      contact,
      price,
      description,
      image,
      location,
      status: "pending",
      createdAt: new Date(),
    });

    const saved = await newRequest.save();
    res.status(201).json({ message: "Request submitted successfully", data: saved });
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// PATCH /api/demolish/:id - Update status
router.patch("/:id", async (req, res) => {
  try {
    const updated = await Demolition.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    console.error("❌ Error updating status:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// DELETE /api/demolish/:id - Delete request
router.delete("/:id", async (req, res) => {
  try {
    await Demolition.findByIdAndDelete(req.params.id);
    res.json({ message: "Request deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting request:", err);
    res.status(500).json({ error: "Failed to delete request" });
  }
});

module.exports = router;
