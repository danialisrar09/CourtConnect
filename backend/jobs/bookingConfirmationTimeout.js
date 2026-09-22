const cron = require('node-cron');
const Booking = require('../models/Booking');
const User = require('../models/User');
const emailService = require('../utils/emailService');

// Reduce noisy cron output: log per pending booking at most once every 30 minutes.
const DEADLINE_LOG_INTERVAL_MS = 30 * 60 * 1000;
const deadlineLogTracker = new Map();

const shouldLogDeadline = (bookingId) => {
  const key = String(bookingId);
  const now = Date.now();
  const last = deadlineLogTracker.get(key) || 0;
  if (now - last >= DEADLINE_LOG_INTERVAL_MS) {
    deadlineLogTracker.set(key, now);
    return true;
  }
  return false;
};

const formatOwnerName = (booking) => {
  const owner = booking?.venue?.owner;
  if (!owner) return 'Unknown Owner';
  if (owner.name && String(owner.name).trim()) return String(owner.name).trim();
  const first = String(owner.firstName || '').trim();
  const last = String(owner.lastName || '').trim();
  const full = `${first} ${last}`.trim();
  return full || 'Unknown Owner';
};

/**
 * Automatic Booking Jobs
 * 
 * Job 1: Cancel pending bookings where owner missed confirmation deadline
 * Job 2: Cancel confirmed+unpaid bookings 30 min before play (with reminder at ~45 min)
 * Job 3: Auto-complete confirmed+paid bookings once play time ends
 */

/**
 * Calculate the confirmation deadline for a booking based on advance booking time
 * 
 * Rules:
 * - For 2-5 hours advance: Owner has 1.5 hours from creation to confirm
 * - For >5 hours advance: Owner must confirm at least 3 hours before play time
 * 
 * @param {Date} createdAt - When booking was created
 * @param {Date} bookingDate - When the court is booked for
 * @param {String} startTime - Start time in HH:MM format
 * @returns {{deadline: Date | null, advanceHours: number, deadlineType: 'advance' | 'long_advance' | null}}
 */
const calculateConfirmationDeadline = (createdAt, bookingDate, startTime) => {
  try {
    // Create booking play time
    const [hours, minutes] = startTime.split(':').map(Number);
    const playTime = new Date(bookingDate);
    playTime.setHours(hours, minutes, 0, 0);

    // Calculate advance time in hours
    const advanceTimeMs = playTime.getTime() - createdAt.getTime();
    const advanceHours = advanceTimeMs / (1000 * 60 * 60);

    let deadline = null;
    let deadlineType = null;

    if (advanceHours >= 2 && advanceHours <= 5) {
      // For 2-5 hour advance: Owner has 1.5 hours from booking creation
      deadline = new Date(createdAt.getTime() + 1.5 * 60 * 60 * 1000);
      deadlineType = 'advance';
    } else if (advanceHours > 5) {
      // For >5 hour advance: Owner must confirm 3 hours before play time
      deadline = new Date(playTime.getTime() - 3 * 60 * 60 * 1000);
      deadlineType = 'long_advance';
    } else {
      // For bookings < 2 hours advance: No auto-cancel (too close to play time)
      deadline = null;
    }

    return { deadline, advanceHours, deadlineType };
  } catch (error) {
    console.error('[DEADLINE_ERROR] Error calculating deadline:', error.message);
    return { deadline: null, advanceHours: 0, deadlineType: null };
  }
};

/**
 * Cancel pending bookings that exceed their confirmation deadline without owner confirmation
 */
