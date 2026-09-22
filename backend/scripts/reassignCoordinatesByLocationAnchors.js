require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const MONGODB_URI = process.env.MONGODB_URI;

const AREA_ANCHORS = [
  { name: 'Gulistan/Jauhar', pattern: /gulistan-e-johar|gulistan-e-jauhar|gulshan-e-johar|gulshan-e-jauhar|johar|jauhar/i, center: [67.113, 24.915], radius: 0.0065 },
  { name: 'Scheme 33', pattern: /scheme\s*33|scheme-33|safoora/i, center: [67.165, 24.952], radius: 0.008 },
  { name: 'Lyari', pattern: /lyari/i, center: [66.985, 24.872], radius: 0.006 },
  { name: 'Clifton', pattern: /clifton|seaview|old\s*clifton/i, center: [67.029, 24.816], radius: 0.0065 },
  { name: 'DHA', pattern: /dha|defence/i, center: [67.06, 24.826], radius: 0.0085 },
  { name: 'PECHS', pattern: /pechs|tariq\s*road|bahadurabad|sindhi\s*muslim/i, center: [67.058, 24.877], radius: 0.006 },
  { name: 'Gulshan', pattern: /gulshan|nipa/i, center: [67.082, 24.919], radius: 0.007 },
  { name: 'North Karachi', pattern: /north\s*karachi|nk\s*sector/i, center: [67.054, 24.968], radius: 0.008 },
  { name: 'FB Area', pattern: /fb\s*area|federal\s*b\s*area|buffer\s*zone|bufferzone/i, center: [67.054, 24.938], radius: 0.0075 },
  { name: 'Surjani', pattern: /surjani/i, center: [67.009, 24.999], radius: 0.0075 },
  { name: 'Malir', pattern: /malir|model\s*town|steel\s*town|gulshan-e-hadeed/i, center: [67.214, 24.892], radius: 0.01 },
  { name: 'Karsaz', pattern: /karsaz|pns\s*karsaz|stadium\s*road|university\s*rd/i, center: [67.095, 24.905], radius: 0.007 },
  { name: 'Saddar/Garden', pattern: /saddar|garden|aram\s*bagh|serai/i, center: [67.02, 24.868], radius: 0.0055 },
  { name: 'Qayyumabad', pattern: /qayyumabad/i, center: [67.069, 24.843], radius: 0.0045 },
  { name: 'Shahrah-e-Faisal', pattern: /shahrah-e-faisal|jacob\s*lines|cantt/i, center: [67.075, 24.882], radius: 0.006 },
];

function hashNumber(value) {
  let hash = 0;
  const input = String(value || '');
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function jitterDeterministic(centerLng, centerLat, radius, key) {
  const h1 = hashNumber(`${key}-a`) / 0xffffffff;
  const h2 = hashNumber(`${key}-b`) / 0xffffffff;
  const angle = h1 * Math.PI * 2;
  const distance = Math.sqrt(h2) * radius;

  const lat = centerLat + Math.sin(angle) * distance;
  const lng = centerLng + Math.cos(angle) * distance;

  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

function pickAnchor(locationText) {
  for (const anchor of AREA_ANCHORS) {
    if (anchor.pattern.test(locationText)) {
      return anchor;
    }
  }
  return null;
}

async function main() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is missing');
  }

  await mongoose.connect(MONGODB_URI);
  const col = mongoose.connection.db.collection('venues');

  const venues = await col.find({ status: 'active' }).project({ _id: 1, location: 1, coordinates: 1 }).toArray();

  let matched = 0;
  let updated = 0;
  const byArea = {};
  const operations = [];

  for (const venue of venues) {
    const locationText = String(venue.location || '').trim();
    const anchor = pickAnchor(locationText);
    if (!anchor) continue;

    matched += 1;
    byArea[anchor.name] = (byArea[anchor.name] || 0) + 1;

    const next = jitterDeterministic(anchor.center[0], anchor.center[1], anchor.radius, venue._id.toString());

    if (APPLY) {
      operations.push({
        updateOne: {
          filter: { _id: venue._id },
          update: {
            $set: {
              'coordinates.lat': next.lat,
              'coordinates.lng': next.lng,
              locationPoint: {
                type: 'Point',
                coordinates: [next.lng, next.lat],
              },
            },
          },
        },
      });
    }

    updated += 1;
  }

  if (APPLY && operations.length > 0) {
    const chunkSize = 300;
    for (let i = 0; i < operations.length; i += chunkSize) {
      const chunk = operations.slice(i, i + chunkSize);
      await col.bulkWrite(chunk, { ordered: false });
    }
  }

  const centralClusterCount = await col.countDocuments({
    status: 'active',
    'coordinates.lat': { $gte: 24.84, $lte: 24.88 },
    'coordinates.lng': { $gte: 67.0, $lte: 67.04 },
  });

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Matched by anchor: ${matched}`);
  console.log(`Updated: ${updated}`);
  console.log(`Central cluster window count: ${centralClusterCount}`);
  console.log('By area:', byArea);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
