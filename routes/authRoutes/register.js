const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../../models/UserModel');
const transporter = require('../../config/nodemailer'); // Nodemailer setup

// POST /api/auth/register - Register user and send email verification link
router.post('/', async (req, res) => {
  const { email, username, password } = req.body;

  try {
    const existingUser = await User.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.createUser({
      uid: crypto.randomUUID(),
      email,
      username,
      role: 'user',  // Default role for new users
      status: 'active',  // Default status
      created_at: new Date(),
      password: hashedPassword,
      verified: false,  // Set verified to false initially
    });

    const verificationToken = jwt.sign({ email: newUser.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const verificationUrl = `http://localhost:5000/api/auth/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify Your Email',
      text: `Click the link to verify your email: ${verificationUrl}`,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Error sending verification email.' });
      }
      res.status(200).json({
        success: true,
        message: 'Registration successful. Please check your email for verification.',
      });
    });
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
