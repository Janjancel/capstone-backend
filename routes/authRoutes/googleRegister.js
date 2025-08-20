const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/UserModel'); // Adjust path

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: 'Token required' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, sub: googleId, name } = payload;

    let user = await User.getUserByEmail(email);
    if (!user) {
      user = await User.createUser({
        uid: crypto.randomUUID(),
        email,
        username: name,
        role: 'user',
        status: 'active',
        created_at: new Date(),
        password: null,
        verified: true,
        googleId,
      });
    }

    const jwtToken = jwt.sign(
      { id: user.uid, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ success: true, user, token: jwtToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Google login failed' });
  }
});

module.exports = router;
