// scripts/backfill-deliveryFee.js
/* eslint-disable no-console */
const mongoose = require("mongoose");

const { Schema, model } = mongoose;

// ---- Lightweight Order model (bypass validations) ----
// Default collection name for model "OrderLite" is "orders"
const OrderLite = mongoose.models.OrderLite || model(
  "OrderLite",
  new Schema({}, { strict: false, collection: "orders" })
);

// Haversine helpers
function toRad(deg) {
  return (deg * Math.PI) / 180;
}
function computeDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null ||
    Number.isNaN(lat1) ||
    Number.isNaN(lon1) ||
    Number.isNaN(lat2) ||
    Number.isNaN(lon2)
  ) return null;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function computeDeliveryFeeFromDistance(distanceKm) {
  if (distanceKm == null) return null;
  if (distanceKm <= 30) return 0;
  const extraKm = distanceKm - 30;
  const blocks = Math.ceil(extraKm / 10);
  return blocks * 1000;
}

function getBaseDate(doc) {
  if (doc.createdAt) return new Date(doc.createdAt);
  if (doc._id && typeof doc._id.getTimestamp === "function") return doc._id.getTimestamp();
  try {
    const oid = new mongoose.Types.ObjectId(doc._id);
    return oid.getTimestamp();
  } catch {
    return new Date();
  }
}

async function backfill() {
  // Query: missing or null or empty deliveryFee or missing grandTotal
  const q = {
    $or: [
      { deliveryFee: { $exists: false } },
      { deliveryFee: null },
      { deliveryFee: { $regex: /^\s*$/ } },
      { grandTotal: { $exists: false } },
    ],
  };

  const cursor = OrderLite.find(q).cursor();
  let scanned = 0;
  let updated = 0;

  // pivot coords (env override)
  const PIVOT_LAT = process.env.PIVOT_LAT ? Number(process.env.PIVOT_LAT) : 13.9414;
  const PIVOT_LNG = process.env.PIVOT_LNG ? Number(process.env.PIVOT_LNG) : 121.6173;

  for await (const o of cursor) {
    scanned += 1;

    try {
      // compute itemsSubtotal (safe)
      const items = Array.isArray(o.items) ? o.items : [];
      let itemsSubtotal = 0;
      for (const it of items) {
        const qty = Number(it?.quantity) || 0;
        const price = Number(it?.price) || Number(it?.unitPrice) || 0;
        const subtotal = (it && typeof it.subtotal !== "undefined") ? Number(it.subtotal) : +(qty * price);
        itemsSubtotal += Number.isFinite(subtotal) ? subtotal : +(qty * price);
      }
      itemsSubtotal = +itemsSubtotal.toFixed(2);

      // extract coords from address (support multiple shapes)
      const address = o.address || {};
      let custLat = null;
      let custLng = null;
      if (address) {
        if (address.coords && typeof address.coords === "object") {
          custLat = address.coords.lat ?? address.coords.latitude ?? null;
          custLng = address.coords.lng ?? address.coords.longitude ?? null;
        } else {
          custLat = address.lat ?? address.latitude ?? null;
          custLng = address.lng ?? address.longitude ?? null;
        }
        custLat = custLat !== undefined && custLat !== null ? Number(custLat) : null;
        custLng = custLng !== undefined && custLng !== null ? Number(custLng) : null;
      }

      const distanceKm = computeDistanceKm(PIVOT_LAT, PIVOT_LNG, custLat, custLng);
      let fee = computeDeliveryFeeFromDistance(distanceKm);

      // lenient default if coords missing
      if (fee === null) {
        fee = 0;
      }

      const grandTotal = +((itemsSubtotal + fee).toFixed(2));

      const needsUpdate =
        o.deliveryFee !== fee ||
        o.itemsSubtotal !== itemsSubtotal ||
        o.total !== grandTotal ||
        o.grandTotal !== grandTotal;

      if (!needsUpdate) continue;

      // perform update
      await OrderLite.updateOne(
        { _id: o._id },
        {
          $set: {
            deliveryFee: fee,
            itemsSubtotal: itemsSubtotal,
            total: grandTotal,
            grandTotal: grandTotal,
            deliveryFeeBackfilled: {
              backfilledAt: new Date(),
              pivot: { lat: PIVOT_LAT, lng: PIVOT_LNG },
              distanceKm: distanceKm == null ? null : Number(distanceKm.toFixed(6)),
            },
          },
        }
      );

      updated += 1;
    } catch (err) {
      console.error(`❌ Failed to process order ${o._id}:`, err);
    }
  }

  console.log(`Backfill complete. Scanned: ${scanned}, Updated: ${updated}`);
}

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Please set MONGO_URI in your environment.");
    process.exit(1);
  }

  await mongoose.connect(uri, { autoIndex: false });
  console.log("Connected to MongoDB");

  await backfill();

  await mongoose.disconnect();
  console.log("Disconnected");
})();
