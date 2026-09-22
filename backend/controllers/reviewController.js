const { Review, Venue, Booking } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseUtils');

const REVIEW_WINDOW_DAYS = parseInt(process.env.REVIEW_WINDOW_DAYS || '30', 10);
const REVIEW_ALLOW_CONFIRMED = process.env.REVIEW_ALLOW_CONFIRMED === 'true';
const ALLOWED_STATUSES = REVIEW_ALLOW_CONFIRMED ? ['completed', 'confirmed'] : ['completed'];

const isPastDate = (date) => new Date(date) < new Date();

const findCompletedBooking = async (userId, venueId) => {
  const booking = await Booking.findOne({
    user: userId,
    venue: venueId,
    status: { $in: ALLOWED_STATUSES },
    bookingDate: { $lt: new Date() }
  }).sort({ bookingDate: -1 });

  if (!booking) return null;

  if (REVIEW_WINDOW_DAYS > 0) {
    const daysSince = (Date.now() - booking.bookingDate) / (1000 * 60 * 60 * 24);
    if (daysSince > REVIEW_WINDOW_DAYS) {
      return { booking, windowExpired: true };
    }
  }

  return { booking, windowExpired: false };
};

const buildDistribution = (reviews = []) => {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((r) => {
    distribution[r.rating] = (distribution[r.rating] || 0) + 1;
  });
  return distribution;
};

const updateVenueReviewStats = async (venueId) => {
  const reviews = await Review.find({ venue: venueId, status: 'active' });
  const count = reviews.length;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const average = count > 0 ? sum / count : 0;
  const distribution = buildDistribution(reviews);

  await Venue.findByIdAndUpdate(venueId, {
    rating: average,
    ratingCount: count,
    reviewStats: { average, count, distribution }
  });
};

