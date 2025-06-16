// backend/routes/notifications.js
const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");

// // GET user notifications
// router.get("/users/:userId/notifications", async (req, res) => {
//   try {
//     const notifs = await Notification.find({ userId: req.params.userId }).sort({ createdAt: -1 });
//     res.json(notifs);
//   } catch {
//     res.status(500).json({ message: "Failed to fetch notifications" });
//   }
// });

// // PATCH mark notification as read
// router.patch("/users/:userId/notifications/:notifId", async (req, res) => {
//   try {
//     const updated = await Notification.findByIdAndUpdate(req.params.notifId, { read: true }, { new: true });
//     res.json(updated);
//   } catch {
//     res.status(500).json({ message: "Failed to mark as read" });
//   }
// });

// // DELETE all notifications
// router.delete("/users/:userId/notifications", async (req, res) => {
//   try {
//     await Notification.deleteMany({ userId: req.params.userId });
//     res.json({ message: "Notifications cleared" });
//   } catch {
//     res.status(500).json({ message: "Failed to clear notifications" });
//   }
// });

// // POST create new notification
// router.post("/", async (req, res) => {
//   try {
//     const notif = new Notification({
//       userId: req.body.userId,
//       orderId: req.body.orderId,
//       status: req.body.status,
//       message: req.body.message,
//       role: req.body.role,
//     });

//     await notif.save();
//     res.status(201).json(notif);
//   } catch (err) {
//     console.error("Notification save failed:", err);
//     res.status(500).json({ message: "Failed to create notification" });
//   }
// });

// routes/notifications.js
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



// router.get("/users/:userId/notifications", async (req, res) => {
//   try {
//     console.log("Fetching notifications for:", req.params.userId);
//     const notifications = await Notification.find({ userId: req.params.userId }).sort({ createdAt: -1 });
//     console.log("Found:", notifications.length);
//     res.json(notifications);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to get notifications" });
//   }
// });


module.exports = router;
