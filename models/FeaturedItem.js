const mongoose = require("mongoose");

const FeaturedItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true,
    unique: true, // ✅ avoid duplicates
  },
  featuredAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("FeaturedItem", FeaturedItemSchema);