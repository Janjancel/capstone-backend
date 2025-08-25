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
const multer = require("multer");
const path = require("path");

const {
  createSell,
  getSellRequests,
  updateStatus,
  deleteSell,
} = require("../controllers/sellController");

// Multer config for file upload
const storage = multer.diskStorage({
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Create new sell request with optional image upload
router.post("/", upload.single("image"), createSell);

// Get all sell requests
router.get("/", getSellRequests);

// Update status (Accept/Decline)
router.put("/:id/status", updateStatus);

// Delete sell request
router.delete("/:id", deleteSell);

module.exports = router;

