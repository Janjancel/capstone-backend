// scripts/backfill-heritage-insert-items.js
/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('✖️ No MONGODB_URI found in env. Set MONGODB_URI or add it to .env');
  process.exit(1);
}

// load model only for the connection; we use collection API for raw docs
require('../models/Heritage'); // ensure model is registered (path adjust if needed)
const HeritageCollection = () => mongoose.connection.collection('heritages');

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected.');

  const batchSize = 500;
  let scanned = 0;
  let queued = 0;
  let applied = 0;
  const sampleIds = [];

  // Use raw collection find() to bypass mongoose defaults
  const col = HeritageCollection();
  const cursor = col.find({}, { projection: { items: 1, description: 1, image: 1, latitude: 1, longitude: 1 } });

  const ops = [];
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    scanned += 1;

    const set = {};

    // If document does NOT have its own 'items' key, queue items: []
    if (!Object.prototype.hasOwnProperty.call(doc, 'items')) {
      set.items = [];
    }

    // For optional fields: if not own property OR empty string -> set null
    const optFields = ['description', 'image', 'latitude', 'longitude'];
    for (const f of optFields) {
      if (!Object.prototype.hasOwnProperty.call(doc, f) || doc[f] === '') {
        set[f] = null;
      }
    }

    if (Object.keys(set).length > 0) {
      queued += 1;
      sampleIds.push(String(doc._id));
      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: set },
        },
      });
    }

    if (ops.length >= batchSize) {
      const res = await col.bulkWrite(ops, { ordered: false });
      const num = (res && (res.modifiedCount ?? res.nModified ?? res.result?.nModified ?? 0)) || 0;
      applied += num;
      console.log(`Scanned ${scanned} — queued ${queued} — applied so far: ${applied}`);
      ops.length = 0;
    }
  }

  if (ops.length > 0) {
    const res = await col.bulkWrite(ops, { ordered: false });
    const num = (res && (res.modifiedCount ?? res.nModified ?? res.result?.nModified ?? 0)) || 0;
    applied += num;
  }

  console.log('--- Backfill complete ---');
  console.log(`Total documents scanned: ${scanned}`);
  console.log(`Documents queued for update: ${queued}`);
  console.log(`Documents updated (modified): ${applied}`);
  if (sampleIds.length) {
    console.log('Sample queued _id(s):', sampleIds.slice(0, 20));
  }
  await mongoose.disconnect();
  console.log('Disconnected. Exiting.');
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(2);
});
