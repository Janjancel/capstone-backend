/**
 * Run: node ./scripts/migrate-coodrinates-to-coordinates.js --mongodbUri="mongodb://127.0.0.1:27017/yourdb"
 *
 * It will:
 *  - for each order with `coodrinates` and without `coordinates`, copy the value across
 *  - leave documents that already have `coordinates` unchanged
 */

const mongoose = require("mongoose");
const path = require("path");

const MONGO_URI = process.env.MONGODB_URI || (() => {
  const arg = process.argv.find(a => a.startsWith("--mongodbUri="));
  if (arg) return arg.split("=")[1];
  return null;
})();

if (!MONGO_URI) {
  console.error("Please provide --mongodbUri or set MONGODB_URI env var.");
  process.exit(1);
}

// load Order model (adjust path if different)
const ORDER_MODEL_PATH = path.join(__dirname, "..", "models", "Order");
const Order = require(ORDER_MODEL_PATH);

async function migrate() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  console.log("Connected to DB. Searching for orders with legacy `coodrinates`...");

  const cursor = Order.find({ coodrinates: { $exists: true }, coordinates: { $exists: false } }).cursor();

  let count = 0;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    try {
      const legacy = doc.coodrinates;
      if (legacy && (legacy.lat != null || legacy.lng != null)) {
        doc.coordinates = { lat: legacy.lat, lng: legacy.lng };
        // optional: remove legacy field
        doc.coodrinates = undefined;
        await doc.save();
        count++;
        if (count % 50 === 0) console.log(`Migrated ${count} orders...`);
      }
    } catch (err) {
      console.error("Error migrating doc", doc._id, err);
    }
  }

  console.log(`Migration completed. Migrated ${count} orders.`);
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
