const { Booking, Venue } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseUtils');
const emailService = require('../utils/emailService');

const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

// Booking prices in this project are PKR-based (shown as Rs in frontend).
const STRIPE_CURRENCY = (process.env.STRIPE_CURRENCY || 'pkr').toLowerCase();
const DEPOSIT_PERCENTAGE = 0.5;

/**
 * Create a new booking
 * POST /api/bookings
 */
const createBooking = async (req, res, next) => {
  try {
    const { venue, bookingDate, timeSlot, duration, totalPrice, paymentInfo, notes } = req.body;
    const userId = req.user.id;

    // Verify venue exists and is active
    const venueDoc = await Venue.findById(venue);
    if (!venueDoc) {
      return sendError(res, 404, 'Venue not found');
    }
    if (venueDoc.status !== 'active') {
      return sendError(res, 400, 'Venue is not available for booking');
    }

    // Prevent users from booking their own venues
    if (venueDoc.owner.toString() === userId.toString()) {
      return sendError(res, 403, 'You cannot book your own venue');
    }

    // Check for booking conflicts
    const hasConflict = await Booking.checkConflict(
      venue,
      bookingDate,
      timeSlot.start,
      timeSlot.end
    );

    if (hasConflict) {
      return sendError(res, 409, 'Time slot is already booked');
    }

    // Create booking
    const booking = await Booking.create({
      user: userId,
      venue,
      bookingDate,
      timeSlot,
      duration,
      totalPrice,
      // Only accept payment method from client; all other payment fields are server-controlled
      paymentInfo: paymentInfo?.method ? { method: paymentInfo.method } : {},
      notes,
      status: 'pending',       // always server-controlled
      paymentStatus: 'pending'  // always server-controlled
    });

    // Populate venue and user details
    await booking.populate([
      { path: 'venue', select: 'title location images hourlyPrice sport owner' },
      { path: 'user', select: 'email profile' }
    ]);

    return sendSuccess(res, 201, 'Booking created successfully', { booking });
  } catch (error) {
    console.error('Create booking error:', error);
    return sendError(res, 500, error.message || 'Failed to create booking');
  }
};

/**
 * Get current user's bookings
 * GET /api/bookings/my
 */
const getMyBookings = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, startDate, endDate, page = 1, limit = 10 } = req.query;

    // Check user role to determine which bookings to fetch
    const userRole = req.user.currentRole || req.user.profileType;
    let query = {};

    if (userRole === 'business' || userRole === 'both') {
      // For business users: fetch bookings for all their venues
      const venueIds = await Venue.find({ owner: userId }).distinct('_id');
      query.venue = { $in: venueIds };
    } else {
      // For customer users: fetch bookings they made
      query.user = userId;
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.bookingDate = {};
      if (startDate) query.bookingDate.$gte = new Date(startDate);
      if (endDate) query.bookingDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('venue', 'title location images hourlyPrice sport')
        .populate('user', 'name email phone')
        .sort({ bookingDate: -1, 'timeSlot.start': -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Booking.countDocuments(query)
    ]);

    return sendSuccess(res, 200, 'Bookings fetched successfully', {
      bookings,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get my bookings error:', error);
    return sendError(res, 500, error.message || 'Failed to fetch bookings');
  }
};

/**
 * Get bookings for a specific venue (business owner only)
 * GET /api/bookings/venue/:venueId
 */
const getVenueBookings = async (req, res, next) => {
  try {
    const { venueId } = req.params;
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;

    // Verify venue exists and user is the owner
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return sendError(res, 404, 'Venue not found');
    }
    if (venue.owner.toString() !== req.user.id) {
      return sendError(res, 403, 'Not authorized to view these bookings');
    }

    const query = { venue: venueId };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.bookingDate = {};
      if (startDate) query.bookingDate.$gte = new Date(startDate);
      if (endDate) query.bookingDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('user', 'email profile')
        .sort({ bookingDate: -1, 'timeSlot.start': -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Booking.countDocuments(query)
    ]);

    return sendSuccess(res, 200, 'Venue bookings fetched successfully', {
      bookings,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get venue bookings error:', error);
    return sendError(res, 500, error.message || 'Failed to fetch venue bookings');
  }
};

/**
 * Get booking by ID
 * GET /api/bookings/:id
 */
const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findById(id)
      .populate('venue', 'title location images hourlyPrice sport owner')
      .populate('user', 'email profile');

    if (!booking) {
      return sendError(res, 404, 'Booking not found');
    }

    // Check if user is authorized to view this booking
    const isOwner = booking.user._id.toString() === userId;
    const isVenueOwner = booking.venue.owner.toString() === userId;

    if (!isOwner && !isVenueOwner) {
      return sendError(res, 403, 'Not authorized to view this booking');
    }

    return sendSuccess(res, 200, 'Booking fetched successfully', { booking });
  } catch (error) {
    console.error('Get booking by ID error:', error);
    return sendError(res, 500, error.message || 'Failed to fetch booking');
  }
};

