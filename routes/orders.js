
// // routes/orders.js
// const express = require("express");
// const router = express.Router();
// const Order = require("../models/Order");
// const User = require("../models/User"); // <-- used to fetch user's coordinates
// const cloudinary = require("../config/cloudinary");
// const multer = require("multer");
// const { Readable } = require("stream");

// // Multer setup (store file in memory before upload to Cloudinary)
// const storage = multer.memoryStorage();
// const upload = multer({ storage });

// // ---------- Helpers: normalize image URL from various shapes ----------
// function getFirstUrl(candidate) {
//   if (!candidate) return null;

//   // string URL
//   if (typeof candidate === "string" && candidate.trim()) return candidate.trim();

//   // array: strings or nested objects
//   if (Array.isArray(candidate)) {
//     const found = candidate.find((c) => typeof c === "string" && c.trim().length > 0);
//     if (found) return found.trim();
//     for (const c of candidate) {
//       const nested = getFirstUrl(c);
//       if (nested) return nested;
//     }
//     return null;
//   }

//   // object with common keys or nested shapes
//   if (typeof candidate === "object") {
//     const priorityKeys = ["front", "main", "cover", "primary", "side", "back", "url"];
//     for (const k of priorityKeys) {
//       if (k in candidate) {
//         const nested = getFirstUrl(candidate[k]);
//         if (nested) return nested;
//       }
//     }
//     for (const k in candidate) {
//       const nested = getFirstUrl(candidate[k]);
//       if (nested) return nested;
//     }
//   }

//   return null;
// }

// function pickImageUrlFromItem(item) {
//   // Prefer images[], then image (object/array/string)
//   return getFirstUrl(item?.images) || getFirstUrl(item?.image) || null;
// }
// // ---------------------------------------------------------------------

// // Haversine formula to compute distance (in kilometers) between 2 lat/lng pairs
// function haversineDistanceKm(lat1, lng1, lat2, lng2) {
//   const toRad = (deg) => (deg * Math.PI) / 180;
//   const R = 6371; // earth radius km
//   const dLat = toRad(lat2 - lat1);
//   const dLng = toRad(lng2 - lng1);
//   const a =
//     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//     Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
//     Math.sin(dLng / 2) * Math.sin(dLng / 2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   return R * c;
// }

// // Delivery fee logic constants (pivot is Lucena City Hall)
// const PIVOT = { lat: 13.9365569, lng: 121.6115341 }; // pivot coordinates (Lucena City Hall). Source: coordinates lookup.
// const FREE_RADIUS_KM = 15;
// const STEP_KM = 3;
// const STEP_FEE_PHP = 1000;

// // computeDeliveryFee(distanceInKm) -> number (PHP)
// function computeDeliveryFee(distanceKm) {
//   if (!distanceKm || distanceKm <= FREE_RADIUS_KM) return 0;
//   const extraKm = distanceKm - FREE_RADIUS_KM;
//   const steps = Math.ceil(extraKm / STEP_KM);
//   return steps * STEP_FEE_PHP;
// }

// /**
//  * computeDiscount(total)
//  * - Rules:
//  *   - total >= 50,000 and < 100,000 => 5%
//  *   - total >= 100,000 and <= 199,999.99 => 8%
//  *   - total >= 200,000 => 10%
//  * - Returns { percent: Number|null, amount: Number|null }
//  */
// function computeDiscount(total) {
//   if (!isFinite(total) || total <= 0) return { percent: null, amount: null };

//   let percent = null;
//   if (total >= 200000) {
//     percent = 10;
//   } else if (total >= 100000) {
//     percent = 8;
//   } else if (total >= 50000) {
//     percent = 5;
//   } else {
//     percent = null;
//   }

//   if (percent == null) return { percent: null, amount: null };
//   const amount = parseFloat(((percent / 100) * total).toFixed(2));
//   return { percent, amount };
// }

// // Create a new order (with file upload)
// router.post("/", upload.array("images"), async (req, res) => {
//   try {
//     // --- 0) Validate userId presence early
//     const userId = req.body.userId;
//     if (!userId) {
//       return res.status(400).json({ error: "Missing userId" });
//     }

//     // 1) Upload any incoming files to Cloudinary
//     let uploadedItems = [];
//     if (req.files && req.files.length > 0) {
//       uploadedItems = await Promise.all(
//         req.files.map(
//           (file) =>
//             new Promise((resolve, reject) => {
//               const uploadStream = cloudinary.uploader.upload_stream(
//                 { folder: "orders" },
//                 (error, result) => {
//                   if (error) return reject(error);
//                   resolve(result.secure_url);
//                 }
//               );
//               Readable.from(file.buffer).pipe(uploadStream);
//             })
//         )
//       );
//     }

