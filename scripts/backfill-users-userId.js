// backfill-users-userId.js
const mongoose = require("mongoose");
const User = require("../models/User");
const Counter = mongoose.models.Counter || require("../models/User").model("Counter");

// MongoDB connection
const MONGO_URI = "mongodb+srv://unikaadmin:unikaantika@unikaantika.nhlsbcx.mongodb.net/unikaantika?retryWrites=true&w=majority&appName=unikaantika";

async function runBackfill() {
  await mongoose.connect(MONGO_URI);
  console.log("🚀 Connected to MongoDB");

  // Match only old userIds (non formatted)
  const regex = /^\d{2}-\d{4}-\d{2}$/;

  const users = await User.find({ userId: { $not: regex } }).sort({ createdAt: 1 });

  if (users.length === 0) {
    console.log("✔ No users need backfilling.");
    return process.exit(0);
  }

  console.log(`📌 Found ${users.length} users to backfill`);

  let count = 1;
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear() % 100).padStart(2, "0");

  const key = `user:${mm}-${yy}`;

  // Reset monthly counter (optional)
  await Counter.findOneAndUpdate(
    { key },
    { seq: 0 },
    { upsert: true }
  );

  for (const user of users) {
    const doc = await Counter.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true }
    );

    const seqStr = String(doc.seq).padStart(4, "0");
    const newUserId = `${mm}-${seqStr}-${yy}`;

    console.log(`➡ Updating: ${user._id} → ${newUserId}`);

    user.userId = newUserId;
    await user.save();
  }

  console.log("🎉 Backfill completed successfully!");
  process.exit(0);
}

runBackfill().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
