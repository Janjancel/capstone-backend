/**
 * backfill-categories.js
 *
 * Usage (PowerShell):
 *   # Dry run first (no writes)
 *   $env:MONGO_URI="your_mongo_connection_string"; node backfill-categories.js --dry-run
 *
 *   # Perform actual update
 *   $env:MONGO_URI="your_mongo_connection_string"; node backfill-categories.js
 *
 * Notes:
 * - Script is idempotent. It will only save docs when a change is required.
 * - It maps legacy "Flooring" and "Bed" to "Others".
 * - Unknown categories (not in ALLOWED) are mapped to "Others".
 * - Keeps legacy single-string `category` in sync to the first element of `categories`.
 * - Ensures `categories` is a non-empty array; falls back to ["Uncategorized"].
 */

const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("ERROR: Please set MONGO_URI environment variable.");
  console.error('PowerShell example: $env:MONGO_URI="mongodb+srv://user:pass@host/dbname"; node backfill-categories.js --dry-run');
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run") || process.argv.includes("-n");

const ALLOWED = [
  "Table",
  "Chair",
  "Cabinet",
  "Post",
  "Scraps",
  "Stones",
  "Windows",
  "Railings",
  "Doors",
  "Others",
  "Uncategorized",
];

// simple canonical map for variations -> canonical name
const CANONICAL_MAP = ALLOWED.reduce((acc, name) => {
  acc[name.toLowerCase()] = name;
  return acc;
}, {});

// special legacy mappings
const LEGACY_MAP = {
  flooring: "Others",
  bed: "Others",
};

// helper -> normalize single token -> canonical or null
function normalizeCategoryRaw(raw) {
  if (!raw && raw !== 0) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const key = s.toLowerCase();

  // direct canonical
  if (CANONICAL_MAP[key]) return CANONICAL_MAP[key];

  // legacy mapping
  if (LEGACY_MAP[key]) return LEGACY_MAP[key];

  // common plural/singular fixes
  if (key.endsWith("s") && CANONICAL_MAP[key.slice(0, -1)]) return CANONICAL_MAP[key.slice(0, -1)];

  // best-effort: if contains keywords 'rail' -> Railings, 'door' -> Doors
  if (key.includes("rail")) return "Railings";
  if (key.includes("door")) return "Doors";

  // unknown -> Others
  return "Others";
}

async function main() {
  console.log(`Connecting to ${MONGO_URI} ...`);
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Minimal item model for updates (we only need fields we touch)
  const ItemSchema = new mongoose.Schema({}, { strict: false });
  const Item = mongoose.models.Item || mongoose.model("Item", ItemSchema, "items");

  const cursor = Item.find().cursor();

  let processed = 0;
  let changed = 0;
  const sampleChanges = [];

  console.log("Starting backfill... (dry run = %s)", DRY_RUN ? "YES" : "NO");

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    processed++;

    // read existing categories in flexible ways
    let rawCats = [];
    if (Array.isArray(doc.categories) && doc.categories.length) {
      rawCats = doc.categories.slice();
    } else if (doc.category) {
      rawCats = [doc.category];
    } else {
      // attempt to infer from other fields? skip for now
      rawCats = [];
    }

    // Normalize each raw category to canonical set
    const normalized = rawCats
      .map((c) => normalizeCategoryRaw(c))
      .filter(Boolean);

    // dedupe preserving order
    const deduped = Array.from(new Set(normalized));

    // if nothing after normalization -> fallback to ["Uncategorized"]
    const finalCats = deduped.length ? deduped : ["Uncategorized"];

    // ensure legacy single-string category matches first entry
    const finalLegacyCategory = finalCats[0] || "Uncategorized";

    // defaults for quantity and availability (non-destructive)
    const finalQuantity = typeof doc.quantity === "undefined" || doc.quantity === null ? 1 : doc.quantity;
    const finalAvailability = typeof doc.availability === "undefined" ? true : doc.availability;

    // Determine whether anything actually changes
    const catsSame =
      Array.isArray(doc.categories) &&
      doc.categories.length === finalCats.length &&
      doc.categories.every((v, i) => String(v) === String(finalCats[i]));

    const legacySame = String(doc.category || "") === String(finalLegacyCategory);
    const quantitySame = finalQuantity === doc.quantity;
    const availabilitySame = finalAvailability === doc.availability;

    if (!catsSame || !legacySame || !quantitySame || !availabilitySame) {
      changed++;
      sampleChanges.push({
        _id: String(doc._id),
        before: { categories: doc.categories, category: doc.category, quantity: doc.quantity, availability: doc.availability },
        after: { categories: finalCats, category: finalLegacyCategory, quantity: finalQuantity, availability: finalAvailability },
      });
      // apply changes
      if (!DRY_RUN) {
        try {
          await Item.updateOne(
            { _id: doc._id },
            {
              $set: {
                categories: finalCats,
                category: finalLegacyCategory,
                quantity: finalQuantity,
                availability: finalAvailability,
                updatedAt: new Date(),
              },
            }
          );
        } catch (err) {
          console.error("Failed to update doc", doc._id, err);
        }
      }
    }

    // logging progress every 200 processed
    if (processed % 200 === 0) {
      console.log(`Processed: ${processed} — Changes queued: ${changed}`);
    }
  }

  console.log("Backfill finished.");
  console.log(`Processed ${processed} items. ${changed} items would be changed${DRY_RUN ? " (dry-run)" : ""}.`);

  if (sampleChanges.length) {
    console.log("Sample changes (first 10):");
    console.dir(sampleChanges.slice(0, 10), { depth: 3, colors: false });
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(2);
});
