import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar as CalendarIcon, Clock, MapPin, DollarSign } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import bookingService from '../../services/bookingService';
import venueService from '../../services/venueService';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface CalendarBooking {
  id: string;
  customerName: string;
  bookingDate: string;
  timeSlot: { start?: string; end?: string };
  status: string;
  totalPrice: number;
}

export function VenueCalendarPage() {
  const MIN_START_MINUTES = 6 * 60;   // 6:00 AM
  const MAX_END_MINUTES = 22 * 60;    // 10:00 PM

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loadingVenue, setLoadingVenue] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [venue, setVenue] = useState<any>(null);
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<any[]>([]);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [startHour, setStartHour] = useState('09');
  const [startMinute, setStartMinute] = useState('00');
  const [startPeriod, setStartPeriod] = useState<'AM' | 'PM'>('AM');
  const [endHour, setEndHour] = useState('10');
  const [endMinute, setEndMinute] = useState('00');
  const [endPeriod, setEndPeriod] = useState<'AM' | 'PM'>('PM');

  useEffect(() => {
    const loadVenue = async () => {
      try {
        setLoadingVenue(true);
        const res = await venueService.getVenueById(id as string);
        const v = res?.data?.venue || res?.venue || res?.data;
        setVenue(v);
        if (v?.availability) {
          setAvailability(
            v.availability.map((a: any) => ({
              day: a.day,
              enabled: a.enabled,
              start: a.startTime,
              end: a.endTime,
            }))
          );
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load venue');
      } finally {
        setLoadingVenue(false);
      }
    };

    const loadBookings = async () => {
      try {
        setLoadingBookings(true);
        const res = await bookingService.getVenueBookings(id as string, { limit: 100 });
        const rows = res?.data?.bookings || res?.bookings || [];
        const mapped: CalendarBooking[] = rows.map((b: any) => ({
          id: b._id || b.id,
          customerName: (() => {
            const candidate =
              b.user?.name ||
              b.user?.fullName ||
              b.customerName ||
              b.userName ||
              (typeof b.user === 'string' ? b.user : undefined);
            if (typeof candidate === 'string') return candidate;
            return 'Customer';
          })(),
          bookingDate: b.bookingDate,
          timeSlot: b.timeSlot || {},
          status: b.status,
          totalPrice: Number(b.totalPrice || 0),
        }));
        setBookings(mapped);
      } catch (e: any) {
        setError(e?.message || 'Failed to load bookings');
      } finally {
        setLoadingBookings(false);
      }
    };

    if (id) {
      loadVenue();
      loadBookings();
    }
  }, [id]);

  const { upcomingBookings, pastBookings } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcoming: Record<string, CalendarBooking[]> = {};
    const past: Record<string, CalendarBooking[]> = {};
    
    bookings.forEach(b => {
      if (!b.bookingDate) return;
      const key = b.bookingDate.split('T')[0];
      const bookingDate = new Date(key);
      bookingDate.setHours(0, 0, 0, 0);
      
      // Only show confirmed bookings in upcoming, past bookings can have any status
      if (bookingDate >= today && b.status === 'confirmed') {
        if (!upcoming[key]) upcoming[key] = [];
        upcoming[key].push(b);
      } else if (bookingDate < today) {
        if (!past[key]) past[key] = [];
        past[key].push(b);
      }
    });
    
    return {
      upcomingBookings: Object.entries(upcoming).sort((a, b) => (a[0] < b[0] ? -1 : 1)),
      pastBookings: Object.entries(past).sort((a, b) => (a[0] > b[0] ? -1 : 1)), // Most recent first
    };
  }, [bookings]);

  const formatTime = (t?: string) => {
    if (!t) return '—';
    const [h, m] = t.split(':').map(Number);
    const hour12 = h % 12 || 12;
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${hour12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
  };

  const to12HourParts = (t?: string) => {
    const [h = '0', m = '0'] = (t || '09:00').split(':');
    const hour24 = Math.max(0, Math.min(23, Number(h) || 0));
    const minute = String(Math.max(0, Math.min(59, Number(m) || 0))).padStart(2, '0');
    const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;
    return {
      hour: String(hour12).padStart(2, '0'),
      minute,
      period,
    };
  };

  const to24Hour = (hour12: string, minute: string, period: 'AM' | 'PM') => {
    let hour = Number(hour12);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  };

  const toMinutes = (time24: string) => {
    const [h, m] = time24.split(':').map(Number);
    return (h * 60) + m;
  };

  const mapUiAvailabilityToApi = (rows: any[]) => {
    return rows.map((slot: any) => ({
      day: slot.day,
      enabled: Boolean(slot.enabled),
      startTime: slot.start,
      endTime: slot.end,
    }));
  };

  const saveAvailability = async (nextAvailability: any[], successMessage: string) => {
    if (!id) return;
    const previousAvailability = availability;
    setAvailability(nextAvailability);
    setSavingAvailability(true);

    try {
      const res = await venueService.updateVenue(id, {
        availability: mapUiAvailabilityToApi(nextAvailability),
      });

      const updatedVenue = res?.data?.venue || res?.venue || res?.data;
      if (updatedVenue?.availability) {
        setAvailability(
          updatedVenue.availability.map((a: any) => ({
            day: a.day,
            enabled: a.enabled,
            start: a.startTime,
            end: a.endTime,
          }))
        );
      }

      toast.success(successMessage);
    } catch (e: any) {
      setAvailability(previousAvailability);
      toast.error(e?.response?.data?.message || e?.message || 'Failed to save availability');
    } finally {
      setSavingAvailability(false);
    }
  };

  const handleCloseDay = (day: string) => {
    const nextAvailability = availability.map(slot => (slot.day === day ? { ...slot, enabled: false } : slot));
    void saveAvailability(nextAvailability, `${day} blocked successfully`);
  };

  const handleOpenDay = (day: string) => {
    const nextAvailability = availability.map(slot => (slot.day === day ? { ...slot, enabled: true } : slot));
    void saveAvailability(nextAvailability, `${day} opened successfully`);
  };

  const handleSetHours = (day: string) => {
    const current = availability.find(s => s.day === day);
    const startParts = to12HourParts(current?.start || '09:00');
    const endParts = to12HourParts(current?.end || '22:00');

    setEditingDay(day);
    setStartHour(startParts.hour);
    setStartMinute(startParts.minute);
    setStartPeriod(startParts.period);
    setEndHour(endParts.hour);
    setEndMinute(endParts.minute);
    setEndPeriod(endParts.period);
  };

  const handleConfirmSetHours = () => {
    if (!editingDay) return;

    const start = to24Hour(startHour, startMinute, startPeriod);
    const end = to24Hour(endHour, endMinute, endPeriod);
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);

    if (startMinutes < MIN_START_MINUTES) {
      toast.error('Start time cannot be earlier than 6:00 AM.');
      return;
    }

    if (endMinutes > MAX_END_MINUTES) {
      toast.error('End time cannot be later than 10:00 PM.');
      return;
    }

    if (start >= end) {
      toast.error('End time must be later than start time.');
      return;
    }

    const nextAvailability = availability.map(slot => (
      slot.day === editingDay ? { ...slot, start, end, enabled: true } : slot
    ));

    const dayLabel = editingDay;
    setEditingDay(null);
    void saveAvailability(nextAvailability, `${dayLabel} hours updated successfully`);
  };

  const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  const getStartHourOptions = () => {
    if (startPeriod === 'AM') return ['06', '07', '08', '09', '10', '11'];
    return ['12', '01', '02', '03', '04', '05', '06', '07', '08', '09'];
  };

  const getEndHourOptions = () => {
    if (endPeriod === 'AM') return ['06', '07', '08', '09', '10', '11'];
    return ['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
  };

  const endMinuteOptions = endPeriod === 'PM' && endHour === '10' ? ['00'] : minuteOptions;

  const startHourOptions = getStartHourOptions();
  const endHourOptions = getEndHourOptions();

  useEffect(() => {
    if (!startHourOptions.includes(startHour)) {
      setStartHour(startHourOptions[0]);
    }
  }, [startPeriod, startHour, startHourOptions]);

  useEffect(() => {
    if (!endHourOptions.includes(endHour)) {
      setEndHour(endHourOptions[endHourOptions.length - 1]);
    }
  }, [endPeriod, endHour, endHourOptions]);

  useEffect(() => {
    if (!endMinuteOptions.includes(endMinute)) {
      setEndMinute(endMinuteOptions[0]);
    }
  }, [endHour, endPeriod, endMinute, endMinuteOptions]);

  return (
    <div className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <span>/</span>
          <span>Manage Calendar</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase text-gray-500">Venue</p>
            <h1 className="text-2xl font-bold text-[#010101]">{venue?.title || '—'}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mt-2">
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {venue?.location || 'N/A'}</span>
              <span className="flex items-center gap-1">{venue?.hourlyPrice ? `Rs ${venue.hourlyPrice}/hr` : '—'}</span>
              {venue?.sport && <Badge variant="secondary">{venue.sport}</Badge>}
              {venue?.status && <Badge>{venue.status}</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CalendarIcon className="h-5 w-5 text-[#98e209]" />
            <span>Manage availability & bookings</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Bookings */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Bookings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingBookings && <Skeleton className="h-24 w-full" />}
                {!loadingBookings && upcomingBookings.length === 0 && (
                  <p className="text-sm text-gray-600 mb-1">No upcoming bookings.</p>
                )}
                {!loadingBookings && upcomingBookings.map(([date, items]) => (
                  <div key={date} className="border rounded-lg p-4 space-y-3 mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700 font-semibold">
                      <CalendarIcon className="h-4 w-4 text-[#98e209]" />
                      <span>{format(new Date(date), 'EEE, MMM d, yyyy')}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map(b => (
                        <div key={b.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border rounded-md p-3 bg-white">
                          <div className="space-y-1">
                            <p className="font-medium text-[#010101]">{b.customerName}</p>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="h-4 w-4" />
                              <span>{formatTime(b.timeSlot.start)} - {formatTime(b.timeSlot.end)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-sm mt-2 sm:mt-0">
                            <Badge variant="secondary" className="capitalize">{b.status}</Badge>
                            <span className="font-semibold text-[#010101]">${b.totalPrice.toFixed(0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {error && <p className="text-sm text-red-600">{error}</p>}
              </CardContent>
            </Card>

            {/* Past Bookings */}
            <Card>
              <CardHeader>
                <CardTitle>Past Bookings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingBookings && <Skeleton className="h-24 w-full" />}
                {!loadingBookings && pastBookings.length === 0 && (
                  <p className="text-sm text-gray-600">No past bookings.</p>
                )}
                {!loadingBookings && pastBookings.map(([date, items]) => (
                  <div key={date} className="border rounded-lg p-4 space-y-3 bg-gray-50 mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600 font-semibold">
                      <CalendarIcon className="h-4 w-4 text-gray-400" />
                      <span>{format(new Date(date), 'EEE, MMM d, yyyy')}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map(b => (
                        <div key={b.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border rounded-md p-3 bg-white opacity-75">
                          <div className="space-y-1">
                            <p className="font-medium text-gray-700">{b.customerName}</p>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Clock className="h-4 w-4" />
                              <span>{formatTime(b.timeSlot.start)} - {formatTime(b.timeSlot.end)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-sm mt-2 sm:mt-0">
                            <Badge variant="outline" className="capitalize">{b.status}</Badge>
                            <span className="font-semibold text-gray-700">${b.totalPrice.toFixed(0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Weekly Availability - Sticky Sidebar */}
          <Card className="lg:col-span-1 h-fit lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle>Weekly Availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingVenue && <Skeleton className="h-40 w-full" />}
              {!loadingVenue && availability.length === 0 && (
                <p className="text-sm text-gray-600">No availability configured yet.</p>
              )}
              {!loadingVenue && availability.map((slot: any) => (
                <div key={slot.day} className="flex flex-col gap-2 border rounded-md px-3 py-2 bg-white mb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[#010101]">{slot.day}</p>
                      <p className="text-xs text-gray-600">{slot.enabled ? `${formatTime(slot.start)} - ${formatTime(slot.end)}` : 'Unavailable'}</p>
                    </div>
                    <Badge variant={slot.enabled ? 'default' : 'secondary'}>
                      {slot.enabled ? 'Open' : 'Closed'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Button className="p-2" variant="outline" size="sm" disabled={savingAvailability} onClick={() => handleSetHours(slot.day)}>
                      Set hours
                    </Button>
                    {slot.enabled ? (
                      <Button className="p-2" variant="outline" size="sm" disabled={savingAvailability} onClick={() => handleCloseDay(slot.day)}>
                        Block day
                      </Button>
                    ) : (
                      <Button className="p-2" variant="outline" size="sm" disabled={savingAvailability} onClick={() => handleOpenDay(slot.day)}>
                        Open day
                      </Button>
                    )}
                  </div>

                  {editingDay === slot.day && (
                    <div className="border rounded-md p-3 bg-gray-50 space-y-3">
                      <div>
                        <p className="text-xs font-medium text-[#010101] mb-2">Start Time</p>
                        <div className="grid grid-cols-3 gap-2">
                          <Select value={startHour} onValueChange={setStartHour}>
                            <SelectTrigger><SelectValue placeholder="Hour" /></SelectTrigger>
                            <SelectContent>
                              {startHourOptions.map((h) => (
                                <SelectItem key={`start-hour-${slot.day}-${h}`} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={startMinute} onValueChange={setStartMinute}>
                            <SelectTrigger><SelectValue placeholder="Minute" /></SelectTrigger>
                            <SelectContent>
                              {minuteOptions.map((m) => (
                                <SelectItem key={`start-minute-${slot.day}-${m}`} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={startPeriod} onValueChange={(v) => setStartPeriod(v as 'AM' | 'PM')}>
                            <SelectTrigger><SelectValue placeholder="AM/PM" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AM">AM</SelectItem>
                              <SelectItem value="PM">PM</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-[#010101] mb-2">End Time</p>
                        <div className="grid grid-cols-3 gap-2">
                          <Select value={endHour} onValueChange={setEndHour}>
                            <SelectTrigger><SelectValue placeholder="Hour" /></SelectTrigger>
                            <SelectContent>
                              {endHourOptions.map((h) => (
                                <SelectItem key={`end-hour-${slot.day}-${h}`} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={endMinute} onValueChange={setEndMinute}>
                            <SelectTrigger><SelectValue placeholder="Minute" /></SelectTrigger>
                            <SelectContent>
                              {endMinuteOptions.map((m) => (
                                <SelectItem key={`end-minute-${slot.day}-${m}`} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={endPeriod} onValueChange={(v) => setEndPeriod(v as 'AM' | 'PM')}>
                            <SelectTrigger><SelectValue placeholder="AM/PM" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AM">AM</SelectItem>
                              <SelectItem value="PM">PM</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => setEditingDay(null)}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleConfirmSetHours} disabled={savingAvailability}>
                          Save Hours
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default VenueCalendarPage;