/**
 * Update booking status (business owner only)
 * PUT /api/bookings/:id
 */
const updateBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes, cancellationReason } = req.body; // paymentStatus intentionally excluded — set only via Stripe webhook
    const userId = req.user.id;

    const booking = await Booking.findById(id).populate('venue', 'title location images hourlyPrice sport owner');
    if (!booking) {
      return sendError(res, 404, 'Booking not found');
    }

    const isBookingUser = booking.user._id.toString() === userId.toString();
    const isVenueOwner = booking.venue.owner.toString() === userId.toString();

    if (!isBookingUser && !isVenueOwner) {
      return sendError(res, 403, 'Not authorized to update this booking');
    }

    // Status changes are restricted to venue owner only
    if (status !== undefined) {
      if (!isVenueOwner) {
        return sendError(res, 403, 'Only the venue owner can update booking status');
      }

      // Enforce allowed state transitions — no backward/invalid moves
      const allowedTransitions = {
        pending:   ['confirmed', 'cancelled'],
        confirmed: ['completed', 'cancelled'],
        completed: [],
        cancelled: []
      };
      const allowed = allowedTransitions[booking.status] || [];
      if (!allowed.includes(status)) {
        return sendError(res, 400, `Cannot transition booking from '${booking.status}' to '${status}'`);
      }
    }

    const wasNotConfirmed = booking.status !== 'confirmed';

    if (status !== undefined) booking.status = status;
    if (notes !== undefined) booking.notes = notes;

    // Set cancellation metadata
    if (status === 'cancelled') {
      booking.cancellationReason = cancellationReason || 'Cancelled by venue owner';
      booking.cancelledAt = new Date();
      // If deposit was already paid, mark for refund
      if (booking.paymentStatus === 'paid') {
        booking.paymentStatus = 'refunded';
      }
    }

    await booking.save();

    if (wasNotConfirmed && booking.status === 'confirmed') {
      await Venue.findByIdAndUpdate(booking.venue._id, { $inc: { totalBookings: 1 } });
    }
    await booking.populate('user', 'email profile');

    return sendSuccess(res, 200, 'Booking updated successfully', { booking });
  } catch (error) {
    console.error('Update booking error:', error);
    return sendError(res, 500, error.message || 'Failed to update booking');
  }
};

/**
 * Cancel a booking
 * DELETE /api/bookings/:id
 */
