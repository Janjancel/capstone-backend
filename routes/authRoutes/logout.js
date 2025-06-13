const express = require('express');
const router = express.Router();
const User = require('../../models/UserModel');

// POST /api/auth/logout - Logout user and set status to "offline"
router.post('/', async (req, res) => {
  const { user_id } = req.body;

  try {
    if (!user_id) {
      return res.status(400).json({ success: false, message: 'User ID is required for logout.' });
    }

    await User.updateStatus(user_id, 'offline');
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully and status set to offline.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ success: false, message: 'Failed to update status during logout.' });
  }
});

module.exports = router;
