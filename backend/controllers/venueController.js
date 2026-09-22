const { sendSuccess, sendError } = require('../utils/responseUtils');
const { Venue } = require('../models');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const axios = require('axios');

const MAP_CACHE = new Map();
const MAP_CACHE_TTL_MS = {
  viewport: 15 * 1000,
  nearby: 20 * 1000,
  directions: 60 * 1000,
};

const buildMapCacheKey = (prefix, params = {}) => {
  const normalized = Object.keys(params)
    .sort()
    .map((key) => `${key}:${String(params[key])}`)
    .join('|');
  return `${prefix}|${normalized}`;
};

const readMapCache = (key) => {
  const cached = MAP_CACHE.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    MAP_CACHE.delete(key);
    return null;
  }
  return cached.payload;
};

const writeMapCache = (key, payload, ttlMs) => {
  MAP_CACHE.set(key, {
    payload,
    expiresAt: Date.now() + ttlMs,
  });
};

// POST /api/venues
const createVenue = async (req, res) => {
  try {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required');
    }

    // Only business accounts (or users in business role) can create venues
    const role = req.user.currentRole || req.user.profileType;
    if (!(role === 'business' || req.user.profileType === 'both')) {
      return sendError(res, 403, 'Only business accounts can create venues');
    }

    const {
      title,
      description,
      sport,
      hourlyPrice,
      capacity,
      location,
      coordinates,
      amenities = [],
      images = [],
      availability = [],
      rules = [],
      contact = {},
      surface,
      indoor = false,
      lighting = false
    } = req.body;

    const venue = new Venue({
      owner: req.user._id,
      title,
      description,
      sport,
      hourlyPrice,
      capacity,
      location,
      coordinates,
      amenities,
      images,
      availability,
      rules,
      contact,
      surface,
      indoor,
      lighting,
      status: 'active'
    });

    await venue.save();

    return sendSuccess(res, 201, 'Venue created successfully', { venue });
  } catch (error) {
    // Enhanced debug logging for 500 investigation
    console.error('[VENUE_CREATE_ERROR] Raw payload:', req.body);
    console.error('[VENUE_CREATE_ERROR] Stack:', error?.stack || error);
    if (error && error.code === 11000) {
      return sendError(res, 409, 'You already have a venue with this title');
    }
    // Expose stack in non-production to aid debugging
    const isProd = process.env.NODE_ENV === 'production';
    const message = error?.message || 'Failed to create venue';
    const debug = !isProd ? { stack: error?.stack } : undefined;
    return res.status(500).json({ success: false, message, ...(debug && { debug }) });
  }
};



// GET /api/venues/top
const getTopVenues = async (req, res) => {
  try {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required');
    }
    // Business dashboard only
    const role = req.user.currentRole || req.user.profileType;
    if (!(role === 'business' || req.user.profileType === 'both')) {
      return sendError(res, 403, 'Only business accounts can view top venues');
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 3, 20);

    // Simple performance heuristic: totalBookings desc, then rating desc
    // Only show venues owned by the current business user
    const venues = await Venue.find({ status: 'active', owner: req.user._id })
      .sort({ totalBookings: -1, rating: -1 })
      .limit(limit)
      .select('title sport hourlyPrice images totalBookings rating ratingCount slug');

    const mapped = venues.map(v => ({
      id: v._id,
      name: v.title,
      sport: v.sport,
      bookings: v.totalBookings,
      revenue: v.totalBookings * (v.hourlyPrice || 0), // approximate
      rating: v.rating,
      reviews: v.ratingCount,
      price: v.hourlyPrice,
      image: v.images?.[0] || null,
      slug: v.slug,
    }));

    return sendSuccess(res, 200, 'Top venues fetched', { venues: mapped });
  } catch (error) {
    console.error('[GET_TOP_VENUES_ERROR]', error);
    return sendError(res, 500, 'Failed to fetch top venues');
  }
};

