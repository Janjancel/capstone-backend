// scripts/backfill-users.js
// Backfill user.location from address fields using Nominatim + DB cache
//
// Usage (PowerShell):
// $env:MONGO_URI="mongodb://user:pass@host:27017/yourdb"; node .\scripts\backfill-users.js
//
// Notes:
// - Replace the USER_AGENT constant with a real contact email/app name to comply with Nominatim policy.
// - Delay is set to 1500ms between requests to be polite. Increase if you want to be safer.

const mongoose = require("mongoose");
const axios = require("axios");
const path = require("path");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/yourdb";
const USER_MODEL_PATH = path.join(__dirname, "..", "models", "User"); // adjust if needed
const User = require(USER_MODEL_PATH);

// Simple cache model (collection: geocache)
const geoCacheSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true }, // full address string
  coordinates: { type: [Number], default: undefined }, // [lng, lat]
  createdAt: { type: Date, default: Date.now },
});
const GeoCache = mongoose.models.GeoCache || mongoose.model("GeoCache", geoCacheSchema);

/** --- CONFIG --- **/
const USER_AGENT = "YourAppName/1.0 (your-email@example.com)"; // <<-- REPLACE with real contact info
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DELAY_MS = 1500; // delay between external requests (ms). Be polite to Nominatim
const DRY_RUN = false; // set true to preview only (no DB updates)
/** -------------- **/

function buildAddressString(addr = {}) {
  const parts = [
    addr.houseNo,
    addr.street,
    addr.barangay,
    addr.city || addr.municipality,
    addr.province,
    addr.region,
    addr.zipCode,
  ].filter(Boolean);
  return parts.join(", ");
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function geocodeAddress(addressString) {
  if (!addressString) return null;

  // check DB cache first
  const cached = await GeoCache.findOne({ key: addressString }).lean();
  if (cached && Array.isArray(cached.coordinates) && cached.coordinates.length === 2) {
    return cached.coordinates;
  }

  // not cached -> call Nominatim
  try {
    const params = {
      q: addressString,
      format: "json",
      limit: 1,
      addressdetails: 0,
      countrycodes: "ph", // restrict to Philippines (optional but often helpful)
    };

    const res = await axios.get(NOMINATIM_URL, {
      params,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      timeout: 15000,
    });

    if (Array.isArray(res.data) && res.data.length > 0) {
      const first = res.data[0];
      const lat = parseFloat(first.lat);
      const lon = parseFloat(first.lon);
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        const coords = [lon, lat];
        // cache it
        try {
          await GeoCache.findOneAndUpdate(
            { key: addressString },
            { key: addressString, coordinates: coords },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        } catch (e) {
          // ignore cache write errors
          console.warn("GeoCache write warning:", e.message || e);
        }
        return coords;
      }
    }
    // nothing found: cache negative result as null coordinates to avoid repeated lookups
    try {
      await GeoCache.findOneAndUpdate(
        { key: addressString },
        { key: addressString, coordinates: undefined },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (e) {
      // ignore
    }
    return null;
  } catch (err) {
    console.error("Geocode request failed for:", addressString, "->", err.message || err);
    return null;
  }
}

async function run() {
  console.log("Connecting to MongoDB:", MONGO_URI);
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    // Find users with an address present and missing or invalid location
    const cursor = User.find({
      address: { $exists: true, $ne: null },
      $or: [
        { "location": { $exists: false } },
        { "location.coordinates": { $exists: false } },
        { $expr: { $lt: [{ $size: { $ifNull: ["$location.coordinates", []] } }, 2] } },
      ],
    }).cursor();

    let processed = 0;
    let updated = 0;
    let skippedNoAddress = 0;
    const summary = [];

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      processed++;
      const addrObj = doc.address || {};
      const addrStr = buildAddressString(addrObj);

      if (!addrStr) {
        console.log(`[${processed}] user ${doc._id} has no usable address — skipping.`);
        skippedNoAddress++;
        continue;
      }

      // Check cache and geocode if needed
      const coords = await geocodeAddress(addrStr);

      if (!coords || coords.length !== 2) {
        console.log(`[${processed}] Could not geocode address for user ${doc._id}: "${addrStr}"`);
        summary.push({ userId: doc._id.toString(), status: "not_found", address: addrStr });
      } else {
        console.log(`[${processed}] Found coords for user ${doc._id}: [lng=${coords[0]}, lat=${coords[1]}]`);
        if (!DRY_RUN) {
          // set location and save — don't modify other fields
          doc.location = { type: "Point", coordinates: coords };
          try {
            // Use updateOne to avoid triggering pre-save side-effects if desired.
            // But we call doc.save() to stick with model validations/hooks (password unchanged).
            // Because location is set, your model's pre-save geocode won't call external services.
            await doc.save();
            updated++;
            summary.push({ userId: doc._id.toString(), status: "updated", coordinates: coords });
          } catch (err) {
            console.error(`Failed to save user ${doc._id}:`, err.message || err);
            summary.push({ userId: doc._id.toString(), status: "save_failed", error: err.message || String(err) });
          }
        } else {
          // dry run - report only
          summary.push({ userId: doc._id.toString(), status: "would_update", coordinates: coords });
        }
      }

      // polite delay between external geocode calls
      await sleep(DELAY_MS);
    }

    console.log("Backfill completed.");
    console.log("Processed:", processed);
    console.log("Updated:", updated);
    console.log("Skipped (no address):", skippedNoAddress);
    // optional: write summary to file or print short summary
    console.log("Sample summary (first 20):", summary.slice(0, 20));
  } catch (err) {
    console.error("Backfill error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
