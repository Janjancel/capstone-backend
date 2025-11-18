

// routes/orders.js
const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const cloudinary = require("../config/cloudinary");
const multer = require("multer");
const { Readable } = require("stream");

// Multer setup (store file in memory before upload to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ---------- Helpers: normalize image URL from various shapes ----------
function getFirstUrl(candidate) {
  if (!candidate) return null;

  // string URL
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim();

  // array: strings or nested objects
  if (Array.isArray(candidate)) {
    const found = candidate.find((c) => typeof c === "string" && c.trim().length > 0);
    if (found) return found.trim();
    for (const c of candidate) {
      const nested = getFirstUrl(c);
      if (nested) return nested;
    }
    return null;
  }

  // object with common keys or nested shapes
  if (typeof candidate === "object") {
    const priorityKeys = ["front", "main", "cover", "primary", "side", "back", "url"];
    for (const k of priorityKeys) {
      if (k in candidate) {
        const nested = getFirstUrl(candidate[k]);
        if (nested) return nested;
      }
    }
    for (const k in candidate) {
      const nested = getFirstUrl(candidate[k]);
      if (nested) return nested;
    }
  }

  return null;
}

function pickImageUrlFromItem(item) {
  // Prefer images[], then image (object/array/string)
  return getFirstUrl(item?.images) || getFirstUrl(item?.image) || null;
}
// ---------------------------------------------------------------------

// Create a new order (with file upload)
router.post("/", upload.array("images"), async (req, res) => {
  try {
    // --- 0) Validate userId presence early
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    // 1) Upload any incoming files to Cloudinary
    let uploadedItems = [];
    if (req.files && req.files.length > 0) {
      uploadedItems = await Promise.all(
        req.files.map(
          (file) =>
            new Promise((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream(
                { folder: "orders" },
                (error, result) => {
                  if (error) return reject(error);
                  resolve(result.secure_url);
                }
              );
              Readable.from(file.buffer).pipe(uploadStream);
            })
        )
      );
    }

    // 2) Parse items payload safely (supports stringified or array)
    const rawItems =
      Array.isArray(req.body.items) ? req.body.items : JSON.parse(req.body.items || "[]");

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ error: "Order must include at least one item." });
    }

    // If we have exactly one uploaded image per item, map by index. Otherwise fallback to item’s own URL.
    const useIndexMapping =
      uploadedItems.length > 0 && uploadedItems.length === rawItems.length;

    // 3) Normalize order items so schema-required fields are present
    const items = rawItems.map((item, idx) => {
      const id =
        (item && (item.id || item.itemId || item._id)) ? String(item.id || item.itemId || item._id) : null;

      if (!id) {
        throw new Error("Each item must include an id.");
      }

      const qty = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      const subtotal = +(qty * price).toFixed(2);

      const uploadedUrl = useIndexMapping ? uploadedItems[idx] : undefined;
      const normalizedUrl = uploadedUrl || pickImageUrlFromItem(item);

      // images[] optional; include primary if we have it
      const images = [];
      if (normalizedUrl) images.push(normalizedUrl);

      return {
        id,
        name: item.name || "Untitled Item",
        quantity: qty,
        price,
        subtotal,
        image: typeof normalizedUrl === "string" ? normalizedUrl : undefined,
        images, // optional array
      };
    });

    // 4) Compute total safely (server-source-of-truth)
    const total = items.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0);

    // 5) Parse address field
    const address =
      typeof req.body.address === "string"
        ? JSON.parse(req.body.address || "{}")
        : req.body.address || {};

    const notes = typeof req.body.notes === "string" ? req.body.notes : "";

    const newOrder = new Order({
      userId,
      items,
      total,
      address,
      notes,
    });

    await newOrder.save();
    return res.status(201).json(newOrder);
  } catch (error) {
    console.error("Order creation error:", error);

    // Send better messages for common cases
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: "Validation failed", details: error.message });
    }
    if (error.name === "SyntaxError") {
      return res.status(400).json({ error: "Bad JSON in payload", details: error.message });
    }

    return res.status(500).json({ error: "Failed to create order" });
  }
});

// Get all orders (admin)
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
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
    const order = await Order.findById(req.params.id);
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

