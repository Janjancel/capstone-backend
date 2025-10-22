/**
 * Backfill Items: category (string) -> categories (array)
 *
 * Usage (recommended with .env):
 *   node -r dotenv/config server/scripts/backfill-items-categories.js --mode=apply
 *
 * Or pass URI directly:
 *   node server/scripts/backfill-items-categories.js --uri="YOUR_MONGODB_URI" --mode=apply
 *
 * Options:
 *   --uri="..."             MongoDB URI (else reads MONGODB_URI or MONGO_URI from env)
 *   --mode=apply|dry        Default: dry (no writes). Use apply to perform updates.
 *   --default="Uncategorized"  Default category when none/invalid.
 *   --remove-legacy=true|false Remove legacy "category" field. Default: false (keep it).
 *   --batch=500             Bulk write batch size. Default: 500.
 */

const mongoose = require("mongoose");

// --- tiny arg parser ---
const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] === undefined ? true : m[2];
}

const MODE = (args.mode || "dry").toLowerCase();        // "dry" | "apply"
const BATCH = Number(args.batch || 500);
const DEFAULT_CAT = args.default || "Uncategorized";
const REMOVE_LEGACY = String(args["remove-legacy"] || "false").toLowerCase() === "true";

const URI =
  args.uri ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URI;

if (!URI) {
  console.error("❌ Missing MongoDB URI. Pass --uri=\"...\" or set MONGODB_URI / MONGO_URI.");
  process.exit(1);
}

// Keep in sync with your server/models/Item.js CATEGORIES
const VALID_CATEGORIES = new Set([
  "Table",
  "Chair",
  "Flooring",
  "Cabinet",
  "Post",
  "Scraps",
  "Stones",
  "Windows",
  "Bed",
  "Uncategorized",
]);

function sanitizeList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  for (const raw of list) {
    const t = String(raw || "").trim();
    if (!t) continue;
    if (!VALID_CATEGORIES.has(t)) continue;
    if (!seen.has(t)) seen.add(t);
  }
  return Array.from(seen);
}

(async () => {
  const started = Date.now();
  console.log(`\n▶ Backfill start (mode: ${MODE})`);
  console.log(`  - default category: ${DEFAULT_CAT}`);
  console.log(`  - remove legacy "category": ${REMOVE_LEGACY}`);
  console.log(`  - batch size: ${BATCH}`);

  await mongoose.connect(URI, { autoIndex: false });

  const col = mongoose.connection.collection("items"); // direct collection for flexibility

  const cursor = col.find({}, { projection: {
    _id: 1,
    category: 1,
    categories: 1,
    name: 1,
  }});

  let seen = 0;
  let toUpdate = 0;
  let updated = 0;
  let skipped = 0;
  let invalidFixed = 0;

  let bulk = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    seen++;

    const legacy = typeof doc.category === "string" ? doc.category.trim() : "";
    const hasArray = Array.isArray(doc.categories);
    const currentArray = hasArray ? doc.categories : [];

    // 1) Build desired categories
    let desired = [];

    if (hasArray && currentArray.length) {
      // Sanitize/dedupe/only valid
      const cleaned = sanitizeList(currentArray);
      if (cleaned.length) {
        desired = cleaned;
        if (cleaned.length !== currentArray.length) invalidFixed++;
      } else {
        // array exists but all invalid
        desired = VALID_CATEGORIES.has(DEFAULT_CAT) ? [DEFAULT_CAT] : ["Uncategorized"];
        invalidFixed++;
      }
    } else if (legacy) {
      if (VALID_CATEGORIES.has(legacy)) {
        desired = [legacy];
      } else {
        desired = VALID_CATEGORIES.has(DEFAULT_CAT) ? [DEFAULT_CAT] : ["Uncategorized"];
        invalidFixed++;
      }
    } else {
      desired = VALID_CATEGORIES.has(DEFAULT_CAT) ? [DEFAULT_CAT] : ["Uncategorized"];
    }

    // 2) Decide if update is needed
    const needsCategories =
      !hasArray ||
      currentArray.length !== desired.length ||
      sanitizeList(currentArray).join("|") !== desired.join("|");

    const needsLegacySync =
      !REMOVE_LEGACY && (legacy !== (desired[0] || ""));

    if (!needsCategories && !needsLegacySync && REMOVE_LEGACY === false) {
      skipped++;
      continue;
    }

    const update = { $set: { categories: desired } };

    if (REMOVE_LEGACY) {
      update.$unset = { ...(update.$unset || {}), category: "" };
    } else {
      update.$set.category = desired[0] || ""; // keep legacy in sync
    }

    bulk.push({ updateOne: { filter: { _id: doc._id }, update } });
    toUpdate++;

    if (bulk.length >= BATCH) {
      if (MODE === "apply") {
        const res = await col.bulkWrite(bulk, { ordered: false });
        updated += res.modifiedCount || 0;
      }
      bulk = [];
      process.stdout.write(`\r  processed: ${seen} | queued: ${toUpdate} | updated: ${updated}`);
    }
  }

  if (bulk.length) {
    if (MODE === "apply") {
      const res = await col.bulkWrite(bulk, { ordered: false });
      updated += res.modifiedCount || 0;
    }
  }

  console.log(`\n\n✅ Backfill complete in ${Math.round((Date.now() - started)/1000)}s`);
  console.log(`   scanned:  ${seen}`);
  console.log(`   queued:   ${toUpdate}`);
  console.log(`   updated:  ${MODE === "apply" ? updated : "(dry-run)"}`);
  console.log(`   skipped:  ${skipped}`);
  console.log(`   fixed invalid/empty: ${invalidFixed}`);

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error("\n❌ Backfill failed:", err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
