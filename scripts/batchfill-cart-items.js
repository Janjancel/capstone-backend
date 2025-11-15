/* eslint-disable no-console */
const mongoose = require("mongoose");
const args = require("minimist")(process.argv.slice(2));

// --- Adjust paths to your project ---
const { Cart } = require("../models/Cart");
const Item = require("../models/Item");
// -------------------------------------

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("Please set MONGO_URI environment variable.");
  process.exit(1);
}

const MODE = args.mode || "missing"; // missing | stale | force
const USER_ID = args.userId || null; // optional: limit to single user
const DRY_RUN = Boolean(args.dry); // --dry to only report what would change
const BATCH_SIZE = Number(args.batchSize || 200);

async function connect() {
  await mongoose.connect(MONGO_URI, { dbName: mongoose.connection?.name || undefined });
  console.log("Connected to MongoDB");
}

async function disconnect() {
  await mongoose.disconnect();
  console.log("Disconnected");
}

async function getItemAvailability(itemId) {
  const item = await Item.findById(itemId).select("availability").lean();
  return item ? Boolean(item.availability) : false;
}

function cartQueryForMode(mode) {
  if (USER_ID) {
    return { userId: USER_ID };
  }
  if (mode === "missing") {
    // cart items where availability field is missing or null
    return { cartItems: { $elemMatch: { $or: [{ availability: { $exists: false } }, { availability: null }] } } };
  } else if (mode === "stale") {
    // need to check each item; fetch all carts (or could be optimized)
    return {};
  } else if (mode === "force") {
    return {};
  }
  return {};
}

async function run() {
  await connect();

  try {
    if (MODE === "missing") {
      await fillMissing();
    } else if (MODE === "stale") {
      await fixStale();
    } else if (MODE === "force") {
      await forceRecompute();
    } else {
      console.error("Unknown mode. Use: missing | stale | force");
      process.exit(1);
    }
  } finally {
    await disconnect();
    process.exit(0);
  }
}

// ------------------------ Mode: missing ------------------------
async function fillMissing() {
  console.log("Mode: missing — filling cartItems with missing/null availability");
  const q = cartQueryForMode("missing");
  const cursor = Cart.find(q).cursor();
  let ops = [];
  let total = 0;
  for (let cart = await cursor.next(); cart != null; cart = await cursor.next()) {
    for (const ci of cart.cartItems) {
      if (ci.availability === undefined || ci.availability === null) {
        const avail = await getItemAvailability(ci.id);
        total++;
        ops.push({
          updateOne: {
            filter: { _id: cart._id, "cartItems._id": ci._id },
            update: { $set: { "cartItems.$.availability": avail } },
          },
        });
      }
    }

    if (ops.length >= BATCH_SIZE) {
      await executeBulk(ops);
      ops = [];
    }
  }
  if (ops.length) await executeBulk(ops);
  console.log(`Processed ${total} cartItems (missing).`);
}

// ------------------------ Mode: stale ------------------------
async function fixStale() {
  console.log("Mode: stale — fixing snapshots that don't match current Item.availability");
  const q = cartQueryForMode("stale"); // probably {} or user-limited
  const cursor = Cart.find(q).cursor();
  let ops = [];
  let totalChecked = 0;
  let totalChanged = 0;

  for (let cart = await cursor.next(); cart != null; cart = await cursor.next()) {
    for (const ci of cart.cartItems) {
      totalChecked++;
      const current = await getItemAvailability(ci.id);
      // treat undefined/null snapshots as stale too
      const snapshot = typeof ci.availability === "boolean" ? ci.availability : null;
      if (snapshot !== current) {
        totalChanged++;
        ops.push({
          updateOne: {
            filter: { _id: cart._id, "cartItems._id": ci._id },
            update: { $set: { "cartItems.$.availability": current } },
          },
        });
      }
    }
    if (ops.length >= BATCH_SIZE) {
      await executeBulk(ops);
      ops = [];
    }
  }

  if (ops.length) await executeBulk(ops);
  console.log(`Checked ${totalChecked} cartItems; updated ${totalChanged} stale snapshots.`);
}

// ------------------------ Mode: force ------------------------
async function forceRecompute() {
  console.log("Mode: force — recomputing ALL cart item snapshots (overwrite)");
  const q = cartQueryForMode("force");
  const cursor = Cart.find(q).cursor();
  let ops = [];
  let total = 0;

  for (let cart = await cursor.next(); cart != null; cart = await cursor.next()) {
    for (const ci of cart.cartItems) {
      const current = await getItemAvailability(ci.id);
      total++;
      ops.push({
        updateOne: {
          filter: { _id: cart._id, "cartItems._id": ci._id },
          update: { $set: { "cartItems.$.availability": current } },
        },
      });
    }
    if (ops.length >= BATCH_SIZE) {
      await executeBulk(ops);
      ops = [];
    }
  }
  if (ops.length) await executeBulk(ops);
  console.log(`Recomputed ${total} cartItems (force).`);
}

// ------------------------ Helper: execute bulk ------------------------
async function executeBulk(ops) {
  if (ops.length === 0) return;
  if (DRY_RUN) {
    console.log(`[dry-run] Would execute bulkWrite with ${ops.length} operations`);
    return;
  }
  const result = await Cart.bulkWrite(ops, { ordered: false });
  console.log(`bulkWrite executed — matched:${result.matchedCount || "?"} modified:${result.modifiedCount || "?"}`);
}

// ------------------------ Start ------------------------
run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
