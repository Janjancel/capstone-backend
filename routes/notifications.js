// backend/routes/notifications.js
const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");


router.post("/", async (req, res) => {
  try {
    const notification = new Notification(req.body);
    await notification.save();
    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ message: "Failed to create notification" });
  }
});

router.get("/users/:userId/notifications", async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: "Failed to get notifications" });
  }
});

router.patch("/users/:userId/notifications/:notifId", async (req, res) => {
  try {
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.notifId, userId: req.params.userId },
      { read: true },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to mark as read" });
  }
});

router.delete("/users/:userId/notifications", async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.params.userId });
    res.json({ message: "All notifications cleared" });
  } catch (err) {
    res.status(500).json({ message: "Failed to clear notifications" });
  }
});

// ✅ Get all notifications (for admin dashboard)
router.get("/", async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});


module.exports = router;
