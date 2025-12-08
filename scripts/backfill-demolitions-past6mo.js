/**
 * backfill-demolitions-past6mo.js
 *
 * Inserts dummy Demolition records for the PAST 6 months (weekly batches).
 *
 * Usage (PowerShell):
 *   $env:MONGO_URI="your_mongo_connection_string"; node backfill-demolitions-past6mo.js
 */

const mongoose = require("mongoose");

// ------------------ Counter model (monthly sequences) ------------------
const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true }, // e.g., 'demolish:10-25'
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// ------------------ Demolition schema (same as yours) ------------------
const DemolitionSchema = new mongoose.Schema({
  demolishId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    match: [/^\d{2}-D-\d{4}-\d{2}$/, "Invalid demolishId format (MM-D-####-YY)"],
  },

  userId: { type: String, required: true },
  name: { type: String, required: true },
  contact: { type: String, required: true },

  price: {
    type: Number,
    default: null,
    set: (v) => (v === "" || v === undefined || v === "null" ? null : v),
    validate: {
      validator: (v) => v === null || (typeof v === "number" && !Number.isNaN(v) && v >= 0),
      message: "Price must be a non-negative number or null.",
    },
  },

  proposedPrice: {
    type: Number,
    default: null,
    validate: {
      validator: (v) => v === null || (typeof v === "number" && !Number.isNaN(v) && v > 0),
      message: "Proposed price must be positive or null.",
    },
  },

  description: { type: String, required: true },

  images: {
    front: { type: String, default: null },
    side: { type: String, default: null },
    back: { type: String, default: null },
  },

  location: {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String }, // helpful for readable address
  },

  status: {
    type: String,
    enum: [
      "pending",
      "awaiting_price_approval",
      "price_accepted",
      "price_declined",
      "ocular_scheduled",
      "scheduled",
      "declined",
      "completed",
    ],
    default: "pending",
  },

  scheduledDate: { type: Date },

  declineReason: {
    type: String,
    trim: true,
    default: null,
    validate: {
      validator: function (v) {
        if (this.status === "declined") {
          return typeof v === "string" && v.trim().length > 0;
        }
        return true;
      },
      message: "declineReason is required when status is 'declined'.",
    },
  },

  createdAt: { type: Date, default: Date.now },
});

// Auto-generate demolishId (MM-D-####-YY) using createdAt when present
DemolitionSchema.pre("validate", async function (next) {
  try {
    if (this.demolishId) return next();

    const base = this.createdAt ? new Date(this.createdAt) : new Date();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const yy = String(base.getFullYear() % 100).padStart(2, "0");

    const key = `demolish:${mm}-${yy}`;
    const doc = await Counter.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    this.demolishId = `${mm}-D-${String(doc.seq).padStart(4, "0")}-${yy}`;
    next();
  } catch (err) {
    next(err);
  }
});

// Clear declineReason when status isn't declined
DemolitionSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    if (this.status !== "declined" && this.declineReason) {
      this.declineReason = null;
    }
  }
  next();
});

const Demolition = mongoose.models.Demolition || mongoose.model("Demolition", DemolitionSchema);

// ------------------ Dummy data pools ------------------
const antiqueDemolitionNames = [
  "Narra Beam Removal",
  "Molave Door Dismantle",
  "Acacia Floor Uplift",
  "Heritage Window Salvage",
  "Bahay Na Bato Frame Removal",
  "Vintage Column Dismantle",
  "Old House Roof Tear-down",
  "Antique Post Extraction",
  "Machuca Tile Removal",
  "Camagong Stair Dismantle",
  "Anahaw Panel Removal",
  "Mahogany Wall Strip",
  "Balayong Ceiling Removal",
  "Spanish Era Door Removal",
  "Antique Divider Knockdown",
];

const quezonAddresses = [
  "Brgy. Poblacion, Lucena City, Quezon",
  "Brgy. San Roque, Tayabas City, Quezon",
  "Brgy. East, Sariaya, Quezon",
  "Brgy. Sta. Catalina, Pagbilao, Quezon",
  "Brgy. Maligaya, Mauban, Quezon",
  "Brgy. San Juan, Gumaca, Quezon",
  "Brgy. San Jose, Candelaria, Quezon",
  "Brgy. Rizal, Atimonan, Quezon",
  "Brgy. Magsaysay, Agdangan, Quezon",
  "Brgy. Del Pilar, Unisan, Quezon",
];

const statuses = [
  "pending",
  "awaiting_price_approval",
  "price_accepted",
  "price_declined",
  "ocular_scheduled",
  "scheduled",
  "declined",
  "completed",
];

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randLat() {
  return 13.9 + Math.random() * 0.5; // approximate Quezon area
}
function randLng() {
  return 121.6 + Math.random() * 0.4;
}

// A few dummy userIds (strings as your schema requires)
const dummyUsers = [
  "64f1a1b2c3d4e5f601234567",
  "64f1a1b2c3d4e5f601234568",
  "64f1a1b2c3d4e5f601234569",
  "64f1a1b2c3d4e5f601234570",
];

// ------------------ Backfill logic (past 6 months) ------------------
async function run() {
  if (!process.env.MONGO_URI) {
    console.error("Please set MONGO_URI environment variable first.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Connected to MongoDB.");

  const today = new Date();
  const start = new Date(today);
  start.setMonth(start.getMonth() - 6); // 6 months ago
  // Move start to the beginning of that week (Monday-ish)
  start.setHours(9, 0, 0, 0);

  let cursor = new Date(start);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  let totalInserted = 0;

  while (cursor <= end) {
    const weeklyCount = randInt(1, 15); // 1–15 per week
    for (let i = 0; i < weeklyCount; i++) {
      const status = rand(statuses);
      const createdAt = new Date(cursor.getTime() + randInt(0, 6) * 24 * 3600 * 1000 + randInt(0, 5) * 3600 * 1000);
      const scheduledDate =
        status === "scheduled" || status === "completed"
          ? new Date(createdAt.getTime() + randInt(1, 14) * 24 * 3600 * 1000)
          : null;

      const demolition = new Demolition({
        userId: rand(dummyUsers),
        name: rand(antiqueDemolitionNames),
        contact: "0917" + String(randInt(1000000, 9999999)),
        price: Math.random() > 0.4 ? randInt(2000, 30000) : null,
        proposedPrice: Math.random() > 0.5 ? randInt(1000, 15000) : null,
        description: "Dummy demolition request for testing/backfill.",
        images: {
          front: "/uploads/dummy-front.jpg",
          side: "/uploads/dummy-side.jpg",
          back: "/uploads/dummy-back.jpg",
        },
        location: {
          lat: randLat(),
          lng: randLng(),
          address: rand(quezonAddresses),
        },
        status,
        declineReason: status === "declined" ? "Scope not suitable / safety concerns." : null,
        scheduledDate,
        createdAt,
      });

      // Save (pre-validate will create demolishId using createdAt's month/year)
      try {
        await demolition.save();
        totalInserted++;
      } catch (err) {
        // If duplicate demolishId or other validation error occurs, log and continue
        console.error("Failed to insert one record:", err.message);
      }
    }

    console.log(`Inserted week starting ${cursor.toISOString().slice(0,10)} -> ${weeklyCount} items`);
    // advance one week
    cursor.setDate(cursor.getDate() + 7);
  }

  console.log(`Backfill done. Total inserted: ${totalInserted}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
