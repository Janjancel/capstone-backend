/**
 * scripts/batchfill-orders.js
 *
 * Purpose:
 * - Backfill existing Order documents to the new schema:
 *    - items[].id (from cart), quantity
 *    - snapshot: name, price, image, images, subtotal
 *    - recompute order.total
 *    - generate orderId (MM-O-####-YY) if missing (via Order pre('validate'))
 *
 * Usage:
 *   DRY_RUN=true LIMIT=100 node scripts/batchfill-orders.js
 *   DRY_RUN=false node scripts/batchfill-orders.js
 *
 * Env:
 *   MONGO_URI=mongodb+srv://...
 */

require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;
const DRY_RUN = String(process.env.DRY_RUN ?? "true").toLowerCase() !== "false"; // default true
const LIMIT = Number(process.env.LIMIT || 0); // 0 = no limit
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 200);

// --- Minimal Item model (adjust fields to match your real Item schema) ---
const itemSchema = new mongoose.Schema(
  {
    itemId: { type: String, index: true, unique: true }, // e.g., "10-I-0001-25"
    name: String,
    price: Number,
    image: String,
    images: [String],
    isArchived: Boolean,
  },
  { collection: "items" }
);
const Item = mongoose.models.Item || mongoose.model("Item", itemSchema);

// --- Bring in your real Order model so its pre('validate') hook runs ---
const Order =
  mongoose.models.Order || require("../models/Order"); // <-- make sure this path is correct in your repo

// ---------- Helpers ----------
const asNumber = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

function primaryFrom(images = [], image = null) {
  if (image && typeof image === "string" && image.trim()) return image.trim();
  if (Array.isArray(images)) {
    const first = images.find((u) => typeof u === "string" && u.trim());
    if (first) return first.trim();
  }
  return null;
}

/**
 * Build snapshot objects for the new Order.items[] shape:
 * - expects `rawItems`: either:
 *    A) old minimal shape: [{ id, quantity }]
 *    B) already snapshot-like: [{ id, quantity, name?, price?, image?, images? }]
 * - uses itemMap to fill in missing fields
 */
function buildSnapshots(rawItems = [], itemMap = new Map()) {
  const out = [];
  for (const raw of rawItems || []) {
    if (!raw) continue;

    const id = String(raw.id || "").trim();
    const quantity = asNumber(raw.quantity, 0);

    const snap = itemMap.get(id) || {};
    const name = String(raw.name ?? snap.name ?? "Untitled Item");
    const price = asNumber(raw.price ?? snap.price, 0);
    const images = Array.isArray(raw.images) ? raw.images : Array.isArray(snap.images) ? snap.images : [];
    const image = primaryFrom(images, raw.image ?? snap.image);
    const subtotal = +(price * quantity).toFixed(2);

    out.push({
      id,
      quantity,
      name,
      price,
      image,
      images,
      subtotal,
    });
  }
  return out;
}

/**
 * Given a list of cart IDs (itemId strings), load Items and return a Map itemId -> snapshot
 */
async function loadItemSnapshotsByIds(ids = []) {
  const want = [...new Set(ids.filter((s) => typeof s === "string" && s.trim()))];
  if (want.length === 0) return new Map();

  const items = await Item.find({ itemId: { $in: want } })
    .select({ itemId: 1, name: 1, price: 1, image: 1, images: 1 })
    .lean();

  const map = new Map();
  for (const it of items) {
    map.set(String(it.itemId), {
      name: it.name,
      price: asNumber(it.price, 0),
      image: primaryFrom(it.images, it.image),
      images: Array.isArray(it.images) ? it.images : it.image ? [it.image] : [],
    });
  }
  return map;
}

/**
 * Normalize a single order doc in-memory. Returns { changed, doc }
 */
async function normalizeOrder(order) {
  let changed = false;

  // 1) Build or fix items snapshots
  const items = Array.isArray(order.items) ? order.items : [];

  // Collect all IDs that look like itemId strings
  const candidateIds = [];
  for (const it of items) {
    if (it?.id && typeof it.id === "string") candidateIds.push(it.id);
  }

  const itemMap = await loadItemSnapshotsByIds(candidateIds);
  const newItems = buildSnapshots(items, itemMap);

  // Check changes vs existing
  const needsItemsReplace =
    newItems.length !== items.length ||
    newItems.some((ni, i) => {
      const oi = items[i] || {};
      return (
        String(ni.id) !== String(oi.id) ||
        asNumber(ni.quantity) !== asNumber(oi.quantity) ||
        String(ni.name || "") !== String(oi.name || "") ||
        asNumber(ni.price) !== asNumber(oi.price) ||
        String(ni.image || "") !== String(oi.image || "") ||
        JSON.stringify(ni.images || []) !== JSON.stringify(oi.images || []) ||
        asNumber(ni.subtotal) !== asNumber(oi.subtotal)
      );
    });

  if (needsItemsReplace) {
    order.items = newItems;
    changed = true;
  }

  // 2) Compute total if needed / drifted
  const computedTotal = +newItems.reduce((acc, it) => acc + asNumber(it.subtotal), 0).toFixed(2);
  if (asNumber(order.total) !== computedTotal) {
    order.total = computedTotal;
    changed = true;
  }

  // 3) If orderId missing, pre('validate') will set it
  if (!order.orderId) {
    changed = true;
  }

  return { changed, doc: order };
}

// ---------- Runner ----------
async function run() {
  if (!MONGO_URI) {
    console.error("❌ MONGO_URI is not set. Put it in .env or your environment.");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log(`✅ Connected: ${mongoose.connection.name}`);

  // Query: only orders that plausibly need work
  const query = {
    $or: [
      { orderId: { $exists: false } },
      { "items.subtotal": { $exists: false } },
      { total: { $exists: false } },
    ],
  };

  const totalToScan = await Order.countDocuments(query);
  console.log(`🔍 Orders needing attention: ${totalToScan}`);

  const cursor = Order.find(query).sort({ createdAt: 1 }).cursor();

  let processed = 0;
  let changedCount = 0;
  let savedCount = 0;

  for await (const order of cursor) {
    processed++;
    const { changed, doc } = await normalizeOrder(order);

    if (changed) {
      changedCount++;
      if (DRY_RUN) {
        // Validate to expose potential issues but don't persist in DRY_RUN
        try {
          await doc.validate();
          console.log(`DRY_RUN ✔ would fix order _id=${doc._id} userId=${doc.userId} total=${doc.total} items=${doc.items.length}`);
        } catch (e) {
          console.warn(`DRY_RUN ⚠ validation failed for _id=${doc._id}:`, e.message);
        }
      } else {
        try {
          await doc.save(); // triggers pre('validate') to assign orderId if missing
          savedCount++;
          console.log(`💾 Saved _id=${doc._id} orderId=${doc.orderId} total=${doc.total}`);
        } catch (e) {
          console.error(`❌ Save failed for _id=${doc._id}:`, e);
        }
      }
    }

    if (LIMIT && processed >= LIMIT) {
      console.log(`⏹ Stopping after LIMIT=${LIMIT}`);
      break;
    }

    if (processed % BATCH_SIZE === 0) {
      console.log(`… processed ${processed}/${totalToScan} so far`);
    }
  }

  console.log("──────── Summary ────────");
  console.log(`Processed: ${processed}`);
  console.log(`Changed (needs update): ${changedCount}`);
  console.log(`Saved (persisted): ${savedCount}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "WRITE MODE"}`);

  await mongoose.disconnect();
  console.log("🔌 Disconnected");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
