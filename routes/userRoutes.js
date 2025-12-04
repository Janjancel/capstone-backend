
// const express = require('express');
// const router = express.Router();
// const User = require('../models/User');
// const Cart = require('../models/Cart');
// const bcrypt = require('bcrypt');
// const authMiddleware = require('../middleware/authMiddleware');

// // ======================
// // GET /api/users/statuses
// // Get status and lastLogin for all users
// // ======================
// router.get('/statuses', authMiddleware, async (req, res) => {
//   try {
//     const users = await User.find({}, 'status lastLogin');
//     const statusMap = {};
//     users.forEach(user => {
//       statusMap[user._id] = { status: user.status, lastLogin: user.lastLogin };
//     });
//     res.json(statusMap);
//   } catch (err) {
//     console.error("Error fetching statuses:", err);
//     res.status(500).json({ error: "Failed to retrieve user statuses." });
//   }
// });

// // ======================
// // PATCH /api/users/status/:userId
// // Update user status (online/offline)
// // ======================
// router.patch('/status/:userId', authMiddleware, async (req, res) => {
//   const { status } = req.body;
//   try {
//     const user = await User.findById(req.params.userId);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     user.status = status;
//     await user.save();
//     res.json({ message: "Status updated successfully" });
//   } catch (err) {
//     console.error("Failed to update user status:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // ======================
// // PUT /api/users/update-password
// // Update password for authenticated user
// // ======================
// router.put('/update-password', authMiddleware, async (req, res) => {
//   const { currentPassword, newPassword } = req.body;
//   try {
//     const user = await User.findById(req.user.id);
//     if (!user) return res.status(404).json({ message: "User not found." });

//     const isMatch = await bcrypt.compare(currentPassword, user.password);
//     if (!isMatch) return res.status(401).json({ message: "Current password is incorrect." });

//     user.password = await bcrypt.hash(newPassword, 10);
//     await user.save();
//     res.json({ message: "Password updated successfully." });
//   } catch (err) {
//     console.error("Password update error:", err);
//     res.status(500).json({ message: "Server error." });
//   }
// });

// // ======================
// // GET /api/users/me
// // Get profile of authenticated user
// // ======================
// router.get("/me", authMiddleware, async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id).select("-password");
//     if (!user) return res.status(404).json({ message: "User not found" });
//     res.json(user);
//   } catch (err) {
//     console.error("Error fetching /me:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // ======================
// // GET /api/users/:id
// // Get user profile by ID
// // ======================
// router.get('/:id', authMiddleware, async (req, res) => {
//   try {
//     const user = await User.findById(req.params.id).select("-password");
//     if (!user) return res.status(404).json({ message: 'User not found' });
//     res.json(user);
//   } catch (err) {
//     console.error("Error fetching user by ID:", err);
//     res.status(500).json({ message: 'Server error.' });
//   }
// });

// // ======================
// // POST /api/users/upload-profile-picture
// // ======================
// router.post("/upload-profile-picture", authMiddleware, async (req, res) => {
//   const { userId, imageBase64 } = req.body;
//   if (!userId || !imageBase64) return res.status(400).json({ message: "Missing userId or image data" });

//   try {
//     const user = await User.findById(userId);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     user.profilePic = imageBase64;
//     await user.save();
//     res.status(200).json({ message: "Profile picture updated successfully" });
//   } catch (error) {
//     console.error("Upload error:", error);
//     res.status(500).json({ message: "Server error while uploading profile picture" });
//   }
// });

// // ======================
// // GET /api/users/admin
// // Admin-only route example
// // ======================
// router.get("/admin", authMiddleware, async (req, res) => {
//   if (req.user.role !== "admin") return res.status(403).json({ message: "Access denied. Admins only." });
//   try {
//     const adminData = await Admin.find({});
//     res.json(adminData);
//   } catch (err) {
//     console.error("Error fetching admin data:", err);
//     res.status(500).json({ message: "Error fetching admin data." });
//   }
// });

// // ======================
// // GET /api/users/
// // Get all users (for AccountsDashboard)
// // ======================
// router.get("/", authMiddleware, async (req, res) => {
//   try {
//     const users = await User.find({}, "_id username email status role profilePic");
//     res.json(users);
//   } catch (err) {
//     console.error("Error fetching users:", err);
//     res.status(500).json({ message: "Failed to fetch users" });
//   }
// });

// // ======================
// // PATCH /api/users/role/:userId
// // Update user role (admin-only)
// // ======================
// router.patch('/role/:userId', authMiddleware, async (req, res) => {
//   if (req.user.role !== 'admin') return res.status(403).json({ message: "Access denied. Admins only." });

