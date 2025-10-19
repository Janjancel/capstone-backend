
  const express = require("express");
  const router = express.Router();
  const Order = require("../models/Order");
  const cloudinary = require("../config/cloudinary");
  const multer = require("multer");

  // Multer setup (store file in memory before upload to Cloudinary)
  const storage = multer.memoryStorage();
  const upload = multer({ storage });

  // Create a new order (with file upload)
  router.post("/", upload.array("images"), async (req, res) => {
    try {
      let uploadedItems = [];

      // Upload each image to Cloudinary if provided
      if (req.files && req.files.length > 0) {
        uploadedItems = await Promise.all(
          req.files.map((file) => {
            return new Promise((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream(
                { folder: "orders" },
                (error, result) => {
                  if (error) {
                    reject(error);
                    return;
                  }
                  resolve(result.secure_url);
                }
              );

              // Convert buffer to stream and pipe to cloudinary
              const bufferStream = require('stream').Readable.from(file.buffer);
              bufferStream.pipe(uploadStream);
            });
          })
        );
      }

      // Parse and build order items with their images
      const parsedItems = JSON.parse(req.body.items);
      const items = parsedItems.map((item, idx) => {
        // If there's a new uploaded image for this item, use it
        // Otherwise keep the existing image URL from the item
        return {
          ...item,
          image: uploadedItems[idx] || item.image,
        };
      });

      const newOrder = new Order({
        userId: req.body.userId,
        items,
        total: items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 0), 0),
        address: JSON.parse(req.body.address),
        notes: req.body.notes || "",
      });

      await newOrder.save();
      res.status(201).json(newOrder);
    } catch (error) {
      console.error("Order creation error:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });


  // Get all orders (admin)
  router.get("/", async (req, res) => {
    try {
      const orders = await Order.find().populate("userId", "email").sort({ createdAt: -1 });
      res.json(orders);
    } catch (error) {
      console.error("Fetch all orders error:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Get orders for a specific user
  router.get("/user/:userId", async (req, res) => {
    try {
      const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 });
      res.json(orders);
    } catch (error) {
      console.error("Fetch user orders error:", error);
      res.status(500).json({ error: "Failed to fetch user orders" });
    }
  });

  // Get order by ID
  router.get("/:id", async (req, res) => {
    try {
      const order = await Order.findById(req.params.id).populate("userId", "email");
      if (!order) return res.status(404).json({ error: "Order not found" });
      res.json(order);
    } catch (error) {
      console.error("Fetch order by ID error:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  // Update order status
  router.put("/:id/status", async (req, res) => {
    const { status } = req.body;
    try {
      const updatedOrder = await Order.findByIdAndUpdate(
        req.params.id,

        { status },
        { new: true }
      );
      if (!updatedOrder) return res.status(404).json({ error: "Order not found" });
      res.json(updatedOrder);
    } catch (error) {
      console.error("Update order status error:", error);
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  // Request order cancellation
  router.patch("/:id/cancel", async (req, res) => {
    try {
      const updatedOrder = await Order.findByIdAndUpdate(
        req.params.id,
        { status: "Cancellation Requested", cancelledAt: new Date() },
        { new: true }
      );
      if (!updatedOrder) return res.status(404).json({ error: "Order not found" });
      res.json(updatedOrder);
    } catch (error) {
      console.error("Cancel order request error:", error);
      res.status(500).json({ error: "Failed to request cancellation" });
    }
  });

  module.exports = router;