// GET /api/venues/my - venues owned by current business user
const getMyVenues = async (req, res) => {
  try {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required');
    }
    const role = req.user.currentRole || req.user.profileType;
    if (!(role === 'business' || req.user.profileType === 'both')) {
      return sendError(res, 403, 'Only business accounts can view their venues');
    }

    const venues = await Venue.find({ owner: req.user._id })
      .sort({ createdAt: -1 })
      .select('title sport status hourlyPrice images rating ratingCount totalBookings slug location');

    // Calculate current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get monthly stats for all venues in parallel
    const Booking = require('../models/Booking');
    const venueIds = venues.map(v => v._id);
    
    const monthlyStats = await Booking.aggregate([
      {
        $match: {
          venue: { $in: venueIds },
          bookingDate: { $gte: startOfMonth, $lte: endOfMonth },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: '$venue',
          monthlyBookings: { $sum: 1 },
          monthlyRevenue: { $sum: '$totalPrice' }
        }
      }
    ]);

    // Create a map for quick lookup
    const statsMap = {};
    monthlyStats.forEach(stat => {
      statsMap[stat._id.toString()] = {
        monthlyBookings: stat.monthlyBookings,
        monthlyRevenue: stat.monthlyRevenue
      };
    });

    const mapped = venues.map(v => {
      const stats = statsMap[v._id.toString()] || { monthlyBookings: 0, monthlyRevenue: 0 };
      return {
        id: v._id,
        name: v.title,
        sport: v.sport,
        status: v.status,
        location: v.location || null,
        bookings: stats.monthlyBookings, // real monthly bookings from database
        revenue: stats.monthlyRevenue, // real monthly revenue from database
        rating: v.rating,
        reviews: v.ratingCount,
        price: v.hourlyPrice,
        image: v.images?.[0] || null,
        slug: v.slug,
      };
    });

    return sendSuccess(res, 200, 'My venues fetched', { venues: mapped });
  } catch (error) {
    console.error('[GET_MY_VENUES_ERROR]', error);
    return sendError(res, 500, 'Failed to fetch your venues');
  }
};

// PUT /api/venues/:id - update venue (owner only)
const updateVenue = async (req, res) => {
  try {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required');
    }
    const role = req.user.currentRole || req.user.profileType;
    if (!(role === 'business' || req.user.profileType === 'both')) {
      return sendError(res, 403, 'Only business accounts can update venues');
    }

    const venueId = req.params.id;
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return sendError(res, 404, 'Venue not found');
    }
    if (venue.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'You do not own this venue');
    }

    const updatableFields = [
      'title','description','sport','hourlyPrice','capacity','location','coordinates','amenities','images','availability','status',
      'rules','contact','surface','indoor','lighting'
    ];
    for (const field of updatableFields) {
      if (field in req.body) {
        venue[field] = req.body[field];
      }
    }

    await venue.save();
    return sendSuccess(res, 200, 'Venue updated successfully', { venue });
  } catch (error) {
    console.error('[UPDATE_VENUE_ERROR]', error);
    if (error && error.code === 11000) {
      return sendError(res, 409, 'Duplicate venue title');
    }
    return sendError(res, 500, 'Failed to update venue');
  }
};

// GET /api/venues/:id - fetch a single venue (owner access for edit)
const getVenueById = async (req, res) => {
  try {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required');
    }
    const role = req.user.currentRole || req.user.profileType;
    if (!(role === 'business' || req.user.profileType === 'both')) {
      return sendError(res, 403, 'Only business accounts can access venue details');
    }

    const venueId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(venueId)) {
      return sendError(res, 400, 'Invalid venue id format');
    }
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return sendError(res, 404, 'Venue not found');
    }

    // For edit page, ensure ownership
    if (venue.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'You do not own this venue');
    }

    return sendSuccess(res, 200, 'Venue fetched', { venue });
  } catch (error) {
    console.error('[GET_VENUE_BY_ID_ERROR]', error);
    return sendError(res, 500, 'Failed to fetch venue');
  }
};

// DELETE /api/venues/:id - delete venue (owner only)
const deleteVenue = async (req, res) => {
  try {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required');
    }
    const role = req.user.currentRole || req.user.profileType;
    if (!(role === 'business' || req.user.profileType === 'both')) {
      return sendError(res, 403, 'Only business accounts can delete venues');
    }

    const venueId = req.params.id;
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return sendError(res, 404, 'Venue not found');
    }
    if (venue.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'You do not own this venue');
    }

    await venue.deleteOne();
    return sendSuccess(res, 200, 'Venue deleted successfully', { id: venueId });
  } catch (error) {
    console.error('[DELETE_VENUE_ERROR]', error);
    return sendError(res, 500, 'Failed to delete venue');
  }
};

