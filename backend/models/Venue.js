const mongoose = require('mongoose');
const { Schema } = mongoose;

const SPORT_TYPES = [
  'Tennis','Football','Basketball','Badminton','Volleyball',
  'Table Tennis','Cricket','Hockey','Swimming','Gym/Fitness'
];

const AMENITIES = [
  'Parking','Changing Rooms','Showers','Equipment Rental',
  'Lighting','Air Conditioning','Wi-Fi','Cafeteria',
  'First Aid','CCTV Security','Lockers','Water Fountain'
];

const AvailabilitySchema = new Schema(
  {
    day: {
      type: String,
      enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
      required: true,
    },
    enabled: { type: Boolean, default: true },
    startTime: { type: String, default: '09:00' }, // HH:mm
    endTime: { type: String, default: '22:00' },
  },
  { _id: false }
);

const CoordinatesSchema = new Schema(
  {
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
  },
  { _id: false }
);

const VenueSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, sparse: true },
    description: { type: String, required: false, trim: true },
    sport: { type: String, enum: SPORT_TYPES, required: true, index: true },
    hourlyPrice: { type: Number, required: true, min: 0 },
    capacity: { type: Number, min: 1 },
    location: { type: String, trim: true },
    coordinates: { type: CoordinatesSchema, default: undefined },
    locationPoint: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [lng, lat]
        validate: {
          validator: function (arr) {
            if (!Array.isArray(arr) || arr.length !== 2) return false;
            const [lng, lat] = arr;
            return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
          },
          message: 'locationPoint.coordinates must be [lng, lat] in valid ranges.',
        },
      },
    },
    amenities: {
      type: [String],
      default: [],
      validate: {
        validator: arr => arr.every(a => AMENITIES.includes(a)),
        message: 'Invalid amenity provided',
      },
    },
    images: {
      type: [String],
      required: true,
      validate: v => Array.isArray(v) && v.length > 0,
    },
    availability: { type: [AvailabilitySchema], default: [] },
      rules: {
        type: [String],
        default: [],
        validate: {
          validator: function(arr) {
            if (!Array.isArray(arr) || arr.length < 2) return false;
            return arr.every(r => typeof r === 'string' && r.trim().length >= 10);
          },
          message: 'At least 2 rules required, each at least 10 characters.'
        }
      },
      contact: {
        phone: {
          type: String,
          trim: true,
          validate: {
            validator: function(v) {
              if (!v) return true;
              return /^\+?[0-9\s-]{7,20}$/.test(v);
            },
            message: 'Invalid phone number format.'
          }
        },
        email: {
          type: String,
          trim: true,
          required: false,
          validate: {
            validator: function(v) {
              if (!v) return true;
              return /^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(v);
            },
            message: 'Invalid email address.'
          }
        }
      },
      surface: {
        type: String,
        enum: ['Synthetic Grass', 'Clay', 'Carpet', 'Concrete', 'Other'],
        trim: true
      },
      indoor: { type: Boolean, default: false },
      lighting: { type: Boolean, default: false },
    status: { type: String, enum: ['active','inactive','pending'], default: 'active', index: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    reviewStats: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
      distribution: {
        1: { type: Number, default: 0 },
        2: { type: Number, default: 0 },
        3: { type: Number, default: 0 },
        4: { type: Number, default: 0 },
        5: { type: Number, default: 0 }
      }
    },
    totalBookings: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Validate availability times
VenueSchema.path('availability').validate(function (days) {
  for (const d of days || []) {
    if (d.enabled && d.startTime && d.endTime && d.startTime >= d.endTime) {
      return false;
    }
  }
  return true;
}, 'Availability startTime must be before endTime');

// Keep coordinates and locationPoint synchronized whenever document is saved.
VenueSchema.pre('validate', function () {
  const lat = this.coordinates?.lat;
  const lng = this.coordinates?.lng;

  const hasLat = typeof lat === 'number';
  const hasLng = typeof lng === 'number';

  if (hasLat !== hasLng) {
    this.invalidate('coordinates', 'Both coordinates.lat and coordinates.lng are required together.');
    return;
  }

  if (hasLat && hasLng) {
    this.locationPoint = {
      type: 'Point',
      coordinates: [lng, lat],
    };
  } else {
    this.locationPoint = undefined;
  }
});

// Create a simple slug from title (no callback pattern to avoid next() issues)
VenueSchema.pre('save', function () {
  if (!this.isModified('title')) return;
  const base = this.title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  this.slug = `${base}-${this._id?.toString().slice(-6)}`;
});

VenueSchema.index({ owner: 1, title: 1 }, { unique: true });
VenueSchema.index({ title: 'text', description: 'text', location: 'text' });
VenueSchema.index({ locationPoint: '2dsphere' });

const Venue = mongoose.model('Venue', VenueSchema);

module.exports = Venue;
module.exports.SPORT_TYPES = SPORT_TYPES;
module.exports.AMENITIES = AMENITIES;
