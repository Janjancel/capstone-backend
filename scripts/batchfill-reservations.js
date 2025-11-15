/* eslint-disable no-console */
const mongoose = require("mongoose");
const args = require("minimist")(process.argv.slice(2));

// Adjust these requires to your project structure:
const Cart  = require("../models/Cart");
const Item = require("../models/Item");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("Please set MONGO_URI environment variable.");
  process.exit(1);
}

const MODE = args.mode || "scan"; // scan | reserve-from-carts | release-orphan-items
const DRY_RUN = Boolean(args.dry);
const BATCH_SIZE = Number(args.batchSize || 200);

async function connect() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");
}

async function disconnect() {
  await mongoose.disconnect();
  console.log("Disconnected");
}

/**
 * Helper: returns current availability for a list of itemIds
 * returns Map(itemIdStr -> boolean)
 */
async function fetchAvailabilities(itemIds) {
  if (!itemIds || itemIds.length === 0) return new Map();
  const docs = await Item.find({ _id: { $in: itemIds } }).select("availability").lean();
  const map = new Map();
  for (const d of docs) map.set(String(d._id), Boolean(d.availability));
  return map;
}

/**
 * Mode: scan
 * - find carts with mismatched snapshot vs item.currentAvailability
 * - report counts and optionally fix them (if --dry not set)
 */
async function modeScan() {
  console.log("Mode: scan — checking cart snapshots vs Item.availability");
  const cursor = Cart.find({}).cursor();
  let checked = 0;
  let mismatches = 0;
  let ops = [];

  for (let cart = await cursor.next(); cart != null; cart = await cursor.next()) {
    // collect itemIds in this cart
    const itemIdStrs = cart.cartItems.map((ci) => String(ci.id));
    const availMap = await fetchAvailabilities(itemIdStrs);

    for (const ci of cart.cartItems) {
      checked++;
      const idStr = String(ci.id);
      const current = availMap.has(idStr) ? availMap.get(idStr) : false;
      const snapshot = typeof ci.availability === "boolean" ? ci.availability : null;
      if (snapshot !== current) {
        mismatches++;
        console.log(`MISMATCH: cart ${cart._id} cartItem ${ci._id} item ${idStr} snapshot=${snapshot} current=${current}`);
        if (!DRY_RUN) {
          ops.push({
            updateOne: {
              filter: { _id: cart._id, "cartItems._id": ci._id },
              update: { $set: { "cartItems.$.availability": current } },
            },
          });
        }
      }
    }

    if (ops.length >= BATCH_SIZE) {
      if (!DRY_RUN) {
        await Cart.bulkWrite(ops, { ordered: false });
      } else {
        console.log(`[dry-run] would bulkWrite ${ops.length} ops`);
      }
      ops = [];
    }
  }

  if (ops.length) {
    if (!DRY_RUN) {
      await Cart.bulkWrite(ops, { ordered: false });
    } else {
      console.log(`[dry-run] would bulkWrite ${ops.length} ops`);
    }
  }

  console.log(`Scanned ${checked} cartItems. Found ${mismatches} mismatches.`);
}

/**
 * Mode: reserve-from-carts
 * - For every cartItem (across all carts or single user if userId provided)
 * - Attempt to set Item.availability = false (only if currently true)
 * - Update the cart snapshot to reflect the resulting Item.availability (usually false)
 *
 * This tries to use transactions when available; otherwise it does best-effort updates
 * with bulk operations and logs failures.
 */
