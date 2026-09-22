// Script: Export business owners and their venues to Markdown
// Usage: node backend/scripts/exportOwnersVenues.js

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
// Load env from backend/.env so connectDB can see MONGODB_URI
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Load DB connection
const connectDB = require('../config/db');

// Load models
const User = require('../models/User');
const Venue = require('../models/Venue');

async function run() {
  try {
    // Allow overriding via CLI: node scripts/exportOwnersVenues.js --uri="mongodb://..."
    const uriArg = process.argv.find(a => a.startsWith('--uri='));
    if (uriArg) {
      process.env.MONGODB_URI = uriArg.replace('--uri=', '').trim();
    }

    if (!process.env.MONGODB_URI) {
      console.warn('MONGODB_URI not set. You can pass it as --uri="your-connection-string" or set backend/.env');
    }

    await connectDB();

    // Find business owners (model uses profileType/currentRole)
    const owners = await User.find({
      $or: [
        { profileType: 'business' },
        { profileType: 'both' },
        { currentRole: 'business' }
      ]
    }).select('_id email name profile profileType currentRole');

    // Fetch venues grouped by owner
    const venuesByOwner = await Venue.aggregate([
      { $match: { owner: { $in: owners.map(o => o._id) } } },
      {
        $group: {
          _id: '$owner',
          venues: {
            $push: {
              title: '$title',
              sport: '$sport',
              location: '$location',
              hourlyPrice: '$hourlyPrice'
            }
          }
        }
      }
    ]);

    // Map ownerId -> owner info
    const ownerMap = new Map();
    for (const owner of owners) {
      const name = owner.name || owner.profile?.name || owner.profile?.fullName || owner.email || String(owner._id);
      ownerMap.set(String(owner._id), { name, email: owner.email });
    }

    // Build Markdown
    const lines = [];
    lines.push('# Business Owners and Their Venues');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    if (venuesByOwner.length === 0) {
      lines.push('No venues found for business owners.');
    } else {
      for (const group of venuesByOwner) {
        const ownerId = String(group._id);
        const info = ownerMap.get(ownerId) || { name: ownerId, email: '' };
        lines.push(`## ${info.name}`);
        if (info.email) lines.push(`- Email: ${info.email}`);
        lines.push('');
        if (!group.venues || group.venues.length === 0) {
          lines.push('- No venues');
        } else {
          for (const v of group.venues) {
            const loc = v.location || '';
            const sport = v.sport ? ` • ${v.sport}` : '';
            const price = typeof v.hourlyPrice === 'number' ? ` • $${v.hourlyPrice}/hr` : '';
            lines.push(`- ${v.title}${sport}${price}${loc ? ` • ${loc}` : ''}`);
          }
        }
        lines.push('');
      }
    }

    const outPath = path.resolve(__dirname, '../../OWNERS_VENUES.md');
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log(`Wrote Markdown: ${outPath}`);
  } catch (err) {
    console.error('Export failed:', err);
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
}

run();
