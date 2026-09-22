const mongoose = require('mongoose');
const dotenv = require('dotenv');

const { Venue } = require('../models');

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const total = await Venue.countDocuments();
  const active = await Venue.countDocuments({ status: 'active' });
  const inactive = await Venue.countDocuments({ status: 'inactive' });
  const pending = await Venue.countDocuments({ status: 'pending' });

  const withSlug = await Venue.countDocuments({ slug: { $exists: true, $ne: null } });
  const withDescription = await Venue.countDocuments({ description: { $exists: true, $ne: '' } });
  const ownerCounts = await Venue.aggregate([
    { $group: { _id: '$owner', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);
  const titleHasDashSport = await Venue.countDocuments({ title: / - /i });
  const titleContainsCourt = await Venue.countDocuments({ title: /court/i });
  const titleContainsArena = await Venue.countDocuments({ title: /arena/i });
  const titleContainsTest = await Venue.countDocuments({ title: /test venue/i });
  const titleHasKarachiToken = await Venue.countDocuments({ title: /karachi|khi/i });
  const createdMin = await Venue.findOne({}).sort({ createdAt: 1 }).select('createdAt').lean();
  const createdMax = await Venue.findOne({}).sort({ createdAt: -1 }).select('createdAt').lean();

  console.log({
    total,
    active,
    inactive,
    pending,
    withSlug,
    withDescription,
    titleHasDashSport,
    titleContainsCourt,
    titleContainsArena,
    titleContainsTest,
    titleHasKarachiToken,
    createdAtMin: createdMin?.createdAt || null,
    createdAtMax: createdMax?.createdAt || null,
    ownerCounts,
  });

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Venue stats error:', err.message);
  try {
    await mongoose.connection.close();
  } catch (e) {
    // ignore
  }
  process.exit(1);
});
