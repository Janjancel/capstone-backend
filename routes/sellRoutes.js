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


// const express = require("express");
// const router = express.Router();
// const multer = require("multer");
// const path = require("path");

// const {
//   createSell,
//   getSellRequests,
//   updateStatus,
//   deleteSell,
//   scheduleOcular,   // ✅ import controller
// } = require("../controllers/sellController");

// // Multer config for file upload
// const storage = multer.diskStorage({
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + path.extname(file.originalname));
//   },
// });
// const upload = multer({ storage });

// // Create new sell request with optional image upload
// router.post("/", upload.single("image"), createSell);

// // Get all sell requests
// router.get("/", getSellRequests);

// // Update status (Accept/Decline)
// router.put("/:id/status", updateStatus);

// // ✅ Schedule ocular visit
// router.put("/:id/schedule-ocular", scheduleOcular);

// // Delete sell request
// router.delete("/:id", deleteSell);

// module.exports = router;


// routes/sellRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const SellRequest = require("../models/SellRequest");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// ================= Multer Config =================
const upload = multer({ storage: multer.memoryStorage() });

// ================= Route Handlers =================

// Create a new sell request
router.post("/", upload.single("image"), async (req, res) => {
  const { userId, name, contact, price, description, location } = req.body;
  let image = null;

  if (!userId || !name || !contact || !price || !description || !location) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  // Parse and validate location
  let parsedLocation;
  try {
    parsedLocation = typeof location === "string" ? JSON.parse(location) : location;
    if (
      typeof parsedLocation.lat !== "number" ||
      typeof parsedLocation.lng !== "number"
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid location object" });
    }
  } catch (err) {
    return res
      .status(400)
      .json({ success: false, message: "Location must be valid JSON" });
  }

  try {
    if (req.file && req.file.buffer) {
      // Upload image to Cloudinary
      const streamUpload = (fileBuffer) =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "sell_images" },
            (error, result) => {
              if (result) resolve(result.secure_url);
              else reject(error);
            }
          );
          streamifier.createReadStream(fileBuffer).pipe(stream);
        });

      image = await streamUpload(req.file.buffer);
    }

    const newSell = await SellRequest.create({
      userId,
      name,
      contact,
      price: Number(price),
      description,
      image: image || null,
      location: parsedLocation,
      status: "pending",
      createdAt: new Date(),
    });

    res.status(201).json({ success: true, sellRequest: newSell });
  } catch (err) {
    console.error("💥 Server error creating sell request:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});

// Get all sell requests
router.get("/", async (req, res) => {
  try {
    const requests = await SellRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error("💥 Error fetching sell requests:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ================= Specific PATCH Routes =================

// Schedule Ocular Visit → PATCH
router.patch("/:id/schedule-ocular", async (req, res) => {
  const { id } = req.params;
  const { ocularVisit } = req.body;

  try {
    const request = await SellRequest.findById(id);
    if (!request)
      return res.status(404).json({ message: "Sell request not found" });

    request.ocularVisit = ocularVisit;
    request.status = "ocular_scheduled";
    await request.save();

    res.json({
      success: true,
      ocularVisit: request.ocularVisit,
      status: request.status,
    });
  } catch (err) {
    console.error("💥 Error scheduling ocular visit:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Update status (Accept / Decline) → PATCH
router.patch("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const request = await SellRequest.findById(id);
    if (!request)
      return res.status(404).json({ message: "Sell request not found" });

    request.status = status;
    await request.save();

    res.json({ success: true, status: request.status });
  } catch (err) {
    console.error("💥 Error updating sell status:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ================= Delete Route =================
router.delete("/:id", async (req, res) => {
  console.log("🔥 deleteSell route hit with id:", req.params.id);

  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    console.warn("❌ Invalid ObjectId received:", id);
    return res
      .status(400)
      .json({ success: false, message: "Invalid ID format" });
  }

  try {
    const deleted = await SellRequest.findByIdAndDelete(id);

    if (!deleted) {
      console.warn("⚠️ Sell request not found:", id);
      return res
        .status(404)
        .json({ success: false, message: "Sell request not found" });
    }

    console.log("✅ Successfully deleted request:", deleted._id);
    res.status(200).json({
      success: true,
      message: "Request deleted successfully",
      deletedId: deleted._id,
    });
  } catch (err) {
    console.error("💥 Server error during delete:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = router;
