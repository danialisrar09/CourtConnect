const mongoose = require('mongoose');
const dotenv = require('dotenv');

const { Venue } = require('../models');

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const byDay = await Venue.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byOwner = await Venue.aggregate([
    { $group: { _id: '$owner', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const earliest = await Venue.find({})
    .select('title location createdAt owner')
    .sort({ createdAt: 1 })
    .limit(20)
    .lean();

  const latest = await Venue.find({})
    .select('title location createdAt owner')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  console.log('BY_DAY');
  console.log(JSON.stringify(byDay, null, 2));
  console.log('BY_OWNER');
  console.log(JSON.stringify(byOwner, null, 2));
  console.log('EARLIEST_SAMPLE');
  console.log(JSON.stringify(earliest, null, 2));
  console.log('LATEST_SAMPLE');
  console.log(JSON.stringify(latest, null, 2));

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Profile script error:', err.message);
  try {
    await mongoose.connection.close();
  } catch (e) {
    // ignore
  }
  process.exit(1);
});
