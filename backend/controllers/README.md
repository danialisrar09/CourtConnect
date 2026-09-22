# Controllers Directory

This directory contains controller functions that handle the business logic for your routes.

## Purpose
Process requests, interact with models, and return responses.

## Example Structure
```
controllers/
├── userController.js      # User-related logic
├── venueController.js     # Venue/Court-related logic
├── bookingController.js   # Booking-related logic
└── authController.js      # Authentication logic
```

## Example Controller Template

```javascript
const Model = require('../models/ModelName');

// @desc    Get all items
// @route   GET /api/items
// @access  Public
exports.getItems = async (req, res) => {
  try {
    const items = await Model.find();
    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Create new item
// @route   POST /api/items
// @access  Private
exports.createItem = async (req, res) => {
  try {
    const item = await Model.create(req.body);
    res.status(201).json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};
```
