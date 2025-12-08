

// // routes/orders.js
// const express = require("express");
// const router = express.Router();
// const mongoose = require("mongoose");
// const Order = require("../models/Order");
// const Item = require("../models/Item");
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

//   if (typeof candidate === "string" && candidate.trim()) return candidate.trim();

//   if (Array.isArray(candidate)) {
//     const found = candidate.find((c) => typeof c === "string" && c.trim().length > 0);
//     if (found) return found.trim();
//     for (const c of candidate) {
//       const nested = getFirstUrl(c);
//       if (nested) return nested;
//     }
//     return null;
//   }

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
// const PIVOT = { lat: 13.9365569, lng: 121.6115341 }; // pivot coordinates (Lucena City Hall).
// const FREE_RADIUS_KM = 15;
// const STEP_KM = 3;
// const STEP_FEE_PHP = 1000;

// function computeDeliveryFee(distanceKm) {
//   if (!distanceKm || distanceKm <= FREE_RADIUS_KM) return 0;
//   const extraKm = distanceKm - FREE_RADIUS_KM;
//   const steps = Math.ceil(extraKm / STEP_KM);
//   return steps * STEP_FEE_PHP;
// }

// /**
//  * computeDiscount(total)
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

// /**
//  * Create a new order (with optional file upload)
//  * This route will:
//  *  - upload any provided files to Cloudinary,
//  *  - parse order items,
//  *  - atomically decrement Item.quantity for each ordered item inside a transaction,
//  *  - set Item.availability = false when quantity reaches 0,
//  *  - save the Order in the same transaction.
//  */
// router.post("/", upload.array("images"), async (req, res) => {
//   let session;
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

//     const useIndexMapping =
//       uploadedItems.length > 0 && uploadedItems.length === rawItems.length;

//     // 3) Normalize order items so schema-required fields are present
//     const items = rawItems.map((item, idx) => {
//       const id =
//         (item && (item.id || item.itemId || item._id)) ? String(item.id || item.itemId || item._id) : null;

//       if (!id) {
//         throw new Error("Each item must include an id.");
//       }

//       const qty = Math.max(0, Number(item.quantity) || 0);
//       const price = Number(item.price) || 0;
//       const subtotal = +(qty * price).toFixed(2);

//       const uploadedUrl = useIndexMapping ? uploadedItems[idx] : undefined;
//       const normalizedUrl = uploadedUrl || pickImageUrlFromItem(item);

//       const images = [];
//       if (normalizedUrl) images.push(normalizedUrl);

//       return {
//         id,
//         name: item.name || "Untitled Item",
//         quantity: qty,
//         price,
//         subtotal,
//         image: typeof normalizedUrl === "string" ? normalizedUrl : undefined,
//         images,
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
//       deliveryFee = 0;
//     }

//     // 8) Compute discount based on "total" (before delivery)
//     const discountInfo = computeDiscount(total);
//     const discountAmount = discountInfo.amount != null ? discountInfo.amount : null;
//     const discountPercent = discountInfo.percent != null ? discountInfo.percent : null;

//     // 9) Compute grand total = total - discount + deliveryFee
//     const grandTotal = parseFloat((total - (discountAmount || 0) + deliveryFee).toFixed(2));

//     //
//     // --- STOCK ADJUSTMENTS + ORDER SAVE (TRANSACTION) ---
//     //
//     // Start a session for transaction (requires replica set)
//     session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//       // For each ordered item, attempt atomic decrement
//       for (const it of items) {
//         const oid = mongoose.Types.ObjectId.isValid(it.id) ? mongoose.Types.ObjectId(it.id) : it.id;

//         // require positive quantity
//         if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
//           // skip stock change for zero-quantity items; you likely want to reject such orders earlier
//           await session.abortTransaction();
//           session.endSession();
//           return res.status(400).json({ error: `Invalid quantity for item ${it.id}` });
//         }

//         // Atomically decrement only if there is enough stock
//         const updatedItem = await Item.findOneAndUpdate(
//           { _id: oid, quantity: { $gte: it.quantity } },
//           { $inc: { quantity: -it.quantity } },
//           { new: true, session }
//         );

//         if (!updatedItem) {
//           // insufficient stock or item missing -> abort
//           // find the current state for better error message
//           const existing = await Item.findById(oid).session(session).lean();
//           const availableQty = existing ? (existing.quantity ?? 0) : 0;
//           await session.abortTransaction();
//           session.endSession();
//           return res.status(400).json({
//             error: "Insufficient stock",
//             itemId: it.id,
//             requested: it.quantity,
//             available: availableQty,
//           });
//         }

//         // If quantity reached zero, ensure availability is false
//         if ((updatedItem.quantity === 0) && updatedItem.availability) {
//           // Set availability false (in same session)
//           await Item.updateOne({ _id: updatedItem._id }, { $set: { availability: false } }, { session });
//         }
//       } // end loop items

