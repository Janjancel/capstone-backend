// // routes/sellRoutes.js
// const express = require("express");
// const router = express.Router();
// const sellController = require("../controllers/sellController");

// // // POST /api/sell - Submit a new sell request
// // router.post("/", sellController.submitSellRequest);

// // // ✅ GET /api/sell - Fetch all sell requests
// // router.get("/", sellController.getAllSellRequests);

// // // PATCH /api/sell/:id - Update status
// // router.patch("/:id", sellController.updateSellStatus);


// // Routes
// // Get all sell requests
// router.get("/", getSellRequests);

// // Update status
// router.patch("/:id", updateStatus);

// // Delete request
// router.delete("/:id", deleteSell);
// module.exports = router;


const express = require("express");
const router = express.Router();
const { createSell, getSellRequests, updateStatus, deleteSell } = require("../controllers/sellController");

// router.get("/", getSellRequests);
// router.patch("/:id", updateStatus);
// router.delete("/:id", deleteSell);

// Create new sell request
router.post("/", sellController.createSell);

// Get all sell requests
router.get("/", sellController.getSellRequests);

// Update status
router.put("/:id/status", sellController.updateStatus);

// Delete sell request
router.delete("/:id", sellController.deleteSell);

module.exports = router;