const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const booking = await Booking.findById(id).populate('venue', 'title location images hourlyPrice sport owner');
    if (!booking) {
      return sendError(res, 404, 'Booking not found');
    }

    // Check authorization - user or venue owner can cancel
    const isOwner = booking.user.toString() === userId;
    const isVenueOwner = booking.venue.owner.toString() === userId;

    if (!isOwner && !isVenueOwner) {
      return sendError(res, 403, 'Not authorized to cancel this booking');
    }

    // Check if booking can be cancelled
    if (!booking.canBeCancelled()) {
      return sendError(res, 400, 'Cannot cancel booking less than 6 hours before start time or if already completed/cancelled');
    }

    booking.status = 'cancelled';
    booking.cancellationReason = reason || 'No reason provided';
    booking.cancelledAt = new Date();

    // Update payment status if applicable
    if (booking.paymentStatus === 'paid') {
      booking.paymentStatus = 'refunded';
    }

    await booking.save();

    return sendSuccess(res, 200, 'Booking cancelled successfully', { booking });
  } catch (error) {
    console.error('Cancel booking error:', error);
    return sendError(res, 500, error.message || 'Failed to cancel booking');
  }
};

/**
 * Check availability for a venue on a specific date
 * GET /api/bookings/availability
 */
const checkAvailability = async (req, res, next) => {
  try {
    const { venue, date } = req.query;

    console.log('=== CHECK AVAILABILITY ===');
    console.log('Received date string:', date);
    console.log('Received venue:', venue);
    
    // Parse the date string correctly - assumes YYYY-MM-DD format in local time
    // We need to create a date at the START of that day in local time
    const parts = date.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);
    
    const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month, day, 23, 59, 59, 999);
    
    console.log('Start of day:', startOfDay);
    console.log('End of day:', endOfDay);

    // Get all non-cancelled bookings for this venue on this date
    const bookings = await Booking.find({
      venue,
      bookingDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'cancelled' }
    }).select('timeSlot status');

    console.log('Found bookings:', bookings.length);
    bookings.forEach(b => {
      console.log('Booked slot:', b.timeSlot.start, '-', b.timeSlot.end);
    });

    // Get venue details for opening hours
    const venueDoc = await Venue.findById(venue).select('name openingHours');
    if (!venueDoc) {
      return sendError(res, 404, 'Venue not found');
    }

    return sendSuccess(res, 200, 'Availability fetched successfully', {
      venue: {
        id: venueDoc._id,
        name: venueDoc.name,
        openingHours: venueDoc.openingHours
      },
      date,
      bookedSlots: bookings.map(b => ({
        start: b.timeSlot.start,
        end: b.timeSlot.end,
        status: b.status
      }))
    });
  } catch (error) {
    console.error('Check availability error:', error);
    return sendError(res, 500, error.message || 'Failed to check availability');
  }
};

/**
 * Get booking statistics (for business dashboard)
 * GET /api/bookings/stats
 */
const getBookingStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    // Get all venues owned by this user
    const venues = await Venue.find({ owner: userId }).select('_id');
    const venueIds = venues.map(v => v._id);

    if (venueIds.length === 0) {
      return sendSuccess(res, 200, 'Booking stats fetched successfully', {
        totalBookings: 0,
        revenue: 0,
        upcomingBookings: 0,
        completedBookings: 0
      });
    }

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const query = { venue: { $in: venueIds } };
    if (startDate || endDate) {
      query.bookingDate = dateFilter;
    }

    const [stats] = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'paid'] },
                '$totalPrice',
                0
              ]
            }
          },
          upcomingBookings: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$bookingDate', new Date()] },
                    { $ne: ['$status', 'cancelled'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          completedBookings: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          }
        }
      }
    ]);

    return sendSuccess(res, 200, 'Booking stats fetched successfully', stats || {
      totalBookings: 0,
      revenue: 0,
      upcomingBookings: 0,
      completedBookings: 0
    });
  } catch (error) {
    console.error('Get booking stats error:', error);
    return sendError(res, 500, error.message || 'Failed to fetch booking stats');
  }
};

/**
 * Get monthly booking and revenue stats for business owner
 * GET /api/bookings/stats/monthly
 */
const getMonthlyBookingStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const monthsParam = Math.min(Math.max(parseInt(req.query.months, 10) || 6, 1), 12);
    const endInput = req.query.endDate ? new Date(req.query.endDate) : new Date();
    const endMonth = new Date(endInput.getFullYear(), endInput.getMonth(), 1);
    const startMonth = new Date(endMonth.getFullYear(), endMonth.getMonth() - (monthsParam - 1), 1);

    const venues = await Venue.find({ owner: userId }).select('_id');
    const venueIds = venues.map(v => v._id);

    if (!venueIds.length) {
      return sendSuccess(res, 200, 'Monthly booking stats fetched successfully', { stats: [] });
    }

    const results = await Booking.aggregate([
      {
        $match: {
          venue: { $in: venueIds },
          status: { $ne: 'cancelled' },
          bookingDate: {
            $gte: startMonth,
            $lt: new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 1)
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$bookingDate' },
            month: { $month: '$bookingDate' }
          },
          bookings: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'paid'] },
                '$totalPrice',
                0
              ]
            }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const stats = [];
    for (let i = monthsParam - 1; i >= 0; i--) {
      const current = new Date(endMonth.getFullYear(), endMonth.getMonth() - i, 1);
      const year = current.getFullYear();
      const month = current.getMonth() + 1;
      const found = results.find(r => r._id.year === year && r._id.month === month);
      stats.push({
        year,
        month,
        bookings: found ? found.bookings : 0,
        revenue: found ? found.revenue : 0
      });
    }

    return sendSuccess(res, 200, 'Monthly booking stats fetched successfully', { stats });
  } catch (error) {
    console.error('[GET_MONTHLY_BOOKING_STATS_ERROR]', error);
    return sendError(res, 500, error.message || 'Failed to fetch monthly booking stats');
  }
};

/**
 * Contact customer for a specific booking (business owner only)
 * POST /api/bookings/:id/contact
 */
const contactCustomer = async (req, res, next) => {
  try {
    const bookingId = req.params.id;
    const { subject, message } = req.body || {};

    if (!subject || !message) {
      return sendError(res, 400, 'Subject and message are required');
    }

    const booking = await Booking.findById(bookingId)
      .populate('user', 'name email')
      .populate('venue', 'name owner');

    if (!booking) {
      return sendError(res, 404, 'Booking not found');
    }

    // Only venue owner can contact the customer
    if (booking.venue?.owner?.toString() !== req.user.id) {
      return sendError(res, 403, 'Not authorized to contact this booking customer');
    }

    const to = booking.user?.email;
    if (!to) {
      return sendError(res, 400, 'Customer email not available');
    }

    const html = emailService.generateContactEmailTemplate({
      customerName: booking.user?.name || 'Customer',
      venueName: booking.venue?.name || 'Venue',
      bookingDate: booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString() : '',
      bookingTime: booking.timeSlot ? `${booking.timeSlot.start} - ${booking.timeSlot.end}` : '',
      totalPrice: booking.totalPrice || '',
      customMessage: message,
      businessOwnerName: req.user?.name || req.user?.email || 'Business',
      businessEmail: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    });

    const result = await emailService.sendEmail({ to, subject, html });

    if (!result.success) {
      return sendError(res, 500, result.error || 'Failed to send email');
    }

    return sendSuccess(res, 200, 'Email sent successfully', {
      messageId: result.messageId,
      to,
      subject,
    });
  } catch (error) {
    console.error('Contact customer error:', error);
    return sendError(res, 500, error.message || 'Failed to contact customer');
  }
};

/**
 * Create Stripe payment intent for 50% deposit
 * POST /api/bookings/:id/payment-intent
 */
