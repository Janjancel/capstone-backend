const mongoose = require('mongoose');

const heritageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  image: String,
  latitude: Number,
  longitude: Number,
}, { timestamps: true });

module.exports = mongoose.model('Heritage', heritageSchema);
