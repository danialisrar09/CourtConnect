import { useNavigate, useLocation } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Calendar, Clock, Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import React, { useState, useEffect } from 'react';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { LoadingButton } from '../ui/loading';
import { useCart } from '../../contexts';
import bookingService from '../../services/bookingService';
import { useAuth } from '../../hooks/useAuth';
import { usePageTitle } from '../../hooks/usePageTitle';

// Helpers to normalize date/time for backend API
// Send full ISO-8601 timestamp to satisfy strict validators
const toISODateTime = (input: string) => {
  const d = new Date(input);
  if (isNaN(d.getTime())) {
    return input; // fallback, backend may reject and we show message
  }
  return d.toISOString();
};

// ISO date (YYYY-MM-DD) from input
const toISODate = (input: string) => {
  // If input is already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }
  
  const d = new Date(input);
  if (isNaN(d.getTime())) return input;
  
  // Use local date components to avoid timezone issues
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const to24h = (time12h: string): string => {
  const match = time12h.match(/(\d{1,2}:\d{2})\s*([AP]M)/i);
  if (!match) {
    const hhmm = time12h.match(/^(\d{2}:\d{2})$/);
    return hhmm ? hhmm[1] : time12h;
  }
  let [_, time, meridian] = match;
  let [h, m] = time.split(':').map(n => parseInt(n, 10));
  if (/PM/i.test(meridian) && h !== 12) h += 12;
  if (/AM/i.test(meridian) && h === 12) h = 0;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}`;
};

const addHours = (startHHMM: string, hours: number): string => {
  const [h, m] = startHHMM.split(':').map(n => parseInt(n, 10));
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setHours(d.getHours() + (hours || 1));
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

export function CheckoutPage() {
  usePageTitle('Checkout', 'Submit your booking request and pay the 50% deposit after owner confirmation.');
  const navigate = useNavigate();
  const location = useLocation();
  const directBooking = (location.state as any)?.directBooking as | {
    venueId: string;
    date: string;
    startTime: string;
    duration: number;
    price: number;
    court?: string;
  } | undefined;
  const { cartItems, clearCart, subtotal, tax, total } = useCart();
  const { isAuthenticated } = useAuth();
  const [step, setStep] = useState(1); // 1: Details, 2: Review & Submit, 3: Confirmation

  // Log directBooking for debugging
  useEffect(() => {
    if (directBooking) {
      console.log('=== CHECKOUT PAGE RECEIVED ===');
      console.log('Direct Booking object:', directBooking);
      console.log('Direct Booking date:', directBooking.date);
      console.log('Direct Booking startTime:', directBooking.startTime);
      console.log('Direct Booking duration:', directBooking.duration);
    }
  }, [directBooking]);

  // Derive display items and totals for direct booking vs cart
  const displayItems = React.useMemo(() => {
    if (directBooking) {
      return [
        {
          id: 'direct',
          court: directBooking.court || 'Selected court',
          sport: '',
          date: directBooking.date,
          time: directBooking.startTime,
          duration: directBooking.duration,
          price: Number(directBooking.price) || 0,
          image: '',
        },
      ];
    }
    return cartItems;
  }, [directBooking, cartItems]);

  const displaySubtotal = React.useMemo(() => {
    if (directBooking) return Number(directBooking.price) || 0;
    return subtotal;
  }, [directBooking, subtotal]);

  const displayTax = React.useMemo(() => {
    return Number((displaySubtotal * 0.08).toFixed(2));
  }, [displaySubtotal]);

  const displayTotal = React.useMemo(() => {
    return Number((displaySubtotal + displayTax).toFixed(2));
  }, [displaySubtotal, displayTax]);
  const [formData, setFormData] = useState({
    // Personal Details
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    
    // Billing Address
    address: '',
    city: '',
    state: 'sindh', // Default to Sindh
    zipCode: '',
    
    // Preferences
    newsletter: false,
    terms: false
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Redirect unauthenticated users to login
  React.useEffect(() => {
    if (!isAuthenticated) {
      toast.error('Please login to proceed to checkout');
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleNextStep = () => {
    if (step === 1) {
      // Validate personal details
      const requiredFields = ['firstName', 'lastName', 'email', 'phone'];
      const isValid = requiredFields.every(field => formData[field as keyof typeof formData]);
      
      if (!isValid) {
        toast.error('Please fill in all required fields');
        return;
      }
      
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error('Please enter a valid email address');
        return;
      }
      
      // Step 1.5: Check availability before confirmation step
      const checkConflicts = async () => {
        try {
          const itemsToCheck = directBooking ? [
            {
              court: directBooking.court || 'Selected court',
              venueId: directBooking.venueId,
              date: directBooking.date,
              time: directBooking.startTime,
              duration: directBooking.duration,
            }
          ] : cartItems as any[];

          for (const item of itemsToCheck) {
            const venueId = (item as any).venueId; // must be a MongoID
            if (!venueId || !/^[a-f\d]{24}$/i.test(String(venueId))) {
              toast.error(`Invalid venue reference for ${item?.court || 'item'}. Please re-add from venue page.`);
              return false;
            }
            const date = toISODateTime(String(item.date));
            const start = to24h(String(item.time));
            const end = addHours(start, Number(item.duration) || 1);

            const availability = await bookingService.checkAvailability(String(venueId), date);
            const booked = availability?.data?.bookedSlots || availability?.bookedSlots || [];

            const overlaps = booked.some((slot: any) => {
              const s = slot.start;
              const e = slot.end;
              return (
                (start >= s && start < e) ||
                (end > s && end <= e) ||
                (start <= s && end >= e)
              );
            });

            if (overlaps) {
              toast.error(`Selected time for ${item.court} conflicts with existing booking.`);
              return false;
            }
          }
          return true;
        } catch (err: any) {
          const apiMsg = err?.response?.data?.message;
          const firstFieldErr = err?.response?.data?.errors?.[0]?.message;
          toast.error(apiMsg || firstFieldErr || err?.message || 'Failed to check availability. Please try again.');
          return false;
        }
      };

      setIsProcessing(true);
      checkConflicts().then((ok) => {
        setIsProcessing(false);
        if (!ok) return;
        setStep(2);
        toast.success('Personal details verified. No conflicts found.');
      });
    } else if (step === 2) {
      // Terms acceptance is required before submitting booking request.
      if (!formData.terms) {
        toast.error('Please accept terms and conditions to continue');
        return;
      }

      // Submit booking request
      setIsProcessing(true);
      toast.info('Submitting your booking request...');
      setTimeout(async () => {
        try {
          const createdIds: string[] = [];
          const itemsToCreate = directBooking ? [
            {
              court: directBooking.court || 'Selected court',
              venueId: directBooking.venueId,
              date: directBooking.date,
              time: directBooking.startTime,
              duration: directBooking.duration,
              price: directBooking.price,
            }
          ] : cartItems as any[];

          for (const item of itemsToCreate) {
            const venueId = (item as any).venueId; // must be a MongoID
            if (!venueId || !/^[a-f\d]{24}$/i.test(String(venueId))) {
              throw new Error(`Missing or invalid venue ID for item: ${item?.court || 'Unknown court'}`);
            }
            const bookingDate = toISODate(String(item.date));
            const start = to24h(String(item.time));
            const end = addHours(start, Number(item.duration) || 1);

            const res = await bookingService.createBooking({
              venue: String(venueId),
              bookingDate,
              timeSlot: { start, end },
              duration: Number(item.duration) || 1,
              totalPrice: Number(item.price) || 0,
              paymentInfo: { method: 'card' },
              notes: `Booked via Checkout by ${formData.firstName} ${formData.lastName}`,
            });
            const newId = res?.data?._id || res?.booking?._id || res?._id;
            if (newId) {
              createdIds.push(String(newId));
              console.log('Booking request created:', newId);
            }
          }

          setIsProcessing(false);
          // Clear cart only when checkout originated from cart items.
          if (!directBooking) {
            await clearCart(false);
          }
          toast.success('Booking request submitted. Pay 50% deposit after owner confirmation.');
          navigate('/receipt', {
            replace: true,
            state: {
              bookingIds: createdIds,
              total: directBooking ? Number(directBooking.price) : Number(total),
              items: directBooking ? itemsToCreate : cartItems,
              paymentDeferred: true,
            }
          });
        } catch (err: any) {
          setIsProcessing(false);
          const apiMsg = err?.response?.data?.message;
          const firstFieldErr = err?.response?.data?.errors?.[0]?.message;
          toast.error(apiMsg || firstFieldErr || err?.message || 'Failed to create booking. Please try again.');
        }
      }, 1500);
    }
  };

  const formatDate = (dateString: string) => {
    console.log('=== FORMATTING DATE ===');
    console.log('Input dateString:', dateString);
    const formatted = new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    console.log('Formatted output:', formatted);
    return formatted;
  };

  if (step === 3) {
    // After booking created successfully, show receipt and go to dashboard
    return (
      <div className="min-h-screen bg-gray-50 pt-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="text-center">
            <CardContent className="p-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-[#010101] mb-4">Booking Request Submitted!</h1>
              <p className="text-gray-600 mb-8">
                Your booking request has been sent to the venue owner for confirmation. Once approved, you can pay the 50% deposit via Stripe.
              </p>
              <div className="space-y-2 mb-8 bg-blue-50 p-4 rounded">
                <p className="text-sm font-semibold text-blue-900">📌 What's Next?</p>
                <p className="text-sm text-blue-800">1. Wait for owner confirmation</p>
                <p className="text-sm text-blue-800">2. Payment option will appear in your dashboard</p>
                <p className="text-sm text-blue-800">3. Complete payment via Stripe</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => navigate('/dashboard/customer')}
                  className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08]"
                >
                  Go to Dashboard
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  variant="outline"
                >
                  Back to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className={`flex items-center ${step >= 1 ? 'text-[#98e209]' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 1 ? 'bg-[#98e209] text-[#010101]' : 'bg-gray-300 text-gray-600'
              }`}>
                1
              </div>
              <span className="ml-2">Personal Details</span>
            </div>
            <div className={`w-16 h-1 ${step >= 2 ? 'bg-[#98e209]' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center ${step >= 2 ? 'text-[#98e209]' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 2 ? 'bg-[#98e209] text-[#010101]' : 'bg-gray-300 text-gray-600'
              }`}>
                2
              </div>
              <span className="ml-2">Confirmation</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 text-[#98e209] mr-2" />
                    Personal Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName" className="mb-2 block">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="mb-2 block">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email" className="mb-2 block">Email Address *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="phone" className="mb-2 block">Phone Number *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="newsletter"
                      checked={formData.newsletter}
                      onCheckedChange={(checked) => handleInputChange('newsletter', checked as boolean)}
                    />
                    <label htmlFor="newsletter" className="text-sm text-gray-600">
                      Subscribe to our newsletter for exclusive offers and updates
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <div className="space-y-4">
                {/* Billing Address */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <MapPin className="h-5 w-5 text-[#98e209] mr-2" />
                      Billing Address (Optional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 p-6">
                    <p className="text-sm text-gray-600 mb-2">Payment will be processed via Stripe after owner confirmation</p>
                    <div>
                      <Label htmlFor="address" className="mb-2 block">Street Address</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div>
                        <Label htmlFor="city" className="mb-2 block">City</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="state" className="mb-2 block">State</Label>
                        <Select value={formData.state} onValueChange={(value) => handleInputChange('state', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sindh">Sindh</SelectItem>
                            <SelectItem value="punjab">Punjab</SelectItem>
                            <SelectItem value="balochistan">Balochistan</SelectItem>
                            <SelectItem value="kpk">Khyber Pakhtunkhwa</SelectItem>
                            <SelectItem value="gb">Gilgit-Baltistan</SelectItem>
                            <SelectItem value="ict">Islamabad Capital Territory</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="zipCode" className="mb-2 block">ZIP Code</Label>
                        <Input
                          id="zipCode"
                          value={formData.zipCode}
                          onChange={(e) => handleInputChange('zipCode', e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Terms */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="terms"
                        checked={formData.terms}
                        onCheckedChange={(checked) => handleInputChange('terms', checked as boolean)}
                        required
                      />
                      <label htmlFor="terms" className="text-sm text-gray-600">
                        I agree to the{' '}
                        <button className="text-[#98e209] hover:underline">Terms & Conditions</button>
                        {' '}and{' '}
                        <button className="text-[#98e209] hover:underline">Privacy Policy</button>
                      </label>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6">
              <Button
                onClick={() => step === 1 ? navigate('/cart') : setStep(step - 1)}
                variant="outline"
                disabled={isProcessing}
              >
                {step === 1 ? (directBooking ? 'Back' : 'Back to Cart') : 'Previous'}
              </Button>
              <LoadingButton
                onClick={handleNextStep}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 bg-[#98e209] text-[#010101] hover:bg-[#89cb08]"
                isLoading={isProcessing}
                disabled={isProcessing}
              >
                {'Complete Booking'}
              </LoadingButton>
            </div>
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {/* Cart Items */}
                <div className="space-y-3">
                  {displayItems.map((item) => (
                    <div key={item.id} className="flex items-start space-x-3 pb-3 border-b border-gray-100 last:border-b-0">
                      <ImageWithFallback
                        src={item.image}
                        alt={item.court}
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-[#010101] truncate">{item.court}</h4>
                        {item.sport && <Badge className="text-xs mt-1">{item.sport}</Badge>}
                        <div className="flex items-center space-x-2 text-xs text-gray-600 mt-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(item.date)}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-gray-600">
                          <Clock className="h-3 w-3" />
                          <span>{item.time} ({item.duration}hr{item.duration > 1 ? 's' : ''})</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">Rs {(item.price).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pricing */}
                <div className="space-y-2 text-sm border-t pt-4">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>Rs {displaySubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax (8%)</span>
                    <span>Rs {displayTax.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span className="text-[#98e209]">Rs {displayTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Security Note */}
                <div className="flex items-center space-x-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <Lock className="h-4 w-4 text-green-600" />
                  <span>Your payment information is secure and encrypted</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}