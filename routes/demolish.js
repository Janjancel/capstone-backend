
// const express = require("express");
// const router = express.Router();
// const Demolition = require("../models/Demolition");
// const multer = require("multer");
// const cloudinary = require("../config/cloudinary");
// const streamifier = require("streamifier");

// const upload = multer({ storage: multer.memoryStorage() });

// // Helper for Cloudinary upload
// const streamUpload = (fileBuffer, folder = "demolitions") =>
//   new Promise((resolve, reject) => {
//     const stream = cloudinary.uploader.upload_stream(
//       { folder },
//       (error, result) => {
//         if (result) resolve(result.secure_url);
//         else reject(error);
//       }
//     );
//     streamifier.createReadStream(fileBuffer).pipe(stream);
//   });

// // GET all requests
// router.get("/", async (req, res) => {
//   try {
//     const requests = await Demolition.find().sort({ createdAt: -1 });
//     res.json(requests);
//   } catch (err) {
//     console.error("❌ Failed to fetch requests:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // POST a request
// router.post(
//   "/",
//   upload.fields([
//     { name: "frontImage", maxCount: 1 },
//     { name: "sideImage", maxCount: 1 },
//     { name: "backImage", maxCount: 1 },
//   ]),
//   async (req, res) => {
//     try {
//       const body = req.body || {};
//       const { userId, name, contact, price, description, location } = body;

//       // Price is NO LONGER required
//       if (!userId || !name || !contact || !description || !location) {
//         return res.status(400).json({ error: "Missing required fields" });
//       }

//       // Parse and validate location, coerce to numbers
//       let parsedLocation;
//       try {
//         parsedLocation = typeof location === "string" ? JSON.parse(location) : location;
//         if (
//           parsedLocation == null ||
//           parsedLocation.lat === undefined ||
//           parsedLocation.lng === undefined
//         ) {
//           return res.status(400).json({ error: "Invalid location object" });
//         }
//         parsedLocation = {
//           lat: Number(parsedLocation.lat),
//           lng: Number(parsedLocation.lng),
//         };
//         if (!Number.isFinite(parsedLocation.lat) || !Number.isFinite(parsedLocation.lng)) {
//           return res.status(400).json({ error: "Location lat/lng must be numbers" });
//         }
//       } catch (err) {
//         return res.status(400).json({ error: "Location must be valid JSON" });
//       }

//       // Optional price normalization (null if empty/invalid)
//       let cleanPrice = null;
//       if (price !== undefined && price !== null && String(price).trim() !== "") {
//         const n = Number(price);
//         cleanPrice = Number.isFinite(n) && n >= 0 ? n : null;
//       }

//       // Handle multiple image uploads → Cloudinary
//       const uploadedImages = {
//         front: null,
//         side: null,
//         back: null,
//       };

//       if (req.files) {
//         if (req.files.frontImage?.[0]) {
//           uploadedImages.front = await streamUpload(req.files.frontImage[0].buffer);
//         }
//         if (req.files.sideImage?.[0]) {
//           uploadedImages.side = await streamUpload(req.files.sideImage[0].buffer);
//         }
//         if (req.files.backImage?.[0]) {
//           uploadedImages.back = await streamUpload(req.files.backImage[0].buffer);
//         }
//       }

//       const newRequest = await Demolition.create({
//         userId,
//         name,
//         contact,
//         price: cleanPrice, // may be null
//         proposedPrice: null,
//         description,
//         images: uploadedImages,
//         location: parsedLocation,
//         status: "pending",
//       });

//       return res
//         .status(201)
//         .json({ message: "Request submitted successfully", data: newRequest });
//     } catch (err) {
//       console.error("❌ Server error:", err);
//       res.status(500).json({ error: err.message || "Server error" });
//     }
//   }
// );

// // PATCH request (price proposal / accept / decline / schedule rules)
// router.patch("/:id", async (req, res) => {
//   try {
//     const { status, scheduledDate, proposedPrice } = req.body;
//     const doc = await Demolition.findById(req.params.id);
//     if (!doc) return res.status(404).json({ error: "Request not found" });

//     // Proposed price (wish price) - optional update
//     if (proposedPrice !== undefined) {
//       const n = Number(proposedPrice);
//       if (!Number.isFinite(n) || n <= 0) {
//         return res.status(400).json({ error: "Invalid proposed price" });
//       }
//       doc.proposedPrice = n;
//     }

//     if (status) {
//       switch (status) {
//         case "awaiting_price_approval":
//           if (doc.proposedPrice == null) {
//             return res.status(400).json({ error: "proposedPrice is required to request approval" });
//           }
//           doc.status = "awaiting_price_approval";
//           break;

