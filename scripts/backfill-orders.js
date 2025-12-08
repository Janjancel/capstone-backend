/**
 * backfill-orders.js
 *
 * Usage:
 *   PowerShell:
 *     $env:MONGO_URI="your_mongo_connection_string"; node backfill-orders.js
 *
 * Notes:
 * - Script will create 1 order per day for the last 6 months (based on current date).
 * - It defines Counter + Order schemas identical to the model you shared so orderId generation works.
 * - Adjust BATCH_LOG_EVERY to tune console output frequency.
 */

const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/test_backfill";
if (!process.env.MONGO_URI) {
  console.warn("Warning: using fallback MONGO_URI. For production, set the MONGO_URI env var.");
}

/* --- Counter model (shared, atomic monthly sequences) --- */
const counterSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

/* --- Order schema (matches user's model) --- */
const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    match: [/^\d{2}-O-\d{4}-\d{2}$/, "Invalid orderId format (MM-O-####-YY)"],
  },
  userId: String,
  items: [
    {
      id: String,
      name: String,
      quantity: Number,
      price: Number,
      subtotal: Number,
      image: String,
      images: [String],
    },
  ],
  total: Number,
  deliveryFee: { type: Number, default: 0 },
  discount: { type: Number, default: null },
  grandTotal: { type: Number, default: 0 },
  address: Object,
  coodrinates: {
    lat: Number,
    lng: Number,
  },
  coordinates: {
    lat: Number,
    lng: Number,
  },
  status: { type: String, default: "Pending" },
  createdAt: { type: Date, default: Date.now },
  cancelledAt: Date,
}, { timestamps: false });

/**
 * Auto-generate orderId as MM-O-####-YY using Counter
 */
orderSchema.pre("validate", async function (next) {
  try {
    if (this.orderId) return next();
    const base = this.createdAt ? new Date(this.createdAt) : new Date();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const yy = String(base.getFullYear() % 100).padStart(2, "0");
    const key = `order:${mm}-${yy}`;

    const doc = await Counter.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const seqStr = String(doc.seq).padStart(4, "0");
    this.orderId = `${mm}-O-${seqStr}-${yy}`;
    next();
  } catch (err) {
    next(err);
  }
});

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

/* --- Helper data and functions --- */

// Antique-themed names (will be picked randomly)
const ANTIQUE_ITEMS = [
  "Molave Traviesa Table",
  "Narra Baluster Chair",
  "Antique Narra Chest",
  "Sagat Hardwood Mirror",
  "Yakal Traviesa Bench",
  "Molave Wall Panel",
  "Callado Baluster Lamp",
  "Antique Window Grill",
  "Collado Console",
  "Sanepa Fascia Chair",
  "Antique Train Bed",
  "Callado Cortina Shelf",
  "Molave Carved Door",
  "Vintage Narra Cabinet",
  "Heritage Baluster Stool",
];

// Possible statuses (ensures coverage)
const STATUSES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"];

// Random helpers
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function money(x) { return Math.round(x * 100) / 100; }

/* --- Main backfill routine --- */
async function main() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Connected to MongoDB:", MONGO_URI);

  // compute date range: past 6 months up to today
  const endDate = new Date(); // today (2025-12-08 in your environment)
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 6); // ~6 months ago
  // normalize times to midnight for clarity
  startDate.setHours(0,0,0,0);
  endDate.setHours(0,0,0,0);

  console.log(`Creating 1 order per day from ${startDate.toISOString().slice(0,10)} through ${endDate.toISOString().slice(0,10)}.`);

  const statusesCount = {};
  let created = 0;
  const BATCH_LOG_EVERY = 50;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    // generate 1-3 items
    const itemCount = randInt(1, 3);
    const items = [];
    let total = 0;
    for (let i = 0; i < itemCount; i++) {
      const name = pick(ANTIQUE_ITEMS);
      const quantity = randInt(1, 5);
      const price = money(randInt(3000, 35000) + Math.random()); // price in local currency (e.g. PHP)
      const subtotal = money(price * quantity);
      items.push({
        id: `item-${Date.now().toString(36)}-${i}`, // cheap unique-ish id
        name,
        quantity,
        price,
        subtotal,
        image: `https://res.cloudinary.com/demo/antique_${(i%5)+1}.jpg`,
        images: [],
      });
      total += subtotal;
    }
    total = money(total);

    // delivery fee random small
    const deliveryFee = money(randInt(0, 500) + Math.random());

    // discount occasionally applied (20% of orders)
    const discount = Math.random() < 0.2 ? money(Math.round((Math.random() < 0.5 ? 0.05 : 0.15) * total * 100) / 100) : null;

    // compute grand total
    const grandTotal = money(total + deliveryFee - (discount || 0));

    // status distribution: rotate through STATUSES but also randomize a bit
    let status;
    if (Math.random() < 0.05) status = "Returned";
    else {
      // choose in deterministic rotating manner to ensure coverage
      const offset = Math.floor((d - startDate) / (1000*60*60*24));
      status = STATUSES[offset % STATUSES.length];
      // small chance to override with a logical future status (e.g., older orders more likely Delivered)
      if ((new Date()) - d > 1000*60*60*24*30 && Math.random() < 0.2) status = "Delivered";
    }

    const orderDoc = new Order({
      userId: `user_${randInt(1, 30)}`,
      items,
      total,
      deliveryFee,
      discount,
      grandTotal,
      address: {
        name: `Customer ${randInt(1,999)}`,
        street: `Blk ${randInt(1,50)} Lot ${randInt(1,200)}`,
        city: "Antique City",
        province: "Heritage Province",
        postal: `${randInt(1000,9999)}`,
      },
      coodrinates: { lat: 14.5833 + Math.random()/100, lng: 120.9667 + Math.random()/100 },
      coordinates: { lat: 14.5833 + Math.random()/100, lng: 120.9667 + Math.random()/100 },
      status,
      createdAt: new Date(d),
      cancelledAt: status === "Cancelled" ? new Date(d.getTime() + randInt(1,5) * 24*60*60*1000) : undefined,
    });

    try {
      await orderDoc.validate(); // runs pre-validate hook which sets orderId via Counter
      await orderDoc.save();
      created++;
      statusesCount[status] = (statusesCount[status] || 0) + 1;
      if (created % BATCH_LOG_EVERY === 0) {
        console.log(`Inserted ${created} orders (latest date: ${d.toISOString().slice(0,10)})`);
      }
    } catch (err) {
      console.error(`Failed to insert for date ${d.toISOString().slice(0,10)}:`, err.message);
      // continue inserting next day
    }
  }

  console.log(`Done. Created ${created} orders.`);
  console.log("Status distribution:", statusesCount);

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