// (legacy export removed; consolidated at bottom)
// GET /api/venues - public/browse list with filters + pagination
const getPublicVenues = async (req, res) => {
  try {
    // No role restriction; optionalAuth used at route level
    const {
      q,
      sport,
      minPrice,
      maxPrice,
      location,
      rating,
      amenities, // comma-separated list
      sortBy,
      page = 1,
      limit = 9,
      availability,
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 9, 1), 50);

    const query = { status: 'active' };

    if (q) {
      const qStr = String(q).trim();
      // Split multi-word queries and build an OR across all words.
      // Use contains ($regex without ^) so "football gulshan" matches venues
      // whose title/description/location contains any of those words.
      const words = qStr.split(/\s+/).filter(Boolean).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (words.length === 1) {
        const esc = words[0];
        query.$or = [
          { title:       { $regex: esc, $options: 'i' } },
          { description: { $regex: esc, $options: 'i' } },
          { location:    { $regex: esc, $options: 'i' } },
        ];
      } else {
        // Multiple words: each word searched across all three fields
        query.$or = words.flatMap(w => [
          { title:       { $regex: w, $options: 'i' } },
          { description: { $regex: w, $options: 'i' } },
          { location:    { $regex: w, $options: 'i' } },
        ]);
      }
    }
    if (sport) {
      query.sport = sport;
    }
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }
      if (rating || req.query.maxRating) {
        const min = rating ? parseFloat(rating) : undefined;
        const max = req.query.maxRating ? parseFloat(req.query.maxRating) : undefined;
        query.rating = {};
        if (!isNaN(min)) query.rating.$gte = min;
        if (!isNaN(max)) query.rating.$lte = max;
    }
    if (minPrice || maxPrice) {
      const minP = typeof minPrice === 'string' ? parseFloat(String(minPrice).replace(/[^0-9.]/g, '')) : Number(minPrice);
      const maxP = typeof maxPrice === 'string' ? parseFloat(String(maxPrice).replace(/[^0-9.]/g, '')) : Number(maxPrice);
      query.hourlyPrice = {};
      if (!isNaN(minP)) query.hourlyPrice.$gte = minP;
      if (!isNaN(maxP)) query.hourlyPrice.$lte = maxP;
    }
    if (amenities) {
      const arr = Array.isArray(amenities) ? amenities : String(amenities).split(',').filter(Boolean);
      if (arr.length) {
        query.amenities = { $all: arr };
      }
    }

    if (availability) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const now = new Date();
      const currentDay = dayNames[now.getDay()];

      let targetDays = [];
      if (availability === 'now' || availability === 'today') {
        targetDays = [currentDay];
      } else if (availability === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        targetDays = [dayNames[tomorrow.getDay()]];
      } else if (availability === 'weekend') {
        targetDays = ['Saturday', 'Sunday'];
      }

      if (targetDays.length) {
        query.availability = {
          $elemMatch: {
            day: { $in: targetDays },
            enabled: true,
          },
        };
      }
    }

    // Exclude venues that are currently booked during the "now" window (HH:mm padded strings)
    if (availability === 'now') {
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      const currentTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

      const overlapping = await Booking.find({
        bookingDate: { $gte: startOfDay, $lte: endOfDay },
        status: { $ne: 'cancelled' },
        'timeSlot.start': { $lte: currentTime },
        'timeSlot.end': { $gt: currentTime },
      }).select('venue');

      if (overlapping.length) {
        const bookedVenueIds = Array.from(new Set(overlapping.map(b => b.venue?.toString()).filter(Boolean)))
          .map(id => new mongoose.Types.ObjectId(id));
        query._id = query._id || {};
        query._id.$nin = bookedVenueIds;
      }
    }

    let sort = { createdAt: -1 };
    if (sortBy === 'price-asc') sort = { hourlyPrice: 1 };
    else if (sortBy === 'price-desc') sort = { hourlyPrice: -1 };
    else if (sortBy === 'rating-desc') sort = { rating: -1 };

    const total = await Venue.countDocuments(query);
    // Temporary debug log for filter diagnostics
    console.log('[GET_PUBLIC_VENUES_DEBUG]', {
      query,
      sort,
      page: pageNum,
      limit: limitNum,
      total
    });
    const itemsRaw = await Venue.find(query)
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select('title sport hourlyPrice location coordinates images rating ratingCount slug amenities rules contact surface indoor lighting availability');

    // Apply time-based availability filtering in application logic
    let items = itemsRaw;
    if (availability === 'now' || availability === 'today') {
      const now = new Date();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = dayNames[now.getDay()];
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      items = itemsRaw.filter(v => {
        const slot = (v.availability || []).find(a => a.enabled && a.day === currentDay);
        if (!slot) return false;
        const hasTimeRemaining = slot.endTime > currentTime; // lexicographic compare on HH:mm
        if (availability === 'today') return hasTimeRemaining;
        // availability === 'now'
        const withinNow = slot.startTime <= currentTime && slot.endTime > currentTime;
        return withinNow;
      });
    }

    const mapped = items.map(v => ({
      id: v._id,
      name: v.title,
      sport: v.sport,
      location: v.location,
      coordinates: v.coordinates,
      rating: v.rating,
      reviews: v.ratingCount,
      price: v.hourlyPrice,
      image: v.images?.[0] || null,
      amenities: v.amenities,
      rules: v.rules,
      contact: v.contact,
      surface: v.surface,
      indoor: v.indoor,
      lighting: v.lighting,
      slug: v.slug,
    }));

    return sendSuccess(res, 200, 'Venues fetched', {
      items: mapped,
      page: pageNum,
      limit: limitNum,
      total: items.length ? total : 0,
      totalPages: Math.ceil((items.length ? total : 0) / limitNum) || 1,
    });
  } catch (error) {
    console.error('[GET_PUBLIC_VENUES_ERROR]', error);
    return sendError(res, 500, 'Failed to fetch venues');
  }
};

