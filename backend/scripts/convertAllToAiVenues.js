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

function normalize(value) {
  return String(value || '').toLowerCase().trim();
}

function mapSport(sportsOffered) {
  const text = normalize(sportsOffered);

  if (text.includes('table tennis') || text.includes('tt')) return 'Table Tennis';
  if (text.includes('badminton')) return 'Badminton';
  if (text.includes('basketball')) return 'Basketball';
  if (text.includes('volleyball')) return 'Volleyball';
  if (text.includes('tennis')) return 'Tennis';
  if (text.includes('football') || text.includes('futsal') || text.includes('soccer')) return 'Football';
  if (text.includes('cricket')) return 'Cricket';
  if (text.includes('hockey')) return 'Hockey';
  if (text.includes('swim') || text.includes('pool')) return 'Swimming';
  if (text.includes('gym') || text.includes('fitness')) return 'Gym/Fitness';

  return 'Cricket';
}

function parsePrice(rateText, fallback = 1000) {
  const nums = String(rateText || '')
    .replace(/,/g, '')
    .match(/\d+(?:\.\d+)?/g);

  if (!nums || nums.length === 0) return fallback;
  const values = nums.map(Number).filter((n) => Number.isFinite(n));
  if (values.length === 0) return fallback;
  return Math.max(0, Math.round(values[0]));
}

async function main() {
  const apply = process.argv.includes('--apply');

  if (!fs.existsSync(csvPath)) {
    throw new Error(`AI data file not found: ${csvPath}`);
  }

  const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

  const idxName = headers.indexOf('facility name');
  const idxLocation = headers.indexOf('area / location');
  const idxSports = headers.indexOf('sports offered');
  const idxRate = headers.indexOf('typical hourly rate (pkr)');

  if (idxName === -1 || idxLocation === -1 || idxSports === -1 || idxRate === -1) {
    throw new Error('Required AI CSV columns are missing.');
  }

  const aiRows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const title = String(cols[idxName] || '').trim();
    const location = String(cols[idxLocation] || '').trim();
    if (!title || !location) continue;

    aiRows.push({
      title,
      location,
      sport: mapSport(cols[idxSports]),
      hourlyPrice: parsePrice(cols[idxRate], 1000),
    });
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const venues = await Venue.find({}).select('_id owner title location sport hourlyPrice').sort({ createdAt: 1, _id: 1 }).lean();

  if (venues.length !== aiRows.length) {
    throw new Error(`Venue count (${venues.length}) and AI row count (${aiRows.length}) differ. Aborting for safety.`);
  }

  const seenOwnerTitles = new Map();

  const ops = venues.map((venue, i) => {
    const row = aiRows[i];
    const ownerKey = String(venue.owner || '');
    const baseTitle = row.title;
    const key = `${ownerKey}|${baseTitle.toLowerCase()}`;
    const count = (seenOwnerTitles.get(key) || 0) + 1;
    seenOwnerTitles.set(key, count);
    const uniqueTitle = count === 1 ? baseTitle : `${baseTitle} (${count})`;

    return {
      updateOne: {
        filter: { _id: venue._id },
        update: {
          $set: {
            title: uniqueTitle,
            location: row.location,
            sport: row.sport,
            hourlyPrice: row.hourlyPrice,
            description: `${uniqueTitle} is an AI-aligned sports facility located in ${row.location}.`,
            status: 'active',
          },
        },
      },
    };
  });

  console.log('=== Convert All To AI Venues ===');
  console.log(`Current venues in DB    : ${venues.length}`);
  console.log(`AI rows available       : ${aiRows.length}`);
  console.log(`Mode                    : ${apply ? 'APPLY (update)' : 'DRY-RUN (no update)'}`);

  if (apply) {
    const result = await Venue.bulkWrite(ops, { ordered: false });
    const modified = (result && (result.modifiedCount || result.nModified)) || 0;
    console.log(`Updated venues          : ${modified}`);
  }

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Conversion failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch (e) {
    // ignore close error
  }
  process.exit(1);
});
