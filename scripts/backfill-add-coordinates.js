

// const mongoose = require("mongoose");
// const axios = require("axios");
// const path = require("path");

// const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/yourdb";
// const USER_MODEL_PATH = path.join(__dirname, "..", "models", "User"); 
// const User = require(USER_MODEL_PATH);

// // GeoCache collection
// const geoCacheSchema = new mongoose.Schema({
//   key: { type: String, unique: true, index: true },
//   coordinates: { type: [Number], default: undefined }, // [lng, lat]
//   createdAt: { type: Date, default: Date.now },
// });
// const GeoCache =
//   mongoose.models.GeoCache || mongoose.model("GeoCache", geoCacheSchema);

// /** --- CONFIG --- **/
// const USER_AGENT = "YourAppName/1.0 (your-email@example.com)"; 
// const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// const DELAY_MS = 1500;
// const DRY_RUN = false;
// /** -------------- **/

// function buildAddressString(addr = {}) {
//   const parts = [
//     addr.houseNo,
//     addr.street,
//     addr.barangay,
//     addr.city,
//     addr.province,
//     addr.region,
//     addr.zipCode,
//   ].filter(Boolean);
//   return parts.join(", ");
// }

// function sleep(ms) {
//   return new Promise((r) => setTimeout(r, ms));
// }

// async function geocodeAddress(addressString) {
//   if (!addressString) return null;

//   // check DB cache
//   const cached = await GeoCache.findOne({ key: addressString }).lean();
//   if (cached && Array.isArray(cached.coordinates)) {
//     return cached.coordinates;
//   }

//   // Call Nominatim
//   try {
//     const params = {
//       q: addressString,
//       format: "json",
//       limit: 1,
//       addressdetails: 0,
//       countrycodes: "ph",
//     };

//     const res = await axios.get(NOMINATIM_URL, {
//       params,
//       headers: {
//         "User-Agent": USER_AGENT,
//         Accept: "application/json",
//       },
//       timeout: 15000,
//     });

//     if (Array.isArray(res.data) && res.data.length > 0) {
//       const first = res.data[0];
//       const lat = parseFloat(first.lat);
//       const lon = parseFloat(first.lon);

//       if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
//         const coords = [lon, lat];

//         // Save to cache
//         try {
//           await GeoCache.findOneAndUpdate(
//             { key: addressString },
//             { key: addressString, coordinates: coords },
//             { upsert: true }
//           );
//         } catch (_) {}

//         return coords;
//       }
//     }

//     // Cache negative result
//     await GeoCache.findOneAndUpdate(
//       { key: addressString },
//       { key: addressString, coordinates: undefined },
//       { upsert: true }
//     );

//     return null;
//   } catch (err) {
//     console.error(
//       "Geocode request failed for:",
//       addressString,
//       "->",
//       err.message
//     );
//     return null;
//   }
// }

// async function run() {
//   console.log("Connecting to MongoDB:", MONGO_URI);
//   await mongoose.connect(MONGO_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   });

//   try {
//     const cursor = User.find({
//       address: { $exists: true, $ne: null },
//       $or: [
//         { coordinates: { $exists: false } },
//         { "coordinates.lat": { $in: [null, undefined] } },
//         { "coordinates.lng": { $in: [null, undefined] } },
//       ],
//     }).cursor();

//     let processed = 0;
//     let updated = 0;

//     for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
//       processed++;

//       const addrObj = doc.address || {};
//       const addrStr = buildAddressString(addrObj);

//       if (!addrStr) {
//         console.log(`[${processed}] User ${doc._id} has no valid address -> setting default 0 coords`);
//         if (!DRY_RUN) {
//           doc.coordinates = { lat: 0, lng: 0 };
//           await doc.save();
//           updated++;
//         }
//         continue;
//       }

//       const coords = await geocodeAddress(addrStr);

//       if (!coords) {
//         console.log(
//           `[${processed}] Could not geocode user ${doc._id} (${addrStr}) -> setting coordinates to 0`
//         );
//         if (!DRY_RUN) {
//           doc.coordinates = { lat: 0, lng: 0 };
//           await doc.save();
//           updated++;
//         }
//       } else {
//         console.log(
//           `[${processed}] Found coords for user ${doc._id}: [lng=${coords[0]}, lat=${coords[1]}]`
//         );

//         if (!DRY_RUN) {
//           doc.coordinates = {
//             lat: Math.round(coords[1]),
//             lng: Math.round(coords[0]),
//           };
//           await doc.save();
//           updated++;
//         }
//       }

//       await sleep(DELAY_MS);
//     }

//     console.log("\nBackfill complete.");
//     console.log("Processed:", processed);
//     console.log("Updated:", updated);
//   } catch (err) {
//     console.error("Backfill error:", err);
//   } finally {
//     await mongoose.disconnect();
//     console.log("Disconnected.");
//     process.exit(0);
//   }
// }

// run().catch((err) => {
//   console.error("Fatal error:", err);
//   process.exit(1);
// });


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
        const coords = [lon, lat]; // [lng, lat] as floats

        // Save to cache
        try {
          await GeoCache.findOneAndUpdate(
            { key: addressString },
            { key: addressString, coordinates: coords },
            { upsert: true }
          );
        } catch (err) {
          // keep running if cache write fails
          console.warn("Warning: failed saving to GeoCache:", err.message);
        }

        return coords;
      }
    }

    // Cache negative result
    try {
      await GeoCache.findOneAndUpdate(
        { key: addressString },
        { key: addressString, coordinates: undefined },
        { upsert: true }
      );
    } catch (err) {
      console.warn("Warning: failed saving negative cache:", err.message);
    }

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
        console.log(
          `[${processed}] User ${doc._id} has no valid address -> setting default 0.0 coords`
        );
        if (!DRY_RUN) {
          doc.coordinates = { lat: 0.0, lng: 0.0 };
          await doc.save();
          updated++;
        }
        continue;
      }

      const coords = await geocodeAddress(addrStr);

      if (!coords) {
        console.log(
          `[${processed}] Could not geocode user ${doc._id} (${addrStr}) -> setting coordinates to 0.0`
        );
        if (!DRY_RUN) {
          doc.coordinates = { lat: 0.0, lng: 0.0 };
          await doc.save();
          updated++;
        }
      } else {
        // coords is [lng, lat] (floats)
        console.log(
          `[${processed}] Found coords for user ${doc._id}: [lng=${coords[0]}, lat=${coords[1]}]`
        );

        if (!DRY_RUN) {
          // **IMPORTANT**: store as floats and do NOT round
          doc.coordinates = {
            lat: Number(coords[1]),
            lng: Number(coords[0]),
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