// (deferred export; consolidated at bottom)

// GET /api/venues/public/:id - public venue detail
const getPublicVenueById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      // Attempt fallback lookup by slug when id is not a valid ObjectId
      const bySlug = await Venue.findOne({ slug: id }).select(
        'title sport hourlyPrice location coordinates images rating ratingCount slug amenities rules contact surface indoor lighting description availability status totalBookings'
      );
      if (!bySlug || bySlug.status === 'inactive') {
        return sendError(res, 404, 'Venue not found');
      }
      return sendSuccess(res, 200, 'Venue fetched', { venue: bySlug });
    }
    const v = await Venue.findById(id).select(
      'title sport hourlyPrice location coordinates images rating ratingCount slug amenities rules contact surface indoor lighting description availability status totalBookings'
    );
    if (!v || v.status === 'inactive') {
      return sendError(res, 404, 'Venue not found');
    }
    return sendSuccess(res, 200, 'Venue fetched', { venue: v });
  } catch (error) {
    console.error('[GET_PUBLIC_VENUE_BY_ID_ERROR]', error);
    return sendError(res, 500, 'Failed to fetch venue');
  }
};

// GET /api/venues/stats/sports - get court counts by sport type
const getSportStats = async (req, res) => {
  try {
    const stats = await Venue.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$sport', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const sportCounts = {};
    stats.forEach(item => {
      if (item._id) {
        sportCounts[item._id] = item.count;
      }
    });

    return sendSuccess(res, 200, 'Sport stats fetched', { sportCounts });
  } catch (error) {
    console.error('[GET_SPORT_STATS_ERROR]', error);
    return sendError(res, 500, 'Failed to fetch sport stats');
  }
};

