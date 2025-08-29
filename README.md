<p align="center">
  <img src="https://i.imgur.com/wMPmx9P.png" alt="Dorkinians FC Logo" width="200"/>
</p>

# Dorkinians FC Statistics Website

> Mobile-first PWA chatbot statistics website for Dorkinians FC with unified schema architecture.

[![Netlify Status](https://api.netlify.com/api/v1/badges/d6b1056f-438c-4a15-8c02-5c390705543e/deploy-status)](https://app.netlify.com/projects/dorkinians-website-v3/deploys)

## Table of Contents

- [Dorkinians FC Statistics Website](#dorkinians-fc-statistics-website)
  - [Table of Contents](#table-of-contents)
  - [Project Overview](#project-overview)
    - [Key Features](#key-features)
  - [Architecture](#architecture)
    - [Unified Schema System](#unified-schema-system)
    - [Single Source of Truth Architecture](#single-source-of-truth-architecture)
    - [Key Components](#key-components)
  - [Quick Start](#quick-start)
    - [Development Setup](#development-setup)
    - [Database Verification](#database-verification)
  - [Environment Setup](#environment-setup)
    - [Prerequisites](#prerequisites)
    - [Neo4j Configuration](#neo4j-configuration)
      - [Local Development (Recommended)](#local-development-recommended)
      - [Production (Neo4j Aura)](#production-neo4j-aura)
    - [OpenAI Configuration](#openai-configuration)
    - [SMTP Configuration](#smtp-configuration)
    - [Installation](#installation)
  - [NPM Script Synchronization](#npm-script-synchronization)
  - [Development Workflow](#development-workflow)
    - [Schema Updates](#schema-updates)
    - [Managing Schema Changes](#managing-schema-changes)
      - [Adding/Removing CSV Columns](#addingremoving-csv-columns)
      - [Schema Validation](#schema-validation)
    - [Data Seeding](#data-seeding)
    - [Testing](#testing)
  - [Deployment](#deployment)
    - [Netlify Deployment](#netlify-deployment)
    - [Database Seeder Deployment](#database-seeder-deployment)
  - [Cron Setup for Automated Database Updates](#cron-setup-for-automated-database-updates)
  - [Email Configuration](#email-configuration)
  - [Maintenance](#maintenance)
    - [Regular Tasks](#regular-tasks)
    - [Troubleshooting](#troubleshooting)
  - [Contributing](#contributing)
    - [Development Guidelines](#development-guidelines)
    - [Repository Structure](#repository-structure)
  - [Support](#support)

## Project Overview

**Mobile-first PWA chatbot statistics website** for Dorkinians FC that processes natural language queries and returns visualized data using reusable chart components.

### Key Features

- **Mobile-First Design**: Optimized for mobile devices with native app feel
- **PWA Interface**: Progressive Web App with chatbot as primary interface
- **Natural Language Processing**: Process user questions and return visualized answers
- **Multiple Screens**: Footer navigation with swipeable sub-screens
- **Unified Data Schema**: Single source of truth for all data definitions
- **Database**: Neo4j Aura for efficient data storage and querying

## Architecture

### Unified Schema System

The project uses a **single source of truth** architecture where configuration files are automatically synchronized between repositories using Git hooks. This ensures perfect consistency without manual intervention.

**Single Source of Truth Locations:**

- **Schema**: `database-dorkinians/config/schema.js` (master) → automatically copied to `V3-Dorkinians-Website/lib/config/schema.js`
- **Data Sources**: `V3-Dorkinians-Website/netlify/functions/lib/config/dataSources.js` (master) → automatically copied to:
  - `database-dorkinians/config/dataSources.js` (for database seeder)
  - `V3-Dorkinians-Website/lib/config/dataSources.js` (for local builds)

```
┌─────────────────────────────────────────────────────────────┐
│                    V3-Dorkinians-Website                   │
│  ├── Frontend (Next.js PWA)                               │
│  ├── Netlify Functions                                    │
│  ├── lib/config/schema.js    # Auto-synced from database  │
│  ├── lib/config/dataSources.js # Auto-synced from database │
│  └── API Routes                                           │
└─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Database Integration                          │
├─────────────────────────────────────────────────────────────┤
│  database-dorkinians/                                      │
│  ├── config/schema.js          # Master schema (source)   │
│  ├── config/dataSources.js     # Master data sources (source) │
│  ├── services/schemaDrivenSeeder.js                        │
│  └── (database seeding logic)                              │
└─────────────────────────────────────────────┘
```

**Schema Alignment Process**:

1. **Edit schema in `database-dorkinians/config/schema.js`**
2. **Run sync script** - `npm run sync-config` copies to `V3-Dorkinians-Website/lib/config/schema.js`
3. **Deploy both repositories**

**Data Sources Alignment Process**:

1. **Edit data sources in `database-dorkinians/config/dataSources.js`**
2. **Run sync script** - `npm run sync-config` copies to both V3-Dorkinians-Website locations
3. **Deploy both repositories**

> **Note**: The system now uses npm scripts for manual synchronization. See [NPM Script Synchronization](#npm-script-synchronization) section below.

## Single Source of Truth Architecture

The project implements a **manual synchronization system** where each configuration file has exactly one master location and is distributed to all required locations using npm scripts.

### **Master File Locations**

| Configuration    | Master Location                             | Auto-Synced To                                                                                                          |
| ---------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Schema**       | `database-dorkinians/config/schema.js`      | `V3-Dorkinians-Website/lib/config/schema.js`                                                                            |
| **Data Sources** | `database-dorkinians/config/dataSources.js` | `V3-Dorkinians-Website/netlify/functions/lib/config/dataSources.js` + `V3-Dorkinians-Website/lib/config/dataSources.js` |

### **Why This Architecture?**

✅ **Eliminates Manual Sync Errors**: No more forgetting to copy files between repositories  
✅ **Perfect Consistency**: All locations always have identical content  
✅ **Clear Ownership**: Each file has one definitive source  
✅ **Controlled Updates**: Changes propagate when you choose to sync  
✅ **Build Compatibility**: Local builds work without path resolution issues

### **How It Works**

1. **Edit Master File**: Make changes in the designated master location
2. **Run Sync Script**: Execute `npm run sync-config` to copy files
3. **Manual Sync**: Files are copied to all required locations with proper headers
4. **Build Success**: All repositories have access to the latest configuration

> [Back to Table of Contents](#table-of-contents)

### Key Components

- **Frontend**: Next.js PWA with chatbot interface
- **Backend Services**: Netlify functions for API endpoints
- **Database Seeder**: Heroku service using unified schema
- **Schema Management**: Centralized in database-dorkinians repo
- **Data Sources**: Google Sheets CSV endpoints + FA website data

> [Back to Table of Contents](#table-of-contents)

## Quick Start

### Development Setup

1. **Start Neo4j Desktop locally**
2. **Start Neo4j graph database** on port `7687`
3. **Run development server**: `npm run dev`
4. **Access application**: http://localhost:3000

> [Back to Table of Contents](#table-of-contents)

### Database Verification

```bash
# View all nodes and relationships
MATCH (n)-[r]->(m) RETURN n, r, m;

# View all nodes
MATCH (n) RETURN n;
```

> [Back to Table of Contents](#table-of-contents)

## Environment Setup

### Prerequisites

- Node.js 18+
- Neo4j Aura database access
- OpenAI API key (for chatbot)

> [Back to Table of Contents](#table-of-contents)

### Neo4j Configuration

#### Local Development (Recommended)

```bash
# Install Neo4j Desktop
# Create local database: neo4j on port 7687

# Environment variables
DEV_NEO4J_URI=bolt://localhost:7687
DEV_NEO4J_USER=neo4j
DEV_NEO4J_PASSWORD=password
DEV_NEO4J_DATABASE=neo4j
```

> [Back to Table of Contents](#table-of-contents)

#### Production (Neo4j Aura)

```bash
PROD_NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io
PROD_NEO4J_USER=your-username
PROD_NEO4J_PASSWORD=your_aura_db_password
```

> [Back to Table of Contents](#table-of-contents)

### OpenAI Configuration

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

> [Back to Table of Contents](#table-of-contents)

### SMTP Configuration

```bash
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL_SECURE=false
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_TO_EMAIL=recipient@example.com
```

> [Back to Table of Contents](#table-of-contents)

### Installation

```bash
npm install
npm run test-neo4j  # Test Neo4j connection
npm run dev          # Start development server
```

> [Back to Table of Contents](#table-of-contents)

## NPM Script Synchronization

The project uses npm scripts to manually synchronize configuration files between repositories. This approach provides full control over when synchronization occurs and eliminates the complexity of Git hooks.

### **How It Works**

**Manual Sync**: Run `npm run sync-config` to copy all configuration files from `database-dorkinians/config/` to the appropriate locations in `V3-Dorkinians-Website`

**Files Synced**:

- `config/schema.js` → `V3-Dorkinians-Website/lib/config/schema.js`
- `config/dataSources.js` → `V3-Dorkinians-Website/lib/config/dataSources.js`
- `config/dataSources.js` → `V3-Dorkinians-Website/netlify/functions/lib/config/dataSources.js`

### **NPM Scripts**

- **`database-dorkinians`**: `npm run sync-config` - runs the sync script
- **`V3-Dorkinians-Website`**: `npm run sync-config` - runs the sync from the other repo

### **Workflow Examples**

**Updating Schema:**

```bash
# 1. Edit the schema in database-dorkinians (MASTER LOCATION)
cd database-dorkinians
# Edit config/schema.js

# 2. Run sync script
npm run sync-config

# 3. Review changes in V3-Dorkinians-Website
cd ../V3-Dorkinians-Website
git status

# 4. Commit the synced files
git add lib/config/schema.js
git commit -m "Sync schema from database-dorkinians"
```

**Updating Data Sources:**

```bash
# 1. Edit data sources in database-dorkinians (MASTER LOCATION)
cd database-dorkinians
# Edit config/dataSources.js

# 2. Run sync script
npm run sync-config

# 3. Review changes in V3-Dorkinians-Website
cd ../V3-Dorkinians-Website
git status

# 4. Commit the synced files
git add lib/config/dataSources.js netlify/functions/lib/config/dataSources.js
git commit -m "Sync data sources from database-dorkinians"
```

### **Benefits**

✅ **Reliable**: No Git hook failures or PowerShell issues  
✅ **Simple**: One command to sync everything  
✅ **Visible**: You see exactly what's being synced  
✅ **Flexible**: Sync when you want, not on every commit  
✅ **Maintainable**: Easy to modify and debug  
✅ **Cross-platform**: Works on Windows, Mac, and Linux  
✅ **Perfect Consistency**: All locations always have identical content

### **Troubleshooting**

**Sync Script Not Working:**

1. **Check Repository Structure**: Both repositories must be in the same parent directory

   ```
   /parent-directory/
   ├── database-dorkinians/
   └── V3-Dorkinians-Website/
   ```

2. **Verify Node.js**: Ensure Node.js is installed and accessible

   ```bash
   node --version
   npm --version
   ```

3. **Check File Permissions**: Ensure the sync script is readable

   ```bash
   # On Windows
   dir scripts\sync-config.js

   # On Unix/Linux/Mac
   ls -la scripts/sync-config.js
   ```

**Manual Sync Required (if npm script fails):**

1. **Schema**: Copy `database-dorkinians/config/schema.js` to `V3-Dorkinians-Website/lib/config/schema.js`
2. **Data Sources**: Copy `database-dorkinians/config/dataSources.js` to both V3-Dorkinians-Website locations
3. **Update Headers**: Add the appropriate warning header to the target files
4. **Commit Changes**: Commit the manually synced files

> [Back to Table of Contents](#table-of-contents)

## Development Workflow

### Schema Updates

When data structures change:

1. **Update Unified Schema**: Modify `database-dorkinians/config/schema.js`
2. **Sync Configuration**: Run `npm run sync-config` to copy to V3-Dorkinians-Website
3. **Test Changes**: Use database seeder test endpoints
4. **Deploy Updates**: Push changes to both repositories
5. **Verify Integration**: Test frontend functionality

> [Back to Table of Contents](#table-of-contents)

### Managing Schema Changes

#### Adding/Removing CSV Columns

When Google Sheets structure changes:

1. **Update Unified Schema** (in `database-dorkinians` repo):

   ```bash
   cd database-dorkinians
   nano config/schema.js
   ```

2. **Modify Table Schema**:

   ```javascript
   TBL_Players: {
     csvColumns: {
       'ID': 'id',
       'PLAYER NAME': 'name',
       'NEW COLUMN': 'newProperty',  // Add new columns
       // Remove old columns from mapping
     },
     requiredColumns: ['ID', 'PLAYER NAME'],
     properties: {
       id: { type: 'string', required: true },
       name: { type: 'string', required: true },
       newProperty: { type: 'string', required: false }, // Add properties
       // Remove old properties
     }
   }
   ```

3. **Test Schema Changes**:

   ```bash
   # Test locally
   node test-csv.js

   # Test via API
   curl -X POST "https://your-heroku-app.herokuapp.com/test-csv" \
     -H "Content-Type: application/json" \
     -d '{"url": "YOUR_CSV_URL", "dataSourceName": "TBL_Players"}'
   ```

4. **Deploy Changes**:

   ```bash
   # Commit and push to database-dorkinians
   git add config/schema.js
   git commit -m "Update schema for TBL_Players: add new column, remove old column"
   git push origin main
   git push heroku main
   ```

5. **Update V3 Repository**:
   ```bash
   cd ../V3-Dorkinians-Website
   git submodule update --remote
   git add v3-repo
   git commit -m "Update database-dorkinians submodule to latest schema"
   git push origin main
   ```

> [Back to Table of Contents](#table-of-contents)

#### Schema Validation

The system automatically validates:

- **Column Presence**: Required columns exist
- **Data Types**: Type conversions work correctly
- **Required Fields**: Mandatory fields have values
- **Relationship Rules**: Relationship creation logic

### Data Seeding

**Hybrid Approach**:

- **Netlify Function**: Lightweight trigger endpoint
- **Heroku Service**: Long-running seeding process using unified schema
- **Email Notifications**: Automated status updates during seeding

> [Back to Table of Contents](#table-of-contents)

### Testing

```bash
# Frontend tests
npm test

# API endpoint tests
npm run test:api

# Database seeding tests
npm run test:seeding

# Schema integration test
node -e "console.log('Schema integration test - check database seeding functionality');"
```

> [Back to Table of Contents](#table-of-contents)

## Deployment

### Netlify Deployment

1. **Build Configuration**:

   ```bash
   npm run build
   npm run export
   ```

2. **Environment Variables**:
   - Set all required environment variables in Netlify dashboard
   - Ensure `HEROKU_SEEDER_URL` points to your database seeder service

3. **Deploy**:
   ```bash
   netlify deploy --prod
   ```

> [Back to Table of Contents](#table-of-contents)

### Database Seeder Deployment

**Separate Heroku Service**:

- **Repository**: `database-dorkinians`
- **Service**: Long-running Neo4j seeding operations
- **Integration**: Triggered via Netlify functions
- **Monitoring**: Email notifications and status endpoints

> [Back to Table of Contents](#table-of-contents)

## Cron Setup for Automated Database Updates

The system supports automated daily database updates using external cron services.

### **External Cron Service Setup**

**Using cron-job.org (Free):**

1. Sign up at [cron-job.org](https://cron-job.org)
2. Create new cronjob:
   - **Title**: `Dorkinians Daily Database Update`
   - **URL**: `https://your-site.netlify.app/.netlify/functions/trigger-seed?environment=production`
   - **Schedule**: Daily at 5:00 AM (`0 5 * * *`)
   - **Timeout**: 1800 seconds (30 minutes)
   - **Retry**: 3 attempts on failure

**Alternative Services:**

- EasyCron: [easycron.com](https://easycron.com)
- Cronitor: [cronitor.io](https://cronitor.io)
- UptimeRobot: [uptimerobot.com](https://uptimerobot.com)

### **Manual Testing**

```bash
# Test the function directly
curl "https://your-site.netlify.app/.netlify/functions/trigger-seed?environment=production"
```

### **Expected Response**

```json
{
	"success": true,
	"message": "Database seeding completed successfully",
	"environment": "production",
	"timestamp": "2024-01-01T06:00:00.000Z",
	"result": {
		"success": true,
		"exitCode": 0,
		"nodesCreated": 1500,
		"relationshipsCreated": 3000
	}
}
```

> [Back to Table of Contents](#table-of-contents)

## Email Configuration

The system sends automated email notifications for CSV header validation failures and seeding completion.

### **Required Environment Variables**

```bash
# Email Configuration for Notifications
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL_SECURE=false
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_TO_EMAIL=your-email@gmail.com
```

### **Email Provider Examples**

**Gmail:**

```bash
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL_SECURE=false
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Use App Password, not regular password
```

**Outlook/Hotmail:**

```bash
SMTP_SERVER=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_EMAIL_SECURE=false
SMTP_USERNAME=your-email@outlook.com
SMTP_PASSWORD=your-password
```

### **Gmail App Password Setup**

1. Enable 2-Factor Authentication on your Google account
2. Go to Google Account settings → Security → App passwords
3. Generate an app password for "Mail"
4. Use this app password in `SMTP_PASSWORD` (not your regular Gmail password)

### **What Happens When Headers Change**

1. **Validation Fails**: Seeding process stops immediately
2. **Email Sent**: Detailed notification with:
   - Which data sources failed
   - Expected vs. actual headers
   - Missing and extra headers
   - Direct links to CSV files
3. **Logging**: All failures logged to `logs/seeding-errors.log`
4. **Seeding Halted**: Database remains unchanged until headers are fixed

> [Back to Table of Contents](#table-of-contents)

## Maintenance

### Regular Tasks

1. **Schema Review**: Periodically review unified schema configuration
2. **Data Quality**: Monitor CSV data quality and structure
3. **Performance**: Track API response times and database query performance
4. **Security**: Review API access and authentication mechanisms

> [Back to Table of Contents](#table-of-contents)

### Troubleshooting

- **Schema Issues**: Check `database-dorkinians/config/schema.js`
- **Data Problems**: Verify CSV structure and Google Sheets permissions
- **Performance**: Monitor Neo4j query execution times
- **Integration**: Test database seeder connectivity

> [Back to Table of Contents](#table-of-contents)

## Contributing

### Development Guidelines

1. **Schema Changes**: Always update the unified schema first
2. **Testing**: Include tests for new functionality
3. **Documentation**: Update relevant documentation
4. **Code Quality**: Follow established patterns and linting rules

> [Back to Table of Contents](#table-of-contents)

### Repository Structure

- **Frontend**: Next.js components and pages
- **API**: Netlify functions and API routes
- **Services**: Business logic and data processing
- **Configuration**: Environment and schema configuration
- **Documentation**: Project documentation and guides

> [Back to Table of Contents](#table-of-contents)

## Support

**Technical Issues**:

1. **Schema Issues**: Check unified schema configuration
2. **Data Problems**: Verify CSV structure and permissions
3. **Performance**: Monitor database and API performance
4. **Integration**: Test database seeder connectivity

> [Back to Table of Contents](#table-of-contents)
