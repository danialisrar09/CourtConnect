import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CartItem } from '../types';
import { toast } from 'sonner';
import cartService from '../services/cartService';
import { useAuth } from '../hooks/useAuth';

interface CartContextType {
  cartItems: CartItem[];
  cartCount: number;
  subtotal: number;
  tax: number;
  total: number;
  addToCart: (payload: { venueId: string | number; date: string; time: string; duration: number }) => Promise<void>;
  removeFromCart: (itemId: string, silent?: boolean) => Promise<void>;
  updateCartItem: (itemId: string, updates: Partial<CartItem>) => Promise<void>;
  updateDuration: (itemId: string, duration: number) => Promise<void>;
  clearCart: (notify?: boolean) => Promise<void>;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const { isAuthenticated } = useAuth();

  /**
   * Validate cart items and remove those that are too close to current time
   * If booking is within 2 hours from now, remove it and notify user
   */
  const validateCartItems = async (items: CartItem[]) => {
    const now = new Date();
    const expiredItems: CartItem[] = [];
    const validItems: CartItem[] = [];

    for (const item of items) {
      try {
        // Parse booking date and time
        const bookingDate = new Date(item.date);
        bookingDate.setHours(0, 0, 0, 0);

        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        // Only check if booking is for today
        if (bookingDate.getTime() === todayDate.getTime()) {
          const [hours, minutes] = (item.time || '00:00').split(':').map(Number);
          const bookingTime = new Date();
          bookingTime.setHours(hours, minutes, 0, 0);

          // Calculate hours until booking
          const minutesUntilBooking = (bookingTime.getTime() - now.getTime()) / (1000 * 60);
          const hoursUntilBooking = minutesUntilBooking / 60;

          // If booking is within 2 hours of now, it's expired
          if (hoursUntilBooking < 2) {
            expiredItems.push(item);
          } else {
            validItems.push(item);
          }
        } else {
          // Future bookings are valid
          validItems.push(item);
        }
      } catch (error) {
        console.error('Error validating cart item:', error);
        validItems.push(item); // Keep on error to prevent data loss
      }
    }

    // Remove expired items if any
    if (expiredItems.length > 0) {
      setCartItems(validItems);

      // Remove from backend silently
      for (const item of expiredItems) {
        try {
          await cartService.removeItem(item.id);
        } catch (error) {
          console.error('Failed to remove expired item from backend:', error);
        }
      }

      // Notify user about removed items
      const venues = expiredItems.map((item) => item.venueName || 'Court').join(', ');
      toast.info(`Removed ${expiredItems.length} item(s) from cart - too close to booking time (< 2 hours): ${venues}`);
    }

    return validItems;
  };

  // Hydrate from backend when authenticated
  useEffect(() => {
    const hydrate = async () => {
      if (!isAuthenticated) {
        setCartItems([]);
        return;
      }
      try {
        const data = await cartService.getCart();
        const items = data.data?.items || [];
        const validItems = await validateCartItems(items);
        setCartItems(validItems);
      } catch (e: any) {
        console.error('Failed to load cart', e);
      }
    };
    hydrate();
  }, [isAuthenticated]);

  // Periodically validate cart items (every minute) to catch items that become too close to booking time
  useEffect(() => {
    if (!isAuthenticated || cartItems.length === 0) return;

    const interval = setInterval(async () => {
      await validateCartItems(cartItems);
    }, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, [isAuthenticated, cartItems]);

  const addToCart = async (payload: { venueId: string | number; date: string; time: string; duration: number }) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast.error('Please login to add items to cart');
      return;
    }

    // Validate that the booking time is not within 2 hours of now
    try {
      const bookingDate = new Date(payload.date);
      bookingDate.setHours(0, 0, 0, 0);

      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      // Only validate if booking is for today
      if (bookingDate.getTime() === todayDate.getTime()) {
        const [hours, minutes] = payload.time.split(':').map(Number);
        const bookingTime = new Date();
        bookingTime.setHours(hours, minutes, 0, 0);

        const now = new Date();
        const minutesUntilBooking = (bookingTime.getTime() - now.getTime()) / (1000 * 60);
        const hoursUntilBooking = minutesUntilBooking / 60;

        if (hoursUntilBooking < 2) {
          toast.error(`Cannot add to cart - booking is less than 2 hours away (${hoursUntilBooking.toFixed(1)}h remaining)`);
          return;
        }
      }
    } catch (error) {
      console.error('Error validating booking time:', error);
    }

    try {
      // Optimistic: nothing; wait for server authoritative price/id
      const res = await cartService.addItem(payload);
      const newItem = res.data?.item || res.item;
      setCartItems((prev) => [newItem, ...prev.filter(p => p.id !== newItem.id)]);
      toast.success('Added to cart');
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Failed to add to cart';
      toast.error(msg);
    }
  };

  const removeFromCart = async (itemId: string, silent: boolean = false) => {
    const current = cartItems;
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
    try {
      await cartService.removeItem(itemId);
      if (!silent) {
        toast.success('Item removed from cart');
      }
    } catch (e) {
      setCartItems(current); // rollback
      toast.error('Failed to remove item');
    }
  };

  const updateCartItem = async (itemId: string, updates: Partial<CartItem>) => {
    const previous = cartItems;
    // Optimistically update duration only (price will be refreshed from server)
    if (updates.duration !== undefined) {
      setCartItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, duration: updates.duration as number } : i)));
    }
    try {
      const payload: any = {};
      if (updates.date) payload.date = updates.date;
      if (updates.time) payload.time = updates.time;
      if (updates.duration !== undefined) payload.duration = updates.duration;
      const res = await cartService.updateItem(itemId, payload);
      const updated = res?.data?.item || res?.item;
      if (updated) {
        setCartItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
      }
    } catch (e) {
      setCartItems(previous);
      toast.error('Failed to update cart');
    }
  };

  const updateDuration = async (itemId: string, duration: number) => {
    if (duration < 1 || duration > 3) {
      toast.error('Duration must be between 1 and 3 hours');
      return;
    }
    await updateCartItem(itemId, { duration } as any);
  };

  const clearCart = async (notify: boolean = true) => {
    const previous = cartItems;
    setCartItems([]);
    try {
      await cartService.clear();
      if (notify) {
        toast.success('Cart cleared');
      }
    } catch (e) {
      setCartItems(previous);
      toast.error('Failed to clear cart');
    }
  };

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + tax;

  const value: CartContextType = {
    cartItems,
    cartCount: cartItems.length,
    subtotal,
    tax,
    total,
    addToCart,
    removeFromCart,
    updateCartItem,
    updateDuration,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// Custom hook to use cart context
export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