const createDepositPaymentIntent = async (req, res) => {
  try {
    if (!stripe) {
      console.warn('[PAYMENT_INTENT_ERROR] Stripe not configured - STRIPE_SECRET_KEY missing');
      return sendError(res, 500, 'Stripe is not configured. Add STRIPE_SECRET_KEY in environment');
    }

    const { id } = req.params;
    const userId = req.user.id;

    console.log(`[PAYMENT_INTENT_START] User ${userId} creating payment intent for booking ${id}`);

    const booking = await Booking.findById(id).populate('venue', 'owner title');
    if (!booking) {
      console.warn(`[PAYMENT_INTENT_ERROR] Booking not found: ${id}`);
      return sendError(res, 404, 'Booking not found');
    }

    // Only the customer who created the booking can initiate payment.
    if (booking.user.toString() !== userId.toString()) {
      console.warn(`[PAYMENT_INTENT_UNAUTHORIZED] User ${userId} attempted to pay for booking owned by ${booking.user}`);
      return sendError(res, 403, 'Only booking customer can initiate payment');
    }

    // Deposit can start only after owner confirms booking.
    if (!booking.canInitiatePayment()) {
      console.warn(`[PAYMENT_INTENT_INVALID_STATE] Booking ${id} cannot initiate payment - status: ${booking.status}, paymentStatus: ${booking.paymentStatus}`);
      return sendError(
        res,
        400,
        `Payment cannot be initiated for booking with status '${booking.status}' and paymentStatus '${booking.paymentStatus}'`
      );
    }

    const depositAmount = Number((booking.totalPrice * DEPOSIT_PERCENTAGE).toFixed(2));
    if (depositAmount <= 0) {
      console.error(`[PAYMENT_INTENT_ERROR] Invalid deposit amount for booking ${id}: ${depositAmount}`);
      return sendError(res, 400, 'Invalid deposit amount calculated from booking total');
    }

    // Amount must be in the smallest currency unit (e.g., cents).
    const amountInMinorUnit = Math.round(depositAmount * 100);
    
    console.log(`[PAYMENT_INTENT_STRIPE] Creating Stripe payment intent for booking ${id}: amount=${depositAmount} PKR`);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInMinorUnit,
      currency: STRIPE_CURRENCY,
      automatic_payment_methods: { enabled: true },
      metadata: {
        bookingId: booking._id.toString(),
        userId: booking.user.toString(),
        venueId: booking.venue?._id?.toString() || '',
        type: 'booking_deposit',
      },
    });

    console.log(`[PAYMENT_INTENT_SUCCESS] Created Stripe payment intent ${paymentIntent.id} for booking ${id}`);

    booking.paymentInfo.depositAmount = depositAmount;
    booking.paymentInfo.stripePaymentIntentId = paymentIntent.id;
    booking.paymentInfo.paymentFailureReason = undefined;
    await booking.save();

    console.log(`[PAYMENT_INTENT_SAVED] Booking ${id} updated with payment intent ${paymentIntent.id}`);

    return sendSuccess(res, 200, 'Deposit payment intent created successfully', {
      bookingId: booking._id,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: depositAmount,
      currency: STRIPE_CURRENCY,
      depositPercentage: DEPOSIT_PERCENTAGE,
    });
  } catch (error) {
    console.error(`[PAYMENT_INTENT_ERROR] Failed to create payment intent: ${error.message}`);
    console.error(error.stack);
    return sendError(res, 500, error.message || 'Failed to create deposit payment intent');
  }
};

/**
 * Create Stripe Checkout session for 50% deposit
 * POST /api/bookings/:id/deposit-checkout-session
 */
