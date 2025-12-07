/**
 * backfill-add-quantity.js
 *
 * Usage:
 *   - Dry run (report only):
 *       $env:MONGODB_URI="mongodb://..." ; node backfill-add-quantity.js --dry-run
 *
 *   - Execute:
 *       $env:MONGODB_URI="mongodb://..." ; node backfill-add-quantity.js
 *
 * Options:
 *   --uri <mongodb-uri>    (optional) provide connection string via CLI instead of MONGODB_URI env
 *   --dry-run              (optional) do not write, only report how many documents WOULD be updated
 */

const mongoose = require("mongoose");
const path = require("path");

// Adjust if your models live elsewhere; this assumes ./models/Item.js exports the mongoose model
const Item = require(path.join(process.cwd(), "models", "Item"));

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { dryRun: false, uri: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run") out.dryRun = true;
    if (a === "--uri" && args[i + 1]) {
      out.uri = args[i + 1];
      i++;
    }
  }
  return out;
}

(async () => {
  const { dryRun, uri: cliUri } = parseArgs();
  const uri = cliUri || process.env.MONGODB_URI;
  if (!uri) {
    console.error("ERROR: MongoDB connection string required. Set MONGODB_URI or pass --uri.");
    process.exit(2);
  }

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Query: documents where quantity missing or null
    const filter = {
      $or: [{ quantity: { $exists: false } }, { quantity: null }],
    };

    const toUpdateCount = await Item.countDocuments(filter);
    console.log(`Documents matching missing quantity: ${toUpdateCount}`);

    if (toUpdateCount === 0) {
      console.log("Nothing to do. Exiting.");
      await mongoose.disconnect();
      process.exit(0);
    }

    if (dryRun) {
      console.log("Dry run enabled — no changes will be made.");
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log("Updating documents to set quantity = 1 ...");
    const result = await Item.updateMany(filter, { $set: { quantity: 1 } });

    console.log("Update complete.");
    console.log(`Matched: ${result.matchedCount ?? result.n ?? "N/A"}`);
    console.log(`Modified: ${result.modifiedCount ?? result.nModified ?? "N/A"}`);

    // Optional: print a small sample of updated ids (helpful)
    const sample = await Item.find({ quantity: 1 }).limit(10).select("_id itemId name quantity");
    console.log("Sample updated documents (up to 10):");
    sample.forEach((doc) => {
      console.log(` - _id: ${doc._id}   itemId: ${doc.itemId ?? "-"}   name: ${doc.name ?? "-"}   quantity: ${doc.quantity}`);
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Backfill error:", err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
})();