exports.getVenueReviews = async (req, res) => {
  try {
    const { venueId } = req.params;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const sort = req.query.sort || 'recent';

    const sortMap = {
      recent: { createdAt: -1 },
      rating: { rating: -1, createdAt: -1 },
      helpful: { helpfulUsers: -1, createdAt: -1 }
    };

    const query = { venue: venueId, status: 'active' };

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate('user', 'name email currentRole profileType')
        .populate('booking', 'bookingDate timeSlot')
        .sort(sortMap[sort] || sortMap.recent)
        .skip((page - 1) * limit)
        .limit(limit),
      Review.countDocuments(query)
    ]);

    const venue = await Venue.findById(venueId, 'reviewStats rating ratingCount');

    return sendSuccess(res, 200, 'Reviews fetched', {
      reviews,
      page,
      limit,
      total,
      stats: venue?.reviewStats || { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

exports.getReviewById = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id).populate('user', 'name email currentRole profileType');
    if (!review) return sendError(res, 404, 'Review not found');
    return sendSuccess(res, 200, 'Review fetched', review);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

exports.addReview = async (req, res) => {
  try {
    const { venueId } = req.params;
    const { rating, comment, bookingId } = req.body;
    const userId = req.user._id;

    // Validate booking exists and belongs to user
    let booking = null;
    if (bookingId) {
      booking = await Booking.findOne({ _id: bookingId, user: userId, venue: venueId });
      if (!booking) {
        return sendError(res, 400, 'Invalid booking or booking does not match venue');
      }
    }

    // Check if user already reviewed THIS specific booking
    if (bookingId) {
      const existing = await Review.findOne({ user: userId, booking: bookingId });
      if (existing) {
        return sendError(res, 409, 'You have already reviewed this booking. Please edit your review.');
      }
    } else {
      // If no bookingId provided, find the latest completed booking for this user+venue
      const bookingResult = await findCompletedBooking(userId, venueId);
      if (!bookingResult || bookingResult === null) {
        return sendError(res, 403, 'You must complete a booking at this venue before reviewing');
      }
      if (bookingResult.windowExpired) {
        return sendError(res, 403, 'Review period has expired (30 days after booking)');
      }
      booking = bookingResult.booking;
      
      // Check if already reviewed this specific booking
      const existing = await Review.findOne({ user: userId, booking: booking._id });
      if (existing) {
        return sendError(res, 409, 'You have already reviewed this booking. Please edit your review.');
      }
    }

    const review = await Review.create({
      user: userId,
      venue: venueId,
      booking: booking?._id,
      rating,
      comment,
      status: 'active'
    });

    await updateVenueReviewStats(venueId);

    return sendSuccess(res, 201, 'Review created', review);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

exports.updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const review = await Review.findById(id);
    if (!review) return sendError(res, 404, 'Review not found');

    if (review.user.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'You can only edit your own review');
    }

    if (typeof rating !== 'undefined') review.rating = rating;
    if (typeof comment !== 'undefined') review.comment = comment;
    review.updatedAt = new Date();
    await review.save();

    await updateVenueReviewStats(review.venue);

    return sendSuccess(res, 200, 'Review updated', review);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) return sendError(res, 404, 'Review not found');

    const isOwner = review.user.toString() === req.user._id.toString();
    if (!isOwner) {
      return sendError(res, 403, 'You can only delete your own review');
    }

    await review.deleteOne();
    await updateVenueReviewStats(review.venue);

    return sendSuccess(res, 200, 'Review deleted');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

exports.toggleHelpful = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const review = await Review.findById(id);
    if (!review) return sendError(res, 404, 'Review not found');

    if (review.user.toString() === userId.toString()) {
      return sendError(res, 400, 'You cannot mark your own review as helpful');
    }

    const already = review.helpfulUsers.some((u) => u.toString() === userId.toString());
    if (already) {
      review.helpfulUsers = review.helpfulUsers.filter((u) => u.toString() !== userId.toString());
    } else {
      review.helpfulUsers.push(userId);
    }

    await review.save();

    return sendSuccess(res, 200, 'Helpful status updated', { helpfulCount: review.helpfulCount });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

exports.respondToReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    const review = await Review.findById(id).populate('venue');
    if (!review) return sendError(res, 404, 'Review not found');

    // Only venue owner can respond
    if (review.venue.owner.toString() !== userId.toString()) {
      return sendError(res, 403, 'Only the venue owner can respond to reviews');
    }

    review.response = {
      text,
      respondedBy: userId,
      respondedAt: new Date()
    };

    await review.save();

    return sendSuccess(res, 200, 'Response added', review);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// Get unreviewed bookings for a venue
exports.getUnreviewedBookings = async (req, res) => {
  try {
    const { venueId } = req.params;
    const userId = req.user._id;

    // Find all finished bookings for this user at this venue
    // Include today's bookings (status completed OR confirmed with current check on client for finished time)
    const allBookings = await Booking.find({
      user: userId,
      venue: venueId,
      status: { $in: ALLOWED_STATUSES },
      bookingDate: { $lte: new Date() }  // Changed from $lt to $lte to include today
    }).sort({ bookingDate: -1 });

    if (!allBookings.length) {
      return sendSuccess(res, 200, 'No bookings found', { bookings: [] });
    }

    // Find which ones are not yet reviewed
    const reviewedBookingIds = await Review.find({
      user: userId,
      booking: { $in: allBookings.map(b => b._id) }
    }).select('booking');

    const reviewedIds = new Set(reviewedBookingIds.map(r => r.booking.toString()));

    // Client-side will verify time has passed, here we just filter by date and status
    const unreviewedBookings = allBookings
      .filter(b => !reviewedIds.has(b._id.toString()))
      .map(b => ({
        id: b._id,
        date: b.bookingDate,
        timeSlot: b.timeSlot,
        price: b.totalPrice || b.price
      }));

    console.log('getUnreviewedBookings:', {
      userId,
      venueId,
      totalFound: allBookings.length,
      reviewed: reviewedIds.size,
      unreviewed: unreviewedBookings.length,
      unreviewedBookings
    });

    return sendSuccess(res, 200, 'Unreviewed bookings fetched', { bookings: unreviewedBookings });
  } catch (error) {
    console.error('getUnreviewedBookings error:', error);
    return sendError(res, 500, error.message);
  }
};