// GET /api/venues/locations
const getVenueLocations = async (req, res) => {
  try {
    const locations = await Venue.distinct('location', {
      status: 'active',
      location: { $exists: true, $nin: [null, ''] },
    });

    const sortedLocations = locations
      .map((value) => String(value).trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return sendSuccess(res, 200, 'Venue locations fetched', {
      locations: sortedLocations,
      total: sortedLocations.length,
    });
  } catch (error) {
    console.error('[GET_VENUE_LOCATIONS_ERROR]', error);
    return sendError(res, 500, 'Failed to fetch venue locations');
  }
};

// GET /api/venues/map/viewport
const getViewportVenues = async (req, res) => {
  try {
    const north = parseFloat(req.query.north);
    const south = parseFloat(req.query.south);
    const east = parseFloat(req.query.east);
    const west = parseFloat(req.query.west);
    const sport = req.query.sport;
    const q = req.query.q ? String(req.query.q).trim() : '';
    const location = req.query.location ? String(req.query.location).trim() : '';
    const amenities = req.query.amenities;
    const availability = req.query.availability;
    const rating = req.query.rating;
    const maxRating = req.query.maxRating;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined;
    const minRating = rating ? parseFloat(rating) : undefined;
    const maxRatingValue = maxRating ? parseFloat(maxRating) : undefined;
    const hasMinPrice = Number.isFinite(minPrice);
    const hasMaxPrice = Number.isFinite(maxPrice);
    const hasMinRating = Number.isFinite(minRating);
    const hasMaxRating = Number.isFinite(maxRatingValue);
    const cacheKey = buildMapCacheKey('viewport', {
      north,
      south,
      east,
      west,
      q,
      sport: sport || '',
      location,
      amenities: amenities || '',
      availability: availability || '',
      rating: hasMinRating ? minRating : '',
      maxRating: hasMaxRating ? maxRatingValue : '',
      minPrice: hasMinPrice ? minPrice : '',
      maxPrice: hasMaxPrice ? maxPrice : '',
    });

    const cachedPayload = readMapCache(cacheKey);
    if (cachedPayload) {
      res.locals.mapCacheHit = true;
      res.locals.mapResultCount = cachedPayload.count;
      return sendSuccess(res, 200, 'Viewport venues fetched', cachedPayload);
    }

    const buildViewportPolygon = (minLng, minLat, maxLng, maxLat) => ({
      type: 'Polygon',
      coordinates: [[
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ]],
    });

    const queryFilters = [{ status: 'active' }];

    if (sport) {
      queryFilters.push({ sport });
    }

    if (q) {
      const esc = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      queryFilters.push({
        $or: [
          { title: { $regex: `^${esc}`, $options: 'i' } },
          { description: { $regex: esc, $options: 'i' } },
          { location: { $regex: esc, $options: 'i' } },
        ],
      });
    }

    if (location) {
      queryFilters.push({ location: { $regex: location, $options: 'i' } });
    }

    if (amenities) {
      const arr = Array.isArray(amenities) ? amenities : String(amenities).split(',').filter(Boolean);
      if (arr.length) {
        queryFilters.push({ amenities: { $all: arr } });
      }
    }

    if (hasMinRating || hasMaxRating) {
      const ratingQuery = {};
      if (hasMinRating) ratingQuery.$gte = minRating;
      if (hasMaxRating) ratingQuery.$lte = maxRatingValue;
      queryFilters.push({ rating: ratingQuery });
    }

    if (availability) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const now = new Date();
      const currentDay = dayNames[now.getDay()];

      let targetDays = [];
      if (availability === 'now' || availability === 'today') {
        targetDays = [currentDay];
      } else if (availability === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        targetDays = [dayNames[tomorrow.getDay()]];
      } else if (availability === 'weekend') {
        targetDays = ['Saturday', 'Sunday'];
      }

      if (targetDays.length) {
        queryFilters.push({
          availability: {
            $elemMatch: {
              day: { $in: targetDays },
              enabled: true,
            },
          },
        });
      }
    }

    if (hasMinPrice || hasMaxPrice) {
      const priceQuery = {};
      if (hasMinPrice) priceQuery.$gte = minPrice;
      if (hasMaxPrice) priceQuery.$lte = maxPrice;
      queryFilters.push({ hourlyPrice: priceQuery });
    }

    const viewportFilter = east >= west
      ? {
          locationPoint: {
            $geoWithin: {
              $geometry: buildViewportPolygon(west, south, east, north),
            },
          },
        }
      : {
          $or: [
            {
              locationPoint: {
                $geoWithin: {
                  $geometry: buildViewportPolygon(west, south, 180, north),
                },
              },
            },
            {
              locationPoint: {
                $geoWithin: {
                  $geometry: buildViewportPolygon(-180, south, east, north),
                },
              },
            },
          ],
        };

    queryFilters.push(viewportFilter);

    const baseQuery = queryFilters.length === 1 ? queryFilters[0] : { $and: queryFilters };

    const venues = await Venue.find(baseQuery)
      .select('title sport hourlyPrice location coordinates images rating ratingCount slug availability')
      .lean();

    let filteredVenues = venues;
    if (availability === 'now' || availability === 'today') {
      const now = new Date();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = dayNames[now.getDay()];
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      filteredVenues = venues.filter((v) => {
        const slot = (v.availability || []).find((a) => a.enabled && a.day === currentDay);
        if (!slot) return false;
        const hasTimeRemaining = slot.endTime > currentTime;
        if (availability === 'today') return hasTimeRemaining;
        return slot.startTime <= currentTime && slot.endTime > currentTime;
      });
    }

    const items = filteredVenues.map((v) => ({
      id: v._id,
      name: v.title,
      sport: v.sport,
      location: v.location,
      coordinates: v.coordinates,
      price: v.hourlyPrice,
      rating: v.rating,
      reviews: v.ratingCount,
      image: v.images?.[0] || null,
      slug: v.slug,
    }));

    const responsePayload = {
      items,
      count: items.length,
    };
    writeMapCache(cacheKey, responsePayload, MAP_CACHE_TTL_MS.viewport);
    res.locals.mapResultCount = responsePayload.count;
    return sendSuccess(res, 200, 'Viewport venues fetched', responsePayload);
  } catch (error) {
    console.error('[GET_VIEWPORT_VENUES_ERROR]', error);
    return sendError(res, 500, 'Failed to fetch viewport venues');
  }
};

