# Venue Data Seeding Guide

This guide explains how to import venue data from JSON files into your MongoDB database.

## 📁 JSON Files Located in Root Directory

The following JSON files contain venue data:
- `malir.json`
- `johar.json`
- `gulshan_iqbal.json`
- `north_nazimabad (1).json`

## 🚀 How to Seed the Database

### Method 1: Using npm script (Recommended)

```bash
cd backend
npm run seed
```

### Method 2: Direct execution

```bash
cd backend
node seedVenues.js
```

## 📋 What the Script Does

1. **Connects to MongoDB** using your `.env` configuration
2. **Creates a default business owner account** (if it doesn't exist):
   - Email: `venues@courtconnect.com`
   - Password: `VenueOwner123!`
   - Profile Type: Business
3. **Reads all JSON files** from the root directory
4. **Imports venue data** with the following features:
   - Skips duplicate venues (checks by title + location)
   - Assigns all venues to the default owner
   - Generates default availability (Mon-Sun, 9 AM - 10 PM)
   - Validates required fields
   - Adds missing default rules if needed
5. **Shows progress** and summary statistics

## ✅ Expected Output

```
🌱 Starting venue seeding process...

✅ MongoDB Connected
✅ Using existing default owner

📂 Processing malir.json...
   ✅ Added: The edge indoor
   ✅ Added: Sports arena gym
   ...

📂 Processing johar.json...
   ✅ Added: The sports club
   ✅ Added: Playout sports ground
   ...

==================================================
📊 Seeding Summary:
   Total venues processed: 50
   Successfully added: 48
   Failed/Skipped: 2
==================================================

✨ Venue seeding completed!
🔌 Database connection closed
```

## 🔐 Default Owner Credentials

After seeding, you can login as the venue owner to manage all imported venues:

- **Email**: `venues@courtconnect.com`
- **Password**: `VenueOwner123!`
- **Account Type**: Business

## 🔄 Re-running the Script

- The script is **idempotent** - safe to run multiple times
- Existing venues (same title + location) will be skipped
- Only new venues will be added
- No duplicate data will be created

## 🛠️ Troubleshooting

### Connection Error
Make sure MongoDB is running and your `.env` file has the correct `MONGODB_URI`

### File Not Found
Ensure JSON files are in the project root directory (one level up from `backend/`)

### Validation Errors
Check that venue data in JSON files meets the schema requirements:
- `title` (required)
- `sport` (must be one of the allowed types)
- `hourlyPrice` (required, number)
- `images` (required, array with at least 1 image)
- `rules` (must have at least 2 rules)

## 📊 Venue Schema Fields

Each venue contains:
- Basic info: title, description, location, sport
- Pricing: hourlyPrice, capacity
- Features: amenities, surface, indoor, lighting
- Contact: phone, email
- Media: images (array)
- Availability: weekly schedule
- Rules: facility rules (min 2)
- Status: active/inactive/pending

## 🗑️ Clearing Venues (if needed)

To remove all seeded venues and start fresh:

```javascript
// In MongoDB shell or Compass
db.venues.deleteMany({ owner: ObjectId("default_owner_id") })
```

Or create a separate script to clear all venues.
