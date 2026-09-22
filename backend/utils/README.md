# Utils Directory

This directory contains utility/helper functions used across the application.

## Purpose
Reusable functions that don't fit into models, controllers, or middleware.

## Example Structure
```
utils/
├── emailSender.js    # Email sending utility
├── tokenGenerator.js # JWT token generation
├── dateHelper.js     # Date formatting/manipulation
└── apiFeatures.js    # Pagination, filtering, sorting
```

## Example Utility Templates

### Email Sender
```javascript
const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const message = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message
  };

  await transporter.sendMail(message);
};

module.exports = sendEmail;
```

### Token Generator
```javascript
const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

module.exports = generateToken;
```

### API Features (Pagination, Filter, Sort)
```javascript
class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(el => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 10;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}

module.exports = APIFeatures;
```

## Usage Example

```javascript
const sendEmail = require('../utils/emailSender');
const generateToken = require('../utils/tokenGenerator');

// In controller
const token = generateToken(user._id);

await sendEmail({
  email: user.email,
  subject: 'Welcome to our platform',
  message: 'Thank you for signing up!'
});
```
