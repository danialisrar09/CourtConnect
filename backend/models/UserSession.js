const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  deviceInfo: {
    userAgent: String,
    ip: String,
    device: String,
    browser: String,
    os: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // TTL index - auto delete when expired
  }
}, {
  timestamps: true
});

// Indexes
userSessionSchema.index({ userId: 1, isActive: 1 });
userSessionSchema.index({ token: 1 });
userSessionSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('UserSession', userSessionSchema);
