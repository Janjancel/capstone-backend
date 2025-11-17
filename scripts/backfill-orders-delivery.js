// /* eslint-disable no-console */
// // scripts/backfill-orders-delivery.js
// // Backfills subtotal, deliveryFee and total for existing orders.
// // Also attempts to geocode address.formatted -> address.coords using Nominatim
// // when coords are missing. Use --dry to preview without saving.

// const mongoose = require('mongoose');
// const axios = require('axios');
// const argv = require('minimist')(process.argv.slice(2));

// // Load Order model (adjust path if your project layout differs)
// const Order = require('../models/Order');

// // Config (same as model)
// const PIVOT = { lat: 13.9365569, lng: 121.6115341 };
// function toRad(deg) { return (deg * Math.PI) / 180; }
// function distanceKm(lat1, lon1, lat2, lon2) {
//   const R = 6371;
//   const dLat = toRad(lat2 - lat1);
//   const dLon = toRad(lon2 - lon1);
//   const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   return R * c;
// }
// function computeDeliveryFee(distanceKmFromPivot) {
//   const baseRadius = 30; // km
//   const stepKm = 10; // per 10km
//   const stepFee = 1000; // PHP
//   if (!isFinite(distanceKmFromPivot) || distanceKmFromPivot <= baseRadius) return 0;
//   const extra = distanceKmFromPivot - baseRadius;
//   const steps = Math.ceil(extra / stepKm);
//   return steps * stepFee;
// }

// // CLI options
// const DRY = !!argv.dry;
// const FORCE = !!argv.force; // force re-calc even if totals exist
// const BATCH = Number(argv.batch) || 200; // how many orders per DB query
// const DELAY = Number(argv.delay) || 150; // ms between geocode calls

// if (!process.env.MONGO_URI) {
//   console.error('ERROR: Set MONGO_URI environment variable before running.');
//   console.error('Example (PowerShell): $env:MONGO_URI="mongodb://user:pass@host:27017/db"');
//   process.exit(1);
// }

// async function geocodeAddress(formatted) {
//   // Uses Nominatim search to get coordinates for a formatted address.
//   // Keep usage polite: add small delay between calls.
//   if (!formatted) return null;
//   const url = 'https://nominatim.openstreetmap.org/search';
//   try {
//     const res = await axios.get(url, {
//       params: { q: formatted, format: 'jsonv2', limit: 1, 'accept-language': 'en' },
//       headers: { 'User-Agent': 'backfill-script/1.0 (your-email@example.com)' },
//       timeout: 10000,
//     });
//     const items = res.data;
//     if (Array.isArray(items) && items.length) {
//       const it = items[0];
//       return { lat: Number(it.lat), lng: Number(it.lon), raw: it };
//     }
//     return null;
//   } catch (e) {
//     console.warn('Geocode failed for', formatted, e.message);
//     return null;
//   }
// }

// async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// async function processBatch() {
//   await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
//   console.log('Connected to MongoDB');

//   const query = FORCE
//     ? {}
//     : { $or: [ { subtotal: { $exists: false } }, { deliveryFee: { $exists: false } }, { total: { $exists: false } } ] };

//   let processed = 0;
//   let updated = 0;
//   let cursor = Order.find(query).cursor({ batchSize: BATCH });

//   for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
//     processed += 1;

//     // compute subtotal
//     const subtotal = (Array.isArray(doc.items) ? doc.items : [])
//       .reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);

//     // Ensure address object exists
//     if (!doc.address) doc.address = {};
//     if (!doc.address.coords || !Number.isFinite(doc.address.coords.lat) || !Number.isFinite(doc.address.coords.lng)) {
//       // try geocoding from formatted address
//       if (doc.address.formatted) {
//         const geo = await geocodeAddress(doc.address.formatted);
//         if (geo) {
//           doc.address.coords = { lat: geo.lat, lng: geo.lng };
//           doc.address.raw = doc.address.raw || geo.raw;
//           console.log(`Geocoded order ${doc._id} -> ${geo.lat},${geo.lng}`);
//         }
//         await sleep(DELAY);
//       }
//     }

