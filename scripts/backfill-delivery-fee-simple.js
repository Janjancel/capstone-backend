/* eslint-disable no-console */
/**
 * scripts/backfill-delivery-fee-simple.js
 *
 * Simple backfill: fill missing deliveryFee and grandTotal on orders.
 *
 * Usage:
 *   node .\scripts\backfill-delivery-fee-simple.js --mongodbUri="mongodb://127.0.0.1:27017/yourdb"
 *
 * Notes:
 * - Will only update orders where deliveryFee is missing or null.
 * - Skips orders with no coordinates available (no write).
 */

const mongoose = require("mongoose");
const path = require("path");

const argv = process.argv.slice(2);
const arg = (name) => {
  const found = argv.find((a) => a.startsWith(`${name}=`));
  if (found) return found.split("=")[1];
  return null;
};

const MONGO_URI = process.env.MONGODB_URI || arg("--mongodbUri") || null;
if (!MONGO_URI) {
  console.error("Provide MongoDB URI via --mongodbUri or MONGODB_URI env var.");
  process.exit(1);
}

// Haversine distance (km)
const toRad = (deg) => (deg * Math.PI) / 180;
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Pivot: Lucena City Hall
const PIVOT = { lat: 13.9365569, lng: 121.6115341 };
const FREE_RADIUS_KM = 15;
const STEP_KM = 3;
const STEP_FEE = 1000;

const computeDeliveryFee = (distanceKm) => {
  if (!distanceKm || distanceKm <= FREE_RADIUS_KM) return 0;
  const extra = distanceKm - FREE_RADIUS_KM;
  const steps = Math.ceil(extra / STEP_KM);
  return steps * STEP_FEE;
};

(async function main() {
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("Connected to MongoDB");

    const User = require(path.join(__dirname, "..", "models", "User"));
    const Order = require(path.join(__dirname, "..", "models", "Order"));

    // Only orders where deliveryFee does not exist or is null
    const cursor = Order.find({ $or: [{ deliveryFee: { $exists: false } }, { deliveryFee: null }] }).cursor();

    let processed = 0;
    let updated = 0;
    let skipped = 0;

    for (let order = await cursor.next(); order != null; order = await cursor.next()) {
      processed++;

      // Try to get coordinates: User -> order.coordinates -> order.coodrinates
      let coords = null;
      try {
        if (order.userId) {
          const user = await User.findOne({ _id: order.userId }).lean().select("coordinates");
          if (user && user.coordinates && user.coordinates.lat != null && user.coordinates.lng != null) {
            coords = { lat: Number(user.coordinates.lat), lng: Number(user.coordinates.lng) };
          }
        }
      } catch (e) {
        // ignore lookup failure for this order, fallback to order fields
      }

      if (!coords) {
        if (order.coordinates && order.coordinates.lat != null && order.coordinates.lng != null) {
          coords = { lat: Number(order.coordinates.lat), lng: Number(order.coordinates.lng) };
        } else if (order.coodrinates && order.coodrinates.lat != null && order.coodrinates.lng != null) {
          coords = { lat: Number(order.coodrinates.lat), lng: Number(order.coodrinates.lng) };
        }
      }

      if (!coords) {
        skipped++;
        continue;
      }

      const distanceKm = haversineKm(PIVOT.lat, PIVOT.lng, coords.lat, coords.lng);
      const deliveryFee = computeDeliveryFee(distanceKm);
      const total = Number(order.total || 0);
      const grandTotal = +(total + deliveryFee);

      // Minimal update
      const update = {
        $set: {
          deliveryFee,
          grandTotal,
          // ensure coordinates are stored as floats (non-destructive)
          coordinates: { lat: coords.lat, lng: coords.lng },
        },
      };

      await Order.updateOne({ _id: order._id }, update).exec();
      updated++;
    }

    console.log("Backfill finished.");
    console.log(`Processed: ${processed}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped (no coords): ${skipped}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Backfill failed:", err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
})();