//     // 2) Parse items payload safely (supports stringified or array)
//     const rawItems =
//       Array.isArray(req.body.items) ? req.body.items : JSON.parse(req.body.items || "[]");

//     if (!Array.isArray(rawItems) || rawItems.length === 0) {
//       return res.status(400).json({ error: "Order must include at least one item." });
//     }

//     // If we have exactly one uploaded image per item, map by index. Otherwise fallback to item’s own URL.
//     const useIndexMapping =
//       uploadedItems.length > 0 && uploadedItems.length === rawItems.length;

//     // 3) Normalize order items so schema-required fields are present
//     const items = rawItems.map((item, idx) => {
//       const id =
//         (item && (item.id || item.itemId || item._id)) ? String(item.id || item.itemId || item._id) : null;

//       if (!id) {
//         throw new Error("Each item must include an id.");
//       }

//       const qty = Number(item.quantity) || 0;
//       const price = Number(item.price) || 0;
//       const subtotal = +(qty * price).toFixed(2);

//       const uploadedUrl = useIndexMapping ? uploadedItems[idx] : undefined;
//       const normalizedUrl = uploadedUrl || pickImageUrlFromItem(item);

//       // images[] optional; include primary if we have it
//       const images = [];
//       if (normalizedUrl) images.push(normalizedUrl);

//       return {
//         id,
//         name: item.name || "Untitled Item",
//         quantity: qty,
//         price,
//         subtotal,
//         image: typeof normalizedUrl === "string" ? normalizedUrl : undefined,
//         images, // optional array
//       };
//     });

//     // 4) Compute total safely (server-source-of-truth)
//     const total = items.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0);

//     // 5) Parse address field
//     const address =
//       typeof req.body.address === "string"
//         ? JSON.parse(req.body.address || "{}")
//         : req.body.address || {};

//     const notes = typeof req.body.notes === "string" ? req.body.notes : "";

//     // 6) Get user's coordinates from DB (fallback to coordinates in req.body)
//     let userCoords = null;
//     const userDoc = await User.findOne({ _id: userId }).lean().select("coordinates");
//     if (userDoc && userDoc.coordinates && userDoc.coordinates.lat != null && userDoc.coordinates.lng != null) {
//       userCoords = {
//         lat: Number(userDoc.coordinates.lat),
//         lng: Number(userDoc.coordinates.lng),
//       };
//     } else {
//       // fallback: allow front-end to pass coordinates in request body
//       const clientCoords =
//         typeof req.body.coordinates === "string" ? JSON.parse(req.body.coordinates || "{}") : req.body.coordinates;
//       if (clientCoords && clientCoords.lat != null && clientCoords.lng != null) {
//         userCoords = {
//           lat: Number(clientCoords.lat),
//           lng: Number(clientCoords.lng),
//         };
//       }
//     }

//     // 7) Compute distance and delivery fee (if user coordinates exist)
//     let distanceKm = null;
//     let deliveryFee = 0;
//     if (userCoords && isFinite(userCoords.lat) && isFinite(userCoords.lng)) {
//       distanceKm = haversineDistanceKm(PIVOT.lat, PIVOT.lng, userCoords.lat, userCoords.lng);
//       deliveryFee = computeDeliveryFee(distanceKm);
//     } else {
//       // If coordinates missing: default behaviour is 0 fee or you might prefer rejection.
//       // I will set deliveryFee = 0 and note coordinates missing in the response.
//       deliveryFee = 0;
//     }

//     // 8) Compute discount based on "total" (before delivery)
//     const discountInfo = computeDiscount(total); // { percent, amount }
//     // store discount as numeric amount (or null if none)
//     const discountAmount = discountInfo.amount != null ? discountInfo.amount : null;
//     const discountPercent = discountInfo.percent != null ? discountInfo.percent : null;

//     // 9) Compute grand total = total - discount + deliveryFee
//     const grandTotal = parseFloat((total - (discountAmount || 0) + deliveryFee).toFixed(2));

//     const newOrder = new Order({
//       userId,
//       items,
//       total,
//       deliveryFee,
//       // store numeric discount amount in model (null when none)
//       discount: discountAmount,
//       grandTotal,
//       address,
//       notes,
//       // store both for compatibility
//       coodrinates: userCoords ? { lat: userCoords.lat, lng: userCoords.lng } : undefined,
//       coordinates: userCoords ? { lat: userCoords.lat, lng: userCoords.lng } : undefined,
//     });

//     await newOrder.save();

//     // Return some computed fields so frontend can show them immediately
//     const resp = {
//       order: newOrder,
//       meta: {
//         computed: {
//           distanceKm: distanceKm != null ? Number(distanceKm.toFixed(3)) : null,
//           deliveryFee,
//           discountAmount: discountAmount,
//           discountPercent: discountPercent,
//           totalBeforeDiscount: total,
//           grandTotal,
//           pivot: PIVOT,
//         },
//         coordinatesProvided: !!userCoords,
//       },
//     };

