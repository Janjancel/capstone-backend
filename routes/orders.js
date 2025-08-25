// const express = require("express");
// const router = express.Router();
// const Order = require("../models/Order");

// // Create new order
// router.post("/", async (req, res) => {
//   try {
//     const newOrder = new Order(req.body);
//     await newOrder.save();
//     res.status(201).json(newOrder);
//   } catch (error) {
//     console.error("Order creation error:", error);
//     res.status(500).json({ error: "Failed to create order" });
//   }
// });

// // routes/orders.js
// router.get("/", async (req, res) => {
//   try {
//     const orders = await Order.find().sort({ createdAt: -1 });
//     res.json(orders);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to fetch orders" });
//   }
// });


// router.put("/:id/status", async (req, res) => {
//   const { status } = req.body;
//   try {
//     const updated = await Order.findByIdAndUpdate(
//       req.params.id,
//       { status },
//       { new: true }
//     );
//     res.json(updated);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to update status" });
//   }
// });


// router.put("/:id/cancel", async (req, res) => {
//   try {
//     const updated = await Order.findByIdAndUpdate(
//       req.params.id,
//       { status: "Cancelled", cancelledAt: new Date() },
//       { new: true }
//     );
//     res.json(updated);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to cancel order" });
//   }
// });

// // ✅ Get full order details by ID
// router.get("/orders/:orderId", async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.orderId);
//     if (!order) return res.status(404).json({ message: "Order not found" });
//     res.json(order);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to fetch order" });
//   }
// });

// // Get all orders for a specific user
// router.get("/user/:userId", async (req, res) => {
//   try {
//     const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 });
//     res.json(orders);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to fetch user orders" });
//   }
// });



// module.exports = router;

// const express = require("express");
// const router = express.Router();
// const Order = require("../models/Order");

// // Create a new order
// router.post("/", async (req, res) => {
//   try {
//     const newOrder = new Order(req.body);

//     // Calculate total automatically
//     newOrder.total = newOrder.items.reduce(
//       (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
//       0
//     );

//     await newOrder.save();
//     res.status(201).json(newOrder);
//   } catch (error) {
//     console.error("Order creation error:", error);
//     res.status(500).json({ error: "Failed to create order" });
//   }
// });
const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const cloudinary = require("../utils/cloudinary");
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
        req.files.map(async (file) => {
          const result = await cloudinary.uploader.upload_stream(
            { folder: "orders" },
            (error, result) => {
              if (error) throw error;
              return result.secure_url;
            }
          );

          return result;
        })
      );
    }

    // Build order items (map body data with uploaded image URLs)
    const items = JSON.parse(req.body.items).map((item, idx) => ({
      ...item,
      image: uploadedItems[idx] || item.image, // fallback if no new image
    }));

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


// const express = require("express");
// const router = express.Router();
// const Order = require("../models/Order");

// // ✅ Create a new order
// router.post("/", async (req, res) => {
//   try {
//     const newOrder = new Order(req.body);
//     await newOrder.save();
//     res.status(201).json(newOrder);
//   } catch (error) {
//     console.error("Order creation error:", error);
//     res.status(500).json({ error: "Failed to create order" });
//   }
// });

// // ✅ Get all orders (Admin use)
// router.get("/", async (req, res) => {
//   try {
//     const orders = await Order.find().sort({ createdAt: -1 });
//     res.json(orders);
//   } catch (error) {
//     console.error("Fetch all orders error:", error);
//     res.status(500).json({ error: "Failed to fetch orders" });
//   }
// });

// // ✅ Get all orders for a specific user
// router.get("/user/:userId", async (req, res) => {
//   try {
//     const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 });
//     res.json(orders);
//   } catch (error) {
//     console.error("Fetch user orders error:", error);
//     res.status(500).json({ error: "Failed to fetch user orders" });
//   }
// });

// // ✅ Get full order details by ID
// router.get("/:id", async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.id);
//     if (!order) {
//       return res.status(404).json({ error: "Order not found" });
//     }
//     res.json(order);
//   } catch (error) {
//     console.error("Fetch order by ID error:", error);
//     res.status(500).json({ error: "Failed to fetch order" });
//   }
// });

// // ✅ Update order status
// router.put("/:id/status", async (req, res) => {
//   const { status } = req.body;
//   try {
//     const updatedOrder = await Order.findByIdAndUpdate(
//       req.params.id,
//       { status },
//       { new: true }
//     );
//     if (!updatedOrder) {
//       return res.status(404).json({ error: "Order not found" });
//     }
//     res.json(updatedOrder);
//   } catch (error) {
//     console.error("Update order status error:", error);
//     res.status(500).json({ error: "Failed to update order status" });
//   }
// });

// // ✅ Request order cancellation
// router.patch("/:id/cancel", async (req, res) => {
//   try {
//     const updatedOrder = await Order.findByIdAndUpdate(
//       req.params.id,
//       {
//         status: "Cancellation Requested",
//         cancelledAt: new Date(),
//       },
//       { new: true }
//     );
//     if (!updatedOrder) {
//       return res.status(404).json({ error: "Order not found" });
//     }
//     res.json(updatedOrder);
//   } catch (error) {
//     console.error("Cancel order request error:", error);
//     res.status(500).json({ error: "Failed to request cancellation" });
//   }
// });

// module.exports = router;
