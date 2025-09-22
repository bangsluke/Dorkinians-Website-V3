# Additional Detail - Dorkinians FC Statistics Website

> Detailed technical documentation for developers working on the Dorkinians FC statistics website.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Architecture Details](#architecture-details)
  - [Unified Schema System](#unified-schema-system)
  - [Single Source of Truth Architecture](#single-source-of-truth-architecture)
    - [Master File Locations](#master-file-locations)
    - [Why This Architecture?](#why-this-architecture)
    - [How It Works](#how-it-works)
  - [Tech Stack \& Architecture](#tech-stack--architecture)
    - [Core Technologies](#core-technologies)
    - [Data Layer Strategy](#data-layer-strategy)
    - [PWA Implementation](#pwa-implementation)
    - [Screen Architecture](#screen-architecture)
- [Environment Setup](#environment-setup)
  - [Prerequisites](#prerequisites)
  - [Neo4j Configuration](#neo4j-configuration)
    - [Development Environment](#development-environment)
    - [Production (Neo4j Aura)](#production-neo4j-aura)
  - [OpenAI Configuration](#openai-configuration)
  - [SMTP Configuration](#smtp-configuration)
  - [Installation](#installation)
- [Schema Management](#schema-management)
  - [Schema Alignment Process](#schema-alignment-process)
  - [Automated Syncing](#automated-syncing)
  - [Manual Process](#manual-process)
- [PWA Configuration](#pwa-configuration)
  - [PWA Setup](#pwa-setup)
  - [Icon Requirements](#icon-requirements)
  - [iOS Splash Screens](#ios-splash-screens)
  - [Data Persistence](#data-persistence)
  - [Update Strategy](#update-strategy)
- [NPM Script Synchronization](#npm-script-synchronization)
  - [How It Works](#how-it-works-1)
  - [NPM Scripts](#npm-scripts)
  - [Workflow Examples](#workflow-examples)
  - [Benefits](#benefits)
  - [Troubleshooting](#troubleshooting)
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
- [PWA Release Process](#pwa-release-process)
  - [Version Management](#version-management)
  - [Release Checklist](#release-checklist)
- [Cron Setup](#cron-setup)
  - [Cron Setup for Automated Database Updates](#cron-setup-for-automated-database-updates)
    - [External Cron Service Setup](#external-cron-service-setup)
    - [Manual Testing](#manual-testing)
    - [Expected Response](#expected-response)
  - [Cron Setup for Weekly Chatbot Testing](#cron-setup-for-weekly-chatbot-testing)
    - [External Cron Service Setup](#external-cron-service-setup-1)
    - [Manual Testing](#manual-testing-1)
    - [Expected Response](#expected-response-1)
    - [Test Coverage](#test-coverage)
    - [Email Reports](#email-reports)
- [Email Configuration](#email-configuration)
  - [Required Environment Variables](#required-environment-variables)
  - [Email Provider Examples](#email-provider-examples)
  - [Gmail App Password Setup](#gmail-app-password-setup)
  - [What Happens When Headers Change](#what-happens-when-headers-change)
- [Maintenance](#maintenance)
  - [Regular Tasks](#regular-tasks)
  - [Troubleshooting](#troubleshooting-1)
- [Contributing](#contributing)
  - [Development Guidelines](#development-guidelines)
  - [Repository Structure](#repository-structure)
- [Support](#support)

## Architecture Details

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

**Schema Alignment Process:**

1. **Edit schema in `database-dorkinians/config/schema.js`**
2. **Run sync script** - `npm run sync-config` copies to `V3-Dorkinians-Website/lib/config/schema.js`
3. **Deploy both repositories**

**Data Sources Alignment Process:**

1. **Edit data sources in `database-dorkinians/config/dataSources.js`**
2. **Run sync script** - `npm run sync-config` copies to both V3-Dorkinians-Website locations
3. **Deploy both repositories**

> [Back to Table of Contents](#table-of-contents)

### Single Source of Truth Architecture

The project implements a **manual synchronization system** where each configuration file has exactly one master location and is distributed to all required locations using npm scripts.

#### Master File Locations

| Configuration    | Master Location                             | Auto-Synced To                                                                                                          |
| ---------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Schema**       | `database-dorkinians/config/schema.js`      | `V3-Dorkinians-Website/lib/config/schema.js`                                                                            |
| **Data Sources** | `database-dorkinians/config/dataSources.js` | `V3-Dorkinians-Website/netlify/functions/lib/config/dataSources.js` + `V3-Dorkinians-Website/lib/config/dataSources.js` |

#### Why This Architecture?

✅ **Eliminates Manual Sync Errors**: No more forgetting to copy files between repositories  
✅ **Perfect Consistency**: All locations always have identical content  
✅ **Clear Ownership**: Each file has one definitive source  
✅ **Controlled Updates**: Changes propagate when you choose to sync  
✅ **Build Compatibility**: Local builds work without path resolution issues

#### How It Works

1. **Edit Master File**: Make changes in the designated master location
2. **Run Sync Script**: Execute `npm run sync-config` to copy files
3. **Manual Sync**: Files are copied to all required locations with proper headers
4. **Build Success**: All repositories have access to the latest configuration

> [Back to Table of Contents](#table-of-contents)

### Tech Stack & Architecture

#### Core Technologies

**Frontend: Next.js 14 + App Router**

- **PWA Support**: Built-in PWA capabilities with `next-pwa`
- **Mobile Performance**: Automatic code splitting, image optimization, static generation
- **Developer Experience**: Familiar React patterns, excellent TypeScript support
- **Deployment**: Optimized for Netlify with edge functions
- **Mobile-First**: Built-in responsive design patterns

**Mobile Navigation: Framer Motion + Hybrid Navigation**

- **Native Feel**: Smooth animations matching iOS/Android
- **Main Navigation**: Footer icon-based navigation between primary pages
- **Sub-Navigation**: Swipe gestures within specific pages (e.g., Stats sub-screens)
- **Gesture Support**: Natural mobile interactions for content exploration
- **Performance**: Hardware-accelerated animations

**UI Components: Tailwind CSS + Headless UI**

- **Mobile Optimization**: Touch-friendly component sizing (44px minimum)
- **Responsive Design**: Automatic mobile-first breakpoints
- **Accessibility**: Built-in mobile accessibility features
- **Performance**: Minimal CSS bundle size

**Backend: Next.js API Routes + Edge Runtime**

- **Unified Stack**: Single codebase, shared types
- **Edge Functions**: Global distribution, minimal latency
- **CSV Processing**: Built-in fetch API for Google Sheets
- **Cost**: No additional hosting costs

**Database: Neo4j Aura**

- **Data Volume**: Handle 50k+ rows × 50 columns efficiently
- **Query Performance**: Graph database excels at complex sports statistics
- **Data Relationships**: Natural fit for player-team-fixture relationships
- **Scheduled Updates**: Built-in job scheduling with email notifications
- **Existing Infrastructure**: Already available in your environment

**Visualization: Recharts + Custom Components**

- **React Native**: Seamless Next.js integration
- **Performance**: Lightweight, optimized for mobile
- **Customization**: Easy to create reusable chart components
- **Bundle Size**: Tree-shakeable, minimal impact

**State Management: Zustand**

- **Mobile Performance**: Lightweight state management
- **Offline Support**: Easy integration with PWA caching
- **Navigation State**: Manage screen transitions and data

#### Data Layer Strategy

**Hybrid Caching Strategy:**

1. **Static Generation**: Pre-build common queries at build time
2. **ISR (Incremental Static Regeneration)**: Update data every 6-12 hours
3. **Edge Caching**: Cache responses at CDN level
4. **Client Caching**: Store processed data in IndexedDB for offline
5. **Database Storage**: Neo4j for complex queries and data relationships

**Update Strategy:**

- **Automated Refresh**: Daily scheduled jobs (configurable frequency)
- **Failure Notifications**: Email alerts on update failures
- **Data Validation**: Schema validation and error handling
- **Incremental Updates**: Smart updates vs. full refresh

#### PWA Implementation

**Core Features:**

- **Service Worker**: Offline-first strategy with background sync
- **App Manifest**: Native app feel and installation prompts
- **Background Sync**: Data updates when connection restored
- **Push Notifications**: New stats and update notifications

**Mobile-Specific Features:**

- **Touch Interactions**: Footer icon navigation, swipe within pages, tap to expand
- **Responsive Design**: Mobile-first breakpoints, landscape/portrait support
- **Touch Targets**: 44px minimum button sizes
- **Thumb Navigation**: Optimized for one-handed use
- **Navigation Pattern**: Footer icons for main pages, swipe for sub-content
- **Header Access**: Club logo and settings always visible, consistent branding

#### Screen Architecture

**Main Pages (Footer Navigation):**

1. **Homepage**: Chatbot input bar centered on screen
2. **Stats**: Container page with swipeable sub-screens
3. **TOTW**: Team of the week with clickable SVG graphics
4. **Club Information**: Static content (captains, awards, etc.)

**Stats Page Sub-Screens (Swipeable):**

- **Player Stats**: Filterable player statistics with graphical components
- **Team Stats**: Team-specific statistics and analytics
- **Club Stats**: Club-wide analytics and statistics
- **Comparison**: Side-by-side player statistics comparison

**Header Elements (All Screens):**

- **Club Logo**: Visible across all screens
- **Settings Icon**: Accessible from header on all pages

> [Back to Table of Contents](#table-of-contents)

## Environment Setup

### Prerequisites

- Node.js 18+
- Neo4j Aura database access
- OpenAI API key (for chatbot)

> [Back to Table of Contents](#table-of-contents)

### Neo4j Configuration

#### Development Environment

```bash
# All environments now use Neo4j Aura for consistency
# No local Neo4j Desktop required

# Environment variables (same as production)
PROD_NEO4J_URI=neo4j+s://your-aura-instance.databases.neo4j.io
PROD_NEO4J_USER=neo4j
PROD_NEO4J_PASSWORD=your-aura-password
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

## Schema Management

### Schema Alignment Process

The project uses a **single source of truth** architecture where `database-dorkinians/config/schema.js` is the master schema file that must be manually synchronized to `V3-Dorkinians-Website/lib/config/schema.js`.

**Master Location:**
- `database-dorkinians/config/schema.js` (source of truth)

**Synced Location:**
- `V3-Dorkinians-Website/lib/config/schema.js` (copy for alignment)

### Automated Syncing

**NPM Script (Recommended):**
```bash
cd database-dorkinians
npm run sync-schema
```

**PowerShell Script (Windows):**
```powershell
cd database-dorkinians
.\scripts\sync-schema.ps1
```

**VS Code Tasks:**
- Press `Ctrl+Shift+P` → "Tasks: Run Task" → "Sync Schema to V3-Dorkinians-Website"

### Manual Process

**When Making Schema Changes:**

1. **Edit schema in `database-dorkinians/config/schema.js`**
2. **Run sync script** or manually copy to `V3-Dorkinians-Website/lib/config/schema.js`
3. **Deploy both repositories** to ensure consistency

**Schema Dependencies:**
- `lib/config/schemaBridge.js` - Main schema bridge
- `lib/services/csvHeaderValidator.js` - CSV validation
- `lib/services/dataSeederService.js` - Data seeding logic
- `app/api/seed-data/route.js` - API endpoint

> [Back to Table of Contents](#table-of-contents)

## PWA Configuration

### PWA Setup

**Core PWA Files:**
```
public/
├── manifest.json                 # PWA manifest
├── sw.js                        # Service worker (auto-generated)
├── workbox-*.js                 # Workbox library (auto-generated)
└── icons/                       # Icon directory
    ├── icon-16x16.png          # Small favicon
    ├── icon-32x32.png          # Standard favicon
    ├── icon-72x72.png          # Android small
    ├── icon-96x96.png          # Android medium
    ├── icon-128x128.png        # Android large
    ├── icon-144x144.png        # Android xlarge
    ├── icon-152x152.png        # iOS touch icon
    ├── icon-192x192.png        # Android xlarge + maskable
    ├── icon-384x384.png        # Android xxlarge
    └── icon-512x512.png        # Android xxlarge + maskable
```

### Icon Requirements

**Design Specifications:**
- **Background**: #1C8841 (Dorkinians green)
- **Foreground**: White elements (logo, text)
- **Format**: PNG with transparency support
- **Quality**: High resolution, crisp edges

**Icon Sizes and Purposes:**

| Size    | Purpose                    | Platform        |
| ------- | -------------------------- | --------------- |
| 16x16   | Favicon                    | All browsers    |
| 32x32   | Favicon                    | All browsers    |
| 72x72   | Android small              | Android devices |
| 96x96   | Android medium             | Android devices |
| 128x128 | Android large              | Android devices |
| 144x144 | Android xlarge             | Android devices |
| 152x152 | iOS touch                  | iOS devices     |
| 192x192 | Android xlarge + maskable  | Android + PWA   |
| 384x384 | Android xxlarge            | Android devices |
| 512x512 | Android xxlarge + maskable | Android + PWA   |

### iOS Splash Screens

**Device Coverage:**
- **iPhone 6.7"**: 1290x2796 (portrait), 2796x1290 (landscape)
- **iPhone 6.1"**: 1170x2532 (portrait), 2532x1170 (landscape)
- **iPhone 5.5"**: 1242x2208 (portrait), 2208x1242 (landscape)
- **iPad 12.9"**: 2048x2732 (portrait), 2732x2048 (landscape)
- **iPad 11"**: 1668x2388 (portrait), 2388x1668 (landscape)

**Generation Process:**
1. Open `public/apple-touch-startup-image.html` in a browser
2. Use the download buttons to generate each splash screen
3. Save files with exact names in the `public/` directory

### Data Persistence

**localStorage Implementation:**
- **Player Selection**: Automatically saves and restores the last selected player
- **Cross-Session Persistence**: Data survives browser restarts, app closures, and device reboots
- **PWA Integration**: Works seamlessly with PWA installation and offline functionality

**Storage Keys:**
- `dorkinians-selected-player`: Stores the currently selected player name

### Update Strategy

**Version Management:**
1. **Increment version** in `package.json` for each release
2. **Service worker** automatically detects updates
3. **Update notification** appears to installed PWA users
4. **One-click update** process for seamless experience

**Update Flow:**
```
User has PWA installed → New version deployed →
Service worker detects update → Update notification appears →
User clicks "Update Now" → Page reloads → New version active
```

**Testing:**
- **Chrome DevTools**: Application tab → Manifest
- **Lighthouse**: PWA audit score
- **Real devices**: Install on iOS/Android
- **Offline functionality**: Test without internet

> [Back to Table of Contents](#table-of-contents)

## NPM Script Synchronization

The project uses npm scripts to manually synchronize configuration files between repositories. This approach provides full control over when synchronization occurs and eliminates the complexity of Git hooks.

### How It Works

**Manual Sync**: Run `npm run sync-config` to copy all configuration files from `database-dorkinians/config/` to the appropriate locations in `V3-Dorkinians-Website`

**Files Synced:**

- `config/schema.js` → `V3-Dorkinians-Website/lib/config/schema.js`
- `config/dataSources.js` → `V3-Dorkinians-Website/lib/config/dataSources.js`
- `config/dataSources.js` → `V3-Dorkinians-Website/netlify/functions/lib/config/dataSources.js`

### NPM Scripts

- **`database-dorkinians`**: `npm run sync-config` - runs the sync script
- **`V3-Dorkinians-Website`**: `npm run sync-config` - runs the sync from the other repo

### Workflow Examples

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

### Benefits

✅ **Reliable**: No Git hook failures or PowerShell issues  
✅ **Simple**: One command to sync everything  
✅ **Visible**: You see exactly what's being synced  
✅ **Flexible**: Sync when you want, not on every commit  
✅ **Maintainable**: Easy to modify and debug  
✅ **Cross-platform**: Works on Windows, Mac, and Linux  
✅ **Perfect Consistency**: All locations always have identical content

### Troubleshooting

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

**Hybrid Approach:**

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

**Separate Heroku Service:**

- **Repository**: `database-dorkinians`
- **Service**: Long-running Neo4j seeding operations
- **Integration**: Triggered via Netlify functions

> [Back to Table of Contents](#table-of-contents)

## PWA Release Process

### Version Management

The application uses a centralized version management system to ensure consistency across all components:

**Version Sources:**

- **Primary**: `config/config.ts` - Main app configuration
- **Secondary**: `package.json` - NPM package version (should match app config)

**Files to Update for New Release:**

1. `config/config.ts` - Update `version` field
2. `package.json` - Update `version` field to match

**Example:**

```typescript
// config/config.ts
export const appConfig = {
	version: "1.1.3", // Update this
	name: "Dorkinians FC",
	// ... other config
} as const;
```

```json
// package.json
{
	"name": "dorkinians-website",
	"version": "1.1.3" // Update this to match
	// ... other fields
}
```

### Release Checklist

**Before Release:**

- [ ] Update version in `config/config.ts`
- [ ] Update version in `package.json`
- [ ] Test PWA update flow locally
- [ ] Verify version displays correctly in settings page
- [ ] Check that update toasts show correct version number

**Post-Release:**

- [ ] Verify PWA update notifications work
- [ ] Test update flow on mobile devices
- [ ] Monitor for any version-related issues

> [Back to Table of Contents](#table-of-contents)

## Cron Setup

A Cron Service, using cron-job.org, is used to automate the database updates and weekly chatbot testing.

**Alternative Services:**

- EasyCron: [easycron.com](https://easycron.com)
- Cronitor: [cronitor.io](https://cronitor.io)
- UptimeRobot: [uptimerobot.com](https://uptimerobot.com)

### Cron Setup for Automated Database Updates

The system supports automated daily database updates using external cron services.

#### External Cron Service Setup

**Using cron-job.org (Free):**

1. Sign up at [cron-job.org](https://cron-job.org)
2. Create new cronjob:
   - **Title**: `Dorkinians Daily Database Update`
   - **URL**: `https://your-site.netlify.app/.netlify/functions/trigger-seed?environment=production`
   - **Schedule**: Daily at 5:00 AM (`0 5 * * *`)
   - **Timeout**: 1800 seconds (30 minutes)
   - **Retry**: 3 attempts on failure

#### Manual Testing

```bash
# Test the function directly
curl "https://your-site.netlify.app/.netlify/functions/trigger-seed?environment=production"
```

#### Expected Response

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

### Cron Setup for Weekly Chatbot Testing

The system supports automated weekly chatbot testing using external cron services to ensure the chatbot functionality remains operational. The system uses a **random test selection approach** that ensures comprehensive coverage over time while staying within execution limits.

#### Random Test Selection Approach

**How It Works:**
- **Total Available Tests**: 204 tests (3 players × 68 test configurations)
- **Random Selection**: Each week, randomly selects 2 tests from the full set
- **No Duplicates**: Ensures the same test isn't run twice in a single execution
- **Comprehensive Coverage**: Over time, all 204 tests will be tested
- **Timeout Safe**: Designed to complete within 30-second Netlify function limit

**Using cron-job.org (Free):**

1. Sign up at [cron-job.org](https://cron-job.org)
2. Create new cronjob:
   - **Title**: `Weekly Random Chatbot Test`
   - **URL**: `https://dorkinians-website-v3.netlify.app/api/chatbot-test`
   - **Method**: POST
          - **Request Body**: `{"emailAddress": "your-email@example.com", "maxTests": 2}`
   - **Headers**: `Content-Type: application/json`
   - **Schedule**: Weekly on Saturday at 5:00 AM (`0 5 * * 6`)
   - **Timeout**: 30 seconds
   - **Retry**: 2 attempts on failure

**Manual Testing:**
```bash
       curl -X POST "https://dorkinians-website-v3.netlify.app/api/chatbot-test" \
         -H "Content-Type: application/json" \
         -d '{"emailAddress": "your-email@example.com", "maxTests": 2}'
```

#### Expected Response

```json
{
  "success": true,
  "message": "Random chatbot test completed successfully",
         "selectedTests": 2,
         "totalAvailableTests": 204,
         "processedTests": 2,
         "passedTests": 1,
         "failedTests": 1,
         "successRate": "50.0%",
         "output": "Random tests completed: 1/2 passed (2 selected from 204 available)"
}
```

#### Test Coverage

**Random Selection Benefits:**
- **Efficient**: Tests only 2 random tests per week (1% of total)
- **Comprehensive Over Time**: All 204 tests will be tested within ~102 weeks
- **No Duplicates**: Each weekly run tests different combinations
- **Timeout Safe**: Always completes within 30 seconds
- **Diverse Coverage**: Tests different players and statistics each week

**Test Categories Covered:**
- **Basic Statistics**: Goals, assists, appearances, minutes, etc.
- **Advanced Statistics**: Goals per appearance, minutes per goal, etc.
- **Home/Away Statistics**: Home wins, away wins, percentages
- **Team-Specific Statistics**: 1s, 2s, 3s through 8s appearances and goals
- **Seasonal Statistics**: 2016/17 through 2021/22 seasons
  - Positional Statistics (goalkeeper, defender, midfielder, forward)

#### Email Reports

Test results are automatically emailed to the configured address with:
- Comprehensive test summary
- Detailed pass/fail breakdown with expected vs received values
- Cypher query analysis
- Performance metrics
- Recommendations for improvements

> [Back to Table of Contents](#table-of-contents)

## Email Configuration

The system sends automated email notifications for CSV header validation failures and seeding completion.

### Required Environment Variables

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

### Email Provider Examples

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

### Gmail App Password Setup

1. Enable 2-Factor Authentication on your Google account
2. Go to Google Account settings → Security → App passwords
3. Generate an app password for "Mail"
4. Use this app password in `SMTP_PASSWORD` (not your regular Gmail password)

### What Happens When Headers Change

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

**Technical Issues:**

1. **Schema Issues**: Check unified schema configuration
2. **Data Problems**: Verify CSV structure and permissions
3. **Performance**: Monitor database and API performance
4. **Integration**: Test database seeder connectivity

> [Back to Table of Contents](#table-of-contents)
