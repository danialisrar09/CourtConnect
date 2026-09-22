const { sendSuccess, sendError } = require('../utils/responseUtils');
const { Cart, Venue } = require('../models');

const normalizeDate = (value) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const mapCartItem = (item) => {
  const venue = item.venue || {};
  return {
    id: item._id,
    venueId: venue._id,
    court: venue.title || venue.name || venue.slug || 'Court',
    sport: item.sport || venue.sport,
    date: item.date ? item.date.toISOString().split('T')[0] : null,
    time: item.time,
    duration: item.duration,
    price: item.price,
    image: item.image || (venue.images && venue.images[0]) || '',
    location: item.location || venue.location || '',
  };
};

// Normalize time strings like "6:00 AM" or "18:00" to 24h HH:mm
const normalizeTime = (time) => {
  if (!time || typeof time !== 'string') return null;
  const ampm = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    const period = ampm[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  const hhmm = time.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (hhmm) return `${hhmm[1].padStart(2,'0')}:${hhmm[2]}`;
  return time; // fallback as-is
};

const getCart = async (req, res) => {
  try {
    const items = await Cart.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('venue', 'title name sport location images hourlyPrice price slug');

    const mapped = items.map(mapCartItem);
    return sendSuccess(res, 200, 'Cart fetched', { items: mapped });
  } catch (error) {
    console.error('[CART_GET_ERROR]', error);
    return sendError(res, 500, 'Failed to fetch cart');
  }
};

const addCartItem = async (req, res) => {
  try {
    const { venueId, date, time, duration } = req.body;

    if (!venueId || !date || !time || !duration) {
      return sendError(res, 400, 'venueId, date, time, and duration are required');
    }

    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) {
      return sendError(res, 400, 'Invalid date format');
    }

    const parsedDuration = Number(duration);
    if (isNaN(parsedDuration) || parsedDuration < 0.5 || parsedDuration > 24) {
      return sendError(res, 400, 'Duration must be between 0.5 and 24 hours');
    }

    const venue = await Venue.findById(venueId).select('title name sport location images hourlyPrice price slug status');
    if (!venue || venue.status === 'inactive') {
      return sendError(res, 404, 'Venue not found');
    }

    const unitPrice = venue.hourlyPrice || venue.price;
    if (!unitPrice || unitPrice <= 0) {
      return sendError(res, 400, 'Venue price is not configured');
    }

    const existing = await Cart.findOne({
      user: req.user._id,
      venue: venueId,
      date: normalizedDate,
      time: normalizeTime(time),
    });
    if (existing) {
      return sendError(res, 409, 'This time slot is already in your cart');
    }

    const price = unitPrice * parsedDuration;

    const cartItem = await Cart.create({
      user: req.user._id,
      venue: venueId,
      date: normalizedDate,
      time: normalizeTime(time),
      duration: parsedDuration,
      price,
      sport: venue.sport,
      venueName: venue.title || venue.name,
      location: venue.location,
      image: venue.images && venue.images[0],
    });

    const populated = await cartItem.populate('venue', 'title name sport location images hourlyPrice price slug');

    return sendSuccess(res, 201, 'Item added to cart', { item: mapCartItem(populated) });
  } catch (error) {
    console.error('[CART_ADD_ERROR]', error);
    if (error.code === 11000) {
      return sendError(res, 409, 'This time slot is already in your cart');
    }
    return sendError(res, 500, 'Failed to add item to cart');
  }
};

const updateCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time, duration } = req.body;

    const cartItem = await Cart.findOne({ _id: id, user: req.user._id }).populate(
      'venue',
      'title name sport location images hourlyPrice price slug status'
    );

    if (!cartItem) {
      return sendError(res, 404, 'Cart item not found');
    }

    if (date) {
      const normalizedDate = normalizeDate(date);
      if (!normalizedDate) {
        return sendError(res, 400, 'Invalid date format');
      }
      cartItem.date = normalizedDate;
    }

    if (time) {
      cartItem.time = normalizeTime(time);
    }

    if (duration !== undefined) {
      const parsedDuration = Number(duration);
      if (isNaN(parsedDuration) || parsedDuration < 0.5 || parsedDuration > 24) {
        return sendError(res, 400, 'Duration must be between 0.5 and 24 hours');
      }
      cartItem.duration = parsedDuration;
    }

    // Ensure no duplicate slot after updates
    const duplicate = await Cart.findOne({
      _id: { $ne: cartItem._id },
      user: req.user._id,
      venue: cartItem.venue,
      date: cartItem.date,
      time: cartItem.time,
    });

    if (duplicate) {
      return sendError(res, 409, 'This time slot is already in your cart');
    }

    const venue = cartItem.venue;
    if (!venue || venue.status === 'inactive') {
      return sendError(res, 404, 'Venue not found');
    }

    const unitPrice = venue.hourlyPrice || venue.price;
    if (!unitPrice || unitPrice <= 0) {
      return sendError(res, 400, 'Venue price is not configured');
    }

    cartItem.price = unitPrice * cartItem.duration;

    await cartItem.save();

    return sendSuccess(res, 200, 'Cart item updated', { item: mapCartItem(cartItem) });
  } catch (error) {
    console.error('[CART_UPDATE_ERROR]', error);
    if (error.code === 11000) {
      return sendError(res, 409, 'This time slot is already in your cart');
    }
    return sendError(res, 500, 'Failed to update cart item');
  }
};

const removeCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Cart.findOneAndDelete({ _id: id, user: req.user._id });
    if (!deleted) {
      return sendError(res, 404, 'Cart item not found');
    }
    return sendSuccess(res, 200, 'Cart item removed', { id });
  } catch (error) {
    console.error('[CART_DELETE_ERROR]', error);
    return sendError(res, 500, 'Failed to remove cart item');
  }
};

const clearCart = async (req, res) => {
  try {
    await Cart.deleteMany({ user: req.user._id });
    return sendSuccess(res, 200, 'Cart cleared');
  } catch (error) {
    console.error('[CART_CLEAR_ERROR]', error);
    return sendError(res, 500, 'Failed to clear cart');
  }
};

module.exports = {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
};
