// scripts/batchfill-availability.js
/* eslint-disable no-console */
const mongoose = require("mongoose");

/**
 * Usage examples:
 *
 * # Set availability=true for items missing the field:
 * MONGO_URI=mongodb://... node scripts/batchfill-availability.js --mode missing --availability true
 *
 * # Set availability=false for specific itemIds:
 * node scripts/batchfill-availability.js --mode itemIds --itemIds "10-I-0001-25,10-I-0002-25" --availability false
 *
 * # Set availability for a filter (JSON):
 * node scripts/batchfill-availability.js --mode filter --filter '{"categories":"Table"}' --availability true
 *
 * # Update all documents (dangerous) - must pass --allowAll
 * node scripts/batchfill-availability.js --mode all --allowAll --availability false
 */

const { Schema, model } = mongoose;

// Lightweight models (bypass schema validations)
const Counter = mongoose.models.Counter || model(
  "Counter",
  new Schema({ key: { type: String, unique: true }, seq: { type: Number, default: 0 } }, { strict: false, collection: "counters" })
);

// ItemLite uses the existing "items" collection, with strict: false to avoid validation errors.
const ItemLite = mongoose.models.ItemLite || model(
  "ItemLite",
  new Schema({}, { strict: false, collection: "items" })
);

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const name = a.slice(2);
    const next = argv[i + 1];
    // flags without value
    if (next === undefined || next.startsWith("--")) {
      args[name] = true;
      continue;
    }
    args[name] = next;
    i++;
  }
  return args;
}

function parseJSONSafe(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    // try to accept single-quoted JSON by swapping quotes
    try {
      // crude replacement — user should prefer double-quoted JSON
      return JSON.parse(str.replace(/'/g, '"'));
    } catch {
      throw new Error("Failed to parse JSON: " + str);
    }
  }
}

async function ensurePartialIndex() {
  try {
    const coll = mongoose.connection.collection("items");
    await coll.createIndex(
      { availability: 1 },
      { sparse: true } // keep lightweight, not required, but OK to create
    );
    console.log("✅ ensured index on items.availability (sparse)");
  } catch (e) {
    console.warn("Could not ensure index on availability:", e.message || e);
  }
}

async function run() {
  const envUri = process.env.MONGO_URI || process.env.MONGOURL || process.env.MONGODB_URI;
  const args = parseArgs();

  if (!envUri) {
    console.error("Please set MONGO_URI in your environment (e.g. MONGO_URI=mongodb://...).");
    process.exit(1);
  }

  const mode = args.mode || "missing";
  if (!["missing", "itemIds", "filter", "all"].includes(mode)) {
    console.error("Invalid --mode. Allowed: missing, itemIds, filter, all");
    process.exit(1);
  }

  if (!("availability" in args)) {
    console.error("Missing required --availability (true|false).");
    process.exit(1);
  }
  const availabilityArg = String(args.availability).toLowerCase();
  if (!["true", "false"].includes(availabilityArg)) {
    console.error("--availability must be true or false.");
    process.exit(1);
  }
  const availability = availabilityArg === "true";

  // Parse itemIds CSV if provided
  let itemIds = [];
  if (args.itemIds) {
    itemIds = String(args.itemIds)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (itemIds.length === 0) {
      console.error("--itemIds provided but no valid ids found.");
      process.exit(1);
    }
  }

  // Parse filter JSON if provided
  let filter = null;
  if (args.filter) {
    try {
      filter = parseJSONSafe(args.filter);
    } catch (e) {
      console.error("Failed to parse --filter JSON:", e.message);
      process.exit(1);
    }
  }

  // Safety: only allow full collection update with explicit flag
  const allowAll = !!args.allowAll;

  if (mode === "all" && !allowAll) {
    console.error("Refusing to update all documents. Re-run with --mode all --allowAll to confirm.");
    process.exit(1);
  }

  // Connect
  await mongoose.connect(envUri, {
    autoIndex: false,
    // leave other options default — fine for a migration script
  });
  console.log("Connected to MongoDB");

  await ensurePartialIndex();

  let query;
  switch (mode) {
    case "missing":
      query = {
        $or: [
          { availability: { $exists: false } },
          { availability: null },
        ],
      };
      break;
    case "itemIds":
      if (!itemIds.length) {
        console.error("Mode 'itemIds' requires --itemIds.");
        await mongoose.disconnect();
        process.exit(1);
      }
      query = { itemId: { $in: itemIds } };
      break;
    case "filter":
      if (!filter || typeof filter !== "object") {
        console.error("Mode 'filter' requires a valid --filter JSON object.");
        await mongoose.disconnect();
        process.exit(1);
      }
      query = filter;
      break;
    case "all":
      query = {}; // allowed only if allowAll is true
      break;
    default:
      query = {};
  }

  // If query is non-empty, prefer a single updateMany for speed. If you want to inspect individual docs you can iterate.
  try {
    console.log("Running batch update with query:", JSON.stringify(query));
    console.log("Setting availability ->", availability);

    // For transparency, show how many matched before updating
    const matchedBefore = await ItemLite.countDocuments(query).exec();
    console.log(`Matched documents: ${matchedBefore}`);

    if (matchedBefore === 0) {
      console.log("No documents matched — exiting.");
      await mongoose.disconnect();
      return;
    }

    // Perform update
    const res = await ItemLite.updateMany(query, { $set: { availability } }).exec();

    // Mongoose v5 returns { n: ..., nModified: ... }, v6 returns { acknowledged, modifiedCount, matchedCount }
    const matchedCount = res.matchedCount ?? res.n ?? 0;
    const modifiedCount = res.modifiedCount ?? res.nModified ?? 0;

    console.log("Batch availability update completed.");
    console.log(`matchedCount: ${matchedCount}`);
    console.log(`modifiedCount: ${modifiedCount}`);
  } catch (err) {
    console.error("Batch update failed:", err && err.message ? err.message : err);
    // As a fallback — iterate cursor and patch one by one to handle potential unique-index or partial update issues
    console.log("Attempting safe cursor-based fallback (one-by-one)...");

    try {
      const cursor = ItemLite.find(query).cursor();
      let scanned = 0;
      let updated = 0;
      for await (const doc of cursor) {
        scanned++;
        try {
          const r = await ItemLite.updateOne({ _id: doc._id }, { $set: { availability } }).exec();
          const changed = (r.modifiedCount ?? r.nModified ?? 0) > 0;
          if (changed) updated++;
        } catch (e) {
          console.warn(`Failed to update ${doc._id}:`, e.message || e);
          continue;
        }
      }
      console.log(`Fallback complete. Scanned: ${scanned}, Updated: ${updated}`);
    } catch (e) {
      console.error("Fallback also failed:", e && e.message ? e.message : e);
    }
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

run().catch((err) => {
  console.error("Fatal error:", err && err.stack ? err.stack : err);
  process.exit(1);
});