async function modeReserveFromCarts() {
  console.log("Mode: reserve-from-carts — reserving Items referenced by carts");

  // Build a unique list of itemIds currently referenced in any cart
  const cursor = Cart.find({}).cursor();
  const itemIdSet = new Set();
  for (let cart = await cursor.next(); cart != null; cart = await cursor.next()) {
    for (const ci of cart.cartItems) itemIdSet.add(String(ci.id));
  }
  const itemIds = Array.from(itemIdSet);
  console.log("Total unique itemIds referenced by carts:", itemIds.length);

  if (itemIds.length === 0) return console.log("No items found in carts.");

  // We'll attempt to flip Items to availability=false if they are currently true.
  // We'll use bulkWrite findOneAndUpdate-like behavior by using updateMany with filter availability:true.
  // To preserve the atomic semantics per-document we use findOneAndUpdate per id in batches.

  let reservedCount = 0;
  let alreadyReserved = 0;
  let failCount = 0;

  for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
    const batch = itemIds.slice(i, i + BATCH_SIZE);

    // For each item in the batch, attempt to set availability=false only if it is true.
    // We'll run parallel updates but sequentially gather results (could be optimized).
    const promises = batch.map(async (idStr) => {
      if (DRY_RUN) {
        // just fetch and report
        const item = await Item.findById(idStr).select("availability").lean();
        return { id: idStr, before: item ? Boolean(item.availability) : null, success: null };
      }

      try {
        // Use findOneAndUpdate filter { _id: id, availability: true } to only flip when available.
        const updated = await Item.findOneAndUpdate(
          { _id: idStr, availability: true },
          { $set: { availability: false } },
          { new: true }
        ).lean();

        if (updated) {
          return { id: idStr, before: true, after: false, success: true };
        } else {
          // Either item didn't exist or was already false
          const item = await Item.findById(idStr).select("availability").lean();
          return { id: idStr, before: item ? Boolean(item.availability) : null, success: false };
        }
      } catch (err) {
        return { id: idStr, before: null, success: false, err };
      }
    });

    const results = await Promise.all(promises);

    // Apply results: log counts and prepare to patch carts snapshots accordingly
    const toPatchItemIds = [];
    for (const r of results) {
      if (DRY_RUN) {
        console.log(`[dry-run] item ${r.id} availability before=${r.before}`);
      } else {
        if (r.success === true) {
          reservedCount++;
          toPatchItemIds.push(r.id);
        } else if (r.success === false) {
          // if before === false then it's already reserved
          if (r.before === false) alreadyReserved++;
          else failCount++;
        } else {
          failCount++;
          console.warn("Unknown result for item", r);
        }
      }
    }

    // Update cart snapshot fields for items in this batch that we reserved (and also update snapshots for items already reserved)
    if (!DRY_RUN) {
      // fetch current availabilities for this batch (after attempted reservations)
      const availMap = await fetchAvailabilities(batch);

      // prepare cart updates: for each cartItem whose id is in batch and snapshot differs, set snapshot to current.
      const cartsCursor = Cart.find({ "cartItems.id": { $in: batch } }).cursor();
      const patchOps = [];
      for (let cart = await cartsCursor.next(); cart != null; cart = await cartsCursor.next()) {
        for (const ci of cart.cartItems) {
          const idStr = String(ci.id);
          if (!batch.includes(idStr)) continue;
          const current = availMap.has(idStr) ? availMap.get(idStr) : false;
          const snapshot = typeof ci.availability === "boolean" ? ci.availability : null;
          if (snapshot !== current) {
            patchOps.push({
              updateOne: {
                filter: { _id: cart._id, "cartItems._id": ci._id },
                update: { $set: { "cartItems.$.availability": current } },
              },
            });
          }
        }

        if (patchOps.length >= BATCH_SIZE) {
          await Cart.bulkWrite(patchOps, { ordered: false });
          patchOps.length = 0;
        }
      }
      if (patchOps.length) {
        await Cart.bulkWrite(patchOps, { ordered: false });
      }
    }
  }

  console.log(`Reserved: ${reservedCount}, alreadyReserved: ${alreadyReserved}, failed: ${failCount}`);
  console.log("Done reserve-from-carts.");
}

/**
 * Mode: release-orphan-items
 * - find Items with availability:false which are NOT referenced by any cart
 * - set them back to true (best-effort)
 */
async function modeReleaseOrphanItems() {
  console.log("Mode: release-orphan-items — finding Items false but not in any cart");

  // gather itemIds that appear in carts
  const itemIdSet = new Set();
  const cursor = Cart.find({}).cursor();
  for (let cart = await cursor.next(); cart != null; cart = await cursor.next()) {
    for (const ci of cart.cartItems) itemIdSet.add(String(ci.id));
  }
  const referencedIds = Array.from(itemIdSet);

  // find Items with availability:false and _id not in referencedIds
  const q = referencedIds.length > 0 ? { availability: false, _id: { $nin: referencedIds } } : { availability: false };
  const toRelease = await Item.find(q).select("_id").lean();
  console.log("Orphan items to release:", toRelease.length);

  if (DRY_RUN) {
    for (const t of toRelease) console.log(`[dry-run] would release item ${t._id}`);
    return;
  }

  const ids = toRelease.map((d) => d._id);
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const res = await Item.updateMany({ _id: { $in: batch }, availability: false }, { $set: { availability: true } });
    console.log(`Batch released ${batch.length} items. result:`, res.nModified || res.modifiedCount || "?");
  }

  console.log("Done release-orphan-items.");
}

async function main() {
  await connect();

  try {
    if (MODE === "scan") {
      await modeScan();
    } else if (MODE === "reserve-from-carts") {
      await modeReserveFromCarts();
    } else if (MODE === "release-orphan-items") {
      await modeReleaseOrphanItems();
    } else {
      console.error("Unknown mode. Use scan | reserve-from-carts | release-orphan-items");
    }
  } catch (err) {
    console.error("Fatal error:", err);
  } finally {
    await disconnect();
    process.exit(0);
  }
}

main();
