# Middleware Directory

This directory contains custom middleware functions.

## Purpose
Handle cross-cutting concerns like authentication, validation, error handling, and logging.

## Example Structure
```
middleware/
├── auth.js           # Authentication middleware
├── errorHandler.js   # Global error handler
├── validator.js      # Request validation
└── logger.js         # Request logging
```

## Example Middleware Templates

### Authentication Middleware
```javascript
const jwt = require('jsonwebtoken');

exports.protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Not authorized to access this route' 
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      error: 'Not authorized' 
    });
  }
};
```

### Error Handler Middleware
```javascript
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Server Error'
  });
};

module.exports = errorHandler;
```

## How to use in server.js

```javascript
const { protect } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

// Protected route example
app.use('/api/bookings', protect, bookingRoutes);

// Error handler (should be last middleware)
app.use(errorHandler);
```
