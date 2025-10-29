// scripts/batchfill-orders.js
/* eslint-disable no-console */
require("dotenv").config();
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGODB_URI) {
  console.error("❌ Missing MONGODB_URI env var");
  process.exit(1);
}

// --- Load models (adjust paths if your structure differs)
const Order = require("../models/Order");   // uses your pre-validate hooks to hydrate + generate orderId
let Counter;
try {
  Counter = mongoose.model("Counter");
} catch {
  // fallback if not registered by Order model
  const counterSchema = new mongoose.Schema({
    key: { type: String, unique: true, index: true }, // 'order:MM-YY'
    seq: { type: Number, default: 0 },
  });
  Counter = mongoose.model("Counter", counterSchema);
}

// --- CLI flags
const DRY_RUN = process.argv.includes("--dry");
const COMMIT = process.argv.includes("--commit");
const LIMIT = (() => {
  const arg = process.argv.find((a) => a.startsWith("--limit="));
  return arg ? parseInt(arg.split("=")[1], 10) : null;
})();

if (!DRY_RUN && !COMMIT) {
  console.log("ℹ️  No mode specified. Use --dry (preview) or --commit (apply). Defaulting to --dry.");
}

// --- Helpers
const VALID_ID_RE = /^\d{2}-O-\d{4}-\d{2}$/;

function parseOrderId(str) {
  // 10-O-0123-25  => { mm:'10', seq:123, yy:'25' }
  const m = VALID_ID_RE.test(str) ? str.split("-") : null;
  if (!m) return null;
  return { mm: m[0], seq: parseInt(m[2], 10), yy: m[3] };
}

function keyFor(date) {
  const d = new Date(date || Date.now());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  return { key: `order:${mm}-${yy}`, mm, yy };
}

async function ensureCountersPrimedByExistingOrders() {
  // For each month-year, set Counter.seq to the max existing sequence (or keep if higher)
  const rows = await Order.find({ orderId: { $regex: VALID_ID_RE } }, { orderId: 1 }).lean();
  const maxByKey = new Map();
  for (const r of rows) {
    const parsed = parseOrderId(r.orderId);
    if (!parsed) continue;
    const k = `order:${parsed.mm}-${parsed.yy}`;
    const prev = maxByKey.get(k) || 0;
    if (parsed.seq > prev) maxByKey.set(k, parsed.seq);
  }

  for (const [k, maxSeq] of maxByKey.entries()) {
    const doc = await Counter.findOne({ key: k });
    if (!doc) {
      await Counter.create({ key: k, seq: maxSeq }); // next new order increments from here
    } else if (doc.seq < maxSeq) {
      await Counter.updateOne({ key: k }, { $set: { seq: maxSeq } });
    }
  }
}

async function primeCountersForPendingBatch(orders) {
  // Make sure each month in the batch has a counter at least at the current max.
  // (If ensureCountersPrimedByExistingOrders ran, this is usually already satisfied.)
  const seen = new Set();
  for (const o of orders) {
    const { key } = keyFor(o.createdAt || Date.now());
    if (seen.has(key)) continue;
    seen.add(key);
    const doc = await Counter.findOne({ key });
    if (!doc) {
      await Counter.create({ key, seq: 0 });
    }
  }
}

async function main() {
  await mongoose.connect(MONGODB_URI, { maxPoolSize: 5 });
  console.log(`✅ Connected to MongoDB`);

  // 1) Prime counters based on existing valid orderIds so new numbers continue correctly.
  await ensureCountersPrimedByExistingOrders();

  // 2) Find orders that need backfill:
  //    - Missing or invalid orderId
  //    - Items missing snapshot fields (name/price)
  //    - Missing total
  const needsQuery = {
    $or: [
      { orderId: { $exists: false } },
      { orderId: { $not: { $regex: VALID_ID_RE } } },
      { total: { $exists: false } },
      { "items.0.name": { $exists: false } }, // not hydrated
      { "items": { $size: 0 } },               // guard: empty items
    ],
  };

  // Sort by createdAt ascending so sequences within a month are assigned chronologically.
  let q = Order.find(needsQuery).sort({ createdAt: 1, _id: 1 });
  if (LIMIT) q = q.limit(LIMIT);
  const candidates = await q.exec();

  if (!candidates.length) {
    console.log("✅ No orders need backfilling. All good!");
    await mongoose.disconnect();
    return;
  }

  console.log(`🔧 Found ${candidates.length} order(s) needing backfill`);
  await primeCountersForPendingBatch(candidates);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of candidates) {
    try {
      // Quick sanity: must have items array
      if (!Array.isArray(order.items) || order.items.length === 0) {
        console.warn(`⏭️  Skipping ${order._id}: no items`);
        skipped++;
        continue;
      }

      // Preview details
      const willTouchId = !order.orderId || !VALID_ID_RE.test(order.orderId);
      const needsHydrate = !order.items[0].name || !Number.isFinite(order.items[0].price);
      const needsTotal = !Number.isFinite(order.total);

      if (DRY_RUN && !COMMIT) {
        const { mm, yy } = keyFor(order.createdAt || Date.now());
        console.log(
          `• [DRY] ${order._id}  ` +
          (willTouchId ? `orderId: -> (will assign ${mm}-O-####-${yy}) ` : "") +
          (needsHydrate ? `hydrate items ` : "") +
          (needsTotal ? `recompute total` : "")
        );
        ok++;
        continue;
      }

      // Trigger your Order model's pre-validate hooks (hydrates + computes + assigns orderId)
      await order.save();

      console.log(
        `✔️  Saved ${order._id}  ` +
        `orderId=${order.orderId}  items=${order.items.length}  total=${order.total}`
      );
      ok++;
    } catch (err) {
      console.error(`❌ Failed ${order._id}: ${err.message}`);
      failed++;
    }
  }

  console.log("\n==== Summary ====");
  console.log(`Processed : ${candidates.length}`);
  console.log(`OK        : ${ok}`);
  console.log(`Skipped   : ${skipped}`);
  console.log(`Failed    : ${failed}`);
  console.log(`Mode      : ${DRY_RUN && !COMMIT ? "DRY" : "COMMIT"}`);

  await mongoose.disconnect();
  console.log("🔌 Disconnected");
}

main().catch(async (e) => {
  console.error("Fatal:", e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
