const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const { Venue } = require('../models');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const csvPath = path.join(__dirname, '..', '..', 'ai-service', 'Data.csv');

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  out.push(current);
  return out;
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(value) {
  return String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

async function main() {
  const applyDelete = process.argv.includes('--apply');
  const requireExactCount = process.argv.includes('--require-2079');

  const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const nameIndex = headers.indexOf('facility name');
  const locationIndex = headers.indexOf('area / location');
  const sportIndex = headers.indexOf('sports offered');

  if (nameIndex === -1 || locationIndex === -1 || sportIndex === -1) {
    throw new Error('Required columns not found in AI CSV.');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const venues = await Venue.find({ status: 'active' })
    .select('_id title location sport rating totalBookings')
    .sort({ rating: -1, totalBookings: -1 })
    .lean();

  const normalizedVenues = venues.map((v) => ({
    id: String(v._id),
    title: normalizeText(v.title),
    location: normalizeText(v.location),
    sport: normalizeText(v.sport),
  }));

  const matchedIds = new Set();
  let matchedRows = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const facilityName = normalizeText(cols[nameIndex]);
    const areaLocation = String(cols[locationIndex] || '').trim();
    const areaName = normalizeText(areaLocation.split(',')[0] || '');
    const sportsOffered = String(cols[sportIndex] || '').trim();
    const sportsList = sportsOffered
      .split(',')
      .map((s) => normalizeText(s))
      .filter(Boolean);

    const match = normalizedVenues.find((v) => {
      const nameOk = facilityName ? v.title.includes(facilityName) : true;
      const locationOk = areaName ? v.location.includes(areaName) : true;
      const sportOk = sportsList.length > 0 ? sportsList.some((s) => v.sport === s) : true;
      return nameOk && locationOk && sportOk;
    });

    if (match) {
      matchedRows += 1;
      matchedIds.add(match.id);
    }
  }

  const total = await Venue.countDocuments();
  const keepCount = matchedIds.size;
  const removeCount = total - keepCount;

  console.log('=== AI-Matched Cleanup Report ===');
  console.log(`AI rows matched         : ${matchedRows}`);
  console.log(`Unique venues to keep   : ${keepCount}`);
  console.log(`Venues to remove        : ${removeCount}`);
  console.log(`Mode                    : ${applyDelete ? 'APPLY (delete)' : 'DRY-RUN (no delete)'}`);

  if (requireExactCount && keepCount !== 2079) {
    throw new Error(`Safety stop: expected 2079 keepers, got ${keepCount}.`);
  }

  if (applyDelete) {
    const keepObjectIds = Array.from(matchedIds).map((id) => new mongoose.Types.ObjectId(id));
    const result = await Venue.deleteMany({ _id: { $nin: keepObjectIds } });
    console.log(`Deleted venues          : ${result.deletedCount}`);
    const finalCount = await Venue.countDocuments();
    console.log(`Final venue count       : ${finalCount}`);
  }

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Script failed:', err && err.message ? err.message : err);
  if (err && err.stack) {
    console.error(err.stack);
  }
  try {
    await mongoose.connection.close();
  } catch (e) {
    // ignore
  }
  process.exit(1);
});
