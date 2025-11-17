/**
 * scripts/backfill-dummy-orders.js
 *
 * Weekly backfill generator (2..5 orders per week) from 2024-11-01 to 2025-11-17.
 * - Item names are antiques-themed
 * - Addresses are in Quezon province (CALABARZON / Region IV-A)
 * - Ensures each status from the list appears at least once
 *
 * Usage (PowerShell):
 *   $env:MONGO_URI="mongodb://USER:PASS@HOST:27017/DBNAME"
 *   node .\scripts\backfill-dummy-orders.js
 *
 * Options:
 *   --dry            Dry run (no DB writes)
 *   --start=YYYY-MM-DD
 *   --end=YYYY-MM-DD
 */

const mongoose = require("mongoose");
const argv = require("minimist")(process.argv.slice(2));
const path = require("path");

const MONGO_URI = process.env.MONGO_URI || argv.mongo;
if (!MONGO_URI) {
  console.error("ERROR: set MONGO_URI env var or pass --mongo");
  process.exit(1);
}

// adjust path if your Order model is located elsewhere
const Order = require(path.join(__dirname, "..", "models", "Order"));

const DRY = Boolean(argv.dry);
const startArg = argv.start || "2024-11-01";
const endArg = argv.end || "2025-11-17"; // explicit per request (today)

const startDate = new Date(startArg + "T00:00:00.000Z");
const endDate = new Date(endArg + "T23:59:59.999Z");
if (isNaN(startDate) || isNaN(endDate)) {
  console.error("Invalid --start or --end date. Use YYYY-MM-DD");
  process.exit(1);
}

const antiques = [
  "Antique Wooden Trunk",
  "Vintage Pocket Watch",
  "Porcelain Vase (Antique)",
  "Brass Oil Lamp (Antique)",
  "Colonial Era Chair",
  "Antique Radio Set",
  "Vintage Typewriter",
  "Antique Mirror Frame",
  "Carved Teak Chest",
  "Antique Brass Telescope",
  "Antique Silverware Set",
  "Vintage Gramophone",
  "Antique Coin Collection",
  "Antique Hand Fan (Bone & Lace)",
  "Antique Map Print",
  "Antique Porcelain Figurine",
  "Vintage Lantern",
  "Antique Sewing Machine",
  "Antique Ceramic Jar",
  "Antique Wooden Clock"
];

const quezonPlaces = [
  { city: "Lucena City", postal: "4301" },
  { city: "Tayabas", postal: "4320" },
  { city: "Lucban", postal: "4303" },
  { city: "Sariaya", postal: "4328" },
  { city: "Candelaria", postal: "4322" },
  { city: "Tiaong", postal: "4327" },
  { city: "Mauban", postal: "4326" },
  { city: "Gumaca", postal: "4329" },
  { city: "Pagbilao", postal: "4321" },
  { city: "Atimonan", postal: "4317" },
  { city: "Mulanay", postal: "4316" },
  { city: "Real", postal: "4313" },
  { city: "Infanta", postal: "4324" },
  { city: "Lopez", postal: "4312" },
  { city: "Alabat", postal: "4318" }
];

const STATUSES = ["Pending", "Scheduled", "Accepted", "Declined", "Cancelled", "Completed"];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randPrice(min, max) {
  return Math.round((Math.random() * (max - min) + min) / 10) * 10;
}
function addMs(date, ms) {
  return new Date(date.getTime() + ms);
}

