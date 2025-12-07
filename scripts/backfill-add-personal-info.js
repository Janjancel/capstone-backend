/**
 * Backfill: add personalInfo field to existing users
 * - Sets `personalInfo: null` for users that don't have the field or have an empty object.
 *
 * Usage:
 *   DRY RUN:
 *     $env:MONGO_URI="mongodb://..." ; node .\scripts\backfill-add-personal-info.js --dry-run
 *
 *   APPLY:
 *     $env:MONGO_URI="mongodb://..." ; node .\scripts\backfill-add-personal-info.js
 *
 * Make sure you run this from your project root so `require('../models/User')` resolves correctly
 * (script stored at ./scripts/backfill-add-personal-info.js).
 */

const mongoose = require("mongoose");
const path = require("path");

// allow override of models path if needed via env or adjust relative require below
// Require your User model. Script expects to be at ./scripts and models at ./models/User.js
const User = require(path.join(__dirname, "..", "models", "User"));

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/your-db-name";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run") || argv.includes("-d");

async function run() {
  console.log("Connecting to MongoDB:", MONGO_URI);
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    // Target docs where personalInfo does not exist OR is an empty object.
    // (We set to null so field exists explicitly but doesn't contain required nested fields.)
    const filter = {
      $or: [
        { personalInfo: { $exists: false } },
        { personalInfo: {} },
      ],
    };

    const toUpdateCount = await User.countDocuments(filter);
    console.log(`Found ${toUpdateCount} user(s) matching the filter (missing or empty personalInfo).`);

    if (toUpdateCount === 0) {
      console.log("Nothing to update. Exiting.");
      return process.exit(0);
    }

    if (dryRun) {
      console.log("Dry-run mode: no documents will be modified.");
      // optionally list a few _ids
      const sample = await User.find(filter).limit(10).select("_id username email").lean();
      console.log("Sample documents to be updated:", sample);
      return process.exit(0);
    }

    // Perform the update: set personalInfo explicitly to null
    const result = await User.updateMany(filter, { $set: { personalInfo: null } });
    console.log("Update result:", result);
    console.log(`Modified ${result.modifiedCount || result.nModified || 0} document(s).`);
  } catch (err) {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB. Done.");
  }
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
