const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      required: true,
      index: true
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    helpfulUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    response: {
      text: { type: String, trim: true, maxlength: 500 },
      respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      respondedAt: { type: Date }
    },
    status: {
      type: String,
      enum: ['active', 'hidden', 'reported'],
      default: 'active',
      index: true
    }
  },
  {
    timestamps: true
  }
);

ReviewSchema.index({ user: 1, booking: 1 }, { unique: true });
ReviewSchema.index({ venue: 1, createdAt: -1 });

ReviewSchema.virtual('helpfulCount').get(function () {
  return this.helpfulUsers?.length || 0;
});

const Review = mongoose.model('Review', ReviewSchema);

module.exports = Review;
