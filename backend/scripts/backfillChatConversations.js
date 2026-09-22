const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const { Booking, Conversation } = require('../models');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const dryRun = argv.includes('--dry-run') || !apply;

  let limit = null;
  const limitArg = argv.find((arg) => arg.startsWith('--limit='));
  if (limitArg) {
    const parsed = parseInt(limitArg.split('=')[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = parsed;
    }
  }

  return { apply, dryRun, limit };
}

function isoNow() {
  return new Date().toISOString();
}

async function fetchEligibleBookings(limit) {
  let query = Booking.find({
    status: { $in: ['pending', 'confirmed', 'completed'] },
  })
    .select('_id user venue status bookingDate createdAt')
    .populate({ path: 'venue', select: '_id owner title location' })
    .sort({ createdAt: 1, _id: 1 });

  if (limit) {
    query = query.limit(limit);
  }

  return query.lean();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const report = {
    timestamp: isoNow(),
    mode: args.apply ? 'apply' : 'dry-run',
    limit: args.limit,
    totals: {
      scannedBookings: 0,
      createdConversations: 0,
      existingConversations: 0,
      skippedMissingData: 0,
      failed: 0,
    },
    items: [],
  };

  const bookings = await fetchEligibleBookings(args.limit);
  report.totals.scannedBookings = bookings.length;

  console.log('=== Phase 2 Chat Conversation Backfill ===');
  console.log(`Mode                  : ${report.mode}`);
  console.log(`Bookings scanned      : ${bookings.length}${args.limit ? ` (limit=${args.limit})` : ''}`);

  for (const booking of bookings) {
    const bookingId = String(booking._id);
    const customerId = booking.user ? String(booking.user) : '';
    const venueId = booking.venue?._id ? String(booking.venue._id) : '';
    const ownerId = booking.venue?.owner ? String(booking.venue.owner) : '';

    if (!customerId || !venueId || !ownerId) {
      report.totals.skippedMissingData += 1;
      report.items.push({
        bookingId,
        status: 'skipped',
        reason: 'missing customerId, venueId, or ownerId',
      });
      continue;
    }

    if (customerId === ownerId) {
      report.totals.skippedMissingData += 1;
      report.items.push({
        bookingId,
        status: 'skipped',
        reason: 'customer and owner are the same user',
      });
      continue;
    }

    const query = {
      customerId,
      ownerId,
      venueId,
      status: 'active',
    };

    try {
      const existing = await Conversation.findOne(query).select('_id').lean();
      if (existing) {
        report.totals.existingConversations += 1;
        report.items.push({
          bookingId,
          conversationId: String(existing._id),
          status: 'exists',
        });
        continue;
      }

      const payload = {
        customerId,
        ownerId,
        venueId,
        participants: [
          { userId: customerId, role: 'customer' },
          { userId: ownerId, role: 'business' },
        ],
        unreadCounts: {
          [customerId]: 0,
          [ownerId]: 0,
        },
        status: 'active',
      };

      if (args.apply) {
        const created = await Conversation.create(payload);
        report.totals.createdConversations += 1;
        report.items.push({
          bookingId,
          conversationId: String(created._id),
          status: 'created',
        });
      } else {
        report.totals.createdConversations += 1;
        report.items.push({
          bookingId,
          status: 'would-create',
          key: { customerId, ownerId, venueId },
        });
      }
    } catch (error) {
      report.totals.failed += 1;
      report.items.push({
        bookingId,
        status: 'failed',
        reason: error.message,
      });
    }
  }

  const reportDir = path.join(__dirname, 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `phase2-chat-backfill-${stamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Created / would-create : ${report.totals.createdConversations}`);
  console.log(`Already existing       : ${report.totals.existingConversations}`);
  console.log(`Skipped                : ${report.totals.skippedMissingData}`);
  console.log(`Failed                 : ${report.totals.failed}`);
  console.log(`Report file            : ${reportPath}`);

  await mongoose.connection.close();
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error('Phase 2 chat backfill failed:', error.message);
    try {
      await mongoose.connection.close();
    } catch (closeErr) {
      // ignore close errors
    }
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
};