// GET /api/venues/map/nearby
const getNearbyVenues = async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = req.query.radiusKm ? parseFloat(req.query.radiusKm) : 5;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const sport = req.query.sport;
    const q = req.query.q ? String(req.query.q).trim() : '';
    const location = req.query.location ? String(req.query.location).trim() : '';
    const amenities = req.query.amenities;
    const availability = req.query.availability;
    const rating = req.query.rating;
    const maxRating = req.query.maxRating;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined;
    const minRating = rating ? parseFloat(rating) : undefined;
    const maxRatingValue = maxRating ? parseFloat(maxRating) : undefined;
    const hasMinPrice = Number.isFinite(minPrice);
    const hasMaxPrice = Number.isFinite(maxPrice);
    const hasMinRating = Number.isFinite(minRating);
    const hasMaxRating = Number.isFinite(maxRatingValue);

    const maxDistanceMeters = Math.round(radiusKm * 1000);
    const cacheKey = buildMapCacheKey('nearby', {
      lat,
      lng,
      radiusKm,
      limit,
      q,
      sport: sport || '',
      location,
      amenities: amenities || '',
      availability: availability || '',
      minPrice: hasMinPrice ? minPrice : '',
      maxPrice: hasMaxPrice ? maxPrice : '',
      rating: hasMinRating ? minRating : '',
      maxRating: hasMaxRating ? maxRatingValue : '',
    });

    const cachedPayload = readMapCache(cacheKey);
    if (cachedPayload) {
      res.locals.mapCacheHit = true;
      res.locals.mapResultCount = cachedPayload.count;
      return sendSuccess(res, 200, 'Nearby venues fetched', cachedPayload);
    }

    const matchClauses = [{ status: 'active' }];
    if (sport) {
      matchClauses.push({ sport });
    }
    if (q) {
      const esc = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      matchClauses.push({
        $or: [
          { title: { $regex: `^${esc}`, $options: 'i' } },
          { description: { $regex: esc, $options: 'i' } },
          { location: { $regex: esc, $options: 'i' } },
        ],
      });
    }
    if (location) {
      matchClauses.push({ location: { $regex: location, $options: 'i' } });
    }
    if (amenities) {
      const arr = Array.isArray(amenities) ? amenities : String(amenities).split(',').filter(Boolean);
      if (arr.length) {
        matchClauses.push({ amenities: { $all: arr } });
      }
    }
    if (hasMinPrice || hasMaxPrice) {
      const priceQuery = {};
      if (hasMinPrice) priceQuery.$gte = minPrice;
      if (hasMaxPrice) priceQuery.$lte = maxPrice;
      matchClauses.push({ hourlyPrice: priceQuery });
    }
    if (hasMinRating || hasMaxRating) {
      const ratingQuery = {};
      if (hasMinRating) ratingQuery.$gte = minRating;
      if (hasMaxRating) ratingQuery.$lte = maxRatingValue;
      matchClauses.push({ rating: ratingQuery });
    }

    if (availability) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const now = new Date();
      const currentDay = dayNames[now.getDay()];

      let targetDays = [];
      if (availability === 'now' || availability === 'today') {
        targetDays = [currentDay];
      } else if (availability === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        targetDays = [dayNames[tomorrow.getDay()]];
      } else if (availability === 'weekend') {
        targetDays = ['Saturday', 'Sunday'];
      }

      if (targetDays.length) {
        matchClauses.push({
          availability: {
            $elemMatch: {
              day: { $in: targetDays },
              enabled: true,
            },
          },
        });
      }
    }

    const match = matchClauses.length === 1 ? matchClauses[0] : { $and: matchClauses };

    const pipeline = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance: maxDistanceMeters,
          spherical: true,
          query: match,
        },
      },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          title: 1,
          sport: 1,
          location: 1,
          coordinates: 1,
          hourlyPrice: 1,
          rating: 1,
          ratingCount: 1,
          images: 1,
          slug: 1,
          availability: 1,
          distanceMeters: 1,
        },
      },
    ];

    const venues = await Venue.aggregate(pipeline);

    let filteredVenues = venues;
    if (availability === 'now' || availability === 'today') {
      const now = new Date();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = dayNames[now.getDay()];
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      filteredVenues = venues.filter((v) => {
        const slot = (v.availability || []).find((a) => a.enabled && a.day === currentDay);
        if (!slot) return false;
        const hasTimeRemaining = slot.endTime > currentTime;
        if (availability === 'today') return hasTimeRemaining;
        return slot.startTime <= currentTime && slot.endTime > currentTime;
      });
    }

    const items = filteredVenues.map((v) => ({
      id: v._id,
      name: v.title,
      sport: v.sport,
      location: v.location,
      coordinates: v.coordinates,
      price: v.hourlyPrice,
      rating: v.rating,
      reviews: v.ratingCount,
      image: v.images?.[0] || null,
      slug: v.slug,
      distanceMeters: Math.round(v.distanceMeters || 0),
      distanceKm: Number(((v.distanceMeters || 0) / 1000).toFixed(2)),
    }));

    const responsePayload = {
      items,
      count: items.length,
      radiusKm,
      limit,
    };
    writeMapCache(cacheKey, responsePayload, MAP_CACHE_TTL_MS.nearby);
    res.locals.mapResultCount = responsePayload.count;
    return sendSuccess(res, 200, 'Nearby venues fetched', responsePayload);
  } catch (error) {
    console.error('[GET_NEARBY_VENUES_ERROR]', error);
    return sendError(res, 500, 'Failed to fetch nearby venues');
  }
};

