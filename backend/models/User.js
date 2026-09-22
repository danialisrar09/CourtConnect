const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  phone: {
    type: String,
    trim: true,
    default: null
  },
  profileType: {
    type: String,
    enum: ['customer', 'business', 'both'],
    required: [true, 'Profile type is required'],
    default: 'customer'
  },
  currentRole: {
    type: String,
    enum: ['customer', 'business'],
    default: function() {
      return this.profileType === 'both' ? 'customer' : this.profileType;
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for better query performance
// Email is already unique; keep a single index declaration to avoid duplicates
// Note: unique creates an index implicitly, so we avoid a second explicit index on email
userSchema.index({ profileType: 1 });

// Virtual for user profile
userSchema.virtual('profile', {
  ref: 'UserProfile',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

// Method to check if user has specific role
userSchema.methods.hasRole = function(role) {
  if (this.profileType === 'both') return true;
  return this.profileType === role;
};

// Method to safely convert to JSON (remove sensitive fields)
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

module.exports = mongoose.model('User', userSchema);
