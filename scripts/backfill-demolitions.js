/**
 * BACKFILL: Demolition Requests (6 months from now, weekly, 1–15 per week)
 *
 * PowerShell:
 *   $env:MONGO_URI="your_mongo_uri_here"; node backfill-demolitions.js
 */

const mongoose = require("mongoose");

// ------------------ COUNTER MODEL ------------------
const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// ------------------ DEMOLITION MODEL ------------------
const DemolitionSchema = new mongoose.Schema({
  demolishId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    match: [/^\d{2}-D-\d{4}-\d{2}$/, "Invalid demolishId format"],
  },
  userId: { type: String, required: true },
  name: { type: String, required: true },
  contact: { type: String, required: true },
  price: {
    type: Number,
    default: null,
    set: (v) => (v === "" || v === undefined || v === "null" ? null : v),
  },
  proposedPrice: {
    type: Number,
    default: null,
  },
  description: { type: String, required: true },
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
  },
  createdAt: { type: Date, default: Date.now },
});

// Auto-ID generation
DemolitionSchema.pre("validate", async function (next) {
  try {
    if (this.demolishId) return next();

    const base = this.createdAt || new Date();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const yy = String(base.getFullYear() % 100).padStart(2, "0");

    const key = `demolish:${mm}-${yy}`;
    const doc = await Counter.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    this.demolishId = `${mm}-D-${String(doc.seq).padStart(4, "0")}-${yy}`;
    next();
  } catch (err) {
    next(err);
  }
});

// Clean decline reason
DemolitionSchema.pre("save", function (next) {
  if (this.status !== "declined") this.declineReason = null;
  next();
});

const Demolition =
  mongoose.models.Demolition || mongoose.model("Demolition", DemolitionSchema);

// ===============================================================
// ------------------ BACKFILL GENERATION LOGIC ------------------
// ===============================================================

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
  "Lucena City, Quezon",
  "Tayabas City, Quezon",
  "Sariaya, Quezon",
  "Pagbilao, Quezon",
  "Mauban, Quezon",
  "Gumaca, Quezon",
  "Candelaria, Quezon",
  "Atimonan, Quezon",
  "Agdangan, Quezon",
  "Unisan, Quezon",
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

function randLat() {
  return 13.9 + Math.random() * 0.5;
}

function randLng() {
  return 121.6 + Math.random() * 0.4;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.");

  const today = new Date();
  const end = new Date();
  end.setMonth(today.getMonth() + 6);

  let cursor = new Date(today);

  while (cursor <= end) {
    const count = Math.floor(Math.random() * 15) + 1; // 1–15 / week
    for (let i = 0; i < count; i++) {
      const status = rand(statuses);

      const demolition = new Demolition({
        userId: "65ab12cd34ef56ab78cd9012",
        name: rand(antiqueDemolitionNames),
        contact: "09171234567",

        description: "Dummy demolition request for testing.",

        price: Math.random() > 0.5 ? Math.floor(Math.random() * 20000) + 5000 : null,
        proposedPrice: Math.random() > 0.5 ? Math.floor(Math.random() * 10000) + 3000 : null,

        images: {
          front: "/uploads/demo-front.jpg",
          side: "/uploads/demo-side.jpg",
          back: "/uploads/demo-back.jpg",
        },

        location: {
          lat: randLat(),
          lng: randLng(),
        },

        status,
        declineReason: status === "declined" ? "Scope not suitable for demolition." : null,
        scheduledDate:
          status === "scheduled" || status === "completed"
            ? new Date(cursor.getTime() + 86400000 * 3)
            : null,

        createdAt: new Date(cursor),
      });

      await demolition.save();
    }

    console.log(
      `Inserted week starting: ${cursor.toDateString()} — ${count} records`
    );

    cursor.setDate(cursor.getDate() + 7);
  }

  console.log("Backfill complete.");
  process.exit();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
