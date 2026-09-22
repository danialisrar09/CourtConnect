# CourtConnect Backend - Module 1.1: User Authentication & Registration

## 📁 Project Structure

```
backend/
├── config/
│   └── db.js                    # MongoDB connection
├── controllers/
│   ├── authController.js        # Authentication logic
│   └── userController.js        # User management logic
├── middleware/
│   ├── authMiddleware.js        # JWT authentication
│   ├── validationMiddleware.js  # Request validation
│   ├── errorMiddleware.js       # Error handling
│   └── rateLimitMiddleware.js   # Rate limiting
├── models/
│   ├── User.js                  # User model
│   ├── UserProfile.js           # User profile model
│   ├── UserSession.js           # Session management model
│   └── index.js                 # Model exports
├── routes/
│   ├── authRoutes.js            # Authentication routes
│   └── userRoutes.js            # User routes
├── utils/
│   ├── jwtUtils.js              # JWT helper functions
│   ├── passwordUtils.js         # Password hashing
│   └── responseUtils.js         # Standard API responses
├── .env                         # Environment variables
├── server.js                    # Main server file
└── package.json                 # Dependencies
```

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Update `.env` file with your configuration:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
NODE_ENV=development
JWT_SECRET=your-secret-key-here
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5173
```

### 3. Start Server
```bash
# Development mode with nodemon
npm run dev

# Production mode
npm start
```

## 📚 API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register new user | No |
| POST | `/login` | Login user | No |
| POST | `/logout` | Logout user | Yes |
| POST | `/switch-profile` | Switch between customer/business | Yes |
| GET | `/verify` | Verify JWT token | Yes |

### User Routes (`/api/users`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/profile` | Get user profile | Yes |
| PUT | `/profile` | Update user profile | Yes |
| POST | `/change-password` | Change password | Yes |
| DELETE | `/account` | Delete account | Yes |
| GET | `/sessions` | Get active sessions | Yes |
| DELETE | `/sessions/:sessionId` | Revoke session | Yes |

## 📝 Request/Response Examples

### Register User
**POST** `/api/auth/register`
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Pass123",
  "confirmPassword": "Pass123",
  "profileType": "customer",
  "phone": "+923001234567"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "profileType": "customer",
      "currentRole": "customer",
      "phone": "+923001234567"
    }
  }
}
```

### Login User
**POST** `/api/auth/login`
```json
{
  "email": "john@example.com",
  "password": "Pass123",
  "rememberMe": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "profileType": "both",
      "currentRole": "customer",
      "phone": "+923001234567"
    }
  }
}
```

### Switch Profile (Dual Role Users)
**POST** `/api/auth/switch-profile`
```json
{
  "role": "business"
}
```
**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Profile switched successfully",
  "data": {
    "currentRole": "business",
    "token": "new-token-here..."
  }
}
```

## 🔒 Authentication

All protected routes require JWT token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## ⚡ Features Implemented

- ✅ User registration with email/password
- ✅ Secure password hashing (bcrypt)
- ✅ JWT-based authentication
- ✅ Dual-role support (Customer + Business)
- ✅ Profile switching between roles
- ✅ Session management
- ✅ Rate limiting on auth endpoints
- ✅ Input validation
- ✅ Error handling
- ✅ Password change functionality
- ✅ Account deletion (soft delete)
- ✅ Active session tracking
- ✅ Remember me functionality

## 🛡️ Security Features

1. **Password Hashing**: bcrypt with salt rounds
2. **JWT Tokens**: Secure token generation
3. **Rate Limiting**: 
   - 5 login attempts per 15 minutes
   - 3 registrations per hour per IP
4. **Input Validation**: express-validator
5. **Session Management**: Token-based with expiration
6. **CORS Protection**: Configured for frontend URL

## 🗄️ Database Models

### User
- name, email, password
- profileType (customer, business, both)
- currentRole (customer, business)
- isActive, emailVerified, lastLogin

### UserProfile
- userId (ref to User)
- bio, avatar
- businessInfo (for business users)
- preferences (for customers)

### UserSession
- userId, token
- deviceInfo
- isActive, lastActivity, expiresAt

## 🧪 Testing the API

Use Postman or curl to test endpoints:

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@test.com","password":"Pass123","confirmPassword":"Pass123","profileType":"customer"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@test.com","password":"Pass123"}'
```

## 📊 Module 1.1 Test Coverage

Implements all test cases from:
- CC-TCAUTH-101 to CC-TCAUTH-108 (Authentication)

## 🚧 Next Steps

- Implement email verification
- Add password reset functionality
- Add OAuth (Google, Facebook)
- Implement refresh tokens
- Add 2FA support

---

**Created for:** CourtConnect FYP Project  
**Module:** 1.1 - User Authentication & Registration  
**Status:** ✅ Complete and Ready for Testing
