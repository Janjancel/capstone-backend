#!/usr/bin/env node
"use strict";

// Optional .env (won't crash if not installed)
try { require("dotenv").config(); } catch (_) {}

const path = require("path");
const mongoose = require("mongoose");

// ---- tiny CLI parser (no deps) ----
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (["uri", "limit", "models-dir"].includes(k)) {
      if (next && !next.startsWith("--")) { out[k] = next; i++; }
      else out[k] = true;
    } else {
      out[k] = true; // boolean flags: --dry-run, --purge-cart-items
    }
  }
  return out;
}

const argv = parseArgs(process.argv.slice(2));
const MONGODB_URI = argv.uri || process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌ Missing MongoDB URI. Use --uri or set MONGODB_URI.");
  process.exit(1);
}

const MODELS_DIR = argv["models-dir"] || process.env.MODELS_DIR || path.join(process.cwd(), "models");

// ---- Load models (adjust paths if needed) ----
const Item = require(path.join(MODELS_DIR, "Item"));   // expects mongoose.model('Item', ...)
const Order = require(path.join(MODELS_DIR, "Order")); // your UPDATED Order schema with hydration hooks

function isSnapshotLine(li) {
  return !!(li && typeof li === "object" && li.name != null && li.price != null);
}
function mergeRawLines(lines) {
  const map = new Map();
  for (const li of lines) {
    if (!li || !li.id) continue;
    const q = Math.max(1, Number(li.quantity) || 1);
    map.set(li.id, (map.get(li.id) || 0) + q);
  }
  return map;
}
function computeTotal(items) {
  return items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
}
async function hydrateCartLikeToSnapshots(rawMap) {
  const ids = Array.from(rawMap.keys());
  if (!ids.length) return { snapshots: [], missing: [] };

  const { Types } = mongoose;
  const objectIds = ids.filter((s) => Types.ObjectId.isValid(s)).map((s) => new Types.ObjectId(s));
  const codes = ids.filter((s) => !Types.ObjectId.isValid(s));

  const docs = await Item.find({
    $or: [
      objectIds.length ? { _id: { $in: objectIds } } : null,
      codes.length ? { itemId: { $in: codes } } : null,
      codes.length ? { id: { $in: codes } } : null,
    ].filter(Boolean),
  }).lean();

  const byKey = new Map();
  for (const d of docs) {
    const keys = [d?._id ? String(d._id) : null, d?.itemId, d?.id].filter(Boolean);
    for (const k of keys) if (!byKey.has(k)) byKey.set(k, d);
  }

  const snapshots = [];
  const missing = [];

  for (const id of ids) {
    const doc = byKey.get(id);
    if (!doc) { missing.push(id); continue; }

    const quantity = rawMap.get(id);
    const images = Array.isArray(doc.images) ? doc.images : [];
    const image =
      (typeof doc.image === "string" && doc.image.trim()) ||
      (images.find((u) => typeof u === "string" && u.trim()) || undefined);

    const name = doc.name ?? doc.title ?? doc.itemName;
    const price = Number(doc.price ?? doc.currentPrice);
    if (name == null || !Number.isFinite(price)) { missing.push(id); continue; }

    snapshots.push({
      id,
      name,
      description: doc.description ?? doc.desc ?? undefined,
      price,
      quantity,
      images,
      image,
      categories: Array.isArray(doc.categories) ? doc.categories : [],
      condition: typeof doc.condition === "number" ? doc.condition : undefined,
      origin: doc.origin,
      age: doc.age,
    });
  }

  return { snapshots, missing };
}
function needsHydration(order) {
  if (!Array.isArray(order.items) || order.items.length === 0) return true;
  return order.items.some((li) => !isSnapshotLine(li));
}
function needsTotal(order) {
  return !Number.isFinite(order.total);
}
function needsOrderId(order) {
  return !order.orderId;
}

