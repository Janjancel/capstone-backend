// backfill-declineReason.js
// Usage: set MONGO_URI env var, then run `node backfill-declineReason.js`

const mongoose = require("mongoose");

/**
 * --- Model definitions (kept in the same format as your model) ---
 * This ensures the backfill uses the exact same schema shape/collection name.
 */

// Shared monthly counter (atomic)
const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true }, // e.g., 'sell:10-25'
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

const SellRequestSchema = new mongoose.Schema({
  selId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    match: [/^\d{2}-S-\d{4}-\d{2}$/, "Invalid selId format (MM-S-####-YY)"],
  },

  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
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
    lat: { type: Number },
    lng: { type: Number },
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

// Auto-generate selId as MM-S-####-YY using a monthly counter (kept for parity, not used by backfill)
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

// Keep declineReason consistent: clear it when status isn't 'declined'
SellRequestSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    if (this.status !== "declined" && this.declineReason) {
      this.declineReason = null;
    }
  }
  next();
});

const SellRequest = mongoose.models.SellRequest || mongoose.model("SellRequest", SellRequestSchema);

/**
 * --- Backfill operation ---
 * - Finds documents where declineReason field does not exist
 * - Sets declineReason: null
 * - Prints summary and exits
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
    const coll = mongoose.connection.collection(SellRequest.collection.name || "sellrequests");

    const missingCount = await coll.countDocuments({ declineReason: { $exists: false } });
    console.log(`Documents missing 'declineReason': ${missingCount}`);

    if (missingCount === 0) {
      console.log("Nothing to update. Exiting.");
      return;
    }

    // Do the update
    const result = await coll.updateMany(
      { declineReason: { $exists: false } },
      { $set: { declineReason: null } }
    );

    console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

    const stillMissing = await coll.countDocuments({ declineReason: { $exists: false } });
    console.log(`Documents still missing 'declineReason' after update: ${stillMissing}`);

    // Optional: show a sample of updated _id's (first 10) — comment this out if not desired
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
