// models/Counter.js
const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },   // sequence name, e.g., "user_uid"
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model("Counter", counterSchema);