//   const { role } = req.body;
//   try {
//     const user = await User.findById(req.params.userId);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     user.role = role;
//     await user.save();
//     res.json({ message: "Role updated successfully" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// // ======================
// // DELETE /api/users/:userId
// // Delete user (admin-only)
// // ======================
// router.delete('/:userId', authMiddleware, async (req, res) => {
//   if (req.user.role !== 'admin') return res.status(403).json({ message: "Access denied. Admins only." });

//   try {
//     const user = await User.findByIdAndDelete(req.params.userId);
//     if (!user) return res.status(404).json({ message: "User not found" });
//     res.json({ message: "User deleted successfully" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

// module.exports = router;


// routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Cart = require('../models/Cart');
const bcrypt = require('bcrypt');
const authMiddleware = require('../middleware/authMiddleware');

// New imports for file handling + cloudinary
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary'); // ensure this exports configured cloudinary.uploader

// Multer memory storage (files available as buffer)
const upload = multer({ storage: multer.memoryStorage() });

// Stream upload helper (returns secure_url)
const streamUpload = (fileBuffer, folder = 'users') =>
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

// ======================
// GET /api/users/statuses
// ======================
router.get('/statuses', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({}, 'status lastLogin');
    const statusMap = {};
    users.forEach(user => {
      statusMap[user._id] = { status: user.status, lastLogin: user.lastLogin };
    });
    res.json(statusMap);
  } catch (err) {
    console.error("Error fetching statuses:", err);
    res.status(500).json({ error: "Failed to retrieve user statuses." });
  }
});

// ======================
// PATCH /api/users/status/:userId
// ======================
router.patch('/status/:userId', authMiddleware, async (req, res) => {
  const { status } = req.body;
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.status = status;
    await user.save();
    res.json({ message: "Status updated successfully" });
  } catch (err) {
    console.error("Failed to update user status:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ======================
// PUT /api/users/update-password
// ======================
router.put('/update-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: "Current password is incorrect." });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("Password update error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

// ======================
// GET /api/users/me
// ======================
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Error fetching /me:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ======================
// GET /api/users/:id
// ======================
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error("Error fetching user by ID:", err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ======================
// POST /api/users/upload-profile-picture
// Accepts multipart/form-data with `profilePic` (file) OR JSON body with imageBase64.
// Uses req.user.id from authMiddleware.
// ======================
router.post(
  "/upload-profile-picture",
  authMiddleware,
  upload.single('profilePic'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // 1) Prefer file upload
      if (req.file && req.file.buffer) {
        try {
          const url = await streamUpload(req.file.buffer, 'users/profilePics');
          user.profilePic = url;
          await user.save();
          return res.status(200).json({ message: "Profile picture updated successfully", profilePic: url });
        } catch (err) {
          console.error("Cloudinary upload error:", err);
          return res.status(500).json({ message: "Failed to upload image" });
        }
      }

      // 2) Fallback: accept base64 in body (imageBase64)
      const { imageBase64 } = req.body;
      if (imageBase64) {
        // imageBase64 should be data URI or raw base64 string
        // If data URI, strip prefix
        let base64Data = imageBase64;
        const matches = base64Data.match(/^data:(image\/\w+);base64,(.+)$/);
        if (matches) base64Data = matches[2];

        const buffer = Buffer.from(base64Data, 'base64');
        if (!buffer || buffer.length === 0) {
          return res.status(400).json({ message: "Invalid base64 image" });
        }

        try {
          const url = await streamUpload(buffer, 'users/profilePics');
          user.profilePic = url;
          await user.save();
          return res.status(200).json({ message: "Profile picture updated successfully", profilePic: url });
        } catch (err) {
          console.error("Cloudinary upload error:", err);
          return res.status(500).json({ message: "Failed to upload image" });
        }
      }

      // No image provided
      return res.status(400).json({ message: "No image provided. Attach a file field named 'profilePic' or send 'imageBase64' in JSON body." });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Server error while uploading profile picture" });
    }
  }
);

// ======================
// GET /api/users/admin
// Admin-only route example (note: ensure Admin model is required if used)
// ======================
router.get("/admin", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Access denied. Admins only." });
  try {
    // If you need Admin data, require the model at top:
    // const Admin = require('../models/Admin');
    const adminData = []; // placeholder
    res.json(adminData);
  } catch (err) {
    console.error("Error fetching admin data:", err);
    res.status(500).json({ message: "Error fetching admin data." });
  }
});

// ======================
// GET /api/users/
// Get all users (for AccountsDashboard)
// ======================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const users = await User.find({}, "_id username email status role profilePic");
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// ======================
// PATCH /api/users/role/:userId
// Update user role (admin-only)
// ======================
router.patch('/role/:userId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Access denied. Admins only." });

  const { role } = req.body;
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.role = role;
    await user.save();
    res.json({ message: "Role updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ======================
// DELETE /api/users/:userId
// Delete user (admin-only)
// ======================
router.delete('/:userId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Access denied. Admins only." });

  try {
    const user = await User.findByIdAndDelete(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
