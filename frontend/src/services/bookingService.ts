import { api } from './api';

export interface TimeSlot {
  start: string; // HH:MM
  end: string;   // HH:MM
}

export interface CreateBookingPayload {
  venue: string;           // venue id
  bookingDate: string;     // ISO date string (YYYY-MM-DD or full ISO)
  timeSlot: TimeSlot;
  duration: number;        // hours
  totalPrice: number;
  paymentInfo?: {
    method?: 'card' | 'cash' | 'online' | 'wallet';
    transactionId?: string;
  };
  notes?: string;
}

export interface DepositPaymentIntentResponse {
  success: boolean;
  message: string;
  data: {
    bookingId: string;
    paymentIntentId: string;
    clientSecret: string;
    amount: number;
    currency: string;
    depositPercentage: number;
  };
}

export interface DepositCheckoutSessionResponse {
  success: boolean;
  message: string;
  data: {
    bookingId: string;
    checkoutUrl: string;
    sessionId: string;
    amount: number;
    currency: string;
    depositPercentage: number;
  };
}

export interface ConfirmDepositCheckoutResponse {
  success: boolean;
  message: string;
  data: {
    bookingId: string;
    paymentStatus: string;
    amountPaid?: number;
    transactionId?: string;
    checkoutPaymentStatus?: string;
  };
}

export interface BookingResponse {
  success: boolean;
  message: string;
  data: {
    booking: any;
  };
}

const bookingService = {
  /**
   * Step 1: Create a new booking (Customer)
   */
  async createBooking(payload: CreateBookingPayload): Promise<BookingResponse> {
    const res = await api.post<BookingResponse>('/bookings', payload);
    return res.data;
  },

  /**
   * Step 2: Get current user's bookings with optional filters
   * Filters: status, startDate, endDate, page, limit
   */
  async getMyBookings(params: Record<string, any> = {}): Promise<any> {
    const res = await api.get('/bookings/my', { params });
    return res.data;
  },

  async getMonthlyStats(params: Record<string, any> = {}): Promise<any> {
    const res = await api.get('/bookings/stats/monthly', { params });
    return res.data;
  },

  /**
   * Step 3: Check availability for a venue on a specific date (Public)
   */
  async checkAvailability(venueId: string, date: string): Promise<any> {
    const res = await api.get('/bookings/availability', {
      params: { venue: venueId, date },
    });
    return res.data;
  },

  /**
   * Step 4: Get bookings for a specific venue (Business owner)
   */
  async getVenueBookings(venueId: string, params: Record<string, any> = {}): Promise<any> {
    const res = await api.get(`/bookings/venue/${venueId}`, { params });
    return res.data;
  },

  /**
   * Step 5: Update booking (status/payment) and cancel booking
   */
  async updateBooking(id: string, data: Partial<{ status: string; notes: string; cancellationReason: string }>): Promise<any> {
    const res = await api.put(`/bookings/${id}`, data);
    return res.data;
  },

  /**
   * Step 5.5: Create deposit payment intent (Customer, after owner confirmation)
   */
  async createDepositPaymentIntent(id: string): Promise<DepositPaymentIntentResponse> {
    const res = await api.post<DepositPaymentIntentResponse>(`/bookings/${id}/payment-intent`);
    return res.data;
  },

  /**
   * Step 5.6: Create Stripe Checkout session for deposit and redirect user
   */
  async createDepositCheckoutSession(id: string): Promise<DepositCheckoutSessionResponse> {
    const res = await api.post<DepositCheckoutSessionResponse>(`/bookings/${id}/deposit-checkout-session`);
    return res.data;
  },

  /**
   * Confirm checkout result on return page (fallback when webhook is delayed)
   */
  async confirmDepositCheckoutSession(id: string, sessionId: string): Promise<ConfirmDepositCheckoutResponse> {
    const res = await api.post<ConfirmDepositCheckoutResponse>(`/bookings/${id}/confirm-deposit-checkout`, { sessionId });
    return res.data;
  },

  async cancelBooking(id: string, reason?: string): Promise<any> {
    const res = await api.delete(`/bookings/${id}`, { data: { reason } });
    return res.data;
  },

  /**
   * Step 6: Contact booking customer (Business owner)
   */
  async contactCustomer(id: string, payload: { subject: string; message: string }): Promise<any> {
    const res = await api.post(`/bookings/${id}/contact`, payload);
    return res.data;
  },
};

export default bookingService;
