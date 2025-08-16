# Local Neo4j Development Setup

This guide will help you set up local Neo4j Desktop development for the Dorkinians FC Statistics Website.

## 🎯 Overview

Instead of using Neo4j Aura (cloud), we'll use Neo4j Desktop for local development. This provides:
- **Faster Development**: No network latency
- **Cost-Free**: No cloud charges during development
- **Full Control**: Complete database access and management
- **Offline Development**: Work without internet connection

## 📋 Prerequisites

1. **Neo4j Desktop** installed on your machine
2. **Node.js 18+** installed
3. **Project dependencies** installed (`npm install`)

## 🚀 Setup Steps

### Step 1: Install Neo4j Desktop

1. Download Neo4j Desktop from [neo4j.com/download](https://neo4j.com/download/)
2. Install and launch Neo4j Desktop
3. Create a free account if prompted

### Step 2: Create Local Database

1. In Neo4j Desktop, click **"New"** → **"Create a Local Graph"**
2. Configure the database:
   - **Name**: `DorkiniansFC-Dev`
   - **Version**: Neo4j 5.x (latest stable)
   - **Password**: `password` (or your preferred password)
   - **Port**: `7687` (default)
3. Click **"Create"**

### Step 3: Start the Database

1. Click the **"Start"** button on your new database
2. Wait for the database to start (green status indicator)
3. Note the connection details:
   - **URI**: `bolt://localhost:7687`
   - **Username**: `neo4j`
   - **Password**: `password` (or what you set)

### Step 4: Configure Environment Variables

Update your `.env` file with these values:

```bash
# Local Development Neo4j Configuration
DEV_NEO4J_URI=bolt://localhost:7687
DEV_NEO4J_USER=neo4j
DEV_NEO4J_PASSWORD=password
DEV_NEO4J_DATABASE=neo4j

# Other configurations...
NODE_ENV=development
```

### Step 5: Test the Connection

Run the test script to verify everything is working:

```bash
npm run test-neo4j
```

You should see:
```
🧪 Testing Neo4j Local Connection...
✅ Connection successful!
🧪 Creating test node...
✅ Test node created successfully
✅ graphLabel property correctly set
🧹 Cleaning up test data...
✅ Test data cleaned up
🎉 Neo4j test completed
```

## 🔧 Database Management

### Accessing Neo4j Browser

1. In Neo4j Desktop, click **"Open"** on your database
2. This opens Neo4j Browser at `http://localhost:7474`
3. Login with:
   - **Username**: `neo4j`
   - **Password**: `password`

### Useful Cypher Queries

**View all nodes with graphLabel:**
```cypher
MATCH (n {graphLabel: 'dorkiniansWebsite'})
RETURN n LIMIT 10
```

**View node count by label:**
```cypher
MATCH (n {graphLabel: 'dorkiniansWebsite'})
RETURN labels(n) as Label, count(n) as Count
```

**Clear all data:**
```cypher
MATCH (n {graphLabel: 'dorkiniansWebsite'})
DETACH DELETE n
```

## 📊 Data Seeding

The project includes a data seeder utility that automatically adds the `graphLabel` property to all nodes.

### Using the Data Seeder

```typescript
import { dataSeeder } from '@/lib/data-seeder'

// Seed all data types
await dataSeeder.seedAllData({
  players: playerData,
  fixtures: fixtureData,
  matchDetails: matchDetailData,
  weeklyTOTW: weeklyTOTWData,
  seasonTOTW: seasonTOTWData
})
```

### What Gets Added Automatically

Every node created through the service gets these properties:
- **`graphLabel`**: Always set to `"dorkiniansWebsite"`
- **`createdAt`**: ISO timestamp of creation

## 🚨 Troubleshooting

### Connection Refused
- Ensure Neo4j Desktop is running
- Check if database is started (green status)
- Verify port 7687 is not blocked by firewall

### Authentication Failed
- Double-check username/password in `.env.local`
- Ensure password matches what you set in Neo4j Desktop
- Try resetting password in Neo4j Desktop

### Port Already in Use
- Check if another Neo4j instance is running
- Change port in Neo4j Desktop settings
- Update `DEV_NEO4J_URI` in `.env.local`

### Memory Issues
- Neo4j Desktop uses significant RAM
- Close other applications if needed
- Consider increasing system RAM

## 🔄 Switching Between Local and Production

### Development (Local)
```bash
NODE_ENV=development
# Uses DEV_NEO4J_URI, DEV_NEO4J_USER, DEV_NEO4J_PASSWORD
```

### Production (Aura)
```bash
NODE_ENV=production
# Uses PROD_NEO4J_URI, PROD_NEO4J_USER, PROD_NEO4J_PASSWORD
```

## 📈 Performance Tips

1. **Index Creation**: Create indexes on frequently queried properties
2. **Batch Operations**: Use the data seeder for bulk operations
3. **Memory Management**: Restart database periodically during heavy development
4. **Query Optimization**: Use `EXPLAIN` in Neo4j Browser to analyze queries

## 🎯 Next Steps

After successful local setup:

1. **Test Data Seeding**: Run the data seeder with sample data
2. **Develop Queries**: Build and test Cypher queries in Neo4j Browser
3. **Integration**: Connect the frontend to local database
4. **Performance Testing**: Test with larger datasets

## 📚 Additional Resources

- [Neo4j Cypher Manual](https://neo4j.com/docs/cypher-manual/current/)
- [Neo4j Desktop Guide](https://neo4j.com/docs/desktop-manual/current/)
- [Neo4j Browser Guide](https://neo4j.com/docs/browser-manual/current/)

---

**Need Help?** Check the console output for detailed error messages and ensure all environment variables are correctly set in your `.env` file.
