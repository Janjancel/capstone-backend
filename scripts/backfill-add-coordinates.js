// /**
//  * scripts/backfill-add-coordinates.js
//  *
//  * Backfill rules (per request):
//  *  - If user has existing coordinates (checked in common places), normalize
//  *    them to integers (Math.round) and write to root `lat` and `lng`.
//  *  - If NO prior coordinate is found for a user, set root `lat` and `lng` to 0.
//  *
//  * Usage:
//  *   # Dry-run (preview only, default)
//  *   node scripts/backfill-add-coordinates.js --dry-run
//  *
//  *   # Apply changes (actually write)
//  *   node scripts/backfill-add-coordinates.js --apply
//  *
//  * Environment:
//  *   Set MONGODB_URI env var or pass --mongodbUri="mongodb://..."
//  *
//  * IMPORTANT: Test on a copy of your DB before running in production.
//  */

// const mongoose = require("mongoose");
// const path = require("path");

// // parse args (use minimist if available)
// let argv;
// try {
//   argv = require("minimist")(process.argv.slice(2));
// } catch (e) {
//   argv = {};
//   process.argv.slice(2).forEach((arg) => {
//     if (arg.startsWith("--")) {
//       const [k, v] = arg.slice(2).split("=");
//       argv[k] = v === undefined ? true : v;
//     }
//   });
// }

// const DRY_RUN = argv["dry-run"] || (!argv.apply && !argv.force);
// const APPLY = !!(argv.apply || argv.force);
// const MONGO_URI = process.env.MONGODB_URI || argv.mongodbUri || argv.mongodbURI;

// if (!MONGO_URI) {
//   console.error("ERROR: Set MONGODB_URI environment variable or pass --mongodbUri.");
//   process.exit(1);
// }

// async function main() {
//   console.log(`Connecting to MongoDB: ${MONGO_URI}`);
//   await mongoose.connect(MONGO_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   });

//   // Try to load User model from common locations. Adjust if your app differs.
//   let User;
//   const possiblePaths = [
//     path.resolve(process.cwd(), "models", "User.js"),
//     path.resolve(process.cwd(), "models", "user.js"),
//     path.resolve(process.cwd(), "src", "models", "User.js"),
//     path.resolve(process.cwd(), "src", "models", "user.js"),
//     path.resolve(process.cwd(), "models", "index.js"),
//     path.resolve(process.cwd(), "User.js"),
//     path.resolve(process.cwd(), "user.js"),
//   ];

//   for (const p of possiblePaths) {
//     try {
//       const mod = require(p);
//       if (mod && (typeof mod.findOne === "function" || mod.modelName)) {
//         User = mod;
//         console.log("Loaded User model from:", p);
//         break;
//       }
//       if (mod && mod.default && (typeof mod.default.findOne === "function" || mod.default.modelName)) {
//         User = mod.default;
//         console.log("Loaded User model (default export) from:", p);
//         break;
//       }
//     } catch (e) {
//       // ignore
//     }
//   }

//   if (!User) {
//     try {
//       User = mongoose.model("User");
//       console.log("Loaded User model via mongoose.model('User')");
//     } catch (err) {
//       console.error("ERROR: Could not locate User model. Update possiblePaths or require model directly.");
//       await mongoose.disconnect();
//       process.exit(2);
//     }
//   }

//   const cursor = User.find().cursor();
//   let total = 0;
//   let wouldUpdate = 0;
//   let applied = 0;
//   let skipped = 0;
//   let errors = 0;

//   // convert candidate to integer if numeric, else null
//   const toIntOrNull = (v) => {
//     if (v === null || typeof v === "undefined") return null;
//     if (typeof v === "string") {
//       if (v.trim() === "" || isNaN(Number(v))) return null;
//       v = Number(v);
//     }
//     if (typeof v === "number" && Number.isFinite(v) && !Number.isNaN(v)) {
//       return Math.round(v);
//     }
//     return null;
//   };

//   for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
//     total++;
//     try {
//       const original = doc.toObject({ depopulate: true });
//       const addr = original.address || {};

//       // search candidates: address.coordinates, address.lat/lng, top-level lat/lng
//       let candLat = null;
//       let candLng = null;

//       if (addr && addr.coordinates) {
//         if (typeof addr.coordinates.lat !== "undefined") candLat = addr.coordinates.lat;
//         if (typeof addr.coordinates.lng !== "undefined") candLng = addr.coordinates.lng;
//       }

//       if ((candLat === null || typeof candLat === "undefined") && typeof addr.lat !== "undefined") {
//         candLat = addr.lat;
//       }
//       if ((candLng === null || typeof candLng === "undefined") && typeof addr.lng !== "undefined") {
//         candLng = addr.lng;
//       }

//       if ((candLat === null || typeof candLat === "undefined") && typeof original.lat !== "undefined") {
//         candLat = original.lat;
//       }
//       if ((candLng === null || typeof candLng === "undefined") && typeof original.lng !== "undefined") {
//         candLng = original.lng;
//       }

//       // Normalize candidate to integer (or null)
//       let newLat = toIntOrNull(candLat);
//       let newLng = toIntOrNull(candLng);

//       // If no prior coordinate was found for this user, set to 0 per request
//       const hadAnyCandidate = newLat !== null || newLng !== null;
//       if (!hadAnyCandidate) {
//         newLat = 0;
//         newLng = 0;
//       } else {
//         // If one side exists and other doesn't, set missing side to 0
//         if (newLat === null) newLat = 0;
//         if (newLng === null) newLng = 0;
//       }

//       // desired values (ensures numeric integers)
//       const desiredLat = typeof newLat === "number" ? newLat : 0;
//       const desiredLng = typeof newLng === "number" ? newLng : 0;

