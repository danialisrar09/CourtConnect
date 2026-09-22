# Backend - Sport Slot Booking System

Node.js + Express + MongoDB backend for the Sport Slot Booking System.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (use `.env.example` as template):
```bash
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sport-slot-booking
NODE_ENV=development
```

3. Make sure MongoDB is running locally or use MongoDB Atlas

4. Run in development mode:
```bash
npm run dev
```

5. Run in production mode:
```bash
npm start
```

## Tech Stack

- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **dotenv** - Environment variables
- **nodemon** - Development auto-reload

## API Endpoints

- `GET /` - Welcome message
- `GET /health` - Health check endpoint (includes database status)

## Project Structure

```
backend/
├── config/
│   └── db.js          # MongoDB connection
├── models/            # Mongoose schemas
├── controllers/       # Business logic
├── routes/            # API routes
├── middleware/        # Custom middleware
├── utils/             # Helper functions
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── .env               # Environment variables
└── README.md          # Documentation
```

Server runs on port 5000 by default.
