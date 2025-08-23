const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/UserModel'); // Adjust path

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google Register/Login
router.post('/', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Google token is required' });
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ success: false, message: 'Invalid Google token' });
    }

    const { email, sub: googleId, name, picture } = payload;

    // Check if user exists
    let user = await User.getUserByEmail(email);
    if (!user) {
      user = await User.createUser({
        uid: crypto.randomUUID(),
        email,
        username: name || email.split('@')[0],
        role: 'user',
        status: 'active',
        created_at: new Date(),
        password: null, // No password since Google login
        verified: true,
        googleId,
        avatar: picture || null,
      });
    }

    // Generate JWT
    const jwtToken = jwt.sign(
      { id: user.uid, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Google login successful',
      user,
      token: jwtToken,
    });

  } catch (err) {
    console.error('Google Auth Error:', err.message || err);
    res.status(500).json({ success: false, message: 'Google login failed. Please try again.' });
  }
});

module.exports = router;