// GET /api/venues/map/directions
const getDirections = async (req, res) => {
  try {
    const mapToken = process.env.MAPBOX_SECRET_TOKEN;
    if (!mapToken) {
      return sendError(res, 500, 'Mapbox token is not configured on server');
    }

    const startLat = parseFloat(req.query.startLat);
    const startLng = parseFloat(req.query.startLng);
    const endLat = parseFloat(req.query.endLat);
    const endLng = parseFloat(req.query.endLng);
    const profile = req.query.profile || 'driving';
    const cacheKey = buildMapCacheKey('directions', {
      startLat,
      startLng,
      endLat,
      endLng,
      profile,
    });

    const cachedPayload = readMapCache(cacheKey);
    if (cachedPayload) {
      res.locals.mapCacheHit = true;
      return sendSuccess(res, 200, 'Directions fetched', cachedPayload);
    }

    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${startLng},${startLat};${endLng},${endLat}`;
    const response = await axios.get(directionsUrl, {
      params: {
        access_token: mapToken,
        geometries: 'geojson',
        overview: 'full',
        alternatives: false,
        steps: false,
      },
      timeout: 20000,
    });

    const route = response?.data?.routes?.[0];
    if (!route) {
      return sendError(res, 404, 'No route found for the selected points');
    }

    const responsePayload = {
      profile,
      distanceMeters: Math.round(route.distance || 0),
      distanceKm: Number(((route.distance || 0) / 1000).toFixed(2)),
      durationSeconds: Math.round(route.duration || 0),
      durationMinutes: Math.round((route.duration || 0) / 60),
      geometry: route.geometry,
      legs: route.legs || [],
    };
    writeMapCache(cacheKey, responsePayload, MAP_CACHE_TTL_MS.directions);
    return sendSuccess(res, 200, 'Directions fetched', responsePayload);
  } catch (error) {
    console.error('[GET_DIRECTIONS_ERROR]', error?.response?.data || error.message);
    return sendError(res, 500, 'Failed to fetch directions');
  }
};

// (deferred export; consolidated at bottom)

module.exports = {
  // business-only controllers
  createVenue,
  getTopVenues,
  getMyVenues,
  updateVenue,
  getVenueById,
  deleteVenue,
  // public/browse controllers
  getPublicVenues,
  getPublicVenueById,
  getSportStats,
  getVenueLocations,
  getViewportVenues,
  getNearbyVenues,
  getDirections,
};
