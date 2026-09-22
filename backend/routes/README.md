# Routes Directory

This directory contains route definitions that map URLs to controller functions.

## Purpose
Define API endpoints and link them to appropriate controllers.

## Example Structure
```
routes/
├── userRoutes.js      # User-related routes
├── venueRoutes.js     # Venue/Court-related routes
├── bookingRoutes.js   # Booking-related routes
└── authRoutes.js      # Authentication routes
```

## Example Route Template

```javascript
const express = require('express');
const router = express.Router();
const { 
  getItems, 
  getItem, 
  createItem, 
  updateItem, 
  deleteItem 
} = require('../controllers/itemController');

// Route: /api/items
router.route('/')
  .get(getItems)      // GET all items
  .post(createItem);  // CREATE new item

// Route: /api/items/:id
router.route('/:id')
  .get(getItem)       // GET single item
  .put(updateItem)    // UPDATE item
  .delete(deleteItem);// DELETE item

module.exports = router;
```

## How to use in server.js

```javascript
const itemRoutes = require('./routes/itemRoutes');
app.use('/api/items', itemRoutes);
```
