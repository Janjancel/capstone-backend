const express = require("express");
const router = express.Router();
const User = require("../models/User");

// POST /api/address/save
router.post("/save", async (req, res) => {
  const { userId, address } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.address = address;
    await user.save();

    res.json({ message: "Address saved successfully" });
  } catch (err) {
    console.error("Save address error:", err);
    res.status(500).json({ message: "Failed to save address" });
  }
});


// Example for backend route to fetch the user's address
router.get("/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user.address || {});
  } catch (err) {
    console.error("Fetch address error:", err);
    res.status(500).json({ message: "Failed to fetch address" });
  }
});


module.exports = router;
