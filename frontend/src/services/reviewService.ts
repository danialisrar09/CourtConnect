import api from './api';

const reviewService = {
  /**
   * Get all reviews for a venue
   */
  getVenueReviews: async (venueId: string, params?: { page?: number; limit?: number; sort?: string }): Promise<any> => {
    try {
      const response = await api.get(`/venues/${venueId}/reviews`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching venue reviews:', error);
      throw error;
    }
  },

  /**
   * Add a new review for a venue
   */
  addReview: async (venueId: string, data: { rating: number; comment: string; bookingId?: string }): Promise<any> => {
    try {
      const response = await api.post(`/venues/${venueId}/reviews`, data);
      return response.data;
    } catch (error) {
      console.error('Error adding review:', error);
      throw error;
    }
  },

  /**
   * Update an existing review
   */
  updateReview: async (reviewId: string, data: { rating?: number; comment?: string }): Promise<any> => {
    try {
      const response = await api.put(`/reviews/${reviewId}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating review:', error);
      throw error;
    }
  },

  /**
   * Delete a review
   */
  deleteReview: async (reviewId: string): Promise<any> => {
    try {
      const response = await api.delete(`/reviews/${reviewId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting review:', error);
      throw error;
    }
  },

  /**
   * Toggle helpful status on a review
   */
  toggleHelpful: async (reviewId: string): Promise<any> => {
    try {
      const response = await api.post(`/reviews/${reviewId}/helpful`);
      return response.data;
    } catch (error) {
      console.error('Error toggling helpful:', error);
      throw error;
    }
  },

  /**
   * Respond to a review (venue owner only)
   */
  respondToReview: async (reviewId: string, text: string): Promise<any> => {
    try {
      const response = await api.post(`/reviews/${reviewId}/respond`, { text });
      return response.data;
    } catch (error) {
      console.error('Error responding to review:', error);
      throw error;
    }
  }
};

export default reviewService;
