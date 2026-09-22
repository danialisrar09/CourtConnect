const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const connectDB = require('../config/db');
const { Venue } = require('../models');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const csvPath = path.join(__dirname, '..', '..', 'ai-service', 'Data.csv');

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '');
}

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

function buildAiKeySet() {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`AI data file not found at: ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) {
    throw new Error('AI CSV appears empty or has no data rows.');
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const nameIndex = headers.findIndex((h) => h.toLowerCase() === 'facility name');
  const locationIndex = headers.findIndex((h) => h.toLowerCase() === 'area / location');

  if (nameIndex === -1 || locationIndex === -1) {
    throw new Error('Expected headers "Facility Name" and "Area / Location" were not found in AI CSV.');
  }

  const aiKeySet = new Set();

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const name = normalizeText(cols[nameIndex]);
    const location = normalizeText(cols[locationIndex]);
    if (!name || !location) continue;
    aiKeySet.add(`${name}|${location}`);
  }

  return aiKeySet;
}

async function main() {
  const applyDelete = process.argv.includes('--apply');
  await connectDB();

  const aiKeySet = buildAiKeySet();
  const venues = await Venue.find({}).select('_id title location').lean();

  const keepIds = [];
  const removeIds = [];

  for (const venue of venues) {
    const key = `${normalizeText(venue.title)}|${normalizeText(venue.location)}`;
    if (aiKeySet.has(key)) {
      keepIds.push(venue._id);
    } else {
      removeIds.push(venue._id);
    }
  }

  console.log('=== AI Alignment Cleanup Report ===');
  console.log(`Total venues in DB      : ${venues.length}`);
  console.log(`AI-aligned venues       : ${keepIds.length}`);
  console.log(`Non-aligned venues      : ${removeIds.length}`);
  console.log(`Mode                    : ${applyDelete ? 'APPLY (delete)' : 'DRY-RUN (no delete)'}`);

  if (applyDelete && removeIds.length > 0) {
    const result = await Venue.deleteMany({ _id: { $in: removeIds } });
    console.log(`Deleted venues          : ${result.deletedCount}`);
  }

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error('Cleanup script failed:', error.message);
  try {
    await mongoose.connection.close();
  } catch (e) {
    // Ignore close errors in failure path.
  }
  process.exit(1);
});
