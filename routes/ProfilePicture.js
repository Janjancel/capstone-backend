const express = require("express");
const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Assuming you have a User model

const router = express.Router();

// Setup multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Folder where images will be saved
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});

const upload = multer({ storage: storage });

// POST: Upload profile picture
router.post("/upload-profile-picture", upload.single("profilePicture"), async (req, res) => {
  try {
    const { userId } = req.body;

    // Check if the Authorization header is present
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "No token provided" });

    const token = authHeader.split(" ")[1]; // Extract token from "Bearer <token>"

    // Verify the token
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }

      // Verify userId matches the decoded token's user ID
      if (decoded.userId !== userId) {
        return res.status(403).json({ message: "User not authorized" });
      }

      // Find user and update profile picture URL
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Save the image URL (store the file path)
      const profilePicUrl = `/uploads/${req.file.filename}`; // Assuming you're serving static files from `uploads` folder
      user.profilePic = profilePicUrl;

      await user.save();

      res.status(200).json({ message: "Profile picture uploaded successfully", profilePicUrl });
    });
  } catch (err) {
    console.error("Error uploading profile picture:", err);
    res.status(500).json({ message: "Failed to upload profile picture" });
  }
});

module.exports = router;