(async () => {
  await mongoose.connect(MONGODB_URI);
  const dry = !!argv["dry-run"];
  const limit = Number(argv.limit) || 0;
  const purgeCart = !!argv["purge-cart-items"];
  console.log(`✅ Connected. Dry-run: ${dry ? "ON" : "OFF"}  Limit: ${limit || "ALL"}`);

  const selector = {
    $or: [
      { orderId: { $exists: false } },
      { total: { $exists: false } },
      { items: { $exists: false } },
      { items: { $size: 0 } },
      {
        items: {
          $elemMatch: {
            $or: [{ name: { $exists: false } }, { price: { $exists: false } }],
          },
        },
      },
      { cartItems: { $exists: true, $not: { $size: 0 } } },
    ],
  };

  const cursor = Order.find(selector).sort({ createdAt: 1, _id: 1 }).cursor();

  let processed = 0, changed = 0, failures = 0;
  for await (const order of cursor) {
    if (limit && processed >= limit) break;
    processed++;

    const before = {
      id: String(order._id),
      orderId: order.orderId,
      total: order.total,
      itemsLen: Array.isArray(order.items) ? order.items.length : 0,
      cartLen: Array.isArray(order.cartItems) ? order.cartItems.length : 0,
    };

    let mutated = false;

    // 1) Hydrate cart-like lines
    if (needsHydration(order)) {
      const raw = [];

      if (Array.isArray(order.items) && order.items.length) {
        for (const li of order.items) {
          if (!li || typeof li !== "object") continue;
          if (!isSnapshotLine(li)) raw.push({ id: li.id, quantity: li.quantity || 1 });
        }
      }
      if ((!raw.length || (order.items || []).length === 0) && Array.isArray(order.cartItems) && order.cartItems.length) {
        for (const li of order.cartItems) {
          if (!li || typeof li !== "object") continue;
          raw.push({ id: li.id, quantity: li.quantity || 1 });
        }
      }

      const merged = mergeRawLines(raw);
      if (merged.size) {
        const { snapshots, missing } = await hydrateCartLikeToSnapshots(merged);
        if (missing.length) console.warn(`⚠️  ${before.id} missing/unresolvable: ${missing.join(", ")}`);
        if (snapshots.length) {
          order.items = snapshots;
          if (purgeCart) order.cartItems = [];
          mutated = true;
        } else {
          console.warn(`⏭️  Skipping ${before.id} — no valid items to hydrate`);
        }
      }
    }

    // 2) Ensure total
    if (needsTotal(order) && Array.isArray(order.items) && order.items.length) {
      order.total = computeTotal(order.items);
      mutated = true;
    }

    // 3) orderId will be generated by your schema pre-validate if missing
    if (needsOrderId(order)) mutated = true;

    if (!mutated) continue;

    if (dry) {
      const after = {
        orderId: order.orderId || "(will be generated)",
        total: Number.isFinite(order.total) ? order.total : "(will be computed)",
        itemsLen: Array.isArray(order.items) ? order.items.length : 0,
        cartLen: Array.isArray(order.cartItems) ? order.cartItems.length : 0,
      };
      console.log(`DRY ✔️  ${before.id}  items:${before.itemsLen}->${after.itemsLen}  cart:${before.cartLen}->${after.cartLen}  total:${before.total}=>${after.total}  orderId:${before.orderId}=>${after.orderId}`);
      changed++;
      continue;
    }

    try {
      await order.save(); // triggers your hooks (image fallback, total compute, orderId gen)
      console.log(`✔️  Saved ${before.id}  items:${before.itemsLen}->${order.items.length}  total:${before.total}=>${order.total}  orderId:${before.orderId}=>${order.orderId}`);
      changed++;
    } catch (e) {
      failures++;
      console.error(`❌ Failed ${before.id}: ${e.message}`);
    }
  }

  console.log(`\nDone. Processed: ${processed}, Changed: ${changed}, Failures: ${failures}`);
  await mongoose.disconnect();
  process.exit(0);
})().catch(async (e) => {
  console.error("Fatal:", e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
