

// // routes/notifications.js
// router.post("/", async (req, res) => {
//   try {
//     const notification = new Notification(req.body);
//     await notification.save();
//     res.status(201).json(notification);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to create notification" });
//   }
// });

// router.get("/users/:userId/notifications", async (req, res) => {
//   try {
//     const notifications = await Notification.find({ userId: req.params.userId }).sort({ createdAt: -1 });
//     res.json(notifications);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to get notifications" });
//   }
// });

// router.patch("/users/:userId/notifications/:notifId", async (req, res) => {
//   try {
//     const updated = await Notification.findOneAndUpdate(
//       { _id: req.params.notifId, userId: req.params.userId },
//       { read: true },
//       { new: true }
//     );
//     res.json(updated);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to mark as read" });
//   }
// });

// router.delete("/users/:userId/notifications", async (req, res) => {
//   try {
//     await Notification.deleteMany({ userId: req.params.userId });
//     res.json({ message: "All notifications cleared" });
//   } catch (err) {
//     res.status(500).json({ message: "Failed to clear notifications" });
//   }
// });

// // ✅ Get all notifications (for admin dashboard)
// router.get("/", async (req, res) => {
//   try {
//     const notifications = await Notification.find().sort({ createdAt: -1 });
//     res.json(notifications);
//   } catch (err) {
//     console.error("Error fetching notifications:", err);
//     res.status(500).json({ message: "Failed to fetch notifications" });
//   }
// });


// module.exports = router;

const express = require("express");
const { Redis } = require("@upstash/redis");
const router = express.Router();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Keys
const NOTIF_LIST_KEY = "admin:notifications";

// Fetch all notifications
router.get("/", async (req, res) => {
  try {
    const notifications = (await redis.lrange(NOTIF_LIST_KEY, 0, -1)).map(
      (n) => JSON.parse(n)
    );
    res.json(notifications);
  } catch (err) {
    console.error("Redis fetch notifications error:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark as read
router.patch("/:id/read", async (req, res) => {
  try {
    const notifications = (await redis.lrange(NOTIF_LIST_KEY, 0, -1)).map(
      (n) => JSON.parse(n)
    );

    const updated = notifications.map((n) =>
      n.id === req.params.id ? { ...n, read: true } : n
    );

    await redis.del(NOTIF_LIST_KEY);
    if (updated.length > 0) {
      await redis.lpush(
        NOTIF_LIST_KEY,
        ...updated.map((n) => JSON.stringify(n))
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Redis mark read error:", err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

// Clear notifications
router.delete("/clear", async (req, res) => {
  try {
    await redis.del(NOTIF_LIST_KEY);
    res.json({ success: true });
  } catch (err) {
    console.error("Redis clear notifications error:", err);
    res.status(500).json({ error: "Failed to clear notifications" });
  }
});

module.exports = router;
