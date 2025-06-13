const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/authMiddleware');
const User = require('../../models/UserModel');

// POST /api/auth/role - Get user role (for role-based access control)
router.get('/', verifyToken, async (req, res) => {
  try {
    const user = await User.getUserById(req.user.uid);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, role: user.role });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve user role.' });
  }
});

module.exports = router;
