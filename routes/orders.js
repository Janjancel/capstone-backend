
// const express = require("express");
// const router = express.Router();
// const Order = require("../models/Order");
// const cloudinary = require("../config/cloudinary");
// const multer = require("multer");

// // Multer setup (store file in memory before upload to Cloudinary)
// const storage = multer.memoryStorage();
// const upload = multer({ storage });

// // Create a new order (with file upload)
// router.post("/", upload.array("images"), async (req, res) => {
//   try {
//     let uploadedItems = [];

//     // Upload each image to Cloudinary if provided
//     if (req.files && req.files.length > 0) {
//       uploadedItems = await Promise.all(
//         req.files.map(async (file) => {
//           const result = await cloudinary.uploader.upload_stream(
//             { folder: "orders" },
//             (error, result) => {
//               if (error) throw error;
//               return result.secure_url;
//             }
//           );

//           return result;
//         })
//       );
//     }

//     // Build order items (map body data with uploaded image URLs)
//     const items = JSON.parse(req.body.items).map((item, idx) => ({
//       ...item,
//       image: uploadedItems[idx] || item.image, // fallback if no new image
//     }));

//     const newOrder = new Order({
//       userId: req.body.userId,
//       items,
//       total: items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 0), 0),
//       address: JSON.parse(req.body.address),
//       notes: req.body.notes || "",
//     });

//     await newOrder.save();
//     res.status(201).json(newOrder);
//   } catch (error) {
//     console.error("Order creation error:", error);
//     res.status(500).json({ error: "Failed to create order" });
//   }
// });


// // Get all orders (admin)
// router.get("/", async (req, res) => {
//   try {
//     const orders = await Order.find().populate("userId", "email").sort({ createdAt: -1 });
//     res.json(orders);
//   } catch (error) {
//     console.error("Fetch all orders error:", error);
//     res.status(500).json({ error: "Failed to fetch orders" });
//   }
// });

// // Get orders for a specific user
// router.get("/user/:userId", async (req, res) => {
//   try {
//     const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 });
//     res.json(orders);
//   } catch (error) {
//     console.error("Fetch user orders error:", error);
//     res.status(500).json({ error: "Failed to fetch user orders" });
//   }
// });

// // Get order by ID
// router.get("/:id", async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.id).populate("userId", "email");
//     if (!order) return res.status(404).json({ error: "Order not found" });
//     res.json(order);
//   } catch (error) {
//     console.error("Fetch order by ID error:", error);
//     res.status(500).json({ error: "Failed to fetch order" });
//   }
// });

// // Update order status
// router.put("/:id/status", async (req, res) => {
//   const { status } = req.body;
//   try {
//     const updatedOrder = await Order.findByIdAndUpdate(
//       req.params.id,
//       { status },
//       { new: true }
//     );
//     if (!updatedOrder) return res.status(404).json({ error: "Order not found" });
//     res.json(updatedOrder);
//   } catch (error) {
//     console.error("Update order status error:", error);
//     res.status(500).json({ error: "Failed to update order status" });
//   }
// });

// // Request order cancellation
// router.patch("/:id/cancel", async (req, res) => {
//   try {
//     const updatedOrder = await Order.findByIdAndUpdate(
//       req.params.id,
//       { status: "Cancellation Requested", cancelledAt: new Date() },
//       { new: true }
//     );
//     if (!updatedOrder) return res.status(404).json({ error: "Order not found" });
//     res.json(updatedOrder);
//   } catch (error) {
//     console.error("Cancel order request error:", error);
//     res.status(500).json({ error: "Failed to request cancellation" });
//   }
// });

// module.exports = router;


// order.js (Express backend)
import express from "express";
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import Order from "../models/Order.js";
import { redis } from "../lib/redis.js"; // ✅ Upstash Redis client

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ---------------- CREATE ORDER ----------------
router.post("/", upload.array("images"), async (req, res) => {
  try {
    let uploadedItems = [];

    // Upload images to Cloudinary
    if (req.files && req.files.length > 0) {
      uploadedItems = await Promise.all(
        req.files.map(
          (file) =>
            new Promise((resolve, reject) => {
              const stream = cloudinary.uploader.upload_stream(
                { folder: "orders" },
                (error, result) => {
                  if (error) return reject(error);
                  resolve(result.secure_url);
                }
              );
              stream.end(file.buffer);
            })
        )
      );
    }

    const items = JSON.parse(req.body.items).map((item, idx) => ({
      ...item,
      image: uploadedItems[idx] || item.image,
    }));

    const newOrder = new Order({
      userId: req.body.userId,
      items,
      total: items.reduce(
        (sum, i) => sum + (i.price || 0) * (i.quantity || 0),
        0
      ),
      address: JSON.parse(req.body.address),
      notes: req.body.notes || "",
      status: "pending",
    });

    await newOrder.save();

    // ---- Push + Publish Notification ----
    const notif = {
      id: Date.now().toString(),
      userId: req.body.userId,
      message: `New order placed with ${items.length} items.`,
      createdAt: new Date().toISOString(),
    };

    await redis.lpush("notifications", JSON.stringify(notif));
    await redis.ltrim("notifications", 0, 49); // keep only latest 50
    await redis.publish("notifications_channel", JSON.stringify(notif));

    res.status(201).json(newOrder);
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// ---------------- GET ALL ORDERS ----------------
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("userId", "email")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Fetch all orders error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ---------------- GET USER ORDERS ----------------
router.get("/user/:userId", async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId }).sort({
      createdAt: -1,
    });
    res.json(orders);
  } catch (error) {
    console.error("Fetch user orders error:", error);
    res.status(500).json({ error: "Failed to fetch user orders" });
  }
});

// ---------------- GET ORDER BY ID ----------------
router.get("/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "userId",
      "email"
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (error) {
    console.error("Fetch order by ID error:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// ---------------- UPDATE ORDER STATUS ----------------
router.put("/:id/status", async (req, res) => {
  const { status } = req.body;
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!updatedOrder) return res.status(404).json({ error: "Order not found" });

    // 🔔 Notification
    const notif = {
      id: Date.now().toString(),
      message: `Order ${updatedOrder._id} status updated to ${status}`,
      createdAt: new Date().toISOString(),
    };
    await redis.lpush("notifications", JSON.stringify(notif));
    await redis.ltrim("notifications", 0, 49);
    await redis.publish("notifications_channel", JSON.stringify(notif));

    res.json(updatedOrder);
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// ---------------- REQUEST CANCELLATION ----------------
router.patch("/:id/cancel", async (req, res) => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "Cancellation Requested", cancelledAt: new Date() },
      { new: true }
    );
    if (!updatedOrder) return res.status(404).json({ error: "Order not found" });

    // 🔔 Notification
    const notif = {
      id: Date.now().toString(),
      message: `Order ${updatedOrder._id} requested cancellation`,
      createdAt: new Date().toISOString(),
    };
    await redis.lpush("notifications", JSON.stringify(notif));
    await redis.ltrim("notifications", 0, 49);
    await redis.publish("notifications_channel", JSON.stringify(notif));

    res.json(updatedOrder);
  } catch (error) {
    console.error("Cancel order request error:", error);
    res.status(500).json({ error: "Failed to request cancellation" });
  }
});

// ---------------- STREAM NOTIFICATIONS (SSE) ----------------
router.get("/stream/notifications", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  const listener = redis.subscribe("notifications_channel", (message) => {
    res.write(`data: ${message}\n\n`);
  });

  req.on("close", () => {
    listener.unsubscribe();
    res.end();
  });
});

export default router;