//     // compute distance and deliveryFee
//     let distKm = NaN;
//     if (doc.address && doc.address.coords && Number.isFinite(doc.address.coords.lat) && Number.isFinite(doc.address.coords.lng)) {
//       distKm = distanceKm(PIVOT.lat, PIVOT.lng, Number(doc.address.coords.lat), Number(doc.address.coords.lng));
//     }
//     const deliveryFee = computeDeliveryFee(distKm);
//     const total = Math.round((subtotal + deliveryFee) * 100) / 100;

//     const needsUpdate = FORCE || doc.subtotal !== subtotal || doc.deliveryFee !== deliveryFee || doc.total !== total || !doc.address.raw;

//     if (needsUpdate) {
//       console.log(`${DRY ? '[DRY] ' : ''}Updating order ${doc._id} — subtotal:${subtotal} deliveryFee:${deliveryFee} total:${total}`);
//       if (!DRY) {
//         doc.subtotal = subtotal;
//         doc.deliveryFee = deliveryFee;
//         doc.total = total;
//         await doc.save();
//         updated += 1;
//       }
//     }

//     // throttle writes a little
//     if (processed % 50 === 0) await sleep(100);
//   }

//   console.log('Done. Processed:', processed, 'Updated:', DRY ? 0 : updated);
//   await mongoose.disconnect();
// }

// processBatch().catch((err) => {
//   console.error('Script failed:', err);
//   process.exit(2);
// });


/**
 * Backfill script: backfill-orders-delivery.js
 *
 * Usage:
 *   node ./scripts/backfill-orders-delivery.js --mongodbUri="mongodb://127.0.0.1:27017/yourdb"
 *
 * Environment:
 *   - or set MONGODB_URI env var and omit --mongodbUri
 *
 * Options:
 *   --dryRun       : do not write changes, only print summary and sample updates
 *   --batchSize=N  : number of updates per bulkWrite (default 500)
 *
 * What it does:
 *   - Scans Orders collection
 *   - For each order computes deliveryFee based on coordinates (or legacy coodrinates)
 *   - Updates documents where deliveryFee or grandTotal differ from computed values
 *   - Uses bulkWrite batches for performance and controlled memory usage
 */

/**
 * backfill-orders-delivery.js
 *
 * Usage:
 *   node ./scripts/backfill-orders-delivery.js --mongodbUri="mongodb://127.0.0.1:27017/yourdb" [--dryRun] [--batchSize=500]
 *
 * Or set env var:
 *   MONGODB_URI="mongodb://..." node ./scripts/backfill-orders-delivery.js
 *
 * Options:
 *   --dryRun        (flag) If present, no writes will be performed; script will only report.
 *   --batchSize=N   (default 500) Number of updates to apply per bulkWrite.
 *
 * Behavior:
 *   - Computes deliveryFee using Lucena City Hall pivot (13.9365569, 121.6115341)
 *   - deliveryFee = 0 if distance <= 30km
 *   - otherwise deliveryFee = Math.ceil((distance - 30) / 10) * 1000
 *   - Updates orders where deliveryFee or grandTotal differ from computed values
 *   - Copies legacy 'coodrinates' to 'coordinates' if coordinates missing
 *   - Safe bulkWrite batches and sample logging
 */

const mongoose = require("mongoose");
const path = require("path");

const argv = process.argv.slice(2);

/**
 * Improved arg parsing helpers:
 * - `--mongodbUri=value`
 * - `--dryRun` (boolean flag)
 * - `--batchSize=value`
 */
function getArgValue(name) {
  const kv = argv.find(a => a.startsWith(`${name}=`));
  if (kv) return kv.split("=")[1];
  return null;
}
function hasFlag(name) {
  return argv.includes(name);
}

const rawMongoArg = process.env.MONGODB_URI || getArgValue("--mongodbUri") || null;
const DRY = hasFlag("--dryRun");
const BATCH_SIZE = parseInt(getArgValue("--batchSize") || "500", 10);