const checkAndCancelUnconfirmedBookings = async () => {
  try {
    const now = new Date();

    // Find all pending bookings
    const allPendingBookings = await Booking.find({
      status: 'pending'
    })
      .populate('user', 'email firstName lastName')
      .populate({
        path: 'venue',
        select: 'title sport owner',
        populate: { path: 'owner', select: 'name firstName lastName' }
      })
      .lean();

    if (allPendingBookings.length === 0) {
      return; // No bookings to process
    }

    const bookingsToCancel = [];

    // Check each booking against its specific deadline
    for (const booking of allPendingBookings) {
      // Case 1: Play time is fully in the past — should have never stayed pending
      const [endH, endM] = (booking.timeSlot?.end || '00:00').split(':').map(Number);
      const playEndTime = new Date(booking.bookingDate);
      playEndTime.setHours(endH, endM, 0, 0);
      if (now.getTime() > playEndTime.getTime()) {
        bookingsToCancel.push({
          ...booking,
          deadline: playEndTime,
          _pastPlayDeadline: true
        });
        continue;
      }

      // Case 2: Confirmation deadline passed based on advance booking rules
      const { deadline, advanceHours, deadlineType } = calculateConfirmationDeadline(
        new Date(booking.createdAt),
        new Date(booking.bookingDate),
        booking.timeSlot?.start || '00:00'
      );

      if (deadline && shouldLogDeadline(booking._id)) {
        const kind = deadlineType === 'long_advance' ? 'Long advance booking' : 'Advance booking';
        const ownerName = formatOwnerName(booking);
        console.log(
          `[DEADLINE] ${kind} (${advanceHours.toFixed(1)}h): ` +
          `Booking=${booking._id} | Venue="${booking?.venue?.title || 'Unknown Venue'}" | ` +
          `Owner="${ownerName}" | Deadline=${deadline.toLocaleString()}`
        );
      }

      // If deadline exists and current time has passed it, mark for cancellation
      if (deadline && now.getTime() > deadline.getTime()) {
        bookingsToCancel.push({
          ...booking,
          deadline
        });
      }
    }

    if (bookingsToCancel.length === 0) {
      return; // No bookings exceeded their deadline
    }

    console.log(`[BOOKING_TIMEOUT] Found ${bookingsToCancel.length} booking(s) that exceeded confirmation deadline`);

    for (const booking of bookingsToCancel) {
      try {
        const deadline = booking.deadline;
        const advanceTimeMs = new Date(booking.bookingDate).getTime() - new Date(booking.createdAt).getTime();
        const advanceHours = advanceTimeMs / (1000 * 60 * 60);

        let cancellationReason;
        if (booking._pastPlayDeadline) {
          cancellationReason = 'Booking cancelled: Owner did not confirm before the scheduled play time';
        } else if (advanceHours >= 2 && advanceHours <= 5) {
          cancellationReason = `Booking cancelled: Owner did not confirm within 1.5 hours of booking`;
        } else if (advanceHours > 5) {
          cancellationReason = `Booking cancelled: Owner did not confirm at least 3 hours before play time`;
        } else {
          cancellationReason = `Booking cancelled: Owner confirmation deadline exceeded`;
        }

        // Update booking status to cancelled
        const cancelled = await Booking.findByIdAndUpdate(
          booking._id,
          {
            status: 'cancelled',
            cancellationReason,
            cancelledAt: new Date(),
            // If payment was made, mark as refunded
            ...(booking.paymentStatus === 'paid' && { paymentStatus: 'refunded' })
          },
          { new: true }
        )
          .populate('venue', 'title sport location')
          .exec();

        // Send email notification to customer
        if (booking.user && booking.user.email) {
          await sendCancellationEmail({
            customerEmail: booking.user.email,
            customerName: `${booking.user.firstName} ${booking.user.lastName}`,
            venueName: booking.venue.title,
            venueSport: booking.venue.sport,
            bookingDate: new Date(booking.bookingDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }),
            bookingTime: booking.timeSlot?.start || 'N/A',
            bookingId: booking._id.toString(),
            totalPrice: booking.totalPrice,
            wasPaymentMade: booking.paymentStatus === 'paid',
            cancellationReason
          });
        }

        console.log(`[BOOKING_TIMEOUT] Cancelled booking ${booking._id} - Deadline: ${deadline.toLocaleString()}`);
      } catch (error) {
        console.error(`[BOOKING_TIMEOUT_ERROR] Failed to process booking ${booking._id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('[BOOKING_TIMEOUT_ERROR] Error checking unconfirmed bookings:', error.message);
  }
};

/**
 * Send cancellation notification email to customer
 */
const sendCancellationEmail = async ({
  customerEmail,
  customerName,
  venueName,
  venueSport,
  bookingDate,
  bookingTime,
  bookingId,
  totalPrice,
  wasPaymentMade,
  cancellationReason
}) => {
  try {
    const refundMessage = wasPaymentMade
      ? '<p style="color: #d9534f; font-weight: 600;">Your deposit payment will be refunded within 3-5 business days.</p>'
      : '';

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f9f9f9;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #d9534f 0%, #c9302c 100%);
            color: #ffffff;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: bold;
          }
          .content {
            padding: 30px 20px;
          }
          .message-box {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            line-height: 1.8;
            color: #856404;
          }
          .reason-box {
            background-color: #f8d7da;
            border-left: 4px solid #d9534f;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            line-height: 1.8;
            color: #721c24;
          }
          .booking-details {
            background-color: #f9f9f9;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
          }
          .booking-details h3 {
            margin-top: 0;
            color: #010101;
            font-size: 16px;
            font-weight: 600;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #555;
          }
          .detail-value {
            color: #010101;
            text-align: right;
          }
          .footer {
            background-color: #f5f5f5;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #777;
            border-top: 1px solid #e0e0e0;
          }
          .footer a {
            color: #98e209;
            text-decoration: none;
          }
          .btn {
            display: inline-block;
            padding: 12px 30px;
            background-color: #98e209;
            color: #010101;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 600;
            margin-top: 20px;
            transition: background-color 0.3s;
          }
          .btn:hover {
            background-color: #89cb08;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Booking Cancelled</h1>
            <p>Your court booking request has been automatically cancelled</p>
          </div>
          
          <div class="content">
            <p>Hi <strong>${customerName}</strong>,</p>
            
            <div class="message-box">
              <p><strong>Your booking has been automatically cancelled</strong> because the court owner did not confirm it within the required timeframe.</p>
            </div>

            <div class="reason-box">
              <p><strong>Reason:</strong> ${cancellationReason}</p>
            </div>

            <div class="booking-details">
              <h3>Booking Details</h3>
              <div class="detail-row">
                <span class="detail-label">Court</span>
                <span class="detail-value">${venueName} (${venueSport})</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date</span>
                <span class="detail-value">${bookingDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time</span>
                <span class="detail-value">${bookingTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Amount</span>
                <span class="detail-value">PKR ${totalPrice}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Booking ID</span>
                <span class="detail-value">${bookingId}</span>
              </div>
            </div>

            ${refundMessage}

            <p><strong>What happens next?</strong></p>
            <ul>
              <li>Your booking is no longer active</li>
              <li>The time slot is now available for other customers to book</li>
              <li>You can book another time slot immediately if needed</li>
            </ul>

            <p>We recommend booking with another court that might be more responsive, or contacting the venue owner to understand why they couldn't confirm your booking within the required timeframe.</p>

            <center>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/discover" class="btn">Browse Other Courts</a>
            </center>

            <p>If you have any questions, please contact our support team.</p>
          </div>

          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} SportSlot Booking System. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await emailService.sendEmail({
      to: customerEmail,
      subject: `⚠️ Your Booking at ${venueName} Has Been Cancelled`,
      html
    });
  } catch (error) {
    console.error('[EMAIL_ERROR] Failed to send cancellation email:', error.message);
  }
};

/**
 * Check confirmed bookings where customer hasn't paid the 50% deposit.
 * Payment deadline = 45 minutes before play time.
 * Also sends a reminder email when exactly 1 hour remains.
 */
const checkAndCancelUnpaidBookings = async () => {
  try {
    const now = new Date();

    // Find confirmed bookings where payment is still pending or failed
    const confirmedUnpaid = await Booking.find({
      status: 'confirmed',
      paymentStatus: { $in: ['pending', 'failed'] }
    })
      .populate('user', 'email firstName lastName')
      .populate('venue', 'title sport')
      .lean();

    if (confirmedUnpaid.length === 0) return;

    for (const booking of confirmedUnpaid) {
      try {
        const [hours, minutes] = (booking.timeSlot?.start || '00:00').split(':').map(Number);
        const playTime = new Date(booking.bookingDate);
        playTime.setHours(hours, minutes, 0, 0);

        // Payment deadline: 30 minutes before play time
        const paymentDeadline = new Date(playTime.getTime() - 30 * 60 * 1000);
        // Reminder window: between 55 and 45 minutes before play time (gives ~15-25 min to pay after reminder)
        const reminderStart = new Date(playTime.getTime() - 55 * 60 * 1000);
        const reminderEnd   = new Date(playTime.getTime() - 45 * 60 * 1000);

        // Send payment reminder email once when ~1 hour remains
        if (now >= reminderStart && now <= reminderEnd && !booking.paymentReminderSentAt) {
          // Mark reminder as sent before emailing to avoid duplicates on next tick
          await Booking.findByIdAndUpdate(booking._id, { paymentReminderSentAt: now });

          if (booking.user?.email) {
            await sendPaymentReminderEmail({
              customerEmail: booking.user.email,
              customerName: `${booking.user.firstName} ${booking.user.lastName}`,
              venueName: booking.venue.title,
              venueSport: booking.venue.sport,
              bookingDate: new Date(booking.bookingDate).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              }),
              bookingTime: booking.timeSlot?.start || 'N/A',
              bookingId: booking._id.toString(),
              depositAmount: (booking.totalPrice * 0.5).toFixed(2),
              paymentDeadline: paymentDeadline.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            });
            console.log(`[PAYMENT_REMINDER] Sent reminder for booking ${booking._id}`);
          }
        }

        // Auto-cancel if payment deadline has passed
        if (now.getTime() > paymentDeadline.getTime()) {
          await Booking.findByIdAndUpdate(
            booking._id,
            {
              status: 'cancelled',
              cancellationReason: 'Booking cancelled: Customer did not complete 50% deposit payment at least 30 minutes before play time',
              cancelledAt: now
            }
          );

          if (booking.user?.email) {
            await sendCancellationEmail({
              customerEmail: booking.user.email,
              customerName: `${booking.user.firstName} ${booking.user.lastName}`,
              venueName: booking.venue.title,
              venueSport: booking.venue.sport,
              bookingDate: new Date(booking.bookingDate).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              }),
              bookingTime: booking.timeSlot?.start || 'N/A',
              bookingId: booking._id.toString(),
              totalPrice: booking.totalPrice,
              wasPaymentMade: false,
              cancellationReason: 'You did not complete the 50% deposit payment at least 30 minutes before your scheduled play time.'
            });
          }

          console.log(`[PAYMENT_TIMEOUT] Cancelled unpaid booking ${booking._id} - play time: ${playTime.toLocaleString()}`);
        }
      } catch (error) {
        console.error(`[PAYMENT_TIMEOUT_ERROR] Failed to process booking ${booking._id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('[PAYMENT_TIMEOUT_ERROR] Error checking unpaid bookings:', error.message);
  }
};

/**
 * Send a payment reminder email to customer ~1 hour before deadline
 */
const sendPaymentReminderEmail = async ({
  customerEmail,
  customerName,
  venueName,
  venueSport,
  bookingDate,
  bookingTime,
  bookingId,
  depositAmount,
  paymentDeadline
}) => {
  try {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #f0ad4e 0%, #ec971f 100%); color: #fff; padding: 30px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 26px; }
          .content { padding: 30px 20px; }
          .alert-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; color: #856404; }
          .booking-details { background-color: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 20px; margin: 20px 0; }
          .booking-details h3 { margin-top: 0; color: #010101; font-size: 16px; font-weight: 600; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { font-weight: 600; color: #555; }
          .detail-value { color: #010101; text-align: right; }
          .highlight { color: #d9534f; font-weight: bold; font-size: 18px; }
          .footer { background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #e0e0e0; }
          .btn { display: inline-block; padding: 12px 30px; background-color: #98e209; color: #010101; text-decoration: none; border-radius: 4px; font-weight: 600; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Payment Reminder</h1>
            <p>Action required – complete your deposit payment</p>
          </div>
          <div class="content">
            <p>Hi <strong>${customerName}</strong>,</p>
            <div class="alert-box">
              <p><strong>Your booking at ${venueName} is confirmed!</strong> You must complete your 50% deposit payment by <span class="highlight">${paymentDeadline}</span> (45 minutes before play time), or your booking will be automatically cancelled.</p>
            </div>
            <div class="booking-details">
              <h3>Booking Details</h3>
              <div class="detail-row">
                <span class="detail-label">Court</span>
                <span class="detail-value">${venueName} (${venueSport})</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date</span>
                <span class="detail-value">${bookingDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time</span>
                <span class="detail-value">${bookingTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Deposit Due</span>
                <span class="detail-value" style="color:#d9534f; font-weight:bold;">PKR ${depositAmount}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Pay Before</span>
                <span class="detail-value" style="color:#d9534f; font-weight:bold;">${paymentDeadline}</span>
              </div>
            </div>
            <center>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-bookings" class="btn">Pay Now →</a>
            </center>
            <p style="margin-top:20px;">If you no longer need this booking, you can cancel it from your dashboard before the deadline.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} SportSlot Booking System. All rights reserved.</p>
            <p>This is an automated reminder. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await emailService.sendEmail({
      to: customerEmail,
      subject: `⏰ Payment Reminder: Complete your deposit for ${venueName} by ${paymentDeadline}`,
      html
    });
  } catch (error) {
    console.error('[EMAIL_ERROR] Failed to send payment reminder email:', error.message);
  }
};

/**
 * Start the booking confirmation timeout job
 */
/**
 * Auto-complete confirmed+paid bookings once their play time has fully ended.
 */
const checkAndCompleteFinishedBookings = async () => {
  try {
    const now = new Date();

    // Find confirmed bookings that have been paid
    const confirmedPaid = await Booking.find({
      status: 'confirmed',
      paymentStatus: 'paid'
    }).lean();

    for (const booking of confirmedPaid) {
      try {
        const [endH, endM] = (booking.timeSlot?.end || '00:00').split(':').map(Number);
        const playEndTime = new Date(booking.bookingDate);
        playEndTime.setHours(endH, endM, 0, 0);

        // If play time has ended, mark as completed
        if (now.getTime() > playEndTime.getTime()) {
          await Booking.findByIdAndUpdate(booking._id, { status: 'completed' });
          console.log(`[AUTO_COMPLETE] Marked booking ${booking._id} as completed (play ended at ${playEndTime.toLocaleString()})`);
        }
      } catch (error) {
        console.error(`[AUTO_COMPLETE_ERROR] Failed to complete booking ${booking._id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('[AUTO_COMPLETE_ERROR] Error checking finished bookings:', error.message);
  }
};

const startBookingConfirmationTimeoutJob = () => {
  // Job 1: Cancel pending bookings where owner missed confirmation deadline
  cron.schedule('* * * * *', checkAndCancelUnconfirmedBookings);

  // Job 2: Cancel confirmed bookings where customer missed payment deadline (30 min before play)
  //         Also sends payment reminder email ~10-20 min before deadline
  cron.schedule('* * * * *', checkAndCancelUnpaidBookings);

  // Job 3: Auto-complete confirmed+paid bookings once play time has ended
  cron.schedule('* * * * *', checkAndCompleteFinishedBookings);

  console.log('[CRON_JOB] All booking jobs started (owner confirmation + payment deadline + auto-complete)');
  console.log('[CRON_JOB] Checking every minute');
};

module.exports = {
  startBookingConfirmationTimeoutJob,
  checkAndCancelUnconfirmedBookings,
  checkAndCancelUnpaidBookings,
  checkAndCompleteFinishedBookings
};
