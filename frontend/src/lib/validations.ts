import { z } from 'zod';

// ==================== AUTH SCHEMAS ====================

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must not exceed 50 characters'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must not exceed 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  userType: z.enum(['customer', 'business', 'both'], {
    message: 'Please select account type',
  }),
  terms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// ==================== CHECKOUT SCHEMAS ====================

export const personalDetailsSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must not exceed 50 characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must not exceed 50 characters'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^[\d\s\-\+\(\)]+$/, 'Invalid phone number format')
    .min(10, 'Phone number must be at least 10 digits'),
});

// REMOVED: paymentDetailsSchema - no longer used
// Payment processing moved to Stripe after owner confirmation
// Old fields (cardNumber, expiryDate, cvv) handled entirely via Stripe.js
// See Phase 4 implementation: Stripe Checkout Session and Payment Intent APIs

export const checkoutAddressSchema = z.object({
  address: z
    .string()
    .min(1, 'Address is required')
    .min(5, 'Address must be at least 5 characters'),
  city: z
    .string()
    .min(1, 'City is required')
    .min(2, 'City must be at least 2 characters'),
  state: z
    .string()
    .min(1, 'State is required')
    .min(2, 'State must be at least 2 characters'),
  zipCode: z
    .string()
    .min(1, 'ZIP code is required')
    .regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  terms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
});

// NOTE: Payment details schema removed as of Phase 4
// Payment processing is now deferred to after owner confirmation via Stripe
// See: checkoutSchema below (no longer merges paymentDetailsSchema)

export const checkoutSchema = personalDetailsSchema.extend({
  newsletter: z.boolean().optional(),
});

// ==================== VENUE SCHEMAS ====================

export const venueBasicInfoSchema = z.object({
  title: z
    .string()
    .min(1, 'Venue name is required')
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must not exceed 100 characters'),
  description: z
    .string()
    .min(1, 'Description is required')
    .min(20, 'Description must be at least 20 characters')
    .max(1000, 'Description must not exceed 1000 characters'),
  sport: z
    .string()
    .min(1, 'Sport type is required'),
  hourlyPrice: z
    .string()
    .min(1, 'Price is required')
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid price format')
    .transform((val) => parseFloat(val))
    .refine((val) => val > 0, { message: 'Price must be greater than 0' })
    .refine((val) => val <= 10000, { message: 'Price must not exceed 10,000' }),
  location: z
    .string()
    .min(1, 'Location is required')
    .min(5, 'Location must be at least 5 characters')
    .max(200, 'Location must not exceed 200 characters'),
  capacity: z
    .string()
    .min(1, 'Capacity is required')
    .regex(/^\d+$/, 'Capacity must be a number')
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, { message: 'Capacity must be at least 1' })
    .refine((val) => val <= 1000, { message: 'Capacity must not exceed 1000' }),
  amenities: z
    .array(z.string())
    .min(1, 'Select at least one amenity'),
});

export const venueAvailabilitySchema = z.object({
  day: z.string(),
  enabled: z.boolean(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format'),
}).refine((data) => {
  if (!data.enabled) return true;
  const [startHour, startMin] = data.startTime.split(':').map(Number);
  const [endHour, endMin] = data.endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return endMinutes > startMinutes;
}, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export const venueSchema = venueBasicInfoSchema.extend({
  availability: z.array(venueAvailabilitySchema),
  images: z.array(z.object({
    id: z.string(),
    url: z.string(),
    name: z.string(),
  })).min(1, 'Upload at least one image'),
});

// ==================== SEARCH SCHEMAS ====================

export const searchSchema = z.object({
  query: z.string().optional(),
  sport: z.string().optional(),
  location: z.string().optional(),
  date: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  sortBy: z.enum(['price-asc', 'price-desc', 'rating-desc', 'distance']).optional(),
}).refine((data) => {
  if (data.minPrice !== undefined && data.maxPrice !== undefined) {
    return data.maxPrice >= data.minPrice;
  }
  return true;
}, {
  message: 'Maximum price must be greater than or equal to minimum price',
  path: ['maxPrice'],
});

// ==================== BOOKING SCHEMAS ====================

export const bookingSchema = z.object({
  venueId: z.string().min(1, 'Venue ID is required'),
  date: z.string().min(1, 'Date is required'),
  timeSlot: z.string().min(1, 'Time slot is required'),
  duration: z.number().min(1, 'Duration must be at least 1 hour').max(8, 'Duration cannot exceed 8 hours'),
  notes: z.string().max(500, 'Notes must not exceed 500 characters').optional(),
});

// ==================== TYPE EXPORTS ====================

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type PersonalDetailsFormData = z.infer<typeof personalDetailsSchema>;
// REMOVED: PaymentDetailsFormData - payment processing now via Stripe
export type CheckoutFormData = z.infer<typeof checkoutSchema>;
export type VenueBasicInfoFormData = z.infer<typeof venueBasicInfoSchema>;
export type VenueAvailabilityFormData = z.infer<typeof venueAvailabilitySchema>;
export type VenueFormData = z.infer<typeof venueSchema>;
export type SearchFormData = z.infer<typeof searchSchema>;
export type BookingFormData = z.infer<typeof bookingSchema>;