//     return res.status(201).json(resp);
//   } catch (error) {
//     console.error("Order creation error:", error);

//     // Send better messages for common cases
//     if (error.name === "ValidationError") {
//       return res.status(400).json({ error: "Validation failed", details: error.message });
//     }
//     if (error.name === "SyntaxError") {
//       return res.status(400).json({ error: "Bad JSON in payload", details: error.message });
//     }

//     return res.status(500).json({ error: "Failed to create order" });
//   }
// });

// // Get all orders (admin)
// router.get("/", async (req, res) => {
//   try {
//     const orders = await Order.find().sort({ createdAt: -1 });
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
//     const order = await Order.findById(req.params.id);
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


// routes/orders.js
const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const User = require("../models/User"); // used for coordinates / optional populate
const cloudinary = require("../config/cloudinary");
const multer = require("multer");
const { Readable } = require("stream");
const mongoose = require("mongoose");

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

// Haversine formula to compute distance (in kilometers) between 2 lat/lng pairs
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Delivery fee logic constants (pivot is Lucena City Hall)
const PIVOT = { lat: 13.9365569, lng: 121.6115341 }; // pivot coordinates (Lucena City Hall).
const FREE_RADIUS_KM = 15;
const STEP_KM = 3;
const STEP_FEE_PHP = 1000;

// computeDeliveryFee(distanceInKm) -> number (PHP)
function computeDeliveryFee(distanceKm) {
  if (!distanceKm || distanceKm <= FREE_RADIUS_KM) return 0;
  const extraKm = distanceKm - FREE_RADIUS_KM;
  const steps = Math.ceil(extraKm / STEP_KM);
  return steps * STEP_FEE_PHP;
}

/**
 * computeDiscount(total)
 * - Rules:
 *   - total >= 50,000 and < 100,000 => 5%
 *   - total >= 100,000 and <= 199,999.99 => 8%
 *   - total >= 200,000 => 10%
 * - Returns { percent: Number|null, amount: Number|null }
 */
function computeDiscount(total) {
  if (!isFinite(total) || total <= 0) return { percent: null, amount: null };

  let percent = null;
  if (total >= 200000) {
    percent = 10;
  } else if (total >= 100000) {
    percent = 8;
  } else if (total >= 50000) {
    percent = 5;
  } else {
    percent = null;
  }

  if (percent == null) return { percent: null, amount: null };
  const amount = parseFloat(((percent / 100) * total).toFixed(2));
  return { percent, amount };
}

