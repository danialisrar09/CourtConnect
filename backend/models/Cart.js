const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true,
    index: true,
  },
  date: {
    type: Date,
    required: true,
    index: true,
  },
  time: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
    min: [0.5, 'Minimum duration is 0.5 hours'],
    max: [24, 'Maximum duration is 24 hours'],
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative'],
  },
  sport: {
    type: String,
  },
  venueName: {
    type: String,
  },
  location: {
    type: String,
  },
  image: {
    type: String,
  },
}, {
  timestamps: true,
});

cartSchema.index({ user: 1, venue: 1, date: 1, time: 1 }, { unique: true });

module.exports = mongoose.model('Cart', cartSchema);
