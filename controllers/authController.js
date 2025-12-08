

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register user
// exports.register = async (req, res) => {
//   try {
//     const { username, email, password } = req.body;

//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({ message: 'Email already registered.' });
//     }

//     const newUser = new User({
//       username,
//       email,
//       password, // plain text — the schema will hash it
//       role: 'client',
//       status: 'offline',
//       lastLogin: null,
//     });


//     await newUser.save();
//     res.status(201).json({ message: 'User registered successfully.' });
//   } catch (error) {
//     console.error('❌ Registration error:', error);
//     res.status(500).json({ message: 'Server error.' });
//   }
// };

const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
// const User = require("../models/User"); // Make sure this is included

// exports.register = async (req, res) => {
//   try {
//     const { username, email, password } = req.body;

//     const existingUser = await User.findOne({ email });
//     if (existingUser) return res.status(400).json({ message: "Email already registered." });

//     const verificationToken = crypto.randomBytes(32).toString("hex");

//     const newUser = new User({
//       username,
//       email,
//       password,
//       isVerified: false,
//       verificationToken,
//     });

//     await newUser.save();

//     const link = `${process.env.CLIENT_URL}/verify?token=${verificationToken}&email=${newUser.email}&confirm=yes`;


//     await sendEmail(
//       newUser.email,
//       "Verify Your Email",
//       `
//         <p>We received a request to verify your account.</p>
//         <a href="${process.env.CLIENT_URL}/verify?token=${verificationToken}&email=${newUser.email}&confirm=yes" style="margin-right:10px;">✅ Yes, it's me</a>
//         <a href="${process.env.CLIENT_URL}/verify?token=${verificationToken}&email=${newUser.email}&confirm=no">❌ No, it's not me</a>
//       `
//     );

//     res.status(200).json({ message: "Verification email sent. Please check your inbox." });
//   } catch (error) {
//     console.error("❌ Registration error:", error);
//     res.status(500).json({ message: "Server error." });
//   }
// };

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // simple validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email and password are required." });
    }

    // check existing email
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already registered." });

    // hash password
    const saltRounds = Number(process.env.SALT_ROUNDS) || 10;
    const hashed = await bcrypt.hash(password, saltRounds);

    // create user (no verification token)
    const newUser = new User({
      username,
      email,
      password: hashed,
      isVerified: true, // set true for "pure registration" (change if you want false)
    });

    await newUser.save();

    // optionally generate a JWT token and return it
    const tokenPayload = { id: newUser._id, email: newUser.email, username: newUser.username };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || "change_this_secret", {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    // remove password before returning user object
    const userToReturn = newUser.toObject();
    delete userToReturn.password;

    res.status(201).json({
      message: "Registration successful.",
      user: userToReturn,
      token,
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    res.status(500).json({ message: "Server error." });
  }
};




// Login user
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email/Username and password are required.' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    // Update status to online and log the login time
    user.status = 'online';
    user.lastLogin = new Date();
    await user.save();

    res.status(200).json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { email, token } = req.query;
    const user = await User.findOne({ email, verificationToken: token });

    if (!user) return res.status(400).json({ message: "Invalid or expired token." });

    user.isVerified = true;
    user.verificationToken = null;
    await user.save();

    res.status(200).json({ message: "Email verified successfully." });
  } catch (err) {
    res.status(500).json({ message: "Verification failed." });
  }
};

