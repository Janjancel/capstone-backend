// const express = require("express");
// const router = express.Router();
// const jwt = require("jsonwebtoken");
// const User = require("../../models/User");
// const bcrypt = require("bcrypt");

// // ✅ POST /api/auth/register
// router.post("/register", async (req, res) => {
//   const { username, email, password } = req.body;

//   try {
//     const emailExists = await User.findOne({ email });
//     if (emailExists) {
//       return res.status(400).json({ message: "Email is already in use" });
//     }

//     const usernameExists = await User.findOne({ username });
//     if (usernameExists) {
//       return res.status(400).json({ message: "Username is already taken" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const user = new User({
//       username,
//       email,
//       password: hashedPassword,
//       role: "client",
//       status: "online",
//       lastLogin: new Date(),
//     });

//     await user.save();
//     res.status(201).json({ message: "User registered successfully" });
//   } catch (err) {
//     console.error("❌ Registration error:", err);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });

// // ✅ POST /api/auth/login
// // router.post("/login", async (req, res) => {
// //   const { identifier, password } = req.body;

// //   try {
// //     const query = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
// //       ? { email: identifier }
// //       : { username: identifier };

// //     const user = await User.findOne(query);
// //     if (!user) return res.status(401).json({ message: "User not found." });

// //     const lastLogin = user.lastLogin || new Date(0);
// //     const mins = Math.floor((Date.now() - lastLogin.getTime()) / 60000);
// //     if (user.status === "online" && mins <= 30) {
// //       return res.status(401).json({ message: "This account is already logged in." });
// //     }

// //     // const isMatch = await bcrypt.compare(password, user.password);
// //     // if (!isMatch) return res.status(401).json({ message: "Incorrect password." });
// //         // Check password
// //     const isMatch = await bcrypt.compare(password, user.password);
// //     if (!isMatch) {
// //       return res.status(401).json({ message: "Incorrect password. Please try again." });
// //     }

// //     user.status = "online";
// //     user.lastLogin = new Date();
// //     await user.save();

// //     const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

// //     res.json({
// //       token,
// //       user: {
// //         _id: user._id,
// //         username: user.username,
// //         email: user.email,
// //         role: user.role,
// //       },
// //     });
// //   } catch (err) {
// //     console.error("❌ Login error:", err);
// //     res.status(500).json({ message: "Server error." });
// //   }
// // });
// router.post("/login", async (req, res) => {
//   const { identifier, password } = req.body;

//   try {
//     const user = await User.findOne({
//       $or: [{ email: identifier }, { username: identifier }],
//     });

//     if (!user) {
//       return res.status(401).json({ message: "No user found with this email or username." });
//     }

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(401).json({ message: "Incorrect password." });
//     }

//     const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
//       expiresIn: "1h",
//     });

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
//     console.error("Login error:", error);
//     res.status(500).json({ message: "Server error. Try again later." });
//   }
// });


// module.exports = router;
const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const router = express.Router();
const { register, login, verifyEmail } = require("../../controllers/authController");
const User = require("../../models/User");

  // Routes
router.post("/register", register);
router.post("/login", login);
router.get("/verify", verifyEmail);

router.post("/logout", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    await User.findByIdAndUpdate(userId, { status: "offline" });
    res.json({ message: "Logged out successfully." });
  } catch (error) {
    console.error("❌ Logout error:", error);
    res.status(500).json({ message: "Server error during logout." });
  }
});


  // POST /api/auth/status-check
router.post('/status-check', async (req, res) => {
  const { identifier } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ status: user.status });
  } catch (err) {
    console.error("Error checking status:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// @route POST /api/auth/google
router.post("/google", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "No token provided" });

    // ✅ Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    // ✅ Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // Since password is required in your schema,
      // we generate a random one that won't actually be used.
      const randomPassword = Math.random().toString(36).slice(-8);

      user = new User({
        email,
        username: name.replace(/\s+/g, "").toLowerCase(), // make it unique-ish
        password: randomPassword,
        profilePic: picture, // ✅ matches your schema field
        isVerified: true,    // Google emails are trusted
      });

      await user.save();
    }

    // ✅ Update status & last login
    user.status = "online";
    user.lastLogin = new Date();
    await user.save();

    // ✅ Generate JWT
    const userToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token: userToken,
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        profilePic: user.profilePic,
      },
    });
  } catch (err) {
    console.error("❌ Google auth error:", err);
    res.status(500).json({ message: "Google login failed." });
  }
});


  module.exports = router;
