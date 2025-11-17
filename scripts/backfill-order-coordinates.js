/**
 * scripts/backfill-add-zero-coordinates.js
 *
 * Adds a coordinates field to existing Order documents that are missing it
 * (or missing lat/lng). The coordinates will be set to { lat: 0, lng: 0 }.
 *
 * Usage:
 *   node scripts/backfill-add-zero-coordinates.js --mongodbUri="mongodb://127.0.0.1:27017/yourdb"
 *   node scripts/backfill-add-zero-coordinates.js --mongodbUri="mongodb://..." --modelPath="./models/Order.js" --apply
 *
 * Notes:
 * - Dry-run by default: it will report how many docs would be changed.
 * - Use --apply to actually perform the updates.
 * - You may pass --modelPath if your Order model is in a different location.
 */

const mongoose = require("mongoose");
const path = require("path");

const argv = process.argv.slice(2);
const arg = (name) => {
  const found = argv.find((a) => a.startsWith(`${name}=`));
  if (found) return found.split("=")[1];
  return argv.includes(name);
};

const MONGO_URI = process.env.MONGODB_URI || arg("--mongodbUri") || null;
const MODEL_PATH = arg("--modelPath") || "./models/Order.js";
const APPLY = Boolean(arg("--apply"));

if (!MONGO_URI) {
  console.error("ERROR: Set MONGODB_URI env var or pass --mongodbUri argument.");
  process.exit(1);
}

(async function main() {
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  } catch (err) {
    console.error("MongoDB connect error:", err);
    process.exit(1);
  }

  let Order;
  try {
    const fullPath = path.isAbsolute(MODEL_PATH) ? MODEL_PATH : path.join(process.cwd(), MODEL_PATH);
    Order = require(fullPath);
    // if the required export is a schema instead of a model, compile it
    if (!Order || !Order.find) {
      const maybeSchema = Order;
      Order = mongoose.models.Order || mongoose.model("Order", maybeSchema);
    }
  } catch (err) {
    console.error("ERROR: Could not load Order model from:", MODEL_PATH);
    console.error(err && err.message ? err.message : err);
    await mongoose.disconnect();
    process.exit(1);
  }

  // Filter: documents where coordinates is missing/null OR lat OR lng fields are missing
  const filter = {
    $or: [
      { coordinates: { $exists: false } },
      { coordinates: null },
      { "coordinates.lat": { $exists: false } },
      { "coordinates.lng": { $exists: false } },
    ],
  };

  try {
    const count = await Order.countDocuments(filter);
    console.log("Backfill (set coordinates = {lat:0,lng:0})");
    console.log("MONGO:", MONGO_URI);
    console.log("Model path:", MODEL_PATH);
    console.log("Dry-run (no writes) unless --apply provided:", !APPLY);
    console.log("Documents matching filter (would be updated):", count);

    if (count === 0) {
      console.log("Nothing to do.");
      await mongoose.disconnect();
      process.exit(0);
    }

    if (!APPLY) {
      console.log("\nRun with --apply to perform the update.");
      await mongoose.disconnect();
      process.exit(0);
    }

    // Perform update: set coordinates to {lat: 0, lng: 0} for matching docs.
    const res = await Order.updateMany(filter, { $set: { coordinates: { lat: 0, lng: 0 } } });
    console.log("Update result:", {
      matchedCount: res.matchedCount ?? res.n ?? res.nModified ?? "unknown",
      modifiedCount: res.modifiedCount ?? res.nModified ?? "unknown",
    });

    await mongoose.disconnect();
    console.log("Done.");
    process.exit(0);
  } catch (err) {
    console.error("Fatal error:", err && err.message ? err.message : err);
    await mongoose.disconnect();
    process.exit(1);
  }
})();
