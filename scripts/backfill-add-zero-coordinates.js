// scripts/backfill-add-zero-coordinates.js
/* eslint-disable no-console */
const mongoose = require("mongoose");

const { Schema, model } = mongoose;

// ---- Lightweight Order model (bypass validations) ----
// Default collection name for model "OrderLite" is "orders"
const OrderLite = mongoose.models.OrderLite || model(
  "OrderLite",
  new Schema({}, { strict: false, collection: "orders" })
);

function buildFilter() {
  // documents where coordinates missing/ null OR lat or lng missing
  return {
    $or: [
      { coordinates: { $exists: false } },
      { coordinates: null },
      { "coordinates.lat": { $exists: false } },
      { "coordinates.lng": { $exists: false } },
    ],
  };
}

async function backfill(apply) {
  const filter = buildFilter();

  const total = await OrderLite.countDocuments(filter);
  console.log(`Found ${total} order(s) missing coordinates (would be updated).`);

  if (total === 0) {
    return { scanned: 0, updated: 0 };
  }

  if (!apply) {
    console.log("Dry-run: no changes will be made. Re-run with --apply to persist updates.");
    return { scanned: total, updated: 0 };
  }

  // Use updateMany for simplicity and speed
  const res = await OrderLite.updateMany(filter, { $set: { coordinates: { lat: 0, lng: 0 } } });
  // mongodb driver response shape differs by version; normalize
  const matched = res.matchedCount ?? res.n ?? res.nMatched ?? res.modifiedCount ?? 0;
  const modified = res.modifiedCount ?? res.nModified ?? res.modified ?? 0;

  console.log(`Updated documents - matched: ${matched}, modified: ${modified}`);
  return { scanned: total, updated: modified || matched };
}

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("Please set MONGO_URI (or MONGODB_URI) in your environment.");
    process.exit(1);
  }

  // parse CLI args for --apply
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");

  try {
    await mongoose.connect(uri, { autoIndex: false });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connect error:", err && err.message ? err.message : err);
    process.exit(1);
  }

  try {
    const result = await backfill(apply);
    console.log(`Backfill complete. Scanned: ${result.scanned}, Updated: ${result.updated}`);
  } catch (err) {
    console.error("Backfill failed:", err && err.message ? err.message : err);
    await mongoose.disconnect();
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log("Disconnected");
  process.exit(0);
})();
