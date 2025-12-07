// scripts/backfill-orders-user.js
//
// Backfill script to set `order.user` (ObjectId ref to User) for existing Order documents
// that currently lack a user field (user is missing or null).
//
// Usage:
//   MONGO_URI="mongodb://..." DRY_RUN=true node scripts/backfill-orders-user.js
//
// DRY_RUN=true -> prints operations but does NOT write to DB
//
require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs/promises");

const DRY_RUN = String(process.env.DRY_RUN || "").toLowerCase() === "true";
const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || "mongodb://localhost:27017/yourdb";

// adjust model imports if your project layout differs
const Order = require(path.join(__dirname, "..", "models", "Order"));
const User = require(path.join(__dirname, "..", "models", "User"));

// Simple email extractor
function extractEmail(text) {
  if (!text || typeof text !== "string") return null;
  const m = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0].toLowerCase() : null;
}

// Resolve user by multiple heuristics
async function resolveUserForOrder(order) {
  // 1) If order.userId looks like an ObjectId, try findById
  if (order.userId && mongoose.Types.ObjectId.isValid(order.userId)) {
    const u = await User.findById(order.userId).lean();
    if (u) return u;
  }

  // 2) If order.userId exists (legacy format like "MM-0001-25"), try matching user.userId
  if (order.userId) {
    const u = await User.findOne({ userId: order.userId }).lean();
    if (u) return u;
  }

  // 3) Try address.email or address.emailAddress
  if (order.address && (order.address.email || order.address.emailAddress)) {
    const email = (order.address.email || order.address.emailAddress).toLowerCase();
    const u = await User.findOne({ email }).lean();
    if (u) return u;
  }

  // 4) Try to extract email from notes
  if (order.notes) {
    const extracted = extractEmail(order.notes);
    if (extracted) {
      const u = await User.findOne({ email: extracted }).lean();
      if (u) return u;
    }
  }

  // 5) Fallback: try matching order.userId as email or username
  if (order.userId) {
    const lower = String(order.userId).toLowerCase();
    let u = await User.findOne({ email: lower }).lean();
    if (u) return u;
    u = await User.findOne({ username: order.userId }).lean();
    if (u) return u;
  }

  // Nothing matched
  return null;
}

async function run() {
  console.log("Backfill Orders -> set user field (scripts/backfill-orders-user.js)");
  console.log("DRY_RUN:", DRY_RUN);
  console.log("Connecting to:", MONGO_URI);

  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    const totalOrders = await Order.countDocuments({});
    const missingQuery = { $or: [{ user: { $exists: false } }, { user: null }] };
    const missingCount = await Order.countDocuments(missingQuery);
    console.log(`Total orders in DB: ${totalOrders}`);
    console.log(`Orders missing 'user' field: ${missingCount}`);

    if (missingCount === 0) {
      console.log("No orders need backfill. Exiting.");
      await mongoose.disconnect();
      return process.exit(0);
    }

    // Optionally backup affected orders to a JSON file (useful if you want)
    const backupPath = path.join(process.cwd(), `backfill-orders-user-backup-${Date.now()}.json`);
    console.log(`Backing up affected orders to: ${backupPath} (this can be large)`);

    // Stream the cursor to avoid loading everything to memory
    const cursor = Order.find(missingQuery).cursor();

    const summary = {
      totalScanned: 0,
      updated: 0,
      skippedNoMatch: 0,
      failed: 0,
      backupFile: backupPath,
    };

    // We'll store backups incrementally
    const backupStream = [];
    for (let order = await cursor.next(); order != null; order = await cursor.next()) {
      summary.totalScanned++;

      // push compact backup (avoid extremely deep nesting)
      backupStream.push({
        _id: order._id,
        user: order.user === undefined ? null : order.user,
        userId: order.userId || null,
        orderId: order.orderId || null,
        address: order.address || null,
        notes: order.notes || null,
      });

      try {
        const userDoc = await resolveUserForOrder(order);

        if (!userDoc) {
          console.warn(`[SKIP] Order ${order._id} - no matching user found (userId="${order.userId || ""}")`);
          summary.skippedNoMatch++;
          continue;
        }

        // Prepare update
        const update = {
          user: userDoc._id,
        };

        // Ensure legacy userId string present (prefer existing or user's userId)
        if (!order.userId) {
          update.userId = userDoc.userId || String(userDoc._id);
        }

        console.log(`[MATCH] Order ${order._id} -> matched to user ${userDoc._id} (${userDoc.email || userDoc.userId || userDoc.username || "unknown"})`);

        if (DRY_RUN) {
          summary.updated++;
          continue; // skip actual DB write
        }

        // Persist update (use findByIdAndUpdate to avoid re-validation of orderId, etc.)
        const res = await Order.findByIdAndUpdate(order._id, { $set: update }, { new: true });
        if (res) {
          summary.updated++;
        } else {
          console.error(`[ERROR] Order ${order._id} - failed to update`);
          summary.failed++;
        }
      } catch (err) {
        console.error(`[ERROR] processing order ${order._id}:`, err);
        summary.failed++;
      }
    } // end cursor

    // save backup file
    try {
      await fs.writeFile(backupPath, JSON.stringify(backupStream, null, 2), "utf8");
      console.log(`Backup written to ${backupPath} (${backupStream.length} orders)`);
    } catch (err) {
      console.error("Failed to write backup file:", err);
    }

    console.log("Backfill complete. Summary:", summary);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Fatal error during backfill:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
