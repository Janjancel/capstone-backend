const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/UserModel'); // Adjust path

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google Register/Login
router.post("/", async (req, res) => {
  const { token } = req.body;

  // Verify with Google
  const ticket = await googleClient.verifyIdToken({ 
    idToken: token, 
    audience: process.env.GOOGLE_CLIENT_ID 
  });
  const payload = ticket.getPayload();
  const { email, sub: googleId, name } = payload;

  // Check if user exists
  let user = await User.getUserByEmail(email);

  if (!user) {
    // Register silently
    user = await User.createUser({
      uid: crypto.randomUUID(),
      email,
      username: name,
      googleId,
      verified: true,
      status: "active",
      created_at: new Date()
    });
  }

  // Then always log them in
  const jwtToken = jwt.sign({ id: user.uid, email }, process.env.JWT_SECRET, { expiresIn: "7d" });

  res.json({ success: true, user, token: jwtToken });
});



module.exports = router;