// UTC week start (Monday)
function startOfWeekUTC(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const offset = day === 0 ? -6 : (1 - day);
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function addDaysUTC(date, days) {
  return new Date(date.getTime() + days * 24 * 3600 * 1000);
}

(async function main() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const docs = [];
    let weekStart = startOfWeekUTC(startDate);

    // collect at least one of each status to ensure presence
    const requiredStatusPool = STATUSES.slice();

    while (weekStart <= endDate) {
      const weekEnd = addDaysUTC(weekStart, 6);
      const clampedEnd = weekEnd > endDate ? endDate : weekEnd;

      const ordersThisWeek = randInt(2, 5); // 2..5 orders per week
      for (let i = 0; i < ordersThisWeek; i++) {
        // random ms offset in week
        const msRange = clampedEnd.getTime() - weekStart.getTime();
        const createdAt = new Date(weekStart.getTime() + Math.floor(Math.random() * (msRange + 1)));
        createdAt.setUTCSeconds(randInt(0, 59));
        createdAt.setUTCMilliseconds(0);

        const numItems = randInt(1, 3);
        const items = [];
        let subtotal = 0;
        for (let j = 0; j < numItems; j++) {
          const name = pick(antiques);
          const qty = randInt(1, 3);
          const price = randPrice(200, 25000);
          items.push({ name, quantity: qty, price, image: "" });
          subtotal += price * qty;
        }
        const extras = randInt(0, 500);
        const total = subtotal + extras;

        const place = pick(quezonPlaces);
        const lat = (13 + Math.random() * 2).toFixed(6);
        const lng = (121 + Math.random() * 2).toFixed(6);

        // assign status:
        // - If we still need to place a required status, pick and remove one from pool
        // - otherwise pick randomly but favour "Pending" a bit
        let status;
        if (requiredStatusPool.length > 0 && Math.random() < 0.5) {
          // 50% chance to place a required status this order
          const idx = randInt(0, requiredStatusPool.length - 1);
          status = requiredStatusPool.splice(idx, 1)[0];
        } else {
          // weighted random: Pending more frequent
          const weights = { Pending: 40, Scheduled: 15, Accepted: 15, Declined: 10, Cancelled: 10, Completed: 10 };
          const pickVal = randInt(1, Object.values(weights).reduce((a, b) => a + b, 0));
          let acc = 0;
          for (const s of Object.keys(weights)) {
            acc += weights[s];
            if (pickVal <= acc) { status = s; break; }
          }
          if (!status) status = "Pending";
        }

        const order = {
          // leave orderId blank (pre-validate will create it)
          userId: `user-${randInt(1000, 9999)}`,
          items,
          total,
          address: {
            province: "Quezon",
            region: "CALABARZON (Region IV-A)",
            city: place.city,
            barangay: `Barangay ${randInt(1, 60)}`,
            street: `Blk ${randInt(1, 120)} Lot ${randInt(1, 400)} Antique St`,
            postalCode: place.postal,
            coordinates: { lat, lng }
          },
          status,
          createdAt
        };

        // if cancelled, set cancelledAt to sometime after createdAt (within 7 days)
        if (status === "Cancelled") {
          const afterMs = randInt(1, 7) * 24 * 3600 * 1000 + randInt(0, 23) * 3600 * 1000 + randInt(0, 59) * 60 * 1000;
          order.cancelledAt = new Date(createdAt.getTime() + afterMs);
        }

        docs.push(order);
      }

      weekStart = addDaysUTC(weekStart, 7);
    }

    // If any required statuses remain (rare if date range small), force-add them at the end
    if (requiredStatusPool.length > 0) {
      console.log("Adding leftover required statuses to ensure each status present:", requiredStatusPool);
      for (const st of requiredStatusPool) {
        const createdAt = new Date(endDate.getTime() - randInt(0, 7) * 24 * 3600 * 1000);
        const numItems = randInt(1, 2);
        const items = [];
        let subtotal = 0;
        for (let j = 0; j < numItems; j++) {
          const name = pick(antiques);
          const qty = randInt(1, 2);
          const price = randPrice(200, 5000);
          items.push({ name, quantity: qty, price, image: "" });
          subtotal += price * qty;
        }
        const total = subtotal + randInt(0, 200);
        const place = pick(quezonPlaces);
        const lat = (13 + Math.random() * 2).toFixed(6);
        const lng = (121 + Math.random() * 2).toFixed(6);

        const order = {
          userId: `user-${randInt(1000, 9999)}`,
          items,
          total,
          address: {
            province: "Quezon",
            region: "CALABARZON (Region IV-A)",
            city: place.city,
            barangay: `Barangay ${randInt(1, 60)}`,
            street: `Blk ${randInt(1, 120)} Lot ${randInt(1, 400)} Antique St`,
            postalCode: place.postal,
            coordinates: { lat, lng }
          },
          status: st,
          createdAt
        };

        if (st === "Cancelled") {
          order.cancelledAt = new Date(createdAt.getTime() + randInt(1, 3) * 24 * 3600 * 1000);
        }
        docs.push(order);
      }
    }

    console.log(`Prepared ${docs.length} orders (weekly cadence).`);

    if (DRY) {
      console.log("Dry run enabled — showing up to 8 samples:");
      const samples = docs.slice(0, 8).map(d => ({
        createdAt: d.createdAt.toISOString(),
        status: d.status,
        cancelledAt: d.cancelledAt ? d.cancelledAt.toISOString() : undefined,
        items: d.items.map(it => ({ name: it.name, qty: it.quantity, price: it.price })),
        total: d.total,
        address: `${d.address.city}, ${d.address.province} ${d.address.postalCode}`
      }));
      console.dir(samples, { depth: 4 });
      await mongoose.disconnect();
      process.exit(0);
    }

    // Insert in batches. Use Order.create so pre('validate') runs.
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < docs.length; i += BATCH) {
      const chunk = docs.slice(i, i + BATCH);
      const saved = await Order.create(chunk);
      inserted += saved.length;
      console.log(`Inserted ${inserted}/${docs.length}`);
    }

    console.log(`Done. Inserted ${inserted} orders into collection "${Order.collection.name}"`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Backfill error:", err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
})();
