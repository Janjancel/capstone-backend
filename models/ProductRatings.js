const mongoose = require('mongoose');

const ProductRatingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  rating: { type: Number, min: 0, max: 5, required: true },
  review: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ProductRating', ProductRatingSchema);
