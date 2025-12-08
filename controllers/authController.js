

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




// // Login user
// exports.login = async (req, res) => {
//   try {
//     const { identifier, password } = req.body;

//     if (!identifier || !password) {
//       return res.status(400).json({ message: 'Email/Username and password are required.' });
//     }

//     const user = await User.findOne({
//       $or: [{ email: identifier }, { username: identifier }]
//     });

//     if (!user) {
//       return res.status(401).json({ message: 'Invalid credentials.' });
//     }

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(401).json({ message: 'Incorrect password.' });
//     }

//     const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
//       expiresIn: '1h',
//     });

//     // Update status to online and log the login time
//     user.status = 'online';
//     user.lastLogin = new Date();
//     await user.save();

//     res.status(200).json({
//       token,
//       user: {
//         _id: user._id,
//         email: user.email,
//         username: user.username,
//         role: user.role,
//       },
//     });
//   } catch (error) {
//     console.error('❌ Login error:', error);
//     res.status(500).json({ message: 'Server error.' });
//   }
// };
// Login user
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Email/Username and password are required." });
    }

    // Search for user by email (case-insensitive) or username
    const identifierTrimmed = String(identifier).trim();
    const isEmail = /\S+@\S+\.\S+/.test(identifierTrimmed);
    let user = null;

    if (isEmail) {
      // case-insensitive email match
      user = await User.findOne({ email: { $regex: `^${identifierTrimmed}$`, $options: "i" } });
    } else {
      // try username exact match first, then try email fallback
      user = await User.findOne({ username: identifierTrimmed }) || await User.findOne({ email: { $regex: `^${identifierTrimmed}$`, $options: "i" } });
    }

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // If you have email verification: check and return helpful error
    if (user.isVerified === false) {
      return res.status(403).json({ message: "Account not verified. Please verify your email." });
    }

    // Compare password
    let isMatch = false;
    if (user.password) {
      try {
        // bcrypt.compare returns false if not a valid hash or doesn't match
        isMatch = await bcrypt.compare(password, user.password);
      } catch (compareErr) {
        // If compare throws (malformed hash) fall through to fallback
        console.warn("bcrypt compare error (falling back):", compareErr);
        isMatch = false;
      }
    }

    // Fallback for legacy/plain-text passwords (ONLY if bcrypt compare failed)
    if (!isMatch && user.password && (password === user.password)) {
      // plain equality (legacy) -> treat as match but log a warning
      console.warn(`Legacy plaintext password detected for user ${user._id}. Consider migrating to hashed passwords.`);
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    // Sign JWT (adjust payload claims as needed)
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    });

    // Update status to online and log the login time
    user.status = "online";
    user.lastLogin = new Date();
    // don't store token on user document here (unless you want refresh tokens)
    await user.save();

    // Respond with token and minimal user data
    res.status(200).json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        // add other safe public fields if needed:
        // avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Server error." });
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