//       const beforeLat = typeof original.lat !== "undefined" ? original.lat : null;
//       const beforeLng = typeof original.lng !== "undefined" ? original.lng : null;

//       const needsUpdate =
//         beforeLat !== desiredLat ||
//         beforeLng !== desiredLng;

//       const summary = {
//         _id: doc._id,
//         before: { lat: beforeLat, lng: beforeLng },
//         after: { lat: desiredLat, lng: desiredLng },
//       };

//       if (!needsUpdate) {
//         skipped++;
//         continue;
//       }

//       if (DRY_RUN) {
//         console.log("[DRY-RUN] WOULD update:", JSON.stringify(summary));
//         wouldUpdate++;
//       } else if (APPLY) {
//         await User.updateOne({ _id: doc._id }, { $set: { lat: desiredLat, lng: desiredLng } });
//         console.log("[APPLIED] updated", doc._id.toString(), summary);
//         applied++;
//       }
//     } catch (err) {
//       errors++;
//       console.error("Error processing doc:", err && err.message ? err.message : err);
//     }
//   }

//   console.log("=== BACKFILL SUMMARY ===");
//   console.log("Total scanned:", total);
//   console.log("Would-update (dry-run):", wouldUpdate);
//   console.log("Applied updates:", applied);
//   console.log("Skipped (no change needed):", skipped);
//   console.log("Errors:", errors);

//   await mongoose.disconnect();
//   process.exit(errors > 0 ? 3 : 0);
// }

// main().catch((err) => {
//   console.error("Fatal error:", err);
//   process.exit(9);
// });


// scripts/backfill-add-coordinates.js
// Backfill user.coordinates (lat/lng) from address fields using Nominatim + DB cache
//
// Usage (PowerShell):
// $env:MONGO_URI="mongodb://user:pass@host:27017/yourdb"; node .\scripts\backfill-add-coordinates.js
//
// Notes:
// - Replace USER_AGENT with real contact email/app name (required by Nominatim policy)
// - If geocoding fails or no address → coordinates = { lat: 0, lng: 0 }

const mongoose = require("mongoose");
const axios = require("axios");
const path = require("path");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/yourdb";
const USER_MODEL_PATH = path.join(__dirname, "..", "models", "User"); 
const User = require(USER_MODEL_PATH);

// GeoCache collection
const geoCacheSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true },
  coordinates: { type: [Number], default: undefined }, // [lng, lat]
  createdAt: { type: Date, default: Date.now },
});
const GeoCache =
  mongoose.models.GeoCache || mongoose.model("GeoCache", geoCacheSchema);

/** --- CONFIG --- **/
const USER_AGENT = "YourAppName/1.0 (your-email@example.com)"; 
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DELAY_MS = 1500;
const DRY_RUN = false;
/** -------------- **/

function buildAddressString(addr = {}) {
  const parts = [
    addr.houseNo,
    addr.street,
    addr.barangay,
    addr.city,
    addr.province,
    addr.region,
    addr.zipCode,
  ].filter(Boolean);
  return parts.join(", ");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function geocodeAddress(addressString) {
  if (!addressString) return null;

  // check DB cache
  const cached = await GeoCache.findOne({ key: addressString }).lean();
  if (cached && Array.isArray(cached.coordinates)) {
    return cached.coordinates;
  }

  // Call Nominatim
  try {
    const params = {
      q: addressString,
      format: "json",
      limit: 1,
      addressdetails: 0,
      countrycodes: "ph",
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

        // Save to cache
        try {
          await GeoCache.findOneAndUpdate(
            { key: addressString },
            { key: addressString, coordinates: coords },
            { upsert: true }
          );
        } catch (_) {}

        return coords;
      }
    }

    // Cache negative result
    await GeoCache.findOneAndUpdate(
      { key: addressString },
      { key: addressString, coordinates: undefined },
      { upsert: true }
    );

    return null;
  } catch (err) {
    console.error(
      "Geocode request failed for:",
      addressString,
      "->",
      err.message
    );
    return null;
  }
}

async function run() {
  console.log("Connecting to MongoDB:", MONGO_URI);
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    const cursor = User.find({
      address: { $exists: true, $ne: null },
      $or: [
        { coordinates: { $exists: false } },
        { "coordinates.lat": { $in: [null, undefined] } },
        { "coordinates.lng": { $in: [null, undefined] } },
      ],
    }).cursor();

    let processed = 0;
    let updated = 0;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      processed++;

      const addrObj = doc.address || {};
      const addrStr = buildAddressString(addrObj);

      if (!addrStr) {
        console.log(`[${processed}] User ${doc._id} has no valid address -> setting default 0 coords`);
        if (!DRY_RUN) {
          doc.coordinates = { lat: 0, lng: 0 };
          await doc.save();
          updated++;
        }
        continue;
      }

      const coords = await geocodeAddress(addrStr);

      if (!coords) {
        console.log(
          `[${processed}] Could not geocode user ${doc._id} (${addrStr}) -> setting coordinates to 0`
        );
        if (!DRY_RUN) {
          doc.coordinates = { lat: 0, lng: 0 };
          await doc.save();
          updated++;
        }
      } else {
        console.log(
          `[${processed}] Found coords for user ${doc._id}: [lng=${coords[0]}, lat=${coords[1]}]`
        );

        if (!DRY_RUN) {
          doc.coordinates = {
            lat: Math.round(coords[1]),
            lng: Math.round(coords[0]),
          };
          await doc.save();
          updated++;
        }
      }

      await sleep(DELAY_MS);
    }

    console.log("\nBackfill complete.");
    console.log("Processed:", processed);
    console.log("Updated:", updated);
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
