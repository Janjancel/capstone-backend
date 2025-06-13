const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../../models/UserModel');

// GET /api/auth/verify-email - Verify email using the token in the query string
router.get('/', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Token is required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.getUserByEmail(decoded.email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.verified = true;
    await user.save();

    res.status(200).json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification failed:', error);
    res.status(400).json({ success: false, message: 'Invalid or expired token' });
  }
});

module.exports = router;
