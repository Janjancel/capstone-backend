// const mongoose = require('mongoose');

// const heritageSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   description: String,
//   image: String,
//   latitude: Number,
//   longitude: Number,
// }, { timestamps: true });

// module.exports = mongoose.model('Heritage', heritageSchema);


// models/Heritage.js
const mongoose = require("mongoose");

const heritageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    image: String,
    latitude: Number,
    longitude: Number,

    // New: list of items (each item is an ObjectId referencing the Item model)
    items: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr),
        message: "Items must be an array of Item ObjectIds",
      },
      index: true, // helpful if you query by items
    },
  },
  { timestamps: true }
);

// Virtual: return number of items
heritageSchema.virtual("itemCount").get(function () {
  return Array.isArray(this.items) ? this.items.length : 0;
});

// Instance method: add an item ObjectId (saves document)
heritageSchema.methods.addItem = async function (itemId) {
  if (!itemId) throw new Error("itemId is required");
  // avoid duplicates
  const idStr = String(itemId);
  if (!this.items.map(String).includes(idStr)) {
    this.items.push(itemId);
    await this.save();
  }
  return this;
};

// Instance method: remove an item ObjectId (saves document)
heritageSchema.methods.removeItem = async function (itemId) {
  if (!itemId) throw new Error("itemId is required");
  const idStr = String(itemId);
  this.items = this.items.filter((i) => String(i) !== idStr);
  await this.save();
  return this;
};

// Optional static helper to create a heritage and attach items at creation
heritageSchema.statics.createWithItems = async function (doc) {
  // doc may include an `items` array of ObjectIds
  return this.create(doc);
};

// Ensure virtuals are included when converting to JSON / Object
heritageSchema.set("toJSON", { virtuals: true });
heritageSchema.set("toObject", { virtuals: true });

const Heritage =
  mongoose.models.Heritage || mongoose.model("Heritage", heritageSchema);

module.exports = Heritage;
