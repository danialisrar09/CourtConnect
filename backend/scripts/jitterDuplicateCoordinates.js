/**
 * jitterDuplicateCoordinates.js
 *
 * Finds all venues that share an identical lat/lng pair and applies a small
 * random offset (jitter) so each court gets a unique map position while
 * staying within ~400m of its neighborhood centroid.
 *
 * Usage:
 *   node scripts/jitterDuplicateCoordinates.js          (dry-run, shows stats)
 *   node scripts/jitterDuplicateCoordinates.js --apply  (writes to DB)
 */

require('dotenv').config();
const mongoose = require('mongoose');

const DRY_RUN = !process.argv.includes('--apply');

// Max jitter radius in degrees (~0.004° ≈ 400m at Karachi latitude)
const MAX_JITTER_DEG = 0.004;

function jitter() {
  // Random point inside a circle using polar coords
  const r = MAX_JITTER_DEG * Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  return {
    dlat: r * Math.sin(theta),
    dlng: r * Math.cos(theta),
  };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('venues');

  // Find all duplicate coord groups
  const groups = await col.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: { lat: '$coordinates.lat', lng: '$coordinates.lng' },
        ids: { $push: '$_id' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  console.log(`Found ${groups.length} duplicate coordinate groups`);
  const totalAffected = groups.reduce((s, g) => s + g.count, 0);
  console.log(`Total venues affected: ${totalAffected}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log('');

  if (DRY_RUN) {
    console.log('Top 5 groups (would be fixed):');
    groups.slice(0, 5).forEach(g => {
      console.log(`  lat=${g._id.lat}, lng=${g._id.lng}  →  ${g.count} venues`);
    });
    console.log('\nRun with --apply to fix all duplicates.');
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  let errors = 0;

  for (const group of groups) {
    const { lat, lng } = group._id;
    const ids = group.ids;

    // Skip first one — keep it at original position
    for (let i = 1; i < ids.length; i++) {
      const { dlat, dlng } = jitter();
      const newLat = parseFloat((lat + dlat).toFixed(6));
      const newLng = parseFloat((lng + dlng).toFixed(6));

      try {
        await col.updateOne(
          { _id: ids[i] },
          {
            $set: {
              'coordinates.lat': newLat,
              'coordinates.lng': newLng,
              locationPoint: {
                type: 'Point',
                coordinates: [newLng, newLat],
              },
            },
          }
        );
        updated++;
      } catch (err) {
        console.error(`Failed to update ${ids[i]}:`, err.message);
        errors++;
      }
    }

    console.log(`  Fixed group lat=${lat} lng=${lng}: ${ids.length - 1} jittered`);
  }

  console.log(`Done. Updated: ${updated}, Errors: ${errors}`);
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
