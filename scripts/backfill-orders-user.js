/* eslint-disable no-console */
const mongoose = require("mongoose");

// ---- Simple flag parser (no external deps) ----
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run") || args.includes("--dryrun");
const batchIndex = args.indexOf("--batchSize");
const BATCH_SIZE = batchIndex !== -1 && args[batchIndex + 1]
  ? Number(args[batchIndex + 1])
  : 200;

// ------------------------------------------------

const { Schema, model } = mongoose;

// Lightweight Order model (strict:false)
const OrderLite = mongoose.models.OrderLite || model(
  "OrderLite",
  new Schema({}, { strict: false, collection: "orders" })
);

// Lightweight User model
const UserLite = mongoose.models.UserLite || model(
  "UserLite",
  new Schema({}, { strict: false, collection: "users" })
);

function isEmptyStringish(v) {
  return v === null || v === undefined || (typeof v === "string" && /^\s*$/.test(v));
}

async function ensureIndexes() {
  try {
    const coll = mongoose.connection.collection("orders");
    await coll.createIndex({ user: 1 });
    await coll.createIndex({ userId: 1 });
    console.log("✅ Ensured (non-unique) indexes on orders.user and orders.userId");
  } catch (e) {
    console.warn("⚠️ Index ensure failed:", e.message);
  }
}

async function backfill() {
  const query = {
    $or: [
      // missing user but userId exists
      { $and: [
          { $or: [{ user: { $exists: false } }, { user: null }] },
          { userId: { $exists: true, $nin: [null, ""] } }
      ]},
      // missing userId but has user
      { $and: [
          { user: { $exists: true, $ne: null } },
          { $or: [{ userId: { $exists: false } }, { userId: null }, { userId: { $regex: /^\s*$/ } }] }
      ]},
    ]
  };

  const cursor = OrderLite.find(query).cursor({ batchSize: BATCH_SIZE });

  let scanned = 0;
  let updated = 0;
  let userSet = 0;
  let userIdSet = 0;
  let notFoundUsers = 0;

  for await (const doc of cursor) {
    scanned++;

    const updates = {};

    // CASE A: missing user but have userId
    if ((doc.user === undefined || doc.user === null) && !isEmptyStringish(doc.userId)) {
      const found = await UserLite.findOne({ userId: doc.userId })
        .lean()
        .select("_id");
      if (found && found._id) {
        updates.user = found._id;
      } else {
        notFoundUsers++;
      }
    }

    // CASE B: missing userId but have user
    if (doc.user && isEmptyStringish(doc.userId)) {
      const userObjId = mongoose.Types.ObjectId.isValid(doc.user)
        ? doc.user
        : null;

      if (userObjId) {
        const u = await UserLite.findById(userObjId)
          .lean()
          .select("userId");
        if (u && !isEmptyStringish(u.userId)) {
          updates.userId = u.userId;
        }
      }
    }

    if (Object.keys(updates).length === 0) continue;

    if (DRY_RUN) {
      console.log(`[dry-run] ${doc._id} ->`, updates);
      updated++;
      if (updates.user) userSet++;
      if (updates.userId) userIdSet++;
      continue;
    }

    const res = await OrderLite.updateOne(
      { _id: doc._id },
      { $set: updates }
    );

    const modified = res.modifiedCount || res.nModified;
    if (modified) {
      updated++;
      if (updates.user) userSet++;
      if (updates.userId) userIdSet++;
    }

    if (scanned % 300 === 0) {
      console.log(`Progress: scanned ${scanned}, updated ${updated}`);
    }
  }

  console.log("\n==== Backfill Complete ====");
  console.log("Scanned:", scanned);
  console.log("Updated:", updated);
  console.log("user set:", userSet);
  console.log("userId set:", userIdSet);
  console.log("UserId with no matching user:", notFoundUsers);
}

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI not set.");
    process.exit(1);
  }

  console.log("DRY_RUN =", DRY_RUN);
  console.log("Batch size =", BATCH_SIZE);

  await mongoose.connect(uri, { autoIndex: false });
  console.log("Connected to MongoDB");

  await ensureIndexes();
  await backfill();

  await mongoose.disconnect();
  console.log("Disconnected");
})();
