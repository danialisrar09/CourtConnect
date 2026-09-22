# Models Directory

This directory contains Mongoose models/schemas for MongoDB collections.

## Purpose
Define the structure of your data and business logic related to data validation.

## Example Structure
```
models/
├── User.js           # User model
├── Venue.js          # Venue/Court model
├── Booking.js        # Booking model
└── Payment.js        # Payment model
```

## Example Model Template

```javascript
const mongoose = require('mongoose');

const exampleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Example', exampleSchema);
```