//       // Now create the order within the same session
//       const newOrder = new Order({
//         userId,
//         items,
//         total,
//         deliveryFee,
//         discount: discountAmount,
//         grandTotal,
//         address,
//         notes,
//         coodrinates: userCoords ? { lat: userCoords.lat, lng: userCoords.lng } : undefined,
//         coordinates: userCoords ? { lat: userCoords.lat, lng: userCoords.lng } : undefined,
//       });

//       await newOrder.save({ session });

//       // commit transaction
//       await session.commitTransaction();
//       session.endSession();

//       // Return response (order saved). Note: newOrder is the session-saved doc.
//       const resp = {
//         order: newOrder,
//         meta: {
//           computed: {
//             distanceKm: distanceKm != null ? Number(distanceKm.toFixed(3)) : null,
//             deliveryFee,
//             discountAmount: discountAmount,
//             discountPercent: discountPercent,
//             totalBeforeDiscount: total,
//             grandTotal,
//             pivot: PIVOT,
//           },
//           coordinatesProvided: !!userCoords,
//         },
//       };

//       return res.status(201).json(resp);
//     } catch (txErr) {
//       // abort on any error inside transaction
//       try {
//         await session.abortTransaction();
//       } catch (e) {}
//       session.endSession();
//       console.error("Transaction error:", txErr);
//       // if txErr already sent response earlier, just return generic
//       return res.status(500).json({ error: "Failed to create order (transaction aborted)" });
//     }
//   } catch (error) {
//     // If sessions are not supported (e.g., standalone MongoDB) the startSession or transaction may fail.
//     // Fall back: attempt a safe sequential approach with rollback on partial success.
//     console.error("Order creation error:", error);

//     // If session was created, ensure it was ended
//     if (session) {
//       try { session.endSession(); } catch (e) {}
//     }

//     // If the error indicates transactions unsupported, provide a clear message.
//     if (error && /transactions|replica set/i.test(String(error.message || ""))) {
//       return res.status(500).json({
//         error: "Database transactions not supported by current MongoDB deployment. To safely process orders with stock updates enable replica set / use Atlas."
//       });
//     }

//     // Generic fallback
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


const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Item = require("../models/Item");
const User = require("../models/User"); // <-- used to fetch user's coordinates
const cloudinary = require("../config/cloudinary");
const multer = require("multer");
const { Readable } = require("stream");

