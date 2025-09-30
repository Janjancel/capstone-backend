


// const express = require("express");
// const router = express.Router();
// const Demolition = require("../models/Demolition");
// const multer = require("multer");
// const cloudinary = require("../config/cloudinary");
// const streamifier = require("streamifier");

// const upload = multer({ storage: multer.memoryStorage() });

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
// router.post("/", upload.single("image"), async (req, res) => {
//   try {
//     const body = req.body || {};
//     const { userId, name, contact, price, description, location } = body;

//     if (!userId || !name || !contact || !price || !description || !location) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     let parsedLocation;
//     try {
//       parsedLocation =
//         typeof location === "string" ? JSON.parse(location) : location;
//       if (parsedLocation.lat === undefined || parsedLocation.lng === undefined) {
//         return res.status(400).json({ error: "Invalid location object" });
//       }
//     } catch (err) {
//       return res.status(400).json({ error: "Location must be valid JSON" });
//     }

//     let imageUrl = null;
//     if (req.file && req.file.buffer) {
//       const streamUpload = (fileBuffer) =>
//         new Promise((resolve, reject) => {
//           const stream = cloudinary.uploader.upload_stream(
//             { folder: "demolitions" },
//             (error, result) => {
//               if (result) resolve(result.secure_url);
//               else reject(error);
//             }
//           );
//           streamifier.createReadStream(fileBuffer).pipe(stream);
//         });

//       imageUrl = await streamUpload(req.file.buffer);
//     }

//     const newRequest = new Demolition({
//       userId,
//       name,
//       contact,
//       price: Number(price),
//       description,
//       image: imageUrl,
//       location: parsedLocation,
//       status: "pending",
//     });

//     const saved = await newRequest.save();
//     res.status(201).json({ message: "Request submitted successfully", data: saved });
//   } catch (err) {
//     console.error("❌ Server error:", err);
//     res.status(500).json({ error: err.message || "Server error" });
//   }
// });

// // PATCH request
// router.patch("/:id", async (req, res) => {
//   try {
//     const updateData = {};
//     if (req.body.status) updateData.status = req.body.status;
//     if (req.body.scheduledDate) {
//       updateData.scheduledDate = new Date(req.body.scheduledDate);
//     }

//     const updated = await Demolition.findByIdAndUpdate(
//       req.params.id,
//       updateData,
//       { new: true }
//     );

//     if (!updated) {
//       return res.status(404).json({ error: "Request not found" });
//     }

//     // Notification
//     try {
//       const msg =
//         req.body.scheduledDate && req.body.status === "ocular_scheduled"
//           ? `Your ocular visit has been scheduled on ${new Date(
//               req.body.scheduledDate
//             ).toLocaleDateString()}`
//           : req.body.scheduledDate
//           ? `Your demolish request has been scheduled on ${new Date(
//               req.body.scheduledDate
//             ).toLocaleDateString()}`
//           : req.body.status
//           ? `Your demolish request has been ${req.body.status}`
//           : "Your demolish request was updated";

//       try {
//         const Notification = require("../models/Notification");
//         await Notification.create({
//           userId: updated.userId,
//           title: "Demolition Request Update",
//           message: msg,
//           data: { demolitionId: updated._id },
//           read: false,
//           createdAt: new Date(),
//         });
//       } catch (e) {}

//       try {
//         const io = req.app && req.app.get && req.app.get("io");
//         if (io) {
//           io.to(updated.userId).emit("notification", {
//             title: "Demolition Request Update",
//             message: msg,
//             data: { demolitionId: updated._id },
//             createdAt: new Date(),
//           });
//         }
//       } catch (e) {}

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

// POST a demolition request with front, back, side images
router.post(
  "/",
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
    { name: "side", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { userId, name, contact, price, description, location, notes } = req.body;

      if (!userId || !name || !contact || !price || !description || !location) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const parsedLocation = typeof location === "string" ? JSON.parse(location) : location;

      if (!req.files.front || !req.files.back || !req.files.side) {
        return res.status(400).json({ error: "All three images (front, back, side) are required" });
      }

      const uploadImage = async (file) =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "demolitions" },
            (err, result) => {
              if (err) reject(err);
              else resolve(result.secure_url);
            }
          );
          streamifier.createReadStream(file.buffer).pipe(stream);
        });

      const frontUrl = await uploadImage(req.files.front[0]);
      const backUrl = await uploadImage(req.files.back[0]);
      const sideUrl = await uploadImage(req.files.side[0]);

      const newRequest = new Demolition({
        userId,
        name,
        contact,
        price: Number(price),
        description,
        images: { front: frontUrl, back: backUrl, side: sideUrl },
        location: parsedLocation,
        notes: notes || "Upload photos of front, back, side, for faster approval",
      });

      const saved = await newRequest.save();
      res.status(201).json({ message: "Request submitted successfully", data: saved });
    } catch (err) {
      console.error("❌ Server error:", err);
      res.status(500).json({ error: err.message || "Server error" });
    }
  }
);

// PATCH request (update status, scheduledDate, optionally images)
router.patch(
  "/:id",
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
    { name: "side", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const updateData = {};
      if (req.body.status) updateData.status = req.body.status;
      if (req.body.scheduledDate) updateData.scheduledDate = new Date(req.body.scheduledDate);

      const uploadImage = async (file) =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "demolitions" },
            (err, result) => {
              if (err) reject(err);
              else resolve(result.secure_url);
            }
          );
          streamifier.createReadStream(file.buffer).pipe(stream);
        });

      if (req.files.front) updateData["images.front"] = await uploadImage(req.files.front[0]);
      if (req.files.back) updateData["images.back"] = await uploadImage(req.files.back[0]);
      if (req.files.side) updateData["images.side"] = await uploadImage(req.files.side[0]);

      const updated = await Demolition.findByIdAndUpdate(req.params.id, updateData, { new: true });

      if (!updated) return res.status(404).json({ error: "Request not found" });

      // Notification
      const Notification = require("../models/Notification");
      const msg =
        req.body.scheduledDate && req.body.status === "ocular_scheduled"
          ? `Your ocular visit has been scheduled on ${new Date(req.body.scheduledDate).toLocaleDateString()}`
          : req.body.scheduledDate
          ? `Your demolish request has been scheduled on ${new Date(req.body.scheduledDate).toLocaleDateString()}`
          : req.body.status
          ? `Your demolish request has been ${req.body.status}`
          : "Your demolish request was updated";

      await Notification.create({
        userId: updated.userId,
        title: "Demolition Request Update",
        message: msg,
        data: { demolitionId: updated._id },
        read: false,
        createdAt: new Date(),
      });

      const io = req.app?.get?.("io");
      if (io) {
        io.to(updated.userId).emit("notification", {
          title: "Demolition Request Update",
          message: msg,
          data: { demolitionId: updated._id },
          createdAt: new Date(),
        });
      }

      res.json(updated);
    } catch (err) {
      console.error("❌ Error updating request:", err);
      res.status(500).json({ error: "Failed to update request" });
    }
  }
);

// DELETE request
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
