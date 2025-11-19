// scripts/backfill-personalInfo.js
/* eslint-disable no-console */
const mongoose = require("mongoose");

// --- REQUIRE ENV ---
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌ ERROR: Please set MONGODB_URI first.");
  process.exit(1);
}

async function run() {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected.");

    // Loose model (no schema validation needed for backfill)
    const User = mongoose.model(
      "UserBackfill",
      new mongoose.Schema({}, { strict: false }),
      "users"
    );

    let updated = 0;

    const users = await User.find({}).lean();

    console.log(`📌 Found ${users.length} users. Processing...`);

    const bulkOps = [];

    for (const u of users) {
      const existing = u.personalInfo || {};

      const newPersonalInfo = {
        lastName:
          existing.lastName !== undefined ? existing.lastName : null,
        firstName:
          existing.firstName !== undefined ? existing.firstName : null,
        middleInitial:
          existing.middleInitial !== undefined ? existing.middleInitial : null,
        phoneNumber:
          existing.phoneNumber !== undefined ? existing.phoneNumber : null,
      };

      bulkOps.push({
        updateOne: {
          filter: { _id: u._id },
          update: {
            $set: { personalInfo: newPersonalInfo },
          },
        },
      });

      updated++;
    }

    if (bulkOps.length > 0) {
      const result = await User.bulkWrite(bulkOps, { ordered: false });
      console.log(
        `✅ Backfill complete. Updated ${result.modifiedCount} documents.`
      );
    } else {
      console.log("No updates necessary.");
    }

    await mongoose.disconnect();
    console.log("🔌 Disconnected. Backfill done.");
  } catch (err) {
    console.error("❌ Backfill error:", err);
    process.exit(1);
  }
}

run();