const createDepositCheckoutSession = async (req, res) => {
  try {
    if (!stripe) {
      console.warn('[CHECKOUT_SESSION_ERROR] Stripe not configured - STRIPE_SECRET_KEY missing');
      return sendError(res, 500, 'Stripe is not configured. Add STRIPE_SECRET_KEY in environment');
    }

    const { id } = req.params;
    const userId = req.user.id;
    const clientBaseUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    console.log(`[CHECKOUT_SESSION_START] User ${userId} creating checkout session for booking ${id}`);

    const booking = await Booking.findById(id).populate('venue', 'title owner');
    if (!booking) {
      console.warn(`[CHECKOUT_SESSION_ERROR] Booking not found: ${id}`);
      return sendError(res, 404, 'Booking not found');
    }

    if (booking.user.toString() !== userId.toString()) {
      console.warn(`[CHECKOUT_SESSION_UNAUTHORIZED] User ${userId} attempted checkout for booking owned by ${booking.user}`);
      return sendError(res, 403, 'Only booking customer can initiate payment');
    }

    if (!booking.canInitiatePayment()) {
      console.warn(`[CHECKOUT_SESSION_INVALID_STATE] Booking ${id} cannot initiate payment - status: ${booking.status}, paymentStatus: ${booking.paymentStatus}`);
      return sendError(
        res,
        400,
        `Payment cannot be initiated for booking with status '${booking.status}' and paymentStatus '${booking.paymentStatus}'`
      );
    }

    const depositAmount = Number((booking.totalPrice * DEPOSIT_PERCENTAGE).toFixed(2));
    if (depositAmount <= 0) {
      console.error(`[CHECKOUT_SESSION_ERROR] Invalid deposit amount for booking ${id}: ${depositAmount}`);
      return sendError(res, 400, 'Invalid deposit amount calculated from booking total');
    }

    const amountInMinorUnit = Math.round(depositAmount * 100);

    console.log(`[CHECKOUT_SESSION_STRIPE] Creating Stripe checkout session for booking ${id}: amount=${depositAmount} ${STRIPE_CURRENCY}, venue=${booking.venue?.title}`);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: STRIPE_CURRENCY,
            product_data: {
              name: `Booking Deposit - ${booking.venue?.title || 'Sports Venue'}`,
              description: `50% advance deposit for booking ${booking._id}`,
            },
            unit_amount: amountInMinorUnit,
          },
          quantity: 1,
        },
      ],
      success_url: `${clientBaseUrl}/dashboard/customer?payment=success&bookingId=${booking._id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientBaseUrl}/dashboard/customer?payment=cancelled&bookingId=${booking._id}`,
      metadata: {
        bookingId: booking._id.toString(),
        userId: booking.user.toString(),
        type: 'booking_deposit',
      },
      payment_intent_data: {
        metadata: {
          bookingId: booking._id.toString(),
          userId: booking.user.toString(),
          type: 'booking_deposit',
        },
      },
    });

    console.log(`[CHECKOUT_SESSION_SUCCESS] Created checkout session ${session.id} for booking ${id}, URL: ${session.url}`);

    booking.paymentInfo.depositAmount = depositAmount;
    booking.paymentInfo.paymentFailureReason = undefined;
    await booking.save();

    console.log(`[CHECKOUT_SESSION_SAVED] Booking ${id} updated with checkout session ${session.id}`);

    return sendSuccess(res, 200, 'Deposit checkout session created successfully', {
      bookingId: booking._id,
      checkoutUrl: session.url,
      sessionId: session.id,
      amount: depositAmount,
      currency: STRIPE_CURRENCY,
      depositPercentage: DEPOSIT_PERCENTAGE,
    });
  } catch (error) {
    console.error(`[CHECKOUT_SESSION_ERROR] Failed to create checkout session: ${error.message}`);
    console.error(error.stack);
    return sendError(res, 500, error.message || 'Failed to create deposit checkout session');
  }
};

/**
 * Confirm Stripe Checkout session payment after redirect (fallback when webhook is delayed/unavailable)
 * POST /api/bookings/:id/confirm-deposit-checkout
 */
