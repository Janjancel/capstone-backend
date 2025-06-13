// const express = require('express');
// const router = express.Router();
// const User = require('../models/User');
// const bcrypt = require('bcrypt');
// const authMiddleware = require('../middleware/authMiddleware');

// // ✅ GET /api/users/statuses - Get status and lastLogin for all users
// router.get('/statuses', async (req, res) => {
//   try {
//     const users = await User.find({}, 'status lastLogin');
//     const statusMap = {};

//     users.forEach(user => {
//       statusMap[user._id] = {
//         status: user.status,
//         lastLogin: user.lastLogin
//       };
//     });

//     res.json(statusMap);
//   } catch (err) {
//     console.error("Error fetching statuses:", err);
//     res.status(500).json({ error: "Failed to retrieve user statuses." });
//   }
// });


// // ✅ PUT /api/users/update-password - Update password (protected)
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


// // Must be above /:id
// // ✅ Must be first to avoid conflict
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

// // ✅ All other routes follow
// router.get('/:id', async (req, res) => {
//   try {
//     const user = await User.findById(req.params.id).select("-password");
//     if (!user) return res.status(404).json({ message: 'User not found' });
//     res.json(user);
//   } catch (err) {
//     console.error("Error fetching user by ID:", err);
//     res.status(500).json({ message: 'Server error.' });
//   }
// });




// // GET /api/users/status/:userId
// router.get('/status/:userId', async (req, res) => {
//   try {
//     const user = await User.findById(req.params.userId);
//     res.json({ status: user?.status || 'offline' });
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to fetch user status' });
//   }
// });

// // GET /api/carts/:userId
// router.get('/:userId', async (req, res) => {
//   try {
//     const cart = await Cart.findOne({ userId: req.params.userId });
//     res.json(cart || { cartItems: [] });
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to fetch cart' });
//   }
// });

// // POST /api/users/upload-profile-picture
// router.post("/upload-profile-picture", async (req, res) => {
//   const { userId, imageBase64 } = req.body;

//   if (!userId || !imageBase64) {
//     return res.status(400).json({ message: "Missing userId or image data" });
//   }

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

// module.exports = router;

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Cart = require('../models/Cart');
const bcrypt = require('bcrypt');
const authMiddleware = require('../middleware/authMiddleware');

// ✅ GET /api/users/statuses - Get status and lastLogin for all users
router.get('/statuses', async (req, res) => {
  try {
    const users = await User.find({}, 'status lastLogin');
    const statusMap = {};

    users.forEach(user => {
      statusMap[user._id] = {
        status: user.status,
        lastLogin: user.lastLogin
      };
    });

    res.json(statusMap);
  } catch (err) {
    console.error("Error fetching statuses:", err);
    res.status(500).json({ error: "Failed to retrieve user statuses." });
  }
});

// ✅ GET /api/users/status/:userId - Get single user status
router.get('/status/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    res.json({ status: user?.status || 'offline' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user status' });
  }
});

// ✅ PUT /api/users/update-password - Update password (auth required)
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

// ✅ GET /api/users/me - Get authenticated user profile
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

// ✅ GET /api/users/:id - Get user profile by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error("Error fetching user by ID:", err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ✅ POST /api/users/upload-profile-picture
router.post("/upload-profile-picture", async (req, res) => {
  const { userId, imageBase64 } = req.body;

  if (!userId || !imageBase64) {
    return res.status(400).json({ message: "Missing userId or image data" });
  }

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

// Admin route example
router.get("/admin", authMiddleware, async (req, res) => {
  // Only admin can access
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }

  // Fetch some admin-related data
  try {
    const adminData = await Admin.find({});
    res.json(adminData);
  } catch (err) {
    res.status(500).json({ message: "Error fetching admin data." });
  }
});


// routes/users.js
router.get("/", async (req, res) => {
  try {
    const users = await User.find({}, "_id email displayName"); // Limit fields
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});


module.exports = router;
