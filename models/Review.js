// const mongoose = require('mongoose');

// const ReviewSchema = new mongoose.Schema({
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true,
//   },
//   rating: {
//     type: Number,
//     min: 0,
//     max: 5,
//     required: true,
//   },
//   feedback: {
//     type: String,
//     required: false,
//     trim: true,
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// module.exports = mongoose.model('Review', ReviewSchema);


// backend/models/Review.js
const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      trim: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    feedback: {
      type: String,
      required: false,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    minimize: true,
  }
);

// helpful compound index for common queries (recent reviews by user)
ReviewSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.Review || mongoose.model('Review', ReviewSchema);
