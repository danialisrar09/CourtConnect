const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const { Venue } = require('../models');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

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

async function main() {
  const csvPath = path.join(__dirname, '..', '..', 'ai-service', 'Data.csv');
  const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

  const nameIndex = headers.indexOf('facility name');
  const locationIndex = headers.indexOf('area / location');

  const aiNameSet = new Set();
  const aiPairSet = new Set();

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const name = normalizeText(cols[nameIndex]);
    const location = normalizeText(cols[locationIndex]);

    if (name) aiNameSet.add(name);
    if (name && location) aiPairSet.add(`${name}|${location}`);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const venues = await Venue.find({}).select('title location').lean();
  let nameMatches = 0;
  let pairMatches = 0;

  for (const venue of venues) {
    const title = normalizeText(venue.title);
    const location = normalizeText(venue.location);

    if (aiNameSet.has(title)) nameMatches += 1;
    if (aiPairSet.has(`${title}|${location}`)) pairMatches += 1;
  }

  console.log(`TOTAL=${venues.length}`);
  console.log(`NAME_MATCH=${nameMatches}`);
  console.log(`PAIR_MATCH=${pairMatches}`);

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Stats error:', err.message);
  try {
    await mongoose.connection.close();
  } catch (e) {
    // ignore
  }
  process.exit(1);
});
