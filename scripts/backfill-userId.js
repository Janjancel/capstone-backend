// scripts/backfill-userId.js
const mongoose = require('mongoose');
const { model, Schema } = mongoose;

const counterSchema = new Schema({
  key: { type: String, unique: true, index: true },
  seq: { type: Number, default: 0 },
});
const Counter = model('Counter', counterSchema);

const User = model('User', new Schema({}, { strict: false, collection: 'users' })); // light wrapper

function formatId(date, seq) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear() % 100).padStart(2, '0');
  const seqStr = String(seq).padStart(4, '0');
  return `${mm}-${seqStr}-${yy}`;
}

async function getNextSeqFor(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear() % 100).padStart(2, '0');
  const key = `user:${mm}-${yy}`;
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc.seq;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const cursor = User.find({ userId: { $exists: false } }).cursor();

  for await (const u of cursor) {
    const baseDate =
      u.createdAt ? new Date(u.createdAt) :
      u._id?.getTimestamp ? u._id.getTimestamp() :
      new Date();

    // get next monthly sequence
    const seq = await getNextSeqFor(baseDate);
    const userId = formatId(baseDate, seq);

    try {
      await User.updateOne({ _id: u._id }, { $set: { userId } });
    } catch (e) {
      // If unique collision ever happens, retry with a new seq
      if (e.code === 11000) {
        const retrySeq = await getNextSeqFor(baseDate);
        await User.updateOne({ _id: u._id }, { $set: { userId: formatId(baseDate, retrySeq) } });
      } else {
        console.error(`Failed for ${u._id}:`, e);
      }
    }
  }

  await mongoose.disconnect();
  console.log('Backfill complete.');
})();
