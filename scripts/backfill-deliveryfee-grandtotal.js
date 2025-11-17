// scripts/backfill-deliveryfee-grandtotal.js
/* eslint-disable no-console */
const mongoose = require("mongoose");
const path = require("path");

const { Schema, model } = mongoose;

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error("Please set MONGO_URI (or MONGODB_URI) in your environment.");
  process.exit(1);
}

// CLI
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const MODEL_PATH_ARG = argv.find((a) => a.startsWith("--modelPath="));
const MODEL_PATH = MODEL_PATH_ARG ? MODEL_PATH_ARG.split("=")[1] : "./models/Order.js";

// Lightweight fallback model (strict: false) using the 'orders' collection
const OrderLite = mongoose.models.OrderLite || model(
  "OrderLite",
  new Schema({}, { strict: false, collection: "orders" })
);

// Helpers
function toFiniteNumber(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.trim().replace(/,/g, "");
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function nearlyEqual(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

async function processDocs(Model, apply) {
  // Query candidates: documents where deliveryFee missing/null OR grandTotal missing/null
  // We'll also scan all docs to detect mismatched grandTotal (total + deliveryFee != grandTotal)
  const filterMissing = {
    $or: [
      { deliveryFee: { $exists: false } },
      { deliveryFee: null },
      { grandTotal: { $exists: false } },
      { grandTotal: null },
    ],
  };

  const missingCount = await Model.countDocuments(filterMissing);
  console.log(`Found ${missingCount} document(s) with missing deliveryFee or grandTotal.`);

  // First, patch missing fields in bulk (set deliveryFee:0, grandTotal: total+0)
  if (missingCount > 0) {
    if (apply) {
      // updateMany: set missing deliveryFee to 0 (but don't overwrite existing numeric values),
      // and set grandTotal to computed total + (existing deliveryFee or 0).
      // Because updateMany can't compute "total + deliveryFee" server-side reliably across driver versions
      // we'll fetch the docs and update individually to compute grandTotal correctly.
      const cursor = Model.find(filterMissing).cursor();
      let updated = 0;
      for await (const doc of cursor) {
        const totalVal = toFiniteNumber(doc.total) ?? 0;
        const dfRaw = toFiniteNumber(doc.deliveryFee);
        const df = dfRaw == null ? 0 : dfRaw;
        const newGrand = totalVal + df;
        const set = { deliveryFee: df, grandTotal: newGrand };
        try {
          await Model.updateOne({ _id: doc._id }, { $set: set });
          updated++;
        } catch (err) {
          console.error(`Failed to update _id=${doc._id}:`, err && err.message ? err.message : err);
        }
      }
      console.log(`Applied updates for ${updated} document(s) with previously-missing fields.`);
    } else {
      console.log(`Dry-run: would patch ${missingCount} document(s) to set deliveryFee (missing → 0) and grandTotal = total + deliveryFee.`);
    }
  }

  // Second, scan ALL documents to find inconsistent grandTotal (total + deliveryFee !== grandTotal)
  console.log("Scanning for documents where grandTotal !== total + deliveryFee ... (this may take time on large collections)");
  const cursorAll = Model.find({}).cursor();
  let scanned = 0;
  let inconsistent = 0;
  let appliedFixes = 0;

  for await (const doc of cursorAll) {
    scanned++;
    const totalVal = toFiniteNumber(doc.total) ?? 0;
    const dfVal = toFiniteNumber(doc.deliveryFee);
    const df = dfVal == null ? 0 : dfVal; // treat missing or non-numeric as 0 (but missing already handled above)
    const desiredGrand = totalVal + df;
    const currentGrand = toFiniteNumber(doc.grandTotal);

    // If grandTotal missing or non-numeric or differs from desired
    if (currentGrand == null || !nearlyEqual(currentGrand, desiredGrand)) {
      inconsistent++;
      if (apply) {
        try {
          await Model.updateOne({ _id: doc._id }, { $set: { deliveryFee: df, grandTotal: desiredGrand } });
          appliedFixes++;
        } catch (err) {
          console.error(`Failed to fix _id=${doc._id}:`, err && err.message ? err.message : err);
        }
      } else {
        // dry-run: log sample
        if (inconsistent <= 20) {
          console.log(`(dry) Would fix _id=${doc._id}: total=${totalVal}, deliveryFee=${df}, grandTotal=${currentGrand} -> ${desiredGrand}`);
        } else if (inconsistent === 21) {
          console.log("(dry) ... more fixes possible (only first 20 shown)");
        }
      }
    }
  }

  return { scanned, inconsistent, appliedFixes };
}

// Try to load user's real Order model if available; otherwise use OrderLite
function loadModel() {
  try {
    const fullPath = path.isAbsolute(MODEL_PATH) ? MODEL_PATH : path.join(process.cwd(), MODEL_PATH);
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const maybe = require(fullPath);
    if (maybe && typeof maybe.find === "function") {
      console.log(`Loaded Order model from ${fullPath}`);
      return maybe;
    }
    // if module exports a schema object
    if (maybe && maybe.schema) {
      const mdl = mongoose.models.Order || mongoose.model("Order", maybe.schema || maybe);
      console.log(`Compiled Order model from schema at ${fullPath}`);
      return mdl;
    }
    console.log(`Module at ${fullPath} did not export a model. Falling back to OrderLite.`);
    return OrderLite;
  } catch (e) {
    console.log(`Could not load model at ${MODEL_PATH} — falling back to OrderLite. (${e && e.message ? e.message : e})`);
    return OrderLite;
  }
}

(async () => {
  try {
    await mongoose.connect(MONGO_URI, { autoIndex: false });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connect error:", err && err.message ? err.message : err);
    process.exit(1);
  }

  const OrderModel = loadModel();

  try {
    const result = await processDocs(OrderModel, APPLY);
    console.log(`Scan complete. Documents scanned: ${result.scanned}. Inconsistent found: ${result.inconsistent}. Applied fixes: ${result.appliedFixes || 0}.`);
  } catch (err) {
    console.error("Backfill failed:", err && err.message ? err.message : err);
    await mongoose.disconnect();
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log("Disconnected");
  process.exit(0);
})();
