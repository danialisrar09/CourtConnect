import { api } from './api';

export interface AddCartItemPayload {
  venueId: string | number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm or range
  duration: number; // hours
}

const cartService = {
  getCart: async (): Promise<any> => {
    const res = await api.get('/cart');
    return res.data;
  },
  addItem: async (payload: AddCartItemPayload): Promise<any> => {
    const res = await api.post('/cart', payload);
    return res.data;
  },
  updateItem: async (id: string, updates: Partial<AddCartItemPayload>): Promise<any> => {
    const res = await api.patch(`/cart/${id}`, updates);
    return res.data;
  },
  removeItem: async (id: string): Promise<any> => {
    const res = await api.delete(`/cart/${id}`);
    return res.data;
  },
  clear: async (): Promise<any> => {
    const res = await api.delete('/cart');
    return res.data;
  }
};

export default cartService;
