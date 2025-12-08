/**
 * backfill-sell-requests.js
 * 
 * PowerShell:
 *   $env:MONGO_URI="your_mongo_uri_here"; node backfill-sell-requests.js
 */

const mongoose = require("mongoose");

// === Counter Model ===
const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true }, 
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// === SellRequest Model (copied from your schema) ===
const SellRequestSchema = new mongoose.Schema({
  selId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    match: [/^\d{2}-S-\d{4}-\d{2}$/, "Invalid selId format"],
  },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: String,
  contact: String,
  price: Number,
  description: String,
  images: {
    front: { type: String, default: null },
    side: { type: String, default: null },
    back: { type: String, default: null },
  },
  location: {
    lat: Number,
    lng: Number,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined", "ocular_scheduled"],
    default: "pending",
  },
  ocularVisit: { type: Date, default: null },
  declineReason: { type: String, trim: true, default: null },
  createdAt: { type: Date, default: Date.now },
});

// === Auto-generate selId ===
SellRequestSchema.pre("validate", async function (next) {
  try {
    if (this.selId) return next();

    const base = this.createdAt ? new Date(this.createdAt) : new Date();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const yy = String(base.getFullYear() % 100).padStart(2, "0");

    const key = `sell:${mm}-${yy}`;
    const doc = await Counter.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const seqStr = String(doc.seq).padStart(4, "0");
    this.selId = `${mm}-S-${seqStr}-${yy}`;
    next();
  } catch (err) {
    next(err);
  }
});

// === Fix declineReason depending on status ===
SellRequestSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    if (this.status !== "declined") this.declineReason = null;
  }
  next();
});

const SellRequest = mongoose.models.SellRequest || mongoose.model("SellRequest", SellRequestSchema);


// ==================================================================
// === BACKFILL SCRIPT ==============================================
// ==================================================================

const antiqueNames = [
  "Narra Cabinet", "Molave Chest", "Acacia Table", "Mahogany Trunk",
  "Kamagong Jewelry Box", "Vintage Aparador", "Antique Trunk",
  "Old Spanish Chair", "Balayong Divider", "Narra Console",
  "Molave Bench", "Kapitbahay Shelf", "Bahay Na Bato Frame", 
  "Heritage Mirror", "Anahaw Divider"
];

const quezonAddresses = [
  "Lucena City, Quezon",
  "Tayabas City, Quezon",
  "Sariaya, Quezon",
  "Pagbilao, Quezon",
  "Candelaria, Quezon",
  "Atimonan, Quezon",
  "Gumaca, Quezon",
  "Mauban, Quezon",
  "Agdangan, Quezon",
  "Unisan, Quezon"
];

const statuses = ["pending", "accepted", "declined", "ocular_scheduled"];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomLat() {
  return 13.9 + Math.random() * 0.5; // Quezon-ish lat
}

function randomLng() {
  return 121.6 + Math.random() * 0.4; // Quezon-ish lng
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  const today = new Date();
  const sixMonthsLater = new Date();
  sixMonthsLater.setMonth(today.getMonth() + 6);

  const userId = new mongoose.Types.ObjectId(); // Dummy user ID

  let cursor = new Date(today);

  while (cursor <= sixMonthsLater) {
    const weeklyCount = Math.floor(Math.random() * 15) + 1; // 1–15 per week

    for (let i = 0; i < weeklyCount; i++) {
      const status = getRandom(statuses);

      const record = new SellRequest({
        userId,
        name: getRandom(antiqueNames),
        contact: "09171234567",
        price: Math.floor(Math.random() * 15000) + 3000,
        description: "Antique item for testing and demo purposes.",
        images: {
          front: "/uploads/dummy-front.jpg",
          side: "/uploads/dummy-side.jpg",
          back: "/uploads/dummy-back.jpg",
        },
        location: {
          lat: randomLat(),
          lng: randomLng(),
        },
        status,
        declineReason: status === "declined" ? "Item not eligible for purchase." : null,
        ocularVisit: status === "ocular_scheduled" ? new Date(cursor.getTime() + 86400000) : null,
        createdAt: new Date(cursor),
      });

      await record.save();
    }

    // Move cursor to next week
    cursor.setDate(cursor.getDate() + 7);

    console.log(`Week inserted: ${cursor.toDateString()}`);
  }

  console.log("Backfill completed.");
  process.exit();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