//         case "price_accepted":
//           if (doc.proposedPrice == null) {
//             return res.status(400).json({ error: "No proposed price to accept" });
//           }
//           doc.price = doc.proposedPrice; // commit final price
//           doc.status = "price_accepted";
//           break;

//         case "price_declined":
//           doc.status = "price_declined";
//           break;

//         case "ocular_scheduled":
//           doc.status = "ocular_scheduled";
//           if (scheduledDate) doc.scheduledDate = new Date(scheduledDate);
//           break;

//         case "scheduled":
//           // Only allow scheduling if price already accepted
//           if (!(doc.status === "price_accepted" && (doc.price || doc.price === 0))) {
//             return res.status(400).json({ error: "Cannot schedule before price is accepted" });
//           }
//           doc.status = "scheduled";
//           if (scheduledDate) doc.scheduledDate = new Date(scheduledDate);
//           break;

//         default:
//           // allow other statuses like 'pending', 'declined', 'completed'
//           doc.status = status;
//       }
//     } else if (scheduledDate) {
//       // no status change, just update date if allowed
//       doc.scheduledDate = new Date(scheduledDate);
//     }

//     const updated = await doc.save();

//     // Create a user-facing notification (align to current schema)
//     try {
//       const msg =
//         updated.status === "awaiting_price_approval" && updated.proposedPrice
//           ? `Proposed demolition price: ₱${Number(updated.proposedPrice).toLocaleString()}`
//           : scheduledDate && updated.status === "ocular_scheduled"
//           ? `Your ocular visit has been scheduled on ${new Date(scheduledDate).toLocaleDateString()}`
//           : scheduledDate && updated.status === "scheduled"
//           ? `Your demolition has been scheduled on ${new Date(scheduledDate).toLocaleDateString()}`
//           : updated.status === "price_accepted"
//           ? `Price accepted: ₱${Number(updated.price).toLocaleString()}`
//           : updated.status === "price_declined"
//           ? "Proposed price was declined."
//           : `Your demolish request has been ${updated.status || "updated"}.`;

//       try {
//         const Notification = require("../models/Notification");
//         await Notification.create({
//           userId: updated.userId,
//           status: updated.status || "updated",
//           message: msg,
//           role: "client",
//           for: "demolish",
//           read: false,
//           createdAt: new Date(),
//         });
//       } catch (e) {
//         console.warn("⚠️ Notification model create failed (non-fatal):", e?.message || e);
//       }

//       try {
//         const io = req.app && req.app.get && req.app.get("io");
//         if (io) {
//           io.to(updated.userId).emit("notification", {
//             status: updated.status || "updated",
//             message: msg,
//             role: "client",
//             for: "demolish",
//             data: { demolitionId: updated._id },
//             createdAt: new Date(),
//           });
//         }
//       } catch (e) {
//         console.warn("⚠️ Socket emit failed (non-fatal):", e?.message || e);
//       }

//       console.log(`📢 Notification to user ${updated.userId}: ${msg}`);
//     } catch (notifErr) {
//       console.error("❌ Notification creation/emit failed:", notifErr);
//     }

//     res.json(updated);
//   } catch (err) {
//     console.error("❌ Error updating request:", err);
//     res.status(500).json({ error: "Failed to update request" });
//   }
// });

// // DELETE request
// router.delete("/:id", async (req, res) => {
//   try {
//     await Demolition.findByIdAndDelete(req.params.id);
//     res.json({ message: "Request deleted successfully" });
//   } catch (err) {
//     console.error("❌ Error deleting request:", err);
//     res.status(500).json({ error: "Failed to delete request" });
//   }
// });

// module.exports = router;


const express = require("express");
const router = express.Router();
const Demolition = require("../models/Demolition");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

const upload = multer({ storage: multer.memoryStorage() });

// Stream upload helper
const streamUpload = (fileBuffer, folder = "demolitions") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (result) resolve(result.secure_url);
        else reject(error);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });

