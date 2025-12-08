// const express = require('express');
// const router = express.Router();
// const bcrypt = require('bcryptjs');
// const crypto = require('crypto');
// const jwt = require('jsonwebtoken');
// const User = require('../../models/UserModel');
// const transporter = require('../../config/nodemailer'); // Nodemailer setup

// // POST /api/auth/register - Register user and send email verification link
// router.post('/', async (req, res) => {
//   const { email, username, password } = req.body;

//   try {
//     const existingUser = await User.getUserByEmail(email);
//     if (existingUser) {
//       return res.status(400).json({ success: false, message: 'Email already registered.' });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const newUser = await User.createUser({
//       uid: crypto.randomUUID(),
//       email,
//       username,
//       role: 'user',  // Default role for new users
//       status: 'active',  // Default status
//       created_at: new Date(),
//       password: hashedPassword,
//       verified: false,  // Set verified to false initially
//     });

//     const verificationToken = jwt.sign({ email: newUser.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

//     const verificationUrl = `http://localhost:5000/api/auth/verify-email?token=${verificationToken}`;

//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: 'Verify Your Email',
//       text: `Click the link to verify your email: ${verificationUrl}`,
//     };

//     transporter.sendMail(mailOptions, (err, info) => {
//       if (err) {
//         return res.status(500).json({ success: false, message: 'Error sending verification email.' });
//       }
//       res.status(200).json({
//         success: true,
//         message: 'Registration successful. Please check your email for verification.',
//       });
//     });
//   } catch (err) {
//     console.error('Error during registration:', err);
//     res.status(500).json({ success: false, message: 'Server error.' });
//   }
// });

// module.exports = router;


// routes/auth/register.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../../models/UserModel"); // <-- adjust if your model path differs
const transporter = require("../../config/nodemailer"); // nodemailer transporter (ensure configured)
const { CLIENT_URL, JWT_SECRET } = process.env;

// Helper to detect model API
const findUserByEmail = async (email) => {
  if (!email) return null;
  // Mongoose-like
  if (typeof User.findOne === "function") {
    return User.findOne({ email }).exec ? await User.findOne({ email }) : await User.findOne({ email });
  }
  // Custom DAO-like
  if (typeof User.getUserByEmail === "function") {
    return await User.getUserByEmail(email);
  }
  return null;
};

const createNewUser = async (userObj) => {
  // If model supports createUser (custom wrapper)
  if (typeof User.createUser === "function") {
    return await User.createUser(userObj);
  }
  // If using Mongoose model constructor
  if (typeof User.create === "function") {
    return await User.create(userObj);
  }
  // fallback to new User(...) .save()
  const maybe = new User(userObj);
  return await maybe.save();
};

// POST /api/auth/register
router.post("/", async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json({ success: false, message: "email, username and password are required." });
    }

    // Check existing user
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already registered." });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Build user record (adjust fields as your schema expects)
    const userPayload = {
      email,
      username,
      password: hashedPassword,
      role: "user",
      status: "active",
      created_at: new Date(),
      verified: false,
      // add additional fields your schema requires (e.g. uid)
    };

    // Try to create user
    const newUser = await createNewUser(userPayload);

    // Create verification token (use JWT so you can verify later)
    if (!JWT_SECRET) {
      console.error("JWT_SECRET env not defined — cannot create verification token.");
      return res.status(500).json({ success: false, message: "Server misconfiguration." });
    }

    const verificationToken = jwt.sign({ email: newUser.email }, JWT_SECRET, { expiresIn: "1h" });

    const clientUrl = CLIENT_URL || "http://localhost:3000";
    const verificationUrl = `${clientUrl}/verify?token=${verificationToken}&email=${encodeURIComponent(newUser.email)}&confirm=yes`;

    // Prepare email
    const mailOptions = {
      from: process.env.EMAIL_USER || "no-reply@example.com",
      to: newUser.email,
      subject: "Verify Your Email",
      html: `
        <p>Thanks for registering, ${newUser.username}.</p>
        <p>Please click the link below to verify your email address:</p>
        <p><a href="${verificationUrl}">Verify my account</a></p>
        <p>If you did not create an account, ignore this email.</p>
      `,
    };

    // Send email (await so we can catch failures)
    if (!transporter || typeof transporter.sendMail !== "function") {
      console.error("Email transporter not configured correctly:", transporter);
      // still return success for account creation, but inform admin/dev
      return res.status(500).json({ success: false, message: "Email transporter not configured. Contact admin." });
    }

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("Verification email sent:", info.messageId || info);
    } catch (mailErr) {
      console.error("Error sending verification email:", mailErr);
      // Option A: delete created user if email failed — uncomment if desired
      // if (newUser && newUser._id && typeof User.deleteOne === 'function') {
      //   await User.deleteOne({ _id: newUser._id });
      // }
      return res.status(500).json({ success: false, message: "Failed to send verification email." });
    }

    return res.status(200).json({
      success: true,
      message: "Registration successful. Please check your email for verification.",
    });
  } catch (err) {
    console.error("Error during registration:", err);
    // More detailed error messages may leak sensitive info; keep generic in production
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

module.exports = router;
