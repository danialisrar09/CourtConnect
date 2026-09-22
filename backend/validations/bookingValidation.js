const { body, param, query } = require('express-validator');

const createBookingValidation = [
  body('venue')
    .notEmpty()
    .withMessage('Venue ID is required')
    .isMongoId()
    .withMessage('Invalid venue ID'),
  
  body('bookingDate')
    .notEmpty()
    .withMessage('Booking date is required')
    .isISO8601()
    .withMessage('Invalid date format')
    .custom((value) => {
      const bookingDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (bookingDate < today) {
        throw new Error('Cannot book a date in the past');
      }
      
      // Optional: Limit booking to 90 days in advance
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 90);
      if (bookingDate > maxDate) {
        throw new Error('Cannot book more than 90 days in advance');
      }
      
      return true;
    }),
  
  body('timeSlot.start')
    .notEmpty()
    .withMessage('Start time is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Invalid start time format (HH:MM)'),
  
  body('timeSlot.end')
    .notEmpty()
    .withMessage('End time is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Invalid end time format (HH:MM)')
    .custom((value, { req }) => {
      const start = req.body.timeSlot?.start;
      if (start && value <= start) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),
  
  body('duration')
    .notEmpty()
    .withMessage('Duration is required')
    .isFloat({ min: 0.5, max: 24 })
    .withMessage('Duration must be between 0.5 and 24 hours'),
  
  body('totalPrice')
    .notEmpty()
    .withMessage('Total price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  body('paymentInfo.method')
    .optional()
    .isIn(['card', 'cash', 'online', 'wallet'])
    .withMessage('Invalid payment method'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

const updateBookingValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid booking ID'),
  
  // Only owner-reachable statuses are allowed; 'pending' cannot be set (no backward moves)
  body('status')
    .optional()
    .isIn(['confirmed', 'completed', 'cancelled'])
    .withMessage('Invalid status value'),

  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),

  body('cancellationReason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason cannot exceed 500 characters')
];

const cancelBookingValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid booking ID'),
  
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason cannot exceed 500 characters')
];

const createPaymentIntentValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid booking ID')
];

const getBookingsValidation = [
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'completed', 'cancelled'])
    .withMessage('Invalid status filter'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const checkAvailabilityValidation = [
  query('venue')
    .notEmpty()
    .withMessage('Venue ID is required')
    .isMongoId()
    .withMessage('Invalid venue ID'),
  
  query('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format')
];

module.exports = {
  createBookingValidation,
  updateBookingValidation,
  cancelBookingValidation,
  createPaymentIntentValidation,
  getBookingsValidation,
  checkAvailabilityValidation
};
