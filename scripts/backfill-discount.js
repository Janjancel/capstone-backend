// scripts/backfill-discount.js
// Usage: set MONGODB_URI env var then run: node scripts/backfill-discount.js

const mongoose = require("mongoose");

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/mydb";
  console.log("Connecting to", uri);

  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const db = mongoose.connection.db;
    const orders = db.collection("orders"); // adjust collection name if different

    // 1) Count documents missing discount
    const missingCount = await orders.countDocuments({ discount: { $exists: false } });
    console.log(`Documents missing 'discount': ${missingCount}`);

    if (missingCount === 0) {
      console.log("No documents to update. Exiting.");
      await mongoose.disconnect();
      return;
    }

    // Optional safety: prompt the user (Node script non-interactive when invoked from PowerShell)
    // Perform update: set discount to null where it does not exist
    const result = await orders.updateMany(
      { discount: { $exists: false } },
      { $set: { discount: null } }
    );

    console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    console.log("Backfill complete.");

    // double-check how many still missing
    const stillMissing = await orders.countDocuments({ discount: { $exists: false } });
    console.log(`Documents still missing 'discount' after update: ${stillMissing}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error("Backfill failed:", err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
}

main();
