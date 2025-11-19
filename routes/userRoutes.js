
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


const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Cart = require('../models/Cart');
// const Admin = require('../models/Admin'); // kept because original router referenced it
const bcrypt = require('bcrypt');
const authMiddleware = require('../middleware/authMiddleware');

// Helper phone regex (E.164-ish)
const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

// ======================
// GET /api/users/statuses
// Get status and lastLogin for all users
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
// Update user status (online/offline)
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
// Update password for authenticated user
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
// Get profile of authenticated user
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
// Get user profile by ID
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
// ======================
router.post("/upload-profile-picture", authMiddleware, async (req, res) => {
  const { userId, imageBase64 } = req.body;
  if (!userId || !imageBase64) return res.status(400).json({ message: "Missing userId or image data" });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.profilePic = imageBase64;
    await user.save();
    res.status(200).json({ message: "Profile picture updated successfully" });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Server error while uploading profile picture" });
  }
});

// ======================
// GET /api/users/admin
// Admin-only route example
// ======================
router.get("/admin", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Access denied. Admins only." });
  try {
    const adminData = await Admin.find({});
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

/* ======================
   NEW: POST /api/users/personal-info
   Add or update personalInfo for the authenticated user.
   Body: { lastName, firstName, middleInitial?, phoneNumber }
   ====================== */
router.post('/personal-info', authMiddleware, async (req, res) => {
  const { lastName, firstName, middleInitial = null, phoneNumber } = req.body;

  // Basic validation
  if (lastName === undefined || firstName === undefined || phoneNumber === undefined) {
    return res.status(400).json({ message: "lastName, firstName and phoneNumber are required." });
  }

  if (phoneNumber !== null && !PHONE_REGEX.test(String(phoneNumber))) {
    return res.status(400).json({ message: "Invalid phone number format." });
  }

  try {
    // ensure phone is unique (if provided)
    if (phoneNumber !== null) {
      const existing = await User.findOne({ "personalInfo.phoneNumber": phoneNumber, _id: { $ne: req.user.id } });
      if (existing) {
        return res.status(409).json({ message: "Phone number already in use by another account." });
      }
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    user.personalInfo = user.personalInfo || {};
    user.personalInfo.lastName = lastName;
    user.personalInfo.firstName = firstName;
    user.personalInfo.middleInitial = middleInitial;
    user.personalInfo.phoneNumber = phoneNumber;

    await user.save();
    const responseUser = await User.findById(req.user.id).select("-password");
    res.json({ message: "Personal information saved.", user: responseUser });
  } catch (err) {
    console.error("Error saving personal info:", err);
    // handle unique index duplicate key (race condition)
    if (err.code === 11000 && err.keyPattern && err.keyPattern['personalInfo.phoneNumber']) {
      return res.status(409).json({ message: "Phone number already exists." });
    }
    res.status(500).json({ message: "Server error saving personal info." });
  }
});

/* ======================
   NEW: POST /api/users/:userId/personal-info
   Admin-only: add/update personalInfo for another user.
   Body: { lastName, firstName, middleInitial?, phoneNumber }
   ====================== */
router.post('/:userId/personal-info', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: "Access denied. Admins only." });

  const { lastName, firstName, middleInitial = null, phoneNumber } = req.body;

  if (lastName === undefined || firstName === undefined || phoneNumber === undefined) {
    return res.status(400).json({ message: "lastName, firstName and phoneNumber are required." });
  }

  if (phoneNumber !== null && !PHONE_REGEX.test(String(phoneNumber))) {
    return res.status(400).json({ message: "Invalid phone number format." });
  }

  try {
    // ensure phone is unique (if provided)
    if (phoneNumber !== null) {
      const existing = await User.findOne({ "personalInfo.phoneNumber": phoneNumber, _id: { $ne: req.params.userId } });
      if (existing) {
        return res.status(409).json({ message: "Phone number already in use by another account." });
      }
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    user.personalInfo = user.personalInfo || {};
    user.personalInfo.lastName = lastName;
    user.personalInfo.firstName = firstName;
    user.personalInfo.middleInitial = middleInitial;
    user.personalInfo.phoneNumber = phoneNumber;

    await user.save();
    const responseUser = await User.findById(req.params.userId).select("-password");
    res.json({ message: "Personal information saved for user.", user: responseUser });
  } catch (err) {
    console.error("Error saving personal info (admin):", err);
    if (err.code === 11000 && err.keyPattern && err.keyPattern['personalInfo.phoneNumber']) {
      return res.status(409).json({ message: "Phone number already exists." });
    }
    res.status(500).json({ message: "Server error saving personal info." });
  }
});

module.exports = router;