if (!rawMongoArg) {
  console.error("Please provide --mongodbUri or set MONGODB_URI env var.");
  process.exit(1);
}

/**
 * Normalize Mongo URI to handle malformed option syntax:
 * - removes trailing '?' or '&'
 * - converts bare options (e.g. ?retryWrites or &ssl) to =true
 *
 * Examples:
 *   ...?retryWrites -> ...?retryWrites=true
 *   ...?retryWrites&ssl=true -> ...?retryWrites=true&ssl=true
 */
function normalizeMongoUri(raw) {
  if (!raw || typeof raw !== "string") return raw;

  // Trim whitespace
  let uri = raw.trim();

  // Remove stray trailing ? or &
  uri = uri.replace(/[?&]+$/, "");

  // If there are no options, return early
  if (!uri.includes("?")) return uri;

  // Split base and query
  const [base, query] = uri.split("?", 2);
  if (!query) return base;

  // Parse query parts and repair bare keys
  const parts = query.split("&").filter(Boolean).map((part) => {
    if (part.includes("=")) return part;
    // bare key -> key=true
    return `${part}=true`;
  });

  return `${base}?${parts.join("&")}`;
}

/**
 * Mask credentials in URI for logging (do not print password in logs)
 */
function maskMongoUriForLog(uri) {
  try {
    // simple mask: replace user:pass@ with user:****@
    return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, (m, u) => `//${u}:****@`);
  } catch {
    return uri;
  }
}

const MONGO_URI = normalizeMongoUri(rawMongoArg);
console.log("Backfill starting with options:");
console.log("  Dry run:", DRY ? "YES" : "NO");
console.log("  Batch size:", BATCH_SIZE);
console.log("  Mongo URI (masked):", maskMongoUriForLog(MONGO_URI));

// load Order model (adjust path if your models directory differs)
const ORDER_MODEL_PATH = path.join(__dirname, "..", "models", "Order");
const Order = require(ORDER_MODEL_PATH);

// Pivot: Lucena City Hall
const PIVOT = { lat: 13.9365569, lng: 121.6115341 };

function toRad(deg) { return (deg * Math.PI) / 180; }
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function computeDeliveryFeeFromPivot(customerLat, customerLng) {
  if (
    customerLat == null ||
    customerLng == null ||
    Number.isNaN(Number(customerLat)) ||
    Number.isNaN(Number(customerLng))
  ) {
    return { distanceKm: null, deliveryFee: 0 };
  }

  const dist = haversineKm(PIVOT.lat, PIVOT.lng, Number(customerLat), Number(customerLng));
  if (dist <= 30) return { distanceKm: dist, deliveryFee: 0 };

  const extraKm = dist - 30;
  const increments = Math.ceil(extraKm / 10);
  const fee = increments * 1000;
  return { distanceKm: dist, deliveryFee: fee };
}

