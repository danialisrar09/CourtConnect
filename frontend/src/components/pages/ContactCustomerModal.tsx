import React, { useEffect, useMemo, useState } from 'react';
// Plain modal implementation (no Radix), following ChangePasswordDialog pattern
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { toast } from 'sonner@2.0.3';
import bookingService from '../../services/bookingService';

type BookingLite = {
  id: string;
  customerName: string;
  court: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. 02:00 PM - 03:00 PM
  price: number;
  status: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingLite | null;
  businessDisplayName: string;
};

export function ContactCustomerModal({ open, onOpenChange, booking, businessDisplayName }: Props) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Close on Escape key for consistency with other modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    if (open) {
      window.addEventListener('keydown', onKeyDown);
    }
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open && booking) {
      const defaultSubject = `Regarding your booking at ${booking.court}`;
      const defaultMessage = `Hello ${booking.customerName},\n\nWe are reaching out regarding your booking on ${booking.date} at ${booking.time}. Please let us know if you have any questions or need to adjust anything.\n\nBest regards,\n${businessDisplayName}`;
      setSubject(defaultSubject);
      setMessage(defaultMessage);
    }
  }, [open, booking, businessDisplayName]);

  const charsLeft = useMemo(() => 2000 - (message?.length || 0), [message]);

  const canSend = useMemo(() => {
    return !!booking && subject.trim().length >= 4 && message.trim().length >= 10 && !sending;
  }, [booking, subject, message, sending]);

  const subjectError = useMemo(() => {
    if (!subject.trim()) return 'Subject is required';
    if (subject.trim().length < 4) return 'Subject must be at least 4 characters';
    return '';
  }, [subject]);

  const messageError = useMemo(() => {
    if (!message.trim()) return 'Message is required';
    if (message.trim().length < 10) return 'Message must be at least 10 characters';
    return '';
  }, [message]);

  const onSubmit = async () => {
    if (!booking) return;
    if (!canSend) return;
    try {
      setSending(true);
      const res = await bookingService.contactCustomer(booking.id, { subject, message });
      if (res?.success) {
        toast.success('Email sent to customer successfully');
      } else {
        toast.error(res?.error || 'Email service returned an error');
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to contact customer');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex justify-center items-start pt-24 px-4" style={{ zIndex: 9999 }}>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />

      {/* Modal Content */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-auto p-6 z-[10000]">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Contact Customer</h2>
          <p className="text-sm text-gray-600">Send an email regarding this booking</p>
        </div>

        {booking && (
          <div className="rounded-md border p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#010101]">{booking.customerName}</p>
                <p className="text-sm text-gray-600">{booking.court}</p>
              </div>
              <Badge>{booking.status}</Badge>
            </div>
            <div className="mt-2 text-sm text-gray-700">
              <p>Date: {booking.date}</p>
              <p>Time: {booking.time}</p>
              <p>Price: ${booking.price}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} className={subjectError ? 'border-red-500' : ''} />
            {subjectError && <p className="text-xs text-red-600">{subjectError}</p>}
          </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={8} maxLength={2000} className={messageError ? 'border-red-500' : ''} />
              <div className="text-xs text-gray-500 text-right">{charsLeft} characters left</div>
              {messageError && <p className="text-xs text-red-600">{messageError}</p>}
            </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={onSubmit} className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08]" disabled={!canSend}>
            {sending ? 'Sending…' : 'Send Email'}
          </Button>
        </div>
      </div>
    </div>
  );
}
