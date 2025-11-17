// const express = require("express");
// const router = express.Router();
// const User = require("../models/User");

// // POST /api/address/save
// router.post("/save", async (req, res) => {
//   const { userId, address } = req.body;
//   try {
//     const user = await User.findById(userId);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     user.address = address;
//     await user.save();

//     res.json({ message: "Address saved successfully" });
//   } catch (err) {
//     console.error("Save address error:", err);
//     res.status(500).json({ message: "Failed to save address" });
//   }
// });


// // Example for backend route to fetch the user's address
// router.get("/:userId", async (req, res) => {
//   try {
//     const user = await User.findById(req.params.userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }
//     res.json(user.address || {});
//   } catch (err) {
//     console.error("Fetch address error:", err);
//     res.status(500).json({ message: "Failed to fetch address" });
//   }
// });


// module.exports = router;


const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");

/**
 * Address & Coordinates router
 * Base (in your app): /api/address
 *
 * Routes:
 *  POST /save               -> save/update address (body: { userId, address })
 *  GET  /:userId            -> fetch address for a user
 *  POST /coordinates/save   -> save/update coordinates (body: { userId, coordinates: { lat, lng } })
 *  POST /coordinates        -> alternative path (same handler) accepts same body
 *  GET  /coordinates/:userId-> fetch coordinates for a user
 *
 * NOTE: This router expects `userId` to be a Mongo ObjectId string when using findById.
 */

/* ---------------------------
   Helper: validate ObjectId
   --------------------------- */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/* ---------------------------
   Save or update address
   --------------------------- */
router.post("/save", async (req, res) => {
  const { userId, address } = req.body;

  if (!userId || !isValidObjectId(userId)) {
    return res.status(400).json({ message: "Invalid or missing userId" });
  }

  if (!address || typeof address !== "object") {
    return res.status(400).json({ message: "Invalid or missing address object" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.address = address;
    await user.save();

    res.json({ message: "Address saved successfully", address: user.address });
  } catch (err) {
    console.error("Save address error:", err);
    res.status(500).json({ message: "Failed to save address" });
  }
});

/* ---------------------------
   Fetch address by userId
   --------------------------- */
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    return res.status(400).json({ message: "Invalid userId" });
  }

  try {
    const user = await User.findById(userId, "address");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user.address || {});
  } catch (err) {
    console.error("Fetch address error:", err);
    res.status(500).json({ message: "Failed to fetch address" });
  }
});

/* ---------------------------
   Save or update coordinates
   --------------------------- */
/**
 * Accepts:
 *  {
 *    userId: "<mongoId>",
 *    coordinates: { lat: 123.456, lng: 456.789 }
 *  }
 *
 * This handler accepts floats or numeric strings and stores them as Numbers (floats) on user.coordinates.
 */

// Extract the coordinates-save logic to a handler so we can reuse it on two routes
async function saveCoordinatesHandler(req, res) {
  const { userId, coordinates } = req.body;

  if (!userId || !isValidObjectId(userId)) {
    return res.status(400).json({ message: "Invalid or missing userId" });
  }

  if (!coordinates || typeof coordinates !== "object") {
    return res.status(400).json({ message: "Invalid or missing coordinates object" });
  }

  const { lat, lng } = coordinates;

  // Accept numeric floats or numeric strings that represent finite numbers.
  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return res
      .status(400)
      .json({ message: "lat and lng must be valid numeric values (finite numbers)" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Save under user.coordinates as your schema expects — store the floats exactly.
    user.coordinates = {
      lat: latNum,
      lng: lngNum,
    };

    await user.save();

    res.json({ message: "Coordinates saved successfully", coordinates: user.coordinates });
  } catch (err) {
    console.error("Save coordinates error:", err);
    res.status(500).json({ message: "Failed to save coordinates" });
  }
}

// Primary route (existing one)
router.post("/coordinates/save", saveCoordinatesHandler);
// Added tolerant alternative route — some clients/proxies might post to /coordinates
router.post("/coordinates", saveCoordinatesHandler);

/* ---------------------------
   Fetch coordinates by userId
   --------------------------- */
router.get("/coordinates/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    return res.status(400).json({ message: "Invalid userId" });
  }

  try {
    const user = await User.findById(userId, "coordinates");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user.coordinates || { lat: null, lng: null });
  } catch (err) {
    console.error("Fetch coordinates error:", err);
    res.status(500).json({ message: "Failed to fetch coordinates" });
  }
});

// GET /coordinates/byUserId/:customUserId
router.get("/coordinates/byUserId/:customUserId", async (req, res) => {
  const { customUserId } = req.params;
  if (!customUserId) return res.status(400).json({ message: "Missing userId" });

  try {
    // find by your custom userId field (not Mongo _id)
    const user = await User.findOne({ userId: customUserId }, "coordinates");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user.coordinates || { lat: null, lng: null });
  } catch (err) {
    console.error("Fetch coordinates by userId error:", err);
    res.status(500).json({ message: "Failed to fetch coordinates" });
  }
});


module.exports = router;
