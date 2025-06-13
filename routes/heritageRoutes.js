const express = require('express');
const router = express.Router();
const Heritage = require('../models/Heritage'); // correct path assumed

// GET /api/heritage
router.get('/', async (req, res) => {
  try {
    const heritageSites = await Heritage.find();
    res.status(200).json(heritageSites);
  } catch (err) {
    console.error("❌ Failed to fetch heritage sites:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