// GET all demolition requests
router.get("/", async (req, res) => {
  try {
    const requests = await Demolition.find().sort({ createdAt: -1 });
  res.json(requests);
  } catch (err) {
    console.error("❌ Failed to fetch requests:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// CREATE request
router.post(
  "/",
  upload.fields([
    { name: "frontImage", maxCount: 1 },
    { name: "sideImage", maxCount: 1 },
    { name: "backImage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { userId, name, contact, price, description, location } = req.body;

      if (!userId || !name || !contact || !description || !location) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Parse location
      let parsedLocation;
      try {
        parsedLocation = typeof location === "string"
          ? JSON.parse(location)
          : location;

        parsedLocation = {
          lat: Number(parsedLocation.lat),
          lng: Number(parsedLocation.lng),
        };

        if (!Number.isFinite(parsedLocation.lat) || !Number.isFinite(parsedLocation.lng)) {
          return res.status(400).json({ error: "Invalid lat/lng" });
        }
      } catch {
        return res.status(400).json({ error: "Location must be valid JSON" });
      }

      // Price cleanup
      let cleanPrice = null;
      if (price !== undefined && price !== "") {
        const n = Number(price);
        cleanPrice = Number.isFinite(n) && n >= 0 ? n : null;
      }

      // Image uploads
      const uploadedImages = {
        front: null,
        side: null,
        back: null,
      };

      if (req.files) {
        if (req.files.frontImage?.[0])
          uploadedImages.front = await streamUpload(req.files.frontImage[0].buffer);
        if (req.files.sideImage?.[0])
          uploadedImages.side = await streamUpload(req.files.sideImage[0].buffer);
        if (req.files.backImage?.[0])
          uploadedImages.back = await streamUpload(req.files.backImage[0].buffer);
      }

      const newRequest = await Demolition.create({
        userId,
        name,
        contact,
        price: cleanPrice,
        proposedPrice: null,
        description,
        images: uploadedImages,
        location: parsedLocation,
        status: "pending",
      });

      return res.status(201).json({
        message: "Request submitted successfully",
        data: newRequest,
      });
    } catch (err) {
      console.error("❌ Server error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// UPDATE request
router.patch("/:id", async (req, res) => {
  try {
    const { status, scheduledDate, proposedPrice, declineReason } = req.body;

    const doc = await Demolition.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Request not found" });

    // PROPOSED PRICE UPDATE
    if (proposedPrice !== undefined) {
      const n = Number(proposedPrice);
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({ error: "Invalid proposed price" });
      }
      doc.proposedPrice = n;
    }

    // HANDLE DECLINE LOGIC
    if (status === "declined") {
      if (!declineReason || !declineReason.trim()) {
        return res.status(400).json({
          error: "declineReason is required when declining.",
        });
      }
      doc.declineReason = declineReason.trim();
    } else {
      doc.declineReason = null;
    }

    // STATUS UPDATES
    if (status) {
      switch (status) {
        case "awaiting_price_approval":
          if (!doc.proposedPrice)
            return res.status(400).json({ error: "Proposed price required" });
          doc.status = status;
          break;

        case "price_accepted":
          if (!doc.proposedPrice)
            return res.status(400).json({ error: "Nothing to accept" });
          doc.price = doc.proposedPrice;
          doc.status = status;
          break;

        case "price_declined":
          doc.status = status;
          break;

        case "ocular_scheduled":
          doc.status = status;
          if (scheduledDate) doc.scheduledDate = new Date(scheduledDate);
          break;

        case "scheduled":
          if (!(doc.status === "price_accepted" && doc.price !== null)) {
            return res
              .status(400)
              .json({ error: "Cannot schedule before price acceptance" });
          }
          doc.status = status;
          if (scheduledDate) doc.scheduledDate = new Date(scheduledDate);
          break;

        default:
          doc.status = status;
      }
    }

    const updated = await doc.save();

    // ---- Notifications (unchanged) ----
    try {
      const Notification = require("../models/Notification");

      const msg =
        updated.status === "declined"
          ? `Your demolition request was declined. Reason: ${updated.declineReason}`
          : updated.status === "price_accepted"
          ? `Price accepted: ₱${updated.price.toLocaleString()}`
          : updated.status === "price_declined"
          ? "Proposed price was declined."
          : updated.status === "ocular_scheduled"
          ? `Ocular visit scheduled: ${updated.scheduledDate.toLocaleDateString()}`
          : updated.status === "scheduled"
          ? `Demolition scheduled: ${updated.scheduledDate.toLocaleDateString()}`
          : `Your demolition request is now ${updated.status}`;

      await Notification.create({
        userId: updated.userId,
        status: updated.status,
        message: msg,
        role: "client",
        for: "demolish",
        read: false,
        createdAt: new Date(),
      });

      const io = req.app.get("io");
      if (io) {
        io.to(updated.userId).emit("notification", {
          status: updated.status,
          message: msg,
          role: "client",
          for: "demolish",
          data: { demolitionId: updated._id },
          createdAt: new Date(),
        });
      }
    } catch (err) {
      console.warn("⚠️ Notification error:", err);
    }

    res.json(updated);
  } catch (err) {
    console.error("❌ Error updating request:", err);
    res.status(500).json({ error: "Failed to update request" });
  }
});

// DELETE request
router.delete("/:id", async (req, res) => {
  try {
    await Demolition.findByIdAndDelete(req.params.id);
    res.json({ message: "Request deleted successfully" });
  } catch (err) {
    console.error("❌ Delete error:", err);
    res.status(500).json({ error: "Failed to delete request" });
  }
});

module.exports = router;
