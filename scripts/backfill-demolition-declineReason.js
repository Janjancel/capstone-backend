// backfill-demolition-declineReason.js
// Usage: set MONGO_URI env var, then run `node backfill-demolition-declineReason.js`

const mongoose = require("mongoose");

/**
 * --- Model definitions (kept in the same format as your Demolition model) ---
 */

const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true }, // e.g., 'demolish:10-25'
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

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

// Auto-generate demolishId (same as model; not used by backfill but kept for parity)
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

// Clear declineReason when status is NOT "declined" (kept for parity)
DemolitionSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    if (this.status !== "declined" && this.declineReason) {
      this.declineReason = null;
    }
  }
  next();
});

const Demolition = mongoose.models.Demolition || mongoose.model("Demolition", DemolitionSchema);

/**
 * --- Backfill operation ---
 * - Finds documents where declineReason does not exist
 * - Sets declineReason: null
 * - Prints summary and a small sample of updated ids
 */

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("ERROR: set MONGO_URI environment variable (e.g. mongodb://user:pass@host:27017/dbname)");
    process.exit(1);
  }

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    const collName = Demolition.collection.name || "demolitions";
    const coll = mongoose.connection.collection(collName);

    const missingCount = await coll.countDocuments({ declineReason: { $exists: false } });
    console.log(`Documents in '${collName}' missing 'declineReason': ${missingCount}`);

    if (missingCount === 0) {
      console.log("Nothing to update. Exiting.");
      return;
    }

    const result = await coll.updateMany(
      { declineReason: { $exists: false } },
      { $set: { declineReason: null } }
    );

    console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

    const stillMissing = await coll.countDocuments({ declineReason: { $exists: false } });
    console.log(`Documents still missing 'declineReason' after update: ${stillMissing}`);

    // Sample updated ids (up to 10)
    const sample = await coll.find({ declineReason: null }).project({ _id: 1 }).limit(10).toArray();
    console.log("Sample updated _id's (up to 10):", sample.map((d) => d._id.toString()));
  } catch (err) {
    console.error("Backfill failed:", err);
    process.exitCode = 2;
  } finally {
    await mongoose.disconnect();
  }
}

run();
