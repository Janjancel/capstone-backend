/* eslint-disable no-console */
// scripts/backfill-notifications-for.js
const mongoose = require("mongoose");

const { Schema, model, Types } = mongoose;
const BATCH_SIZE = 500;

// --- Lightweight models (no validators), pinned to collection names
const NotificationLite =
  mongoose.models.NotificationLite ||
  model("NotificationLite", new Schema({}, { strict: false, collection: "notifications" }));

const OrderLite =
  mongoose.models.OrderLite ||
  model("OrderLite", new Schema({}, { strict: false, collection: "orders" }));

const SellRequestLite =
  mongoose.models.SellRequestLite ||
  model("SellRequestLite", new Schema({}, { strict: false, collection: "sellrequests" }));

const DemolitionLite =
  mongoose.models.DemolitionLite ||
  model("DemolitionLite", new Schema({}, { strict: false, collection: "demolitions" }));

function isValidObjectId(v) {
  return Types.ObjectId.isValid(v || "") && String(new Types.ObjectId(v)) === String(v);
}

async function ensureIndexes() {
  const coll = mongoose.connection.collection("notifications");
  // Mirrors your schema’s helpful compound index
  await coll.createIndex({ userId: 1, for: 1, read: 1, createdAt: -1 });
  // Single-field indexes your schema defines
  await coll.createIndex({ userId: 1 });
  await coll.createIndex({ for: 1 });
  await coll.createIndex({ read: 1 });
  await coll.createIndex({ createdAt: 1 });
  console.log("✅ Ensured indexes on notifications");
}

async function findTypeByOrderId(orderId) {
  if (!orderId) return null;

  // Try by _id across all three collections
  if (isValidObjectId(orderId)) {
    const [order, sell, demo] = await Promise.all([
      OrderLite.findOne({ _id: orderId }, { _id: 1 }).lean(),
      SellRequestLite.findOne({ _id: orderId }, { _id: 1 }).lean(),
      DemolitionLite.findOne({ _id: orderId }, { _id: 1 }).lean(),
    ]);
    if (order) return "order";
    if (sell) return "sell";
    if (demo) return "demolish";
  }

  // Try human-readable IDs
  const [orderByCustom, sellBySelId, demoByDemolishId] = await Promise.all([
    OrderLite.findOne({ orderId }, { _id: 1 }).lean(),
    SellRequestLite.findOne({ selId: orderId }, { _id: 1 }).lean(),
    DemolitionLite.findOne({ demolishId: orderId }, { _id: 1 }).lean(),
  ]);

  if (orderByCustom) return "order";
  if (sellBySelId) return "sell";
  if (demoByDemolishId) return "demolish";

  return null;
}

function inferTypeByMessage(msg = "") {
  const m = (msg || "").toLowerCase();
  if (m.includes("demolish") || m.includes("ocular")) return "demolish";
  if (m.includes("sell")) return "sell";
  return "order";
}

async function resolveForField(notif) {
  // Keep existing valid values
  if (["order", "sell", "demolish"].includes(notif.for)) return notif.for;

  // Prefer authoritative match by orderId
  const fromOrderId = await findTypeByOrderId(notif.orderId);
  if (fromOrderId) return fromOrderId;

  // Fall back to message heuristics
  return inferTypeByMessage(notif.message);
}

async function backfill() {
  const query = {
    $or: [
      { for: { $exists: false } },
      { for: null },
      { for: { $nin: ["order", "sell", "demolish"] } },
    ],
  };

  const cursor = NotificationLite.find(query).cursor();
  let scanned = 0;
  let updated = 0;

  let ops = [];
  for await (const n of cursor) {
    scanned += 1;
    try {
      const value = await resolveForField(n);
      if (!value) continue; // Shouldn’t happen, but just in case

      ops.push({
        updateOne: {
          filter: { _id: n._id },
          update: { $set: { for: value } },
        },
      });

      if (ops.length >= BATCH_SIZE) {
        const res = await NotificationLite.bulkWrite(ops, { ordered: false });
        updated += res.modifiedCount || 0;
        ops = [];
        process.stdout.write(".");
      }
    } catch (e) {
      console.warn(`⚠️  Failed to backfill notif ${n._id}:`, e.message);
    }
  }

  if (ops.length) {
    const res = await NotificationLite.bulkWrite(ops, { ordered: false });
    updated += res.modifiedCount || 0;
  }

  console.log(`\nBackfill complete. Scanned: ${scanned}, Updated: ${updated}`);
}

(async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error("Please set MONGO_URI in your environment.");
      process.exit(1);
    }

    await mongoose.connect(uri, { autoIndex: false });
    console.log("Connected to MongoDB");

    await ensureIndexes();
    await backfill();

    await mongoose.disconnect();
    console.log("Disconnected");
  } catch (err) {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
  }
})();
