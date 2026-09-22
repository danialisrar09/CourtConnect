# MongoDB Setup Guide for Sport Slot Booking System

This guide will help you connect your backend to MongoDB.

## Option 1: MongoDB Local Installation

### Step 1: Install MongoDB Locally

#### For Windows:
1. Download MongoDB Community Server from [MongoDB Download Center](https://www.mongodb.com/try/download/community)
2. Run the installer and follow the installation wizard
3. Choose "Complete" installation
4. Install MongoDB as a Windows Service (recommended)
5. MongoDB will start automatically on system startup

#### For macOS:
```bash
# Using Homebrew
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### For Linux (Ubuntu/Debian):
```bash
# Import MongoDB public GPG Key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update and install
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Step 2: Verify MongoDB is Running

```bash
# Check if MongoDB is running
mongosh
```

If successful, you'll see the MongoDB shell. Type `exit` to quit.

### Step 3: Configure Your Backend

Your `.env` file is already set up with the local MongoDB connection:

```env
MONGODB_URI=mongodb://localhost:27017/sport-slot-booking
```

This will:
- Connect to MongoDB running on `localhost`
- Use port `27017` (default MongoDB port)
- Create/use a database named `sport-slot-booking`

### Step 4: Start Your Backend Server

```bash
npm run dev
```

You should see:
```
Server is running on port 5000
MongoDB Connected: localhost
```

---

## Option 2: MongoDB Atlas (Cloud - Recommended for Production)

### Step 1: Create MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Click "Try Free" and sign up
3. Verify your email address

### Step 2: Create a New Cluster

1. Click "Build a Database"
2. Choose "M0 FREE" tier
3. Select your preferred cloud provider and region
4. Click "Create Cluster" (takes 3-5 minutes)

### Step 3: Create Database User

1. Go to "Database Access" in the left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Enter username and password (save these!)
5. Set user privileges to "Read and write to any database"
6. Click "Add User"

### Step 4: Configure Network Access

1. Go to "Network Access" in the left sidebar
2. Click "Add IP Address"
3. For development, click "Allow Access from Anywhere" (0.0.0.0/0)
   - **Note**: For production, use specific IP addresses
4. Click "Confirm"

### Step 5: Get Your Connection String

1. Go back to "Database" in the left sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Copy the connection string (looks like):
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### Step 6: Update Your .env File

Replace the connection string in your `.env` file:

```env
MONGODB_URI=mongodb+srv://your-username:your-password@cluster0.xxxxx.mongodb.net/sport-slot-booking?retryWrites=true&w=majority
```

**Important**: 
- Replace `<username>` with your database username
- Replace `<password>` with your database password
- Add `/sport-slot-booking` after `.net` and before `?` to specify database name

### Step 7: Start Your Backend Server

```bash
npm run dev
```

You should see:
```
Server is running on port 5000
MongoDB Connected: cluster0-shard-00-00.xxxxx.mongodb.net
```

---

## Testing the Connection

### Test with Health Check Endpoint

Open your browser or use curl:

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2025-11-24T...",
  "database": "Connected"
}
```

### Using MongoDB Compass (GUI Tool)

1. Download [MongoDB Compass](https://www.mongodb.com/products/compass)
2. Install and open it
3. Paste your connection string
4. Click "Connect"
5. You should see your `sport-slot-booking` database

---

## Troubleshooting

### Error: "connect ECONNREFUSED"

**Problem**: MongoDB is not running

**Solution**:
- **Local**: Start MongoDB service
  - Windows: Check Services app for "MongoDB"
  - macOS: `brew services start mongodb-community`
  - Linux: `sudo systemctl start mongod`

### Error: "Authentication failed"

**Problem**: Wrong username/password in connection string

**Solution**:
- Verify credentials in MongoDB Atlas
- Make sure password doesn't contain special characters (or encode them)
- Double-check `.env` file has correct credentials

### Error: "Network timeout" or "ETIMEDOUT"

**Problem**: IP address not whitelisted in Atlas

**Solution**:
- Go to Network Access in MongoDB Atlas
- Add your current IP address or allow 0.0.0.0/0

### Error: "MongoServerError: bad auth"

**Problem**: Database user doesn't have proper permissions

**Solution**:
- Go to Database Access in MongoDB Atlas
- Edit user and set role to "Atlas admin" or "Read and write to any database"

---

## Next Steps

Once connected successfully:

1. **Create Models**: Define Mongoose schemas for your data (Users, Venues, Bookings, etc.)
2. **Create Routes**: Set up API endpoints for CRUD operations
3. **Create Controllers**: Implement business logic
4. **Add Middleware**: Authentication, validation, error handling
5. **Test**: Use Postman or Thunder Client to test your APIs

---

## Useful MongoDB Commands

```javascript
// In mongosh (MongoDB Shell)

// Show all databases
show dbs

// Use specific database
use sport-slot-booking

// Show all collections
show collections

// Find all documents in a collection
db.users.find()

// Count documents
db.users.countDocuments()

// Drop a collection
db.users.drop()
```

---

## Security Best Practices

1. ✅ Keep `.env` in `.gitignore` (already done)
2. ✅ Use strong passwords for database users
3. ✅ Restrict IP addresses in production (not 0.0.0.0/0)
4. ✅ Use environment variables for sensitive data
5. ✅ Enable MongoDB authentication in production
6. ✅ Use connection pooling (Mongoose does this automatically)
7. ✅ Regular backups (Atlas provides automatic backups)

---

## Additional Resources

- [MongoDB Official Documentation](https://docs.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [MongoDB University (Free Courses)](https://university.mongodb.com/)
