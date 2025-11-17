/* eslint-disable no-console */
// scripts/backfill-orders-delivery.js
// Backfills subtotal, deliveryFee and total for existing orders.
// Also attempts to geocode address.formatted -> address.coords using Nominatim
// when coords are missing. Use --dry to preview without saving.

const mongoose = require('mongoose');
const axios = require('axios');
const argv = require('minimist')(process.argv.slice(2));

// Load Order model (adjust path if your project layout differs)
const Order = require('../models/Order');

// Config (same as model)
const PIVOT = { lat: 13.9365569, lng: 121.6115341 };
function toRad(deg) { return (deg * Math.PI) / 180; }
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function computeDeliveryFee(distanceKmFromPivot) {
  const baseRadius = 30; // km
  const stepKm = 10; // per 10km
  const stepFee = 1000; // PHP
  if (!isFinite(distanceKmFromPivot) || distanceKmFromPivot <= baseRadius) return 0;
  const extra = distanceKmFromPivot - baseRadius;
  const steps = Math.ceil(extra / stepKm);
  return steps * stepFee;
}

// CLI options
const DRY = !!argv.dry;
const FORCE = !!argv.force; // force re-calc even if totals exist
const BATCH = Number(argv.batch) || 200; // how many orders per DB query
const DELAY = Number(argv.delay) || 150; // ms between geocode calls

if (!process.env.MONGO_URI) {
  console.error('ERROR: Set MONGO_URI environment variable before running.');
  console.error('Example (PowerShell): $env:MONGO_URI="mongodb://user:pass@host:27017/db"');
  process.exit(1);
}

async function geocodeAddress(formatted) {
  // Uses Nominatim search to get coordinates for a formatted address.
  // Keep usage polite: add small delay between calls.
  if (!formatted) return null;
  const url = 'https://nominatim.openstreetmap.org/search';
  try {
    const res = await axios.get(url, {
      params: { q: formatted, format: 'jsonv2', limit: 1, 'accept-language': 'en' },
      headers: { 'User-Agent': 'backfill-script/1.0 (your-email@example.com)' },
      timeout: 10000,
    });
    const items = res.data;
    if (Array.isArray(items) && items.length) {
      const it = items[0];
      return { lat: Number(it.lat), lng: Number(it.lon), raw: it };
    }
    return null;
  } catch (e) {
    console.warn('Geocode failed for', formatted, e.message);
    return null;
  }
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function processBatch() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const query = FORCE
    ? {}
    : { $or: [ { subtotal: { $exists: false } }, { deliveryFee: { $exists: false } }, { total: { $exists: false } } ] };

  let processed = 0;
  let updated = 0;
  let cursor = Order.find(query).cursor({ batchSize: BATCH });

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    processed += 1;

    // compute subtotal
    const subtotal = (Array.isArray(doc.items) ? doc.items : [])
      .reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 0)), 0);

    // Ensure address object exists
    if (!doc.address) doc.address = {};
    if (!doc.address.coords || !Number.isFinite(doc.address.coords.lat) || !Number.isFinite(doc.address.coords.lng)) {
      // try geocoding from formatted address
      if (doc.address.formatted) {
        const geo = await geocodeAddress(doc.address.formatted);
        if (geo) {
          doc.address.coords = { lat: geo.lat, lng: geo.lng };
          doc.address.raw = doc.address.raw || geo.raw;
          console.log(`Geocoded order ${doc._id} -> ${geo.lat},${geo.lng}`);
        }
        await sleep(DELAY);
      }
    }

    // compute distance and deliveryFee
    let distKm = NaN;
    if (doc.address && doc.address.coords && Number.isFinite(doc.address.coords.lat) && Number.isFinite(doc.address.coords.lng)) {
      distKm = distanceKm(PIVOT.lat, PIVOT.lng, Number(doc.address.coords.lat), Number(doc.address.coords.lng));
    }
    const deliveryFee = computeDeliveryFee(distKm);
    const total = Math.round((subtotal + deliveryFee) * 100) / 100;

    const needsUpdate = FORCE || doc.subtotal !== subtotal || doc.deliveryFee !== deliveryFee || doc.total !== total || !doc.address.raw;

    if (needsUpdate) {
      console.log(`${DRY ? '[DRY] ' : ''}Updating order ${doc._id} — subtotal:${subtotal} deliveryFee:${deliveryFee} total:${total}`);
      if (!DRY) {
        doc.subtotal = subtotal;
        doc.deliveryFee = deliveryFee;
        doc.total = total;
        await doc.save();
        updated += 1;
      }
    }

    // throttle writes a little
    if (processed % 50 === 0) await sleep(100);
  }

  console.log('Done. Processed:', processed, 'Updated:', DRY ? 0 : updated);
  await mongoose.disconnect();
}

processBatch().catch((err) => {
  console.error('Script failed:', err);
  process.exit(2);
});
