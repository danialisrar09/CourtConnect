import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingCart, Clock, Calendar, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { useCart } from '../../contexts';
import { useAuth } from '../../hooks/useAuth';
import { EmptyState } from '../common';
import { usePageTitle } from '../../hooks/usePageTitle';

export function CartPage() {
  usePageTitle('Your Cart', 'Review your selected court bookings and proceed to checkout.');
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateDuration, subtotal, tax, total } = useCart();
  const { isAuthenticated } = useAuth();

  const handleRemoveItem = (id: string) => {
    removeFromCart(id);
    toast.success('Item removed from cart');
  };

  const handleUpdateDuration = (id: string, newDuration: number) => {
    if (newDuration < 1) return;
    updateDuration(id, newDuration);
    toast.success('Duration updated');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center mb-8">
          <ShoppingCart className="h-8 w-8 text-[#98e209] mr-3" />
          <h1 className="text-3xl font-bold text-[#010101]">Your Cart</h1>
          <Badge className="ml-3 bg-[#98e209] text-[#010101]">
            {cartItems.length} item{cartItems.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {cartItems.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Your cart is empty"
            description="Start browsing courts to add them to your cart"
            actionLabel="Find Courts"
            onAction={() => navigate('/find-court')}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      <ImageWithFallback
                        src={item.image}
                        alt={item.court}
                        className="w-24 h-24 rounded-lg object-cover shrink-0"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <h3 className="text-lg font-bold text-[#010101] truncate">{item.court}</h3>
                            <Badge className="mt-1">{item.sport}</Badge>
                          </div>
                          <Button
                            onClick={() => handleRemoveItem(item.id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            aria-label={`Remove ${item.court} from cart`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>

                        <div className="flex items-center text-gray-600 mb-1">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span className="text-sm">{item.location || 'Location not specified'}</span>
                        </div>

                        <div className="flex items-center space-x-4 text-gray-600 mb-2">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            <span className="text-sm">{formatDate(item.date)}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            <span className="text-sm">{item.time}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-sm text-gray-600">Duration:</span>
                            <div className="flex items-center space-x-2">
                              <Button
                                onClick={() => handleUpdateDuration(item.id, item.duration - 1)}
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                disabled={item.duration <= 1}
                                aria-label="Decrease duration by 1 hour"
                              >
                                <Minus className="h-3 w-3" aria-hidden="true" />
                              </Button>
                              <span className="text-sm font-medium w-12 text-center">
                                {item.duration} hr{item.duration > 1 ? 's' : ''}
                              </span>
                              <Button
                                onClick={() => handleUpdateDuration(item.id, item.duration + 1)}
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                disabled={item.duration >= 3}
                                aria-label="Increase duration by 1 hour"
                              >
                                <Plus className="h-3 w-3" aria-hidden="true" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-[#010101]">Rs {item.price}</p>
                            <p className="text-sm text-gray-600">
                              Rs {(item.price / item.duration).toFixed(2)}/hour
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Continue Shopping */}
              <div className="text-center pt-4">
                <Button
                  onClick={() => navigate('/find-court')}
                  variant="outline"
                  className="px-8"
                >
                  Continue Shopping
                </Button>
              </div>
            </div>

            {/* Order Summary */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal ({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})</span>
                      <span>Rs {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax (8%)</span>
                      <span>Rs {tax.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span className="text-[#98e209]">Rs {total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      if (!isAuthenticated) {
                        toast.error('Please login to proceed to checkout');
                        navigate('/login');
                        return;
                      }
                      navigate('/checkout');
                    }}
                    className="w-full bg-[#98e209] text-[#010101] hover:bg-[#89cb08] py-3 text-lg"
                  >
                    Book Now
                  </Button>

                  <div className="text-center pt-2">
                    <p className="text-xs text-gray-500">
                      Free cancellation up to 2 hours before booking time
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Booking Information */}
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle className="text-lg">Booking Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm p-4">
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-[#98e209] rounded-full mt-2 shrink-0"></div>
                    <p>Owner confirms your booking first, then you pay a 50% deposit</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-[#98e209] rounded-full mt-2 shrink-0"></div>
                    <p>Free cancellation up to 2 hours before your booking</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-[#98e209] rounded-full mt-2 shrink-0"></div>
                    <p>Show your booking confirmation at the venue</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-[#98e209] rounded-full mt-2 shrink-0"></div>
                    <p>Contact venue directly for special requests</p>
                  </div>
                </CardContent>
              </Card>

              {/* Promo Code */}
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle className="text-lg">Promo Code</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Enter promo code"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:border-transparent"
                    />
                    <Button variant="outline" size="sm">
                      Apply
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Have a promo code? Enter it here to save on your booking.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}