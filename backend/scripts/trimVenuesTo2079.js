const mongoose = require('mongoose');
const dotenv = require('dotenv');

const { Venue } = require('../models');

dotenv.config();

async function main() {
  const applyDelete = process.argv.includes('--apply');
  const target = 2079;

  await mongoose.connect(process.env.MONGODB_URI);

  const total = await Venue.countDocuments();
  const extra = Math.max(0, total - target);

  console.log('=== Venue Trim Report ===');
  console.log(`Current total venues    : ${total}`);
  console.log(`Target venues           : ${target}`);
  console.log(`Venues to delete        : ${extra}`);
  console.log(`Mode                    : ${applyDelete ? 'APPLY (delete)' : 'DRY-RUN (no delete)'}`);

  if (extra === 0) {
    await mongoose.connection.close();
    return;
  }

  const newestExtra = await Venue.find({})
    .select('_id')
    .sort({ createdAt: -1, _id: -1 })
    .limit(extra)
    .lean();

  const deleteIds = newestExtra.map((v) => v._id);

  if (applyDelete) {
    const result = await Venue.deleteMany({ _id: { $in: deleteIds } });
    const finalCount = await Venue.countDocuments();
    console.log(`Deleted venues          : ${result.deletedCount}`);
    console.log(`Final venues in DB      : ${finalCount}`);
  }

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Trim script failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch (e) {
    // ignore
  }
  process.exit(1);
});
