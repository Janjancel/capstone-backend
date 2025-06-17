// routes/sellRoutes.js
const express = require("express");
const router = express.Router();
const sellController = require("../controllers/sellController");

// POST /api/sell - Submit a new sell request
router.post("/", sellController.submitSellRequest);

// ✅ GET /api/sell - Fetch all sell requests
router.get("/", sellController.getAllSellRequests);

module.exports = router;
