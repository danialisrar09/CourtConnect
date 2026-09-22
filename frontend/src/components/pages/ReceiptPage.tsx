import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Check } from 'lucide-react';

export function ReceiptPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as {
    bookingIds?: string[];
    total?: number;
    items?: Array<{ court: string; date: string; time: string; duration: number; price: number }>;
    paymentDeferred?: boolean;
  };

  const bookingIds = state.bookingIds || [];
  const total = typeof state.total === 'number' ? state.total : 0;
  const items = state.items || [];
  const paymentDeferred = Boolean(state.paymentDeferred);

  return (
    <div className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="text-center">
          <CardHeader>
            <CardTitle>Booking Receipt</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-gray-600 mb-2">Your booking request has been submitted successfully.</p>
            {paymentDeferred && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-6">
                Owner confirmation is required first. Once confirmed, you can pay the 50% deposit from your dashboard.
              </p>
            )}

            <div className="text-left space-y-2 mb-6">
              <p className="text-sm text-gray-700">Booking References:</p>
              <ul className="text-sm text-gray-600 list-disc ml-5">
                {bookingIds.length ? bookingIds.map(id => (
                  <li key={id}>#{id}</li>
                )) : <li>No booking references provided.</li>}
              </ul>
            </div>

            <div className="text-left space-y-2 mb-6">
              <p className="text-sm text-gray-700">Items:</p>
              <ul className="text-sm text-gray-600 list-disc ml-5">
                {items.length ? items.map((it, idx) => (
                  <li key={idx}>{it.court} — {new Date(it.date).toLocaleDateString()} at {it.time} ({it.duration}h) — ${it.price.toFixed(2)}</li>
                )) : <li>No items provided.</li>}
              </ul>
            </div>

            <div className="mb-8">
              <p className="font-bold">Booking Total: <span className="text-[#98e209]">${total.toFixed(2)}</span></p>
            </div>

            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate('/dashboard/customer')} className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08]">View My Bookings</Button>
              <Button onClick={() => navigate('/')} variant="outline">Back to Home</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
