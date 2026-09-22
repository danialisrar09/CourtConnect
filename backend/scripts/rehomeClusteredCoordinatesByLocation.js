require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
const MAPBOX_TOKEN = process.env.MAPBOX_SECRET_TOKEN || process.env.MAPBOX_PUBLIC_TOKEN;

const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');

// Courts in this over-dense window are considered mislocated and will be repaired.
const CLUSTER_WINDOW = {
  minLat: 24.84,
  maxLat: 24.88,
  minLng: 67.0,
  maxLng: 67.04,
};

const KARACHI_BBOX = '66.7,24.7,67.5,25.1';
const BASE_JITTER_DEG = 0.0012; // ~130m
const MAX_JITTER_DEG = 0.0045; // ~500m

const FALLBACK_ANCHORS = [
  { pattern: /gulistan|jauhar|johar/i, center: [67.1068, 24.9129] },
  { pattern: /scheme\s*33|scheme-33/i, center: [67.154, 24.95] },
  { pattern: /lyari/i, center: [66.995, 24.872] },
  { pattern: /clifton/i, center: [67.0281, 24.8138] },
  { pattern: /saddar/i, center: [67.0295, 24.858] },
  { pattern: /dha\s*phase\s*8/i, center: [67.058, 24.805] },
  { pattern: /dha\s*phase\s*7/i, center: [67.06, 24.817] },
  { pattern: /dha\s*phase\s*6/i, center: [67.07, 24.82] },
  { pattern: /dha\s*phase\s*5/i, center: [67.047, 24.82] },
  { pattern: /dha\s*phase\s*4/i, center: [67.056, 24.836] },
  { pattern: /dha\s*phase\s*2/i, center: [67.046, 24.84] },
  { pattern: /dha\s*phase\s*1/i, center: [67.04, 24.845] },
  { pattern: /pechs/i, center: [67.053, 24.873] },
  { pattern: /tariq\s*road/i, center: [67.059, 24.873] },
  { pattern: /bahadurabad/i, center: [67.066, 24.882] },
  { pattern: /defence\s*view/i, center: [67.047, 24.829] },
  { pattern: /north\s*karachi/i, center: [67.053, 24.97] },
  { pattern: /fb\s*area/i, center: [67.053, 24.93] },
  { pattern: /surjani/i, center: [67.03, 25.0] },
  { pattern: /malir/i, center: [67.209, 24.894] },
  { pattern: /steel\s*town/i, center: [67.223, 24.86] },
  { pattern: /garden\s*west/i, center: [67.01, 24.88] },
  { pattern: /garden\s*east/i, center: [67.02, 24.88] },
  { pattern: /naval\s*colony/i, center: [66.967, 24.907] },
  { pattern: /university\s*rd/i, center: [67.112, 24.918] },
  { pattern: /gulshan/i, center: [67.0822, 24.9187] },
  { pattern: /mehmoodabad/i, center: [67.065, 24.857] },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const inWindow = (lat, lng) =>
  lat >= CLUSTER_WINDOW.minLat &&
  lat <= CLUSTER_WINDOW.maxLat &&
  lng >= CLUSTER_WINDOW.minLng &&
  lng <= CLUSTER_WINDOW.maxLng;

function getFallbackCenter(location) {
  const text = String(location || '');
  for (const anchor of FALLBACK_ANCHORS) {
    if (anchor.pattern.test(text)) {
      return anchor.center;
    }
  }
  return null;
}

function jitterAround(centerLng, centerLat, index, total) {
  const ringFactor = Math.min(1, Math.sqrt(index + 1) / Math.sqrt(Math.max(1, total)));
  const radius = Math.min(MAX_JITTER_DEG, BASE_JITTER_DEG + ringFactor * (MAX_JITTER_DEG - BASE_JITTER_DEG));
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.random() * radius;

  const lat = centerLat + Math.sin(angle) * distance;
  const lng = centerLng + Math.cos(angle) * distance;

  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

async function geocodeLocation(label, cache) {
  const key = String(label || '').trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);

  if (!MAPBOX_TOKEN) {
    const fallback = getFallbackCenter(label);
    cache.set(key, fallback);
    return fallback;
  }

  try {
    const query = encodeURIComponent(`${label}, Karachi, Pakistan`);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json`;

    const response = await axios.get(url, {
      params: {
        access_token: MAPBOX_TOKEN,
        autocomplete: false,
        limit: 1,
        bbox: KARACHI_BBOX,
        language: 'en',
      },
      timeout: 10000,
    });

    const feature = response?.data?.features?.[0];
    if (feature && Array.isArray(feature.center) && feature.center.length === 2) {
      const center = [Number(feature.center[0]), Number(feature.center[1])];
      cache.set(key, center);
      return center;
    }
  } catch (error) {
    if (VERBOSE) {
      console.warn(`[GEOCODE_FAIL] ${label}: ${error.message}`);
    }
  }

  const fallback = getFallbackCenter(label);
  cache.set(key, fallback);
  return fallback;
}

async function main() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in environment');
  }

  await mongoose.connect(MONGODB_URI);
  const col = mongoose.connection.db.collection('venues');

  const clustered = await col.find({
    status: 'active',
    'coordinates.lat': { $gte: CLUSTER_WINDOW.minLat, $lte: CLUSTER_WINDOW.maxLat },
    'coordinates.lng': { $gte: CLUSTER_WINDOW.minLng, $lte: CLUSTER_WINDOW.maxLng },
  }).toArray();

  console.log(`Found clustered venues: ${clustered.length}`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  if (!clustered.length) {
    await mongoose.disconnect();
    return;
  }

  const grouped = new Map();
  for (const venue of clustered) {
    const key = String(venue.location || '').trim();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(venue);
  }

  console.log(`Unique location labels in cluster: ${grouped.size}`);

  const geocodeCache = new Map();
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  const groupEntries = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length);

  for (const [locationLabel, venues] of groupEntries) {
    const center = await geocodeLocation(locationLabel, geocodeCache);

    if (!center) {
      skipped += venues.length;
      if (VERBOSE) {
        console.log(`[SKIP] ${locationLabel || '<empty>'} (${venues.length}) - no geocode/fallback`);
      }
      continue;
    }

    const [centerLng, centerLat] = center;

    for (let i = 0; i < venues.length; i += 1) {
      const venue = venues[i];
      const next = jitterAround(centerLng, centerLat, i, venues.length);

      // Guard: ensure we don't keep venue trapped in the same bad window.
      if (inWindow(next.lat, next.lng) && !/saddar|garden|aram\s*bagh|serai/i.test(locationLabel)) {
        const pushLat = next.lat + 0.02;
        const pushLng = next.lng + 0.02;
        next.lat = Number(pushLat.toFixed(6));
        next.lng = Number(pushLng.toFixed(6));
      }

      if (APPLY) {
        try {
          await col.updateOne(
            { _id: venue._id },
            {
              $set: {
                'coordinates.lat': next.lat,
                'coordinates.lng': next.lng,
                locationPoint: {
                  type: 'Point',
                  coordinates: [next.lng, next.lat],
                },
              },
            },
          );
        } catch (error) {
          failed += 1;
          if (VERBOSE) {
            console.warn(`[UPDATE_FAIL] ${venue._id}: ${error.message}`);
          }
          continue;
        }
      }

      updated += 1;
    }

    if (VERBOSE) {
      console.log(`[DONE] ${locationLabel || '<empty>'} -> (${centerLat.toFixed(5)}, ${centerLng.toFixed(5)}), count=${venues.length}`);
    }

    // Be polite to geocoding service.
    await sleep(80);
  }

  const remainingClustered = await col.countDocuments({
    status: 'active',
    'coordinates.lat': { $gte: CLUSTER_WINDOW.minLat, $lte: CLUSTER_WINDOW.maxLat },
    'coordinates.lng': { $gte: CLUSTER_WINDOW.minLng, $lte: CLUSTER_WINDOW.maxLng },
  });

  console.log('');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Remaining in cluster window: ${remainingClustered}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
