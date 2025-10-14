// scripts/backfill-itemId.js
/* eslint-disable no-console */
const mongoose = require("mongoose");

const { Schema, model } = mongoose;

// ---- Counter model (monthly atomic sequence) ----
const counterSchema = new Schema({
  key: { type: String, unique: true, index: true }, // e.g., 'item:10-25'
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || model("Counter", counterSchema);

// ---- Lightweight Item model (bypass validations) ----
// Default collection name for model "Item" is "items"
const ItemLite = mongoose.models.ItemLite || model(
  "ItemLite",
  new Schema({}, { strict: false, collection: "items" })
);

function formatItemId(date, seq) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const seqStr = String(seq).padStart(4, "0");
  return `${mm}-I-${seqStr}-${yy}`;
}

async function nextMonthlySeq(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const key = `item:${mm}-${yy}`;
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return doc.seq;
}

function getBaseDate(doc) {
  if (doc.createdAt) return new Date(doc.createdAt);
  if (doc._id && typeof doc._id.getTimestamp === "function") return doc._id.getTimestamp();
  try {
    const oid = new mongoose.Types.ObjectId(doc._id);
    return oid.getTimestamp();
  } catch {
    return new Date();
  }
}

async function ensurePartialUniqueIndex() {
  const coll = mongoose.connection.collection("items");
  await coll.createIndex(
    { itemId: 1 },
    { unique: true, partialFilterExpression: { itemId: { $exists: true } } }
  );
  console.log("✅ Ensured partial unique index on items.itemId");
}

async function backfill() {
  const query = {
    $or: [
      { itemId: { $exists: false } },
      { itemId: null },
      { itemId: { $regex: /^\s*$/ } }, // empty/whitespace string
    ],
  };

  const cursor = ItemLite.find(query).cursor();
  let scanned = 0;
  let updated = 0;

  for await (const it of cursor) {
    scanned += 1;
    const baseDate = getBaseDate(it);

    let attempts = 0;
    while (attempts < 4) {
      attempts += 1;
      try {
        const seq = await nextMonthlySeq(baseDate);
        const itemId = formatItemId(baseDate, seq);
        await ItemLite.updateOne({ _id: it._id }, { $set: { itemId } });
        updated += 1;
        break;
      } catch (e) {
        if (e && e.code === 11000) {
          console.warn(`Duplicate itemId for ${it._id}, retrying…`);
          continue; // get a new seq and retry
        }
        console.error(`❌ Failed for ${it._id}:`, e);
        break;
      }
    }
  }

  console.log(`Backfill complete. Scanned: ${scanned}, Updated: ${updated}`);
}

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Please set MONGO_URI in your environment.");
    process.exit(1);
  }

  await mongoose.connect(uri, { autoIndex: false });
  console.log("Connected to MongoDB");

  await ensurePartialUniqueIndex();
  await backfill();

  await mongoose.disconnect();
  console.log("Disconnected");
})();
