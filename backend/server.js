require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const { apiLimiter } = require('./middleware/rateLimitMiddleware');
const { startBookingConfirmationTimeoutJob } = require('./jobs/bookingConfirmationTimeout');
const { initializeChatSocket, isChatFeatureEnabled } = require('./socket/chatSocket');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const venueRoutes = require('./routes/venueRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const cartRoutes = require('./routes/cartRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const aiRoutes = require('./routes/aiRoutes');
const chatRoutes = require('./routes/chatRoutes');
const bookingController = require('./controllers/bookingController');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// CORS configuration — accept any of the known frontend origins
const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, mobile apps)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));

// Stripe webhook must use raw body for signature verification and must run before express.json()
app.post('/api/bookings/stripe/webhook', express.raw({ type: 'application/json' }), bookingController.handleStripeWebhook);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting to all routes
app.use('/api', apiLimiter);

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'Welcome to CourtConnect API',
    version: '1.0.0'
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'Connected'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api', reviewRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/chat', chatRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

const httpServer = http.createServer(app);

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[CHAT_SOCKET] Feature flag: ${isChatFeatureEnabled() ? 'enabled' : 'disabled'}`);
  initializeChatSocket(httpServer, { corsOrigin: corsOptions.origin });
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn('[STARTUP_WARNING] STRIPE_WEBHOOK_SECRET is not set. Stripe payments will not update booking paymentStatus via webhook.');
  }
  
  // Start background jobs
  startBookingConfirmationTimeoutJob();
});