// Multer setup (store file in memory before upload to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ---------- Helpers: normalize image URL from various shapes ----------
function getFirstUrl(candidate) {
  if (!candidate) return null;

  if (typeof candidate === "string" && candidate.trim()) return candidate.trim();

  if (Array.isArray(candidate)) {
    const found = candidate.find((c) => typeof c === "string" && c.trim().length > 0);
    if (found) return found.trim();
    for (const c of candidate) {
      const nested = getFirstUrl(c);
      if (nested) return nested;
    }
    return null;
  }

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

function computeDeliveryFee(distanceKm) {
  if (!distanceKm || distanceKm <= FREE_RADIUS_KM) return 0;
  const extraKm = distanceKm - FREE_RADIUS_KM;
  const steps = Math.ceil(extraKm / STEP_KM);
  return steps * STEP_FEE_PHP;
}

/**
 * computeDiscount(total)
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

/**
 * Create a new order (with optional file upload)
 * This route will:
 *  - upload any provided files to Cloudinary,
 *  - parse order items,
 *  - atomically decrement Item.quantity for each ordered item inside a transaction,
 *  - set Item.availability = false when quantity reaches 0,
 *  - save the Order in the same transaction.
 */
router.post("/", upload.array("images"), async (req, res) => {
  let session;
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
    let rawItems;
    if (Array.isArray(req.body.items)) {
      rawItems = req.body.items;
    } else {
      try {
        rawItems = JSON.parse(req.body.items || "[]");
      } catch (e) {
        // If req.body.items is not valid JSON, abort
        return res.status(400).json({ error: "Invalid items payload" });
      }
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ error: "Order must include at least one item." });
    }

    const useIndexMapping =
      uploadedItems.length > 0 && uploadedItems.length === rawItems.length;

    // 3) Normalize order items so schema-required fields are present
    const items = rawItems.map((item, idx) => {
      const idRaw = item && (item.id || item.itemId || item._id) ? (item.id || item.itemId || item._id) : null;
      const id = idRaw != null ? String(idRaw) : null;

      if (!id) {
        throw new Error("Each item must include an id.");
      }

      const qty = Math.max(0, Number(item.quantity) || 0);
      const price = Number(item.price) || 0;
      const subtotal = +(qty * price).toFixed(2);

      const uploadedUrl = useIndexMapping ? uploadedItems[idx] : undefined;
      const normalizedUrl = uploadedUrl || pickImageUrlFromItem(item);

      const images = [];
      if (normalizedUrl) images.push(normalizedUrl);

      return {
        id,
        name: item.name || "Untitled Item",
        quantity: qty,
        price,
        subtotal,
        image: typeof normalizedUrl === "string" ? normalizedUrl : undefined,
        images,
      };
    });

    // 4) Compute total safely (server-source-of-truth)
    const total = items.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0);

    // 5) Parse address field
    const address =
      typeof req.body.address === "string"
        ? (() => { try { return JSON.parse(req.body.address || "{}"); } catch (e) { return {}; } })()
        : req.body.address || {};

    const notes = typeof req.body.notes === "string" ? req.body.notes : "";

    // 6) Get user's coordinates from DB (fallback to coordinates in req.body)
    let userCoords = null;
    const userDoc = await User.findOne({ _id: userId }).lean().select("coordinates");
    if (userDoc && userDoc.coordinates && userDoc.coordinates.lat != null && userDoc.coordinates.lng != null) {
      userCoords = {
        lat: Number(userDoc.coordinates.lat),
        lng: Number(userDoc.coordinates.lng),
      };
    } else {
      const clientCoords =
        typeof req.body.coordinates === "string" ? (() => { try { return JSON.parse(req.body.coordinates || "{}"); } catch (e) { return {}; } })() : req.body.coordinates;
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
      deliveryFee = 0;
    }

    // 8) Compute discount based on "total" (before delivery)
    const discountInfo = computeDiscount(total);
    const discountAmount = discountInfo.amount != null ? discountInfo.amount : null;
    const discountPercent = discountInfo.percent != null ? discountInfo.percent : null;

    // 9) Compute grand total = total - discount + deliveryFee
    const grandTotal = parseFloat((total - (discountAmount || 0) + deliveryFee).toFixed(2));

    //
    // --- STOCK ADJUSTMENTS + ORDER SAVE (TRANSACTION) ---
    //
    // Start a session for transaction (requires replica set)
    session = await mongoose.startSession();
    session.startTransaction();

    try {
      // For each ordered item, attempt atomic decrement
      for (const it of items) {
        const oid = mongoose.Types.ObjectId.isValid(it.id) ? mongoose.Types.ObjectId(it.id) : it.id;

        // require positive quantity
        if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
          // skip stock change for zero-quantity items; you likely want to reject such orders earlier
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ error: `Invalid quantity for item ${it.id}` });
        }

        // Atomically decrement only if there is enough stock
        const updatedItem = await Item.findOneAndUpdate(
          { _id: oid, quantity: { $gte: it.quantity } },
          { $inc: { quantity: -it.quantity } },
          { new: true, session }
        );

        if (!updatedItem) {
          // insufficient stock or item missing -> abort
          // find the current state for better error message
          const existing = await Item.findById(oid).session(session).lean();
          const availableQty = existing ? (existing.quantity ?? 0) : 0;
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            error: "Insufficient stock",
            itemId: it.id,
            requested: it.quantity,
            available: availableQty,
          });
        }

        // If quantity reached zero, ensure availability is false
        if ((updatedItem.quantity === 0) && updatedItem.availability) {
          // Set availability false (in same session)
          await Item.updateOne({ _id: updatedItem._id }, { $set: { availability: false } }, { session });
        }
      } // end loop items

      // Now create the order within the same session
      const newOrder = new Order({
        userId,
        items,
        total,
        deliveryFee,
        discount: discountAmount,
        grandTotal,
        address,
        notes,
        // save coordinates under the correct key only
        coordinates: userCoords ? { lat: userCoords.lat, lng: userCoords.lng } : undefined,
      });

      await newOrder.save({ session });

      // commit transaction
      await session.commitTransaction();
      session.endSession();

      // Return response (order saved). Note: newOrder is the session-saved doc.
      const resp = {
        order: newOrder,
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
    } catch (txErr) {
      // abort on any error inside transaction
      try {
        await session.abortTransaction();
      } catch (e) {
        console.error("Error aborting transaction:", e);
      }
      try { session.endSession(); } catch (e) {}

      // Log full stack for debugging (safe on server logs)
      console.error("Transaction error while creating order:", txErr && (txErr.stack || txErr.message || txErr));

      // If txErr indicates transactions unsupported, return clearer instructions
      if (txErr && /transactions|replica set/i.test(String(txErr.message || ""))) {
        return res.status(500).json({
          error: "Database transactions not supported by current MongoDB deployment. To safely process orders with stock updates enable replica set / use Atlas.",
        });
      }

      // For other transaction errors, return a safe message while logging full stack
      const safeMessage = (txErr && txErr.message) ? `Transaction failed: ${txErr.message}` : "Failed to create order (transaction aborted)";
      return res.status(500).json({ error: safeMessage });
    }
  } catch (error) {
    // If sessions are not supported (e.g., standalone MongoDB) the startSession or transaction may fail.
    console.error("Order creation error:", error);

    // If session was created, ensure it was ended
    if (session) {
      try { session.endSession(); } catch (e) {}
    }

    // If the error indicates transactions unsupported, provide a clear message.
    if (error && /transactions|replica set/i.test(String(error.message || ""))) {
      return res.status(500).json({
        error: "Database transactions not supported by current MongoDB deployment. To safely process orders with stock updates enable replica set / use Atlas."
      });
    }

    // Generic fallback with safer message
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
