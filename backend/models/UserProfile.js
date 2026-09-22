const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  avatar: {
    type: String,
    default: null
  },
  // Customer-specific fields
  preferences: {
    favoriteSports: [{
      type: String,
      trim: true
    }],
    preferredLocations: [{
      type: String,
      trim: true
    }],
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    }
  }
  ,
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    default: []
  }]
}, {
  timestamps: true
});

// Index for faster lookups
userProfileSchema.index({ userId: 1 });

module.exports = mongoose.model('UserProfile', userProfileSchema);
