const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const { Venue } = require('../models');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function parseArgs(argv) {
  const args = {
    apply: argv.includes('--apply'),
    dryRun: argv.includes('--dry-run') || !argv.includes('--apply'),
    limit: null,
  };

  const limitArg = argv.find((a) => a.startsWith('--limit='));
  if (limitArg) {
    const parsed = parseInt(limitArg.split('=')[1], 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      args.limit = parsed;
    }
  }

  return args;
}

function round6(value) {
  return Math.round(Number(value) * 1e6) / 1e6;
}

async function geocodeLocation(location, token) {
  const queries = [
    `${location}, Karachi, Pakistan`,
    `${location}, Sindh, Pakistan`,
    location,
  ];

  const karachiProximity = { longitude: 67.0011, latitude: 24.8607 };

  for (const query of queries) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
    const response = await axios.get(url, {
      params: {
        access_token: token,
        limit: 5,
        autocomplete: false,
        country: 'pk',
        proximity: `${karachiProximity.longitude},${karachiProximity.latitude}`,
      },
      timeout: 15000,
    });

    const features = response?.data?.features || [];
    if (!features.length) {
      continue;
    }

    const preferred = features.find((f) => {
      const name = String(f?.place_name || '').toLowerCase();
      return name.includes('karachi') || name.includes('sindh');
    }) || features[0];

    if (preferred && Array.isArray(preferred.center) && preferred.center.length >= 2) {
      const lng = round6(preferred.center[0]);
      const lat = round6(preferred.center[1]);
      return { lat, lng, placeName: preferred.place_name || null };
    }
  }

  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.MAPBOX_SECRET_TOKEN;

  if (!token) {
    throw new Error('MAPBOX_SECRET_TOKEN is missing in backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const missingGeoQuery = {
    $or: [
      { coordinates: { $exists: false } },
      { 'coordinates.lat': { $exists: false } },
      { 'coordinates.lng': { $exists: false } },
      { locationPoint: { $exists: false } },
    ],
  };

  const totalMissing = await Venue.countDocuments(missingGeoQuery);

  let query = Venue.find(missingGeoQuery)
    .select('_id title location coordinates locationPoint')
    .sort({ createdAt: 1, _id: 1 });

  if (args.limit) {
    query = query.limit(args.limit);
  }

  const candidates = await query.lean();

  const report = {
    timestamp: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    totalMissingInDatabase: totalMissing,
    processed: candidates.length,
    updated: 0,
    failures: 0,
    skippedNoLocation: 0,
    items: [],
  };

  console.log('=== Phase 3 Geocode Backfill ===');
  console.log(`Mode                     : ${report.mode}`);
  console.log(`Missing in DB            : ${totalMissing}`);
  console.log(`Processing now           : ${candidates.length}${args.limit ? ` (limit=${args.limit})` : ''}`);

  for (const venue of candidates) {
    const location = String(venue.location || '').trim();

    if (!location) {
      report.skippedNoLocation += 1;
      report.items.push({
        venueId: String(venue._id),
        title: venue.title,
        status: 'skipped',
        reason: 'missing location text',
      });
      continue;
    }

    try {
      const geo = await geocodeLocation(location, token);
      if (!geo) {
        report.failures += 1;
        report.items.push({
          venueId: String(venue._id),
          title: venue.title,
          location,
          status: 'failed',
          reason: 'no geocode result',
        });
        continue;
      }

      if (args.apply) {
        await Venue.updateOne(
          { _id: venue._id },
          {
            $set: {
              coordinates: { lat: geo.lat, lng: geo.lng },
              locationPoint: { type: 'Point', coordinates: [geo.lng, geo.lat] },
            },
          }
        );
      }

      report.updated += 1;
      report.items.push({
        venueId: String(venue._id),
        title: venue.title,
        location,
        status: 'success',
        lat: geo.lat,
        lng: geo.lng,
        matchedPlace: geo.placeName,
      });
    } catch (error) {
      report.failures += 1;
      report.items.push({
        venueId: String(venue._id),
        title: venue.title,
        location,
        status: 'failed',
        reason: error.message,
      });
    }
  }

  const reportDir = path.join(__dirname, 'reports');
  fs.mkdirSync(reportDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `phase3-geocode-report-${stamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  const remainingAfter = await Venue.countDocuments(missingGeoQuery);

  console.log(`Updated successfully     : ${report.updated}`);
  console.log(`Failures                 : ${report.failures}`);
  console.log(`Skipped (no location)    : ${report.skippedNoLocation}`);
  console.log(`Still missing in DB      : ${remainingAfter}`);
  console.log(`Report file              : ${reportPath}`);

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error('Phase 3 backfill failed:', error.message);
  try {
    await mongoose.connection.close();
  } catch (e) {
    // ignore close errors
  }
  process.exit(1);
});
