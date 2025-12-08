/**
 * BACKFILL: Sell Requests (Past 6 Months)
 *
 * Usage (PowerShell):
 *   $env:MONGO_URI="your_mongodb_connection_string"; node backfill-sellrequests-past6mo.js
 */

const mongoose = require("mongoose");

// ---------------------- COUNTER MODEL ----------------------
const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// ---------------------- SELL REQUEST SCHEMA ----------------------
const SellRequestSchema = new mongoose.Schema({
  selId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    match: [/^\d{2}-S-\d{4}-\d{2}$/, "Invalid selId format (MM-S-####-YY)"],
  },

  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: String,
  contact: String,
  price: Number,
  description: String,

  images: {
    front: String,
    side: String,
    back: String,
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

  declineReason: {
    type: String,
    trim: true,
    default: null,
    validate: {
      validator: function (v) {
        if (this.status === "declined") return typeof v === "string" && v.trim().length > 0;
        return true;
      },
    },
  },

  createdAt: { type: Date, default: Date.now },
});

// Auto-generate selId based on createdAt
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
      { new: true, upsert: true }
    );

    this.selId = `${mm}-S-${String(doc.seq).padStart(4, "0")}-${yy}`;
    next();
  } catch (err) {
    next(err);
  }
});

SellRequestSchema.pre("save", function (next) {
  if (this.status !== "declined") this.declineReason = null;
  next();
});

const SellRequest =
  mongoose.models.SellRequest || mongoose.model("SellRequest", SellRequestSchema);

// ---------------------- DUMMY DATA SOURCES ----------------------
const antiqueNames = [
  "Narra Cabinet",
  "Molave Chest",
  "Acacia Console",
  "Mahogany Jewelry Box",
  "Vintage Aparador",
  "Heritage Mirror",
  "Camagong Stool",
  "Spanish-era Door",
  "Anahaw Divider",
  "Bahay Na Bato Frame",
  "Old Trunk",
  "Antique Bench",
  "Balayong Table",
  "Kamagong Box",
  "Vintage Wooden Chest",
];

const quezonTowns = [
  "Lucena City, Quezon",
  "Tayabas City, Quezon",
  "Sariaya, Quezon",
  "Pagbilao, Quezon",
  "Mauban, Quezon",
  "Gumaca, Quezon",
  "Candelaria, Quezon",
  "Atimonan, Quezon",
  "Unisan, Quezon",
  "Agdangan, Quezon",
];

const statuses = ["pending", "accepted", "declined", "ocular_scheduled"];

// Random helpers
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randLat = () => 13.90 + Math.random() * 0.5;
const randLng = () => 121.50 + Math.random() * 0.4;

// Dummy users
const dummyUsers = [
  new mongoose.Types.ObjectId(),
  new mongoose.Types.ObjectId(),
  new mongoose.Types.ObjectId(),
  new mongoose.Types.ObjectId(),
];

// ---------------------- BACKFILL SCRIPT ----------------------
async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to database.");

  const today = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 6);
  start.setHours(9, 0, 0, 0);

  let cursor = new Date(start);
  let totalInserted = 0;

  while (cursor <= today) {
    const weeklyCount = randNum(1, 15);

    for (let i = 0; i < weeklyCount; i++) {
      const status = rand(statuses);

      const doc = new SellRequest({
        userId: rand(dummyUsers),

        name: rand(antiqueNames),
        contact: "0917" + randNum(1000000, 9999999),
        price: randNum(2000, 25000),
        description: "Dummy sell request for testing and analytics.",

        images: {
          front: "/uploads/front.jpg",
          side: "/uploads/side.jpg",
          back: "/uploads/back.jpg",
        },

        location: {
          lat: randLat(),
          lng: randLng(),
        },

        status,
        declineReason: status === "declined" ? "Item not eligible for purchase." : null,
        ocularVisit:
          status === "ocular_scheduled"
            ? new Date(cursor.getTime() + randNum(1, 7) * 24 * 3600 * 1000)
            : null,

        createdAt: new Date(
          cursor.getTime() + randNum(0, 6) * 24 * 3600 * 1000 + randNum(0, 6) * 3600 * 1000
        ),
      });

      await doc.save();
      totalInserted++;
    }

    console.log(
      `Inserted week of ${cursor.toISOString().slice(0, 10)} — ${weeklyCount} records`
    );

    cursor.setDate(cursor.getDate() + 7);
  }

  console.log("BACKFILL COMPLETE — Total inserted:", totalInserted);
  process.exit();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