const confirmDepositCheckoutSession = async (req, res) => {
  try {
    if (!stripe) {
      return sendError(res, 500, 'Stripe is not configured. Add STRIPE_SECRET_KEY in environment');
    }

    const { id } = req.params;
    const userId = req.user.id;
    const { sessionId } = req.body || {};

    if (!sessionId || typeof sessionId !== 'string') {
      return sendError(res, 400, 'Stripe checkout sessionId is required');
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return sendError(res, 404, 'Booking not found');
    }

    if (booking.user.toString() !== userId.toString()) {
      return sendError(res, 403, 'Only booking customer can confirm this payment');
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    if (!session) {
      return sendError(res, 404, 'Stripe checkout session not found');
    }

    const sessionBookingId = session.metadata?.bookingId;
    if (sessionBookingId && String(sessionBookingId) !== String(booking._id)) {
      return sendError(res, 400, 'Stripe session does not belong to this booking');
    }

    if (session.payment_status !== 'paid') {
      return sendSuccess(res, 200, 'Payment is not completed yet', {
        bookingId: booking._id,
        paymentStatus: booking.paymentStatus,
        checkoutPaymentStatus: session.payment_status,
      });
    }

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
    const amountPaid = Number(((session.amount_total || 0) / 100).toFixed(2));

    booking.paymentStatus = 'paid';
    booking.paymentInfo.amountPaid = amountPaid > 0
      ? amountPaid
      : Number((booking.totalPrice * DEPOSIT_PERCENTAGE).toFixed(2));
    booking.paymentInfo.transactionId = session.id;
    booking.paymentInfo.paidAt = new Date();
    booking.paymentInfo.paymentFailureReason = undefined;
    if (paymentIntentId) {
      booking.paymentInfo.stripePaymentIntentId = paymentIntentId;
    }

    await booking.save();

    return sendSuccess(res, 200, 'Deposit payment confirmed successfully', {
      bookingId: booking._id,
      paymentStatus: booking.paymentStatus,
      amountPaid: booking.paymentInfo.amountPaid,
      transactionId: booking.paymentInfo.transactionId,
    });
  } catch (error) {
    console.error(`[CHECKOUT_CONFIRM_ERROR] Failed to confirm checkout payment: ${error.message}`);
    return sendError(res, 500, error.message || 'Failed to confirm checkout payment');
  }
};

/**
 * Stripe webhook handler
 * POST /api/bookings/stripe/webhook
 */
const handleStripeWebhook = async (req, res) => {
  try {
    console.log('[WEBHOOK_START] Received Stripe webhook');

    if (!stripe) {
      console.error('[WEBHOOK_ERROR] Stripe not configured');
      return res.status(500).json({ success: false, message: 'Stripe not configured' });
    }

    const signature = req.headers['stripe-signature'];
    if (!signature) {
      console.warn('[WEBHOOK_ERROR] Missing Stripe signature header');
      return res.status(400).json({ success: false, message: 'Missing Stripe signature' });
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('[WEBHOOK_ERROR] Missing STRIPE_WEBHOOK_SECRET environment variable');
      return res.status(500).json({ success: false, message: 'Missing STRIPE_WEBHOOK_SECRET' });
    }

    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log(`[WEBHOOK_VERIFIED] Event ID: ${event.id}, Type: ${event.type}`);

    const eventObject = event.data?.object;
    if (!eventObject || !eventObject.id) {
      console.warn(`[WEBHOOK_SKIP] No payment intent data in event ${event.id}`);
      return res.status(200).json({ received: true });
    }

    const isCheckoutEvent = event.type.startsWith('checkout.session.');
    const paymentIntentId = isCheckoutEvent
      ? (typeof eventObject.payment_intent === 'string' ? eventObject.payment_intent : eventObject.payment_intent?.id)
      : eventObject.id;

    console.log(`[WEBHOOK_LOOKUP] Looking up booking for event object ${eventObject.id}${paymentIntentId ? ` (payment intent ${paymentIntentId})` : ''}`);

    let booking = null;

    if (paymentIntentId) {
      booking = await Booking.findOne({ 'paymentInfo.stripePaymentIntentId': paymentIntentId });
    }

    if (!booking && eventObject.metadata?.bookingId) {
      console.log(`[WEBHOOK_FALLBACK] Finding booking by ID from metadata: ${eventObject.metadata.bookingId}`);
      booking = await Booking.findById(eventObject.metadata.bookingId);
      if (booking) {
        if (paymentIntentId) {
          booking.paymentInfo.stripePaymentIntentId = paymentIntentId;
        }
      }
    }

    if (!booking) {
      console.warn(`[WEBHOOK_NOTFOUND] Booking not found for event object ${eventObject.id}`);
      return res.status(200).json({ received: true });
    }

    console.log(`[WEBHOOK_BOOKING] Found booking ${booking._id} for payment intent ${paymentIntent.id}`);

    // Idempotency guard for repeated webhook deliveries.
    if (booking.paymentInfo.lastWebhookEventId === event.id) {
      console.log(`[WEBHOOK_DUPLICATE] Event ${event.id} already processed for booking ${booking._id} - skipping`);
      return res.status(200).json({ received: true, duplicate: true });
    }

    console.log(`[WEBHOOK_PROCESS] Processing event type '${event.type}' for booking ${booking._id}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const amountPaid = (eventObject.amount_total || 0) / 100;
        console.log(`[WEBHOOK_SUCCESS] Checkout session completed for booking ${booking._id}: ${amountPaid} ${STRIPE_CURRENCY}`);

        booking.paymentStatus = 'paid';
        booking.paymentInfo.amountPaid = amountPaid;
        booking.paymentInfo.transactionId = eventObject.id;
        booking.paymentInfo.paidAt = new Date();
        booking.paymentInfo.paymentFailureReason = undefined;
        if (paymentIntentId) {
          booking.paymentInfo.stripePaymentIntentId = paymentIntentId;
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const amountPaid = (eventObject.amount_received || eventObject.amount || 0) / 100;
        console.log(`[WEBHOOK_SUCCESS] Payment succeeded for booking ${booking._id}: ${amountPaid} ${STRIPE_CURRENCY}`);
        
        booking.paymentStatus = 'paid';
        booking.paymentInfo.amountPaid = amountPaid;
        booking.paymentInfo.transactionId = eventObject.id;
        booking.paymentInfo.paidAt = new Date();
        booking.paymentInfo.paymentFailureReason = undefined;
        if (paymentIntentId) {
          booking.paymentInfo.stripePaymentIntentId = paymentIntentId;
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const failureMessage = eventObject.last_payment_error?.message || 'Payment failed';
        console.warn(`[WEBHOOK_FAILED] Payment failed for booking ${booking._id}: ${failureMessage}`);
        
        booking.paymentStatus = 'failed';
        booking.paymentInfo.paymentFailureReason = failureMessage;
        break;
      }

      case 'payment_intent.canceled': {
        const cancelReason = eventObject.cancellation_reason || 'unknown';
        console.log(`[WEBHOOK_CANCELED] Payment canceled for booking ${booking._id}: ${cancelReason}`);
        
        booking.paymentStatus = 'failed';
        booking.paymentInfo.paymentFailureReason = `Payment canceled (${cancelReason})`;
        break;
      }

      default: {
        console.log(`[WEBHOOK_UNHANDLED] Event type '${event.type}' not handled for booking ${booking._id}`);
        break;
      }
    }

    booking.paymentInfo.lastWebhookEventId = event.id;
    await booking.save();

    console.log(`[WEBHOOK_COMPLETE] Event ${event.id} processed successfully for booking ${booking._id}, new payment status: ${booking.paymentStatus}`);

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(`[WEBHOOK_ERROR] Stripe webhook error: ${error.message}`);
    console.error(error.stack);
    return res.status(400).json({ success: false, message: `Webhook Error: ${error.message}` });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getVenueBookings,
  getBookingById,
  updateBooking,
  cancelBooking,
  checkAvailability,
  getBookingStats,
  getMonthlyBookingStats,
  // Added: contact customer endpoint
  contactCustomer,
  createDepositPaymentIntent,
  createDepositCheckoutSession,
  confirmDepositCheckoutSession,
  handleStripeWebhook,
};
