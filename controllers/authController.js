

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

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already registered." });

    const existingUsername = await User.findOne({ username });
    if (existingUsername) return res.status(400).json({ message: "Username already taken." });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const verificationToken = crypto.randomBytes(32).toString("hex");

    const newUser = new User({
      username,
      email,
      password: hashed,
      isVerified: false,
      verificationToken,
    });

    await newUser.save();

    // Optionally send server-side email as a fallback. Commented out because we're using EmailJS client-side.
    // const link = `${process.env.CLIENT_URL}/verify?token=${verificationToken}&email=${newUser.email}&confirm=yes`;
    // await sendEmail(
    //   newUser.email,
    //   "Verify Your Email",
    //   `<p>We received a request to verify your account.</p>
    //    <a href="${link}">✅ Yes, it's me</a>`
    // );

    // Return verificationToken (frontend will use EmailJS to send the actual email)
    return res.status(200).json({
      message: "User registered. Verification token generated.",
      verificationToken,
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

// exports.verifyEmail = async (req, res) => {
//   try {
//     const { email, token } = req.query;
//     const user = await User.findOne({ email, verificationToken: token });

//     if (!user) return res.status(400).json({ message: "Invalid or expired token." });

//     user.isVerified = true;
//     user.verificationToken = null;
//     await user.save();

//     res.status(200).json({ message: "Email verified successfully." });
//   } catch (err) {
//     res.status(500).json({ message: "Verification failed." });
//   }
// };

exports.verify = async (req, res) => {
  try {
    const { token, email, confirm } = req.body; // confirm: 'yes' | 'no'

    if (!token || !email || !confirm) {
      return res.status(400).json({ message: "Missing verification parameters." });
    }

    const user = await User.findOne({ email, verificationToken: token });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification link." });
    }

    if (confirm === "yes") {
      user.isVerified = true;
      user.verificationToken = null;
      await user.save();

      return res.status(200).json({ message: "Email verified successfully. You may now log in." });
    } else {
      // The user indicates it's not them. We can clear token and notify admin or mark flag.
      user.isVerified = false;
      user.verificationToken = null;
      user.unverifiedReport = true; // optional flag on user model (create if you want)
      await user.save();

      // Optionally: alert admins / create a support ticket here

      return res.status(200).json({
        message:
          "Marked as not verified. If this account was created without your consent, please contact support.",
      });
    }
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ message: "Server error during verification." });
  }
};