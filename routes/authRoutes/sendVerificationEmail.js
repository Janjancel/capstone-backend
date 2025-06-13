const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const User = require('../../models/UserModel');
const transporter = require('../../config/nodemailer');  // Nodemailer setup

// POST /api/auth/send-verification-email - Send email verification link
router.post('/', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.verified) {
      return res.status(400).json({ success: false, message: 'Email already verified' });
    }

    const verificationToken = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
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
      res.status(200).json({ success: true, message: 'Verification email sent.' });
    });
  } catch (err) {
    console.error('Error sending verification email:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
