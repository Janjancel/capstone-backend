/**
 * backfill-orders-delivery-alt.js
 *
 * Alternate backfill:
 * - 3-7 orders per week from 2024-11-01 to 2025-11-17
 * - Same pivot (Lucena City Hall) and delivery rules:
 *     free <= 30km, then ₱1,000 per started 10km beyond
 * - Adds order status history, payment/shipping fields, and daily counter-based orderCode
 * - Bulk inserts weekly batches; supports DRY_RUN=true to preview only
 *
 * Usage:
 *   set MONGO_URI env var (optional), then:
 *     node backfill-orders-delivery-alt.js
 *
 * Optional: DRY_RUN=true node ...
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// CONFIG
const PIVOT = { lat: 13.9365569, lng: 121.6115341 };
const FREE_RADIUS_KM = 30;
const PRICE_PER_10KM = 1000;
const START = new Date('2024-11-01T09:00:00+08:00');
const END = new Date('2025-11-17T23:59:59+08:00');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/yourdbname';
const DRY_RUN = (String(process.env.DRY_RUN || '')).toLowerCase() === 'true';

// Try to load Order model
const ORDER_MODEL_PATH = path.join(__dirname, 'models', 'Order');
let Order;
try {
  if (!fs.existsSync(path.join(__dirname, 'models', 'Order.js'))) {
    console.warn('[WARN] models/Order.js missing — ensure you have a compatible Order model.');
  }
  Order = require(ORDER_MODEL_PATH);
} catch (err) {
  console.error('[ERR] Could not require Order model from', ORDER_MODEL_PATH, err && err.message);
  // Continue — allow the user to inspect script (dry-run) without model present
  if (!DRY_RUN) process.exit(1);
}

// Helpers
function toRad(v) { return (v * Math.PI) / 180; }
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
function computeDeliveryFeeForCoords(destLat, destLng) {
  if (destLat == null || destLng == null || Number.isNaN(Number(destLat)) || Number.isNaN(Number(destLng))) {
    return { distanceKm: null, deliveryFee: 0 };
  }
  const distanceKmRaw = Number(haversineKm(PIVOT.lat, PIVOT.lng, Number(destLat), Number(destLng)));
  const distanceKm = Math.round(distanceKmRaw * 1000) / 1000;
  if (distanceKm <= FREE_RADIUS_KM) return { distanceKm, deliveryFee: 0 };
  const extra = distanceKm - FREE_RADIUS_KM;
  const chunks = Math.ceil(extra / 10);
  const deliveryFee = chunks * PRICE_PER_10KM;
  return { distanceKm, deliveryFee };
}

function randomIn(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, maxInclusive) { return Math.floor(randomIn(min, maxInclusive + 1)); }

const ANTIQUE_NAMES = [
  "Antique Oak Armoire", "Victorian Mantel Clock", "Brass Candlestick Pair", "Porcelain Figurine Set",
  "Vintage Radio Console", "Colonial Mirror Frame", "Art Deco Lamp", "Antique Writing Desk",
  "Filipiniana Inabel Chest", "Spanish Era Coin Collection", "Handcrafted Mahogany Chair",
  "Silver Tea Set (Antique)", "Retro Sewing Machine (Singer)", "Antique Map Reproduction",
  "Wooden Trunk (Vintage)", "Antique Porcelain Vase", "Brass Telescope (Vintage)",
  "Wrought Iron Gate Panel", "Old Church Bench (Plank)", "Antique Bed Frame (Iron)"
];

const QUEZON_BBOX = { latMin: 13.0, latMax: 14.25, lngMin: 120.85, lngMax: 122.25 };

function randomCoordinateInQuezon() {
  return {
    lat: +(randomIn(QUEZON_BBOX.latMin, QUEZON_BBOX.latMax).toFixed(6)),
    lng: +(randomIn(QUEZON_BBOX.lngMin, QUEZON_BBOX.lngMax).toFixed(6))
  };
}
function randomPrice() { const p = Math.floor(randomIn(500, 25000)); return Math.round(p / 50) * 50; }
function randomQuantity() { return randomInt(1, 3); }

function mkOrderCodeForDate(date, counters) {
  const d = new Date(date);
  const yyyy = d.getFullYear().toString();
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  const key = `${yyyy}${mm}${dd}`;
  counters[key] = (counters[key] || 0) + 1;
  const seq = String(counters[key]).padStart(4, '0');
  return `ORD-${key}-${seq}`;
}

const STATUS_FLOW = ['pending', 'paid', 'processing', 'shipped', 'delivered'];
const STATUSES = ['pending','paid','processing','shipped','delivered','cancelled','returned'];

function generateStatusHistory(createdAt, finalStatus) {
  // createdAt is base; produce timestamps for transitions up to finalStatus
  const history = [{ status: 'created', at: new Date(createdAt) }];
  if (finalStatus === 'cancelled') {
    history.push({ status: 'cancelled', at: new Date(createdAt.getTime() + randomInt(1, 3) * 60*60*1000) });
    return history;
  }
  if (finalStatus === 'returned') {
    // produce full delivered then returned
    let t = new Date(createdAt.getTime() + randomInt(1, 12) * 60*60*1000);
    ['paid','processing','shipped','delivered'].forEach((s, idx) => {
      t = new Date(t.getTime() + randomInt(1, 48) * 60*60*1000);
      history.push({ status: s, at: new Date(t) });
    });
    history.push({ status: 'returned', at: new Date(t.getTime() + randomInt(24, 240) * 60*60*1000) });
    return history;
  }
  // choose how far along the canonical flow this order progressed
  const endStep = randomInt(0, STATUS_FLOW.length - 1);
  let t = new Date(createdAt.getTime());
  for (let i = 0; i <= endStep; i++) {
    t = new Date(t.getTime() + randomInt(1, 72) * 60*60*1000); // 1-72 hours between steps
    history.push({ status: STATUS_FLOW[i], at: new Date(t) });
  }
  // if finalStatus is one of the intermediate statuses like 'processing', keep that as final
  if (!STATUS_FLOW.includes(finalStatus)) return history;
  // Ensure final status equals chosen one
  return history;
}

async function main() {
  console.log('Connecting to MongoDB:', MONGO_URI, DRY_RUN ? '(DRY RUN mode)' : '');
  if (!DRY_RUN) {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  }

  // Counters for order codes
  const orderCounters = {};

  const docsToInsert = [];
  let current = new Date(START);
  while (current <= END) {
    const ordersThisWeek = randomInt(3, 7); // 3..7
    for (let i = 0; i < ordersThisWeek; i++) {
      // random day within week
      const orderDt = new Date(current.getTime() + randomInt(0, 6) * 24*60*60*1000);
      orderDt.setHours(randomInt(8, 19), randomInt(0,59), randomInt(0,59), 0);

      // items 1..4
      const itemCount = randomInt(1, 4);
      const items = [];
      for (let j = 0; j < itemCount; j++) {
        const name = pick(ANTIQUE_NAMES);
        const qty = randomQuantity();
        const price = randomPrice();
        items.push({
          id: `ALT-${randomInt(100000,999999)}`,
          name,
          quantity: qty,
          price,
          subtotal: +(qty * price).toFixed(2),
        });
      }
      const itemsTotal = +items.reduce((s,x) => s + Number(x.subtotal || 0), 0).toFixed(2);

      // coords
      const coords = randomCoordinateInQuezon();
      if (Math.random() < 0.18) { // ~18% near pivot
        coords.lat = PIVOT.lat + randomIn(-0.01, 0.01);
        coords.lng = PIVOT.lng + randomIn(-0.01, 0.01);
      }

      const address = {
        street: `${randomInt(1,500)} ${pick(['Rizal','Bonifacio','Mabini','Quezon Ave','Del Pilar'])} St`,
        barangay: pick(['Poblacion','Ibabang Ilog','Ibabang Dupin','Cotta','San Roque']),
        city: pick(['Lucena City','Tayabas','Sariaya','Tiaong','Candelaria','Mauban','Infanta']),
        province: 'Quezon',
        lat: coords.lat,
        lng: coords.lng,
      };

      const { distanceKm, deliveryFee } = computeDeliveryFeeForCoords(coords.lat, coords.lng);

      // status selection (weighted)
      const statusRand = Math.random();
      let finalStatus = 'delivered';
      if (statusRand < 0.08) finalStatus = 'cancelled';
      else if (statusRand < 0.12) finalStatus = 'returned';
      else if (statusRand < 0.28) finalStatus = pick(['pending','paid','processing','shipped']);
      // generate a status history that makes sense with finalStatus
      const statusHistory = generateStatusHistory(orderDt, finalStatus);

      const paymentMethod = pick(['gcash','cash_on_delivery','card','bank_transfer']);
      const shippingMethod = pick(['standard','pickup','express']);

      const orderCode = mkOrderCodeForDate(orderDt, orderCounters);

      const doc = {
        orderId: orderCode, // mirrors previous script expectations
        userId: `alt-backfill-${randomInt(1000,9999)}`,
        orderCode,
        items,
        itemsTotal,
        deliveryFee,
        distanceKm,
        total: +(itemsTotal + deliveryFee).toFixed(2),
        paymentMethod,
        shippingMethod,
        status: finalStatus,
        statusHistory,
        address,
        notes: 'Alternate backfill (bulk insert)',
        createdAt: orderDt,
        updatedAt: new Date(),
      };

      docsToInsert.push(doc);
    }

    // step to next week
    current.setDate(current.getDate() + 7);
  }

  console.log('Prepared', docsToInsert.length, 'orders for insertion.');

  if (DRY_RUN) {
    // Print a few sample docs and exit
    console.log('DRY RUN mode — sample documents:');
    console.log(JSON.stringify(docsToInsert.slice(0,6), null, 2));
    console.log('Exiting (DRY RUN).');
    if (!DRY_RUN) await mongoose.disconnect();
    return process.exit(0);
  }

  // Insert in weekly batches to avoid huge single insert
  const BATCH_SIZE = 200;
  for (let i = 0; i < docsToInsert.length; i += BATCH_SIZE) {
    const batch = docsToInsert.slice(i, i + BATCH_SIZE);
    try {
      const res = await Order.insertMany(batch, { ordered: false });
      console.log(`[OK] Inserted batch ${i/BATCH_SIZE + 1}: ${res.length} documents.`);
    } catch (err) {
      // handle duplicate key / validation errors gracefully
      console.error(`[WARN] insertMany batch ${i/BATCH_SIZE + 1} had errors:`, err && err.message);
    }
  }

  console.log('Backfill complete.');
  await mongoose.disconnect();
  process.exit(0);
}

// Run
main().catch((err) => {
  console.error('Fatal error in alternate backfill:', err && (err.stack || err.message || err));
  process.exit(1);
});