// Create a new order (with optional file upload)
router.post("/", upload.array("images"), async (req, res) => {
  try {
    // --- 0) Validate user presence early (accept either user (ObjectId) or userId (string) )
    let user = null;
    let userIdString = null;

    // prefer req.body.user (ObjectId) or req.body.userId (string)
    if (req.body.user) {
      // allow string ObjectId or actual ObjectId (from JSON)
      try {
        user = mongoose.Types.ObjectId.isValid(req.body.user) ? mongoose.Types.ObjectId(req.body.user) : null;
      } catch (e) {
        user = null;
      }
    }
    if (!user && req.body.userId) {
      userIdString = String(req.body.userId);
    }

    // If neither provided -> error
    if (!user && !userIdString) {
      return res.status(400).json({ error: "Missing user (user _id) or userId (legacy string)" });
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
    let rawItems = [];
    if (Array.isArray(req.body.items)) {
      rawItems = req.body.items;
    } else if (typeof req.body.items === "string") {
      rawItems = JSON.parse(req.body.items || "[]");
    } else {
      rawItems = [];
    }

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

    // 6) Get user's coordinates from DB (fallback to coordinates in req.body)
    let userCoords = null;
    if (user) {
      const userDoc = await User.findById(user).lean().select("coordinates userId");
      if (userDoc) {
        if (userDoc.coordinates && userDoc.coordinates.lat != null && userDoc.coordinates.lng != null) {
          userCoords = { lat: Number(userDoc.coordinates.lat), lng: Number(userDoc.coordinates.lng) };
        }
        // also set userIdString if we have it available from the user doc (legacy)
        if (!userIdString && userDoc.userId) userIdString = userDoc.userId;
      }
    } else if (userIdString) {
      // try to find user by legacy userId (optional)
      const found = await User.findOne({ userId: userIdString }).lean().select("coordinates _id");
      if (found) {
        if (found.coordinates && found.coordinates.lat != null && found.coordinates.lng != null) {
          userCoords = { lat: Number(found.coordinates.lat), lng: Number(found.coordinates.lng) };
        }
        // set user (ObjectId) if possible
        if (!user && found._id) user = found._id;
      }
    }

    // fallback: allow front-end to pass coordinates in request body
    if (!userCoords) {
      const clientCoords =
        typeof req.body.coordinates === "string" ? JSON.parse(req.body.coordinates || "{}") : req.body.coordinates;
      if (clientCoords && clientCoords.lat != null && clientCoords.lng != null) {
        userCoords = {
          lat: Number(clientCoords.lat),
          lng: Number(clientCoords.lng),
        };
      }
    }

    // 7) Compute distance and delivery fee (if user coordinates exist)
    let distanceKm = null;
    let deliveryFee = 0;
    if (userCoords && isFinite(userCoords.lat) && isFinite(userCoords.lng)) {
      distanceKm = haversineDistanceKm(PIVOT.lat, PIVOT.lng, userCoords.lat, userCoords.lng);
      deliveryFee = computeDeliveryFee(distanceKm);
    } else {
      // If coordinates missing: default behaviour is 0 fee (kept current behaviour)
      deliveryFee = 0;
    }

    // 8) Compute discount based on "total" (before delivery)
    const discountInfo = computeDiscount(total); // { percent, amount }
    const discountAmount = discountInfo.amount != null ? discountInfo.amount : null;
    const discountPercent = discountInfo.percent != null ? discountInfo.percent : null;

    // 9) Compute grand total = total - discount + deliveryFee
    const grandTotal = parseFloat((total - (discountAmount || 0) + deliveryFee).toFixed(2));

    // Build order document
    const orderDoc = new Order({
      user: user || undefined,
      userId: userIdString || undefined,
      items,
      total,
      deliveryFee,
      discount: discountAmount,
      grandTotal,
      address,
      notes,
      // store both for compatibility
      coodrinates: userCoords ? { lat: userCoords.lat, lng: userCoords.lng } : undefined,
      coordinates: userCoords ? { lat: userCoords.lat, lng: userCoords.lng } : undefined,
    });

    await orderDoc.save();

    // Optionally populate the user (light) so frontend can display name/email if needed
    const populated = await Order.findById(orderDoc._id).populate({
      path: "user",
      select: "username email userId profilePic",
    });

    const resp = {
      order: populated,
      meta: {
        computed: {
          distanceKm: distanceKm != null ? Number(distanceKm.toFixed(3)) : null,
          deliveryFee,
          discountAmount: discountAmount,
          discountPercent: discountPercent,
          totalBeforeDiscount: total,
          grandTotal,
          pivot: PIVOT,
        },
        coordinatesProvided: !!userCoords,
      },
    };

    return res.status(201).json(resp);
  } catch (error) {
    console.error("Order creation error:", error);

    // Send better messages for common cases
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: "Validation failed", details: error.message });
    }
    if (error.name === "SyntaxError") {
      return res.status(400).json({ error: "Bad JSON in payload", details: error.message });
    }
    if (error.message && error.message.includes("Each item must include an id")) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: "Failed to create order" });
  }
});

// Get all orders (admin)
router.get("/", async (req, res) => {
  try {
    // optional query params: status, user, limit, skip
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.user && mongoose.Types.ObjectId.isValid(req.query.user)) filter.user = req.query.user;
    if (req.query.userId) filter.userId = req.query.userId;

    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: "user", select: "username email userId" });

    res.json(orders);
  } catch (error) {
    console.error("Fetch all orders error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Get orders for a specific user (by user ObjectId or legacy userId string)
router.get("/user/:userIdentifier", async (req, res) => {
  try {
    const identifier = req.params.userIdentifier;
    const filter = {};

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      filter.user = identifier;
    } else {
      // treat as legacy userId string
      filter.userId = identifier;
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).populate({
      path: "user",
      select: "username email userId",
    });

    res.json(orders);
  } catch (error) {
    console.error("Fetch user orders error:", error);
    res.status(500).json({ error: "Failed to fetch user orders" });
  }
});

// Get order by ID (mongoose _id)
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid order id" });
    }

    const order = await Order.findById(req.params.id).populate({
      path: "user",
      select: "username email userId",
    });

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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid order id" });
    }
    const validStatuses = [
      "Pending",
      "Processing",
      "Accepted",
      "On Delivery",
      "Delivered",
      "Cancellation Requested",
      "Cancelled",
      "Rejected",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate({ path: "user", select: "username email userId" });

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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid order id" });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "Cancellation Requested", cancelledAt: new Date() },
      { new: true }
    ).populate({ path: "user", select: "username email userId" });

    if (!updatedOrder) return res.status(404).json({ error: "Order not found" });
    res.json(updatedOrder);
  } catch (error) {
    console.error("Cancel order request error:", error);
    res.status(500).json({ error: "Failed to request cancellation" });
  }
});

module.exports = router;