(async function main() {
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err.message || err);
    process.exit(1);
  }

  try {
    const totalDocs = await Order.countDocuments({});
    console.log(`Orders in collection: ${totalDocs}`);

    const cursor = Order.find({}).cursor();

    let updates = [];
    let processed = 0;
    let toUpdateCount = 0;
    let noCoordCount = 0;
    let sampleUpdates = [];

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      processed++;

      // Determine authoritative total: prefer doc.total; fallback to summing items' subtotal
      const docTotal = (doc.total != null && !Number.isNaN(Number(doc.total)))
        ? Number(doc.total)
        : (Array.isArray(doc.items) ? doc.items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0) : 0);

      // Coordinates: prefer coordinates -> legacy coodrinates
      const coordSource = (doc.coordinates && (doc.coordinates.lat != null || doc.coordinates.lng != null))
        ? doc.coordinates
        : (doc.coodrinates && (doc.coodrinates.lat != null || doc.coodrinates.lng != null))
          ? doc.coodrinates
          : null;

      const lat = coordSource && coordSource.lat != null ? Number(coordSource.lat) : null;
      const lng = coordSource && coordSource.lng != null ? Number(coordSource.lng) : null;

      const { distanceKm, deliveryFee } = computeDeliveryFeeFromPivot(lat, lng);

      // computed grandTotal
      const computedGrandTotal = +(Number(docTotal) + Number(deliveryFee));

      // current values in DB (coerce)
      const currentDeliveryFee = (doc.deliveryFee != null && !Number.isNaN(Number(doc.deliveryFee))) ? Number(doc.deliveryFee) : 0;
      const currentGrandTotal = (doc.grandTotal != null && !Number.isNaN(Number(doc.grandTotal))) ? Number(doc.grandTotal) : (Number(docTotal) + currentDeliveryFee);

      // decide whether to update: if deliveryFee or grandTotal differ
      const needsDeliveryUpdate = currentDeliveryFee !== deliveryFee;
      const needsGrandTotalUpdate = Math.abs(currentGrandTotal - computedGrandTotal) > 0.0001;

      if (needsDeliveryUpdate || needsGrandTotalUpdate) {
        toUpdateCount++;

        // Build update doc: set deliveryFee and grandTotal, also set coordinates if missing and legacy exists
        const updateFields = {
          deliveryFee,
          grandTotal: computedGrandTotal,
        };

        // If new field 'coordinates' is not present but legacy 'coodrinates' exists, copy it
        if ((!doc.coordinates || (doc.coordinates.lat == null && doc.coordinates.lng == null)) && doc.coodrinates) {
          updateFields.coordinates = {
            lat: doc.coodrinates.lat != null ? Number(doc.coodrinates.lat) : null,
            lng: doc.coodrinates.lng != null ? Number(doc.coodrinates.lng) : null,
          };
        }

        // If coords don't exist at all, track it
        if (lat == null || lng == null) noCoordCount++;

        updates.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: updateFields },
          }
        });

        // Collect some sample updates for logging
        if (sampleUpdates.length < 10) {
          sampleUpdates.push({
            _id: doc._id.toString(),
            total: docTotal,
            oldDeliveryFee: currentDeliveryFee,
            newDeliveryFee: deliveryFee,
            oldGrandTotal: currentGrandTotal,
            newGrandTotal: computedGrandTotal,
            coords: (lat != null && lng != null) ? { lat, lng } : null,
            distanceKm: distanceKm != null ? Number(distanceKm.toFixed(3)) : null,
          });
        }
      }

      // flush batch when full
      if (updates.length >= BATCH_SIZE) {
        if (DRY) {
          console.log(`[dryRun] would apply batch of ${updates.length} updates. Processed ${processed}/${totalDocs}`);
        } else {
          const res = await Order.bulkWrite(updates, { ordered: false });
          // bulkWrite's return shape differs by driver version; print safe fallbacks
          console.log(`Applied bulkWrite: matched ${res.matchedCount ?? res.nMatched ?? 0}, modified ${res.modifiedCount ?? res.nModified ?? 0}`);
        }
        updates = [];
      }

      // periodic progress log
      if (processed % 1000 === 0) {
        console.log(`Processed ${processed}/${totalDocs} orders...`);
      }
    } // end cursor

    // apply remaining
    if (updates.length > 0) {
      if (DRY) {
        console.log(`[dryRun] would apply final batch of ${updates.length} updates.`);
      } else {
        const res = await Order.bulkWrite(updates, { ordered: false });
        console.log(`Applied final bulkWrite: matched ${res.matchedCount ?? res.nMatched ?? 0}, modified ${res.modifiedCount ?? res.nModified ?? 0}`);
      }
    }

    console.log("Backfill summary:");
    console.log(`  Processed orders: ${processed}`);
    console.log(`  Orders to update: ${toUpdateCount}`);
    console.log(`  Orders missing coords (counted as no-coord): ${noCoordCount}`);
    console.log(`  Dry run: ${DRY ? "YES" : "NO"}`);
    if (sampleUpdates.length) {
      console.log("  Sample updates (up to 10):");
      console.table(sampleUpdates);
    }

    console.log("Done.");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Backfill failed:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
})();
