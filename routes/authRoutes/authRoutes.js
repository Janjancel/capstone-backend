
// const express = require("express");
// const jwt = require("jsonwebtoken");
// const { OAuth2Client } = require("google-auth-library");
// const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
// const router = express.Router();
// const { register, login, verifyEmail } = require("../../controllers/authController");
// const User = require("../../models/User");

//   // Routes
// router.post("/register", register);
// router.post("/login", login);
// router.get("/verify", verifyEmail);

// router.post("/logout", async (req, res) => {
//   const { userId } = req.body;

//   if (!userId) {
//     return res.status(400).json({ message: "User ID is required." });
//   }

//   try {
//     await User.findByIdAndUpdate(userId, { status: "offline" });
//     res.json({ message: "Logged out successfully." });
//   } catch (error) {
//     console.error("❌ Logout error:", error);
//     res.status(500).json({ message: "Server error during logout." });
//   }
// });


//   // POST /api/auth/status-check
// router.post('/status-check', async (req, res) => {
//   const { identifier } = req.body;

//   try {
//     const user = await User.findOne({
//       $or: [{ email: identifier }, { username: identifier }]
//     });

//     if (!user) return res.status(404).json({ message: "User not found" });

//     res.json({ status: user.status });
//   } catch (err) {
//     console.error("Error checking status:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });


// // @route POST /api/auth/google
// router.post("/google", async (req, res) => {
//   try {
//     const { token } = req.body;
//     if (!token) return res.status(400).json({ message: "No token provided" });

//     // ✅ Verify Google token safely
//     let payload;
//     try {
//       const ticket = await client.verifyIdToken({
//         idToken: token,
//         audience: process.env.GOOGLE_CLIENT_ID,
//       });
//       payload = ticket.getPayload();
//     } catch (verifyError) {
//       console.error("❌ Google token verification failed:", verifyError);
//       return res.status(400).json({ message: "Invalid Google token." });
//     }

//     const { email, name, picture } = payload;

//     // ✅ Check if user exists
//     let user = await User.findOne({ email });

//     if (!user) {
//       // Generate random password (Google users won't use it)
//       const randomPassword = Math.random().toString(36).slice(-8);

//       // Ensure username uniqueness by appending timestamp
//       const uniqueUsername = name.replace(/\s+/g, "").toLowerCase() + Date.now();

//       user = new User({
//         email,
//         username: uniqueUsername,
//         password: randomPassword,
//         profilePic: picture,
//         isVerified: true,
//       });

//       await user.save();
//     }

//     // ✅ Update status & last login
//     user.status = "online";
//     user.lastLogin = new Date();
//     await user.save();

//     // ✅ Generate JWT
//     const userToken = jwt.sign(
//       { id: user._id, role: user.role },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     res.json({
//       token: userToken,
//       user: {
//         _id: user._id,
//         email: user.email,
//         username: user.username,
//         role: user.role,
//         profilePic: user.profilePic,
//       },
//     });
//   } catch (err) {
//     console.error("❌ Google auth error:", err.stack || err);
//     res.status(500).json({ message: "Google login failed." });
//   }
// });


// module.exports = router;

const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const router = express.Router();
const { register, login, verifyEmail } = require("../../controllers/authController");
const User = require("../../models/User");

// Initialize Google OAuth client
if (!process.env.GOOGLE_CLIENT_ID) {
  console.error("❌ GOOGLE_CLIENT_ID is missing in environment variables!");
}
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// =====================
// Standard Auth Routes
// =====================
router.post("/register", register);
router.post("/login", login);
router.get("/verify", verifyEmail);

// =====================
// Logout
// =====================
router.post("/logout", async (req, res) => {
  const { userId } = req.body;

  if (!userId) return res.status(400).json({ message: "User ID is required." });

  try {
    await User.findByIdAndUpdate(userId, { status: "offline" });
    res.json({ message: "Logged out successfully." });
  } catch (error) {
    console.error("❌ Logout error:", error.stack || error);
    res.status(500).json({ message: "Server error during logout." });
  }
});

// =====================
// Status Check
// =====================
router.post("/status-check", async (req, res) => {
  const { identifier } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ status: user.status });
  } catch (err) {
    console.error("❌ Error checking status:", err.stack || err);
    res.status(500).json({ message: "Server error" });
  }
});

// =====================
// Google OAuth Login
// =====================



// JWT helper
const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// GOOGLE LOGIN
// router.post("/google", async (req, res) => {
//   const { token: googleToken } = req.body;

//   if (!googleToken) return res.status(400).json({ message: "No token provided." });

//   try {
//     const ticket = await client.verifyIdToken({
//       idToken: googleToken,
//       audience: process.env.GOOGLE_CLIENT_ID,
//     });

//     const payload = ticket.getPayload();
//     const { email, name, picture } = payload;

//     let user = await User.findOne({ email });

//     if (!user) {
//       // Create a new user if not exists
//       user = new User({
//         username: name.replace(/\s+/g, "").toLowerCase(),
//         email,
//         password: Math.random().toString(36).slice(-8), // random password
//         isVerified: true,
//         profilePic: picture,
//       });
//       await user.save();
//     }

//     const jwtToken = generateToken(user);

//     user.lastLogin = new Date();
//     await user.save();

//     res.json({ token: jwtToken, user });
//   } catch (err) {
//     console.error("Google login error:", err);
//     res.status(500).json({ message: "Google authentication failed." });
//   }
// });

router.post("/google", async (req, res) => {
  const { token: googleToken } = req.body;

  if (!googleToken) 
    return res.status(400).json({ message: "No token provided." });

  try {
    // Verify Google ID token
    const ticket = await client.verifyIdToken({
      idToken: googleToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase(); // ✅ lowercase
    const { name, picture } = payload;

    // Find existing user
    let user = await User.findOne({ email });

    if (!user) {
      // Create a new user if not exists
      user = new User({
        username: name.replace(/\s+/g, "").toLowerCase(),
        email,
        password: Math.random().toString(36).slice(-8), // random password
        isVerified: true,
        profilePic: picture,
      });
      await user.save();
    }

    // Generate JWT token
    const jwtToken = generateToken(user);

    // Update status to online and log last login
    user.status = "online";
    user.lastLogin = new Date();
    await user.save();

    // Respond with token and user info
    res.status(200).json({
      token: jwtToken,
      user: {
        _id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
        profilePic: user.profilePic,
        lastLogin: user.lastLogin,
      },
    });
  } catch (err) {
    console.error("Google login error:", err);
    res.status(500).json({ message: "Google authentication failed." });
  }
});


module.exports = router;

