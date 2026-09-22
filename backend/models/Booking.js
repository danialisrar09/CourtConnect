const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: [true, 'Venue is required'],
    index: true
  },
  bookingDate: {
    type: Date,
    required: [true, 'Booking date is required'],
    index: true
  },
  timeSlot: {
    start: {
      type: String,
      required: [true, 'Start time is required'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)']
    },
    end: {
      type: String,
      required: [true, 'End time is required'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)']
    }
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [0.5, 'Minimum duration is 0.5 hours'],
    max: [24, 'Maximum duration is 24 hours']
  },
  totalPrice: {
    type: Number,
    required: [true, 'Total price is required'],
    min: [0, 'Price cannot be negative']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'failed'],
    default: 'pending',
    index: true
  },
  paymentInfo: {
    method: {
      type: String,
      enum: ['card', 'cash', 'online', 'wallet'],
      default: 'card'
    },
    transactionId: {
      type: String,
      sparse: true
    },
    paidAt: {
      type: Date
    },
    stripePaymentIntentId: {
      type: String,
      sparse: true
    },
    depositAmount: {
      type: Number,
      min: [0, 'Deposit amount cannot be negative']
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, 'Amount paid cannot be negative']
    },
    paymentFailureReason: {
      type: String,
      maxlength: 500
    },
    lastWebhookEventId: {
      type: String,
      sparse: true
    }
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  cancellationReason: {
    type: String,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  },
  cancelledAt: {
    type: Date
  },
  paymentReminderSentAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for checking availability conflicts
bookingSchema.index({ venue: 1, bookingDate: 1, status: 1 });

// Index for querying user bookings by date
bookingSchema.index({ user: 1, bookingDate: -1 });

// Virtual for checking if booking is upcoming
bookingSchema.virtual('isUpcoming').get(function() {
  return this.bookingDate > new Date() && this.status !== 'cancelled';
});

// Virtual for checking if booking is past
bookingSchema.virtual('isPast').get(function() {
  return this.bookingDate < new Date() || this.status === 'completed';
});

// Pre-save middleware to validate booking date
bookingSchema.pre('save', function() {
  if (this.isNew) {
    // Get today's date at midnight (start of day) to allow bookings for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const bookingDateStart = new Date(this.bookingDate);
    bookingDateStart.setHours(0, 0, 0, 0);
    
    if (bookingDateStart < today) {
      throw new Error('Cannot book a date in the past');
    }
  }
});

// Method to check if booking can be cancelled
bookingSchema.methods.canBeCancelled = function() {
  const now = new Date();
  const bookingTime = new Date(this.bookingDate);
  const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);
  
  // Can cancel if booking is more than 6 hours away and not already cancelled/completed
  return hoursUntilBooking > 6 && 
         this.status !== 'cancelled' && 
         this.status !== 'completed';
};

// Method to check if deposit payment can be initiated (booking must be confirmed by owner first)
bookingSchema.methods.canInitiatePayment = function() {
  return this.status === 'confirmed' &&
         (this.paymentStatus === 'pending' || this.paymentStatus === 'failed');
};

// Static method to check for booking conflicts
bookingSchema.statics.checkConflict = async function(venueId, bookingDate, startTime, endTime, excludeBookingId = null) {
  // Parse the booking date correctly - assumes YYYY-MM-DD format in local time
  let dateToQuery;
  if (typeof bookingDate === 'string') {
    // Parse YYYY-MM-DD format in local time
    const parts = bookingDate.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);
    dateToQuery = new Date(year, month, day);
  } else {
    dateToQuery = new Date(bookingDate);
  }
  
  // Create date range for the entire day
  const startOfDay = new Date(dateToQuery);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateToQuery);
  endOfDay.setHours(23, 59, 59, 999);
  
  const query = {
    venue: venueId,
    bookingDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['cancelled'] }
  };
  
  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }
  
  const existingBookings = await this.find(query);
  
  for (const booking of existingBookings) {
    // Check if time slots overlap
    if (
      (startTime >= booking.timeSlot.start && startTime < booking.timeSlot.end) ||
      (endTime > booking.timeSlot.start && endTime <= booking.timeSlot.end) ||
      (startTime <= booking.timeSlot.start && endTime >= booking.timeSlot.end)
    ) {
      return true; // Conflict found
    }
  }
  
  return false; // No conflict
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
