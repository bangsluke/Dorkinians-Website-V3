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
  - [CORS Configuration](#cors-configuration)
  - [Environment Variable Validation](#environment-variable-validation)
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
    - [Random Test Selection Approach](#random-test-selection-approach)
    - [Expected Response](#expected-response-1)
    - [Test Coverage](#test-coverage)
    - [Email Reports](#email-reports)
- [Email Configuration](#email-configuration)
  - [Required Environment Variables](#required-environment-variables)
  - [Email Provider Examples](#email-provider-examples)
  - [Gmail App Password Setup](#gmail-app-password-setup)
  - [What Happens When Headers Change](#what-happens-when-headers-change)
- [Umami Analytics Setup](#umami-analytics-setup)
  - [Overview](#overview)
  - [Quick Start: Umami Cloud (Recommended)](#quick-start-umami-cloud-recommended)
    - [Step 1: Sign Up](#step-1-sign-up)
    - [Step 2: Add Your Website](#step-2-add-your-website)
    - [Step 3: Get Your Tracking Script](#step-3-get-your-tracking-script)
    - [Step 4: Configure Environment Variables](#step-4-configure-environment-variables)
  - [Configuration](#configuration)
    - [Environment Variables](#environment-variables)
    - [Obtaining Website ID and Script URL](#obtaining-website-id-and-script-url)
  - [Integration with Next.js](#integration-with-nextjs)
  - [Troubleshooting](#troubleshooting-1)
    - [Common Issues](#common-issues)
    - [Debugging Steps](#debugging-steps)
  - [Advanced: Self-Hosted Umami (Optional)](#advanced-self-hosted-umami-optional)
    - [Self-Hosted with Docker](#self-hosted-with-docker)
    - [Vercel Deployment](#vercel-deployment)
    - [Railway Deployment](#railway-deployment)
    - [DigitalOcean App Platform](#digitalocean-app-platform)
    - [Database Setup](#database-setup)
      - [PostgreSQL Setup](#postgresql-setup)
      - [MySQL Setup](#mysql-setup)
    - [Self-Hosted Security Best Practices](#self-hosted-security-best-practices)
- [Google OAuth Setup Guide](#google-oauth-setup-guide)
  - [Prerequisites](#prerequisites-1)
  - [Step 1: Create Google Cloud Project](#step-1-create-google-cloud-project)
  - [Step 2: Enable Google Identity API](#step-2-enable-google-identity-api)
  - [Step 3: Create OAuth 2.0 Credentials](#step-3-create-oauth-20-credentials)
  - [Step 4: Configure Authorized Redirect URIs](#step-4-configure-authorized-redirect-uris)
  - [Step 5: Add Environment Variables](#step-5-add-environment-variables)
  - [Step 6: Generate AUTH\_SECRET](#step-6-generate-auth_secret)
  - [Troubleshooting](#troubleshooting-2)
    - ["Invalid redirect URI" error](#invalid-redirect-uri-error)
    - ["Access blocked: This app's request is invalid" error](#access-blocked-this-apps-request-is-invalid-error)
    - ["Email not authorized" error](#email-not-authorized-error)
    - [Session not persisting](#session-not-persisting)
    - [Can't access /admin after authentication](#cant-access-admin-after-authentication)
- [Chatbot Question Processing Guide](#chatbot-question-processing-guide)
  - [Overview](#overview-1)
  - [Question Flow Overview](#question-flow-overview)
  - [Frontend to Backend Communication](#frontend-to-backend-communication)
  - [Question Analysis Pipeline](#question-analysis-pipeline)
  - [Entity Extraction Priority Order](#entity-extraction-priority-order)
  - [Stat Type Extraction Priority](#stat-type-extraction-priority)
  - [Question Type Determination Priority](#question-type-determination-priority)
  - [Metric Extraction and Correction Priority](#metric-extraction-and-correction-priority)
  - [Cypher Query Generation](#cypher-query-generation)
  - [Query Building Priority Order](#query-building-priority-order)
    - [1. Query Structure Decision](#1-query-structure-decision)
    - [2. Base Query Pattern](#2-base-query-pattern)
    - [3. WHERE Clause Conditions (Applied in Order)](#3-where-clause-conditions-applied-in-order)
    - [4. RETURN Clause](#4-return-clause)
    - [5. Special Case Queries](#5-special-case-queries)
  - [Potential Efficiency Improvements](#potential-efficiency-improvements)
    - [1. Entity Extraction Optimization](#1-entity-extraction-optimization)
    - [2. Stat Type Matching](#2-stat-type-matching)
    - [3. Question Type Determination](#3-question-type-determination)
    - [4. Metric Correction Chain](#4-metric-correction-chain)
    - [5. Query Building](#5-query-building)
    - [6. Fuzzy Matching Performance](#6-fuzzy-matching-performance)
    - [7. Database Query Optimization](#7-database-query-optimization)
    - [8. Early Exit Opportunities](#8-early-exit-opportunities)
  - [Conclusion](#conclusion)
- [Maintenance](#maintenance)
  - [Regular Tasks](#regular-tasks)
  - [Troubleshooting](#troubleshooting-3)
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

### CORS Configuration

The application uses environment-based CORS configuration for security. The `ALLOWED_ORIGIN` environment variable controls which origins are allowed to access the API endpoints.

**Configuration:**

```bash
# CORS Configuration (optional - defaults to production URL)
ALLOWED_ORIGIN=https://dorkinians-website-v3.netlify.app
```

**Implementation:**

- CORS headers are configured in API routes using the `ALLOWED_ORIGIN` environment variable
- Defaults to production URL if not specified: `https://dorkinians-website-v3.netlify.app`
- All API routes use consistent CORS configuration for security
- Wildcard (`*`) CORS is not used for security reasons

**Files:**

- `app/api/chatbot/route.ts` - Main chatbot endpoint with CORS configuration
- Other API routes follow the same pattern

> [Back to Table of Contents](#table-of-contents)

### Environment Variable Validation

The application validates all required environment variables at startup using Zod schema validation. This ensures that the application fails fast with clear error messages if required configuration is missing.

**Validation Implementation:**

- **File**: `lib/config/envValidation.ts`
- **Library**: Zod for schema validation
- **Validation Point**: App startup in `app/layout.tsx`

**Required Variables:**

The following environment variables are validated as required:

- `PROD_NEO4J_URI` - Neo4j database connection URI
- `PROD_NEO4J_USER` - Neo4j database username
- `PROD_NEO4J_PASSWORD` - Neo4j database password

**Optional Variables:**

The following variables are validated but optional:

- `OPENAI_API_KEY` - OpenAI API key (only if used)
- `ALLOWED_ORIGIN` - CORS allowed origin (defaults to production URL)
- `SMTP_*` - Email configuration variables
- `NEXT_PUBLIC_UMAMI_*` - Umami Analytics variables
- `HEROKU_SEEDER_URL` - Heroku seeder service URL

**Error Handling:**

- In **production**: Application throws an error and fails to start if required variables are missing
- In **development**: Application logs warnings but continues to allow for easier local development

**Usage:**

```typescript
import { validateEnv, getValidatedEnv } from "@/lib/config/envValidation";

// Validate and get errors (non-throwing)
const result = validateEnv();
if (!result.success) {
  console.error("Validation errors:", result.errors);
}

// Validate and throw if invalid (for startup)
const env = getValidatedEnv();
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
   - **Timeout**: 1200 seconds (20 minutes)
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
- **Random Selection**: Each week, randomly selects 1 test from the full set
- **No Duplicates**: Ensures the same test isn't run twice in a single execution
- **Comprehensive Coverage**: Over time, all 204 tests will be tested
- **Timeout Safe**: Designed to complete within 30-second Netlify function limit

**Using cron-job.org (Free):**

1. Sign up at [cron-job.org](https://cron-job.org)
2. Create new cronjob:
   - **Title**: `Weekly Random Chatbot Test`
   - **URL**: `https://dorkinians-website-v3.netlify.app/api/chatbot-test`
   - **Method**: POST - **Request Body**: `{"emailAddress": "your-email@example.com", "maxTests": 1}`
   - **Headers**: `Content-Type: application/json`
   - **Schedule**: Weekly on Saturday at 5:00 AM (`0 5 * * 6`)
   - **Timeout**: 30 seconds
   - **Retry**: 2 attempts on failure

**Manual Testing:**

```bash
curl -X POST "https://dorkinians-website-v3.netlify.app/api/chatbot-test" \
  -H "Content-Type: application/json" \
  -d '{"emailAddress": "your-email@example.com", "maxTests": 1}'
```

#### Expected Response

```json
{
	"success": true,
	"message": "Random chatbot test completed successfully",
	"selectedTests": 1,
	"totalAvailableTests": 204,
	"processedTests": 1,
	"passedTests": 1,
	"failedTests": 0,
	"successRate": "100.0%",
	"output": "Random tests completed: 1/1 passed (1 selected from 204 available)"
}
```

#### Test Coverage

**Random Selection Benefits:**

- **Efficient**: Tests only 1 random test per week (0.5% of total)
- **Comprehensive Over Time**: All 204 tests will be tested within ~204 weeks
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

## Umami Analytics Setup

### Overview

Umami is a privacy-focused, open-source web analytics platform that provides website analytics without collecting personal data or using cookies. This guide covers setting up Umami for the Dorkinians website with automatic version tracking.

**Key Features:**
- Privacy-focused (no cookies, GDPR compliant)
- Lightweight tracking script
- Managed cloud service (no hosting required)
- Custom event tracking for version numbers

> [Back to Table of Contents](#table-of-contents)

### Quick Start: Umami Cloud (Recommended)

Umami Cloud is a managed service that handles all hosting, database setup, and maintenance for you. This is the easiest way to get started with Umami analytics.

**Benefits:**
- No hosting or database setup required
- Free tier available
- Automatic updates and maintenance
- Access your analytics at [https://cloud.umami.is](https://cloud.umami.is)

#### Step 1: Sign Up

1. Go to [https://cloud.umami.is](https://cloud.umami.is)
2. Click "Sign Up" or "Get Started"
3. Create your account with email and password
4. Verify your email if required

#### Step 2: Add Your Website

1. After logging in, you'll see the Umami dashboard
2. Click "Add Website" or navigate to Settings → Websites
3. Enter your website details:
   - **Name:** "Dorkinians Website" (or any name you prefer)
   - **Domain:** `dorkinians-website-v3.netlify.app` (or your production domain)
4. Click "Save" or "Add Website"

#### Step 3: Get Your Tracking Script

After adding your website, Umami will display a tracking script. It will look like:

```html
<script async defer 
        data-website-id="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" 
        src="https://cloud.umami.is/script.js"></script>
```

**Important Information:**
- **Website ID:** The UUID in `data-website-id` (e.g., `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- **Script URL:** `https://cloud.umami.is/script.js` (or your region-specific URL)

> [Back to Table of Contents](#table-of-contents)

#### Step 4: Configure Environment Variables

Add the following to your `.env.local` file for local development:

```bash
# Umami Analytics Configuration
NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=your-website-id-here

# App Version (auto-populated from package.json at build time)
NEXT_PUBLIC_APP_VERSION=1.1.21
```

**For Production (Netlify):**
1. Go to your Netlify site dashboard
2. Navigate to Site settings → Environment variables
3. Add the same variables:
   - `NEXT_PUBLIC_UMAMI_SCRIPT_URL`
   - `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
   - `NEXT_PUBLIC_APP_VERSION` (will be auto-populated from package.json)

**Note:** The `NEXT_PUBLIC_APP_VERSION` is automatically set from your `package.json` during build, so you don't need to manually update it.

**Version Tracking:**
- The app version from `package.json` is automatically tracked as a custom event in Umami
- Each time a user visits your site, the version number is tracked once per session
- You can view version tracking data in your Umami Cloud dashboard under "Events"
- This allows you to see which version of your app users are accessing
- The event name is "App Version" with the version number as a property

> [Back to Table of Contents](#table-of-contents)

### Configuration

#### Environment Variables

**Required Environment Variables for Next.js:**

Add to your `.env.local` file (development) and Netlify environment variables (production):

```bash
# Umami Analytics Configuration
NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=your-website-id-here

# App Version (auto-populated from package.json at build time)
NEXT_PUBLIC_APP_VERSION=1.1.21
```

**Note:** If you're using a region-specific Umami Cloud instance (e.g., EU region), your script URL will be different:
- EU: `https://cloud.umami.is/analytics/eu/script.js`
- US: `https://cloud.umami.is/analytics/us/script.js`

Check your Umami Cloud dashboard for the correct script URL.

> [Back to Table of Contents](#table-of-contents)

#### Obtaining Website ID and Script URL

1. **Login to Umami Cloud:**
   - Go to [https://cloud.umami.is](https://cloud.umami.is) (or your region-specific URL)
   - Login with your credentials

2. **Navigate to Websites:**
   - Click on "Websites" in the sidebar
   - Or go to Settings → Websites

3. **View Your Website:**
   - Click on your website name
   - You'll see the tracking script displayed

4. **Copy the Values:**
   - **Website ID:** Copy the UUID from `data-website-id="..."` 
   - **Script URL:** Copy the URL from `src="..."` (usually `https://cloud.umami.is/script.js`)

5. **Update Environment Variables:**
   - Add both values to your `.env.local` file for development
   - Add to Netlify environment variables for production

> [Back to Table of Contents](#table-of-contents)

### Integration with Next.js

The Dorkinians website is already configured to integrate with Umami. The integration includes:

1. **Automatic Script Loading:**
   - Umami script loads via Next.js `Script` component
   - Loads asynchronously without blocking page render
   - Only loads when environment variables are configured

2. **Version Tracking:**
   - App version from `package.json` is automatically tracked
   - Tracked once per session on page load
   - Custom event: "App Version" with version property

3. **Component Structure:**
   - `components/UmamiAnalytics.tsx`: Handles version tracking
   - `app/layout.tsx`: Includes Umami script and analytics component

**To Complete Setup:**

1. Sign up for Umami Cloud at [https://cloud.umami.is](https://cloud.umami.is)
2. Add your website to the Umami dashboard
3. Copy website ID and script URL from the tracking script
4. Add environment variables to `.env.local`:
   ```bash
   NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js
   NEXT_PUBLIC_UMAMI_WEBSITE_ID=your-website-id-here
   ```
5. For production, add same variables to Netlify environment variables
6. Rebuild and deploy the website

The version tracking will work automatically once Umami is configured and environment variables are set.

> [Back to Table of Contents](#table-of-contents)

### Troubleshooting

#### Common Issues

**1. Script Not Loading:**
- Verify `NEXT_PUBLIC_UMAMI_SCRIPT_URL` is correct
- Check the URL is accessible in your browser
- Verify script URL matches your Umami Cloud region
- Check browser console for errors

**2. Events Not Tracking:**
- Verify `NEXT_PUBLIC_UMAMI_WEBSITE_ID` matches dashboard
- Check website domain matches configured domain in Umami
- Verify script is loading (check Network tab in DevTools)
- Check browser console for JavaScript errors

**3. Version Not Tracking:**
- Verify `NEXT_PUBLIC_APP_VERSION` is set (auto-populated from package.json)
- Check UmamiAnalytics component is included in layout
- Verify Umami script loads before tracking component
- Check browser console for tracking errors

**4. Dashboard Access Issues:**
- Verify you're logged into the correct Umami Cloud account
- Check website appears in your dashboard
- Verify events are being received (may take a few minutes)

#### Debugging Steps

1. **Check Environment Variables:**
```bash
# In Next.js, verify variables are accessible
console.log('Script URL:', process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL);
console.log('Website ID:', process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID);
console.log('App Version:', process.env.NEXT_PUBLIC_APP_VERSION);
```

2. **Verify Script Loading:**
- Open browser DevTools → Network tab
- Reload page and check for `script.js` request
- Verify request returns 200 status

3. **Check Umami Dashboard:**
   - Login to Umami Cloud dashboard
   - Check if website appears in settings
   - Verify events are being received (may take a few minutes to appear)
   - To view version tracking: Go to "Events" section and look for "App Version" events

4. **Test Custom Events:**
- Open browser console
- Run: `window.umami.track('Test Event', { test: true })`
- Check Umami dashboard for the event

> [Back to Table of Contents](#table-of-contents)

### Advanced: Self-Hosted Umami (Optional)

If you prefer to host Umami yourself for more control, data privacy, or cost reasons, you can self-host Umami. This requires setting up your own server, database, and managing updates.

**When to Consider Self-Hosting:**
- You need complete data control and privacy
- You have high traffic volumes (cost savings)
- You want to customize Umami
- You have infrastructure and DevOps expertise

> [Back to Table of Contents](#table-of-contents)

#### Self-Hosted with Docker

**Prerequisites:**
- Docker and Docker Compose installed
- PostgreSQL or MySQL database (can be on same server or external)

**Steps:**

1. **Clone Umami Repository:**
```bash
git clone https://github.com/umami-software/umami.git
cd umami
```

2. **Create Environment File:**
Create a `.env` file in the root directory:
```bash
DATABASE_URL=postgresql://umami:password@localhost:5432/umami
# OR for MySQL:
# DATABASE_URL=mysql://umami:password@localhost:3306/umami

HASH_SALT=your-random-salt-here
APP_SECRET=your-random-secret-here
```

Generate secure random strings for `HASH_SALT` and `APP_SECRET`:
```bash
# On Linux/Mac:
openssl rand -base64 32

# On Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

3. **Start with Docker Compose:**
```bash
docker-compose up -d
```

4. **Access Umami Dashboard:**
- Navigate to `http://localhost:3000`
- Default credentials:
  - **Username:** `admin`
  - **Password:** `umami`
- **Important:** Change the default password immediately after first login

5. **Configure for Production:**
- Update `DATABASE_URL` to point to your production database
- Set up reverse proxy (nginx/traefik) with SSL certificate
- Configure domain name and update environment variables

> [Back to Table of Contents](#table-of-contents)

#### Vercel Deployment

**Prerequisites:**
- Vercel account
- PostgreSQL database (Vercel Postgres, Supabase, or external)

**Steps:**

1. **Fork Umami Repository:**
   - Fork https://github.com/umami-software/umami to your GitHub account

2. **Deploy to Vercel:**
   - Import your forked repository in Vercel
   - Configure environment variables:
     - `DATABASE_URL`: Your PostgreSQL connection string
     - `HASH_SALT`: Random secure string
     - `APP_SECRET`: Random secure string

3. **Set Up Database:**
   - Use Vercel Postgres or connect external PostgreSQL
   - Update `DATABASE_URL` in Vercel environment variables

4. **Access Dashboard:**
   - Access via your Vercel deployment URL
   - Login with default credentials and change password

> [Back to Table of Contents](#table-of-contents)

#### Railway Deployment

**Prerequisites:**
- Railway account
- GitHub account (for repository access)

**Steps:**

1. **Deploy from GitHub:**
   - Go to Railway dashboard
   - Click "New Project" → "Deploy from GitHub"
   - Select the Umami repository (fork if needed)

2. **Configure Environment Variables:**
   - Add `DATABASE_URL` (Railway can provision PostgreSQL automatically)
   - Add `HASH_SALT` and `APP_SECRET` (generate random strings)

3. **Set Up Database:**
   - Railway can auto-provision PostgreSQL
   - Or connect external database via `DATABASE_URL`

4. **Access Dashboard:**
   - Railway provides a public URL
   - Login with default credentials and change password

> [Back to Table of Contents](#table-of-contents)

#### DigitalOcean App Platform

**Prerequisites:**
- DigitalOcean account
- PostgreSQL database (DigitalOcean Managed Database or external)

**Steps:**

1. **Create App:**
   - Go to DigitalOcean App Platform
   - Create new app from GitHub repository (fork Umami if needed)

2. **Configure Database:**
   - Provision managed PostgreSQL database
   - Or connect external database

3. **Set Environment Variables:**
   - `DATABASE_URL`: Connection string to PostgreSQL
   - `HASH_SALT`: Random secure string
   - `APP_SECRET`: Random secure string

4. **Deploy:**
   - DigitalOcean will build and deploy automatically
   - Access via provided URL

> [Back to Table of Contents](#table-of-contents)

#### Database Setup

##### PostgreSQL Setup

**Using Docker:**
```bash
docker run --name umami-postgres \
  -e POSTGRES_USER=umami \
  -e POSTGRES_PASSWORD=your-secure-password \
  -e POSTGRES_DB=umami \
  -p 5432:5432 \
  -d postgres:15-alpine
```

**Connection String Format:**
```
postgresql://username:password@host:port/database
```

**Example:**
```
postgresql://umami:password@localhost:5432/umami
```

> [Back to Table of Contents](#table-of-contents)

##### MySQL Setup

**Using Docker:**
```bash
docker run --name umami-mysql \
  -e MYSQL_ROOT_PASSWORD=root-password \
  -e MYSQL_DATABASE=umami \
  -e MYSQL_USER=umami \
  -e MYSQL_PASSWORD=your-secure-password \
  -p 3306:3306 \
  -d mysql:8.0
```

**Connection String Format:**
```
mysql://username:password@host:port/database
```

**Example:**
```
mysql://umami:password@localhost:3306/umami
```

> [Back to Table of Contents](#table-of-contents)

#### Self-Hosted Security Best Practices

1. **Change Default Password:**
   - Immediately change the default `admin`/`umami` password after first login

2. **Use Strong Secrets:**
   - Generate cryptographically secure random strings for `HASH_SALT` and `APP_SECRET`
   - Use at least 32 characters

3. **Enable HTTPS:**
   - Always use HTTPS in production
   - Set up SSL certificate (Let's Encrypt, Cloudflare, etc.)

4. **Database Security:**
   - Use strong database passwords
   - Restrict database access to only the Umami application
   - Use connection pooling for production

5. **Environment Variables:**
   - Never commit `.env` files to version control
   - Use secure environment variable management in production
   - Rotate secrets periodically

6. **Access Control:**
   - Limit admin access to trusted users only
   - Use strong, unique passwords for all accounts
   - Consider enabling 2FA if available

7. **Network Security:**
   - Use firewall rules to restrict database access
   - Consider using VPN or private networks for database connections

> [Back to Table of Contents](#table-of-contents)

## Google OAuth Setup Guide

This guide will walk you through setting up Google OAuth authentication for the admin page.

> [Back to Table of Contents](#table-of-contents)

### Prerequisites

- A Google account (the one matching the contact email in `config/config.ts`)
- Access to Google Cloud Console
- Access to your application's environment variables

> [Back to Table of Contents](#table-of-contents)

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Enter a project name (e.g., "Dorkinians Website Admin")
5. Click "Create"
6. Wait for the project to be created and select it

> [Back to Table of Contents](#table-of-contents)

### Step 2: Enable Google Identity API

1. In the Google Cloud Console, navigate to "APIs & Services" > "Library"
2. Search for "Google Identity API" or "Google+ API"
3. Click on "Identity Toolkit API" (or "Google+ API" if that's what appears)
4. Click "Enable"
5. Wait for the API to be enabled

> [Back to Table of Contents](#table-of-contents)

### Step 3: Create OAuth 2.0 Credentials

1. Navigate to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "Internal" (if using Google Workspace) or "External" (for personal Google accounts)
   - Fill in the required fields:
     - App name: "Dorkinians Website Admin"
     - User support email: Your email (bangsluke@gmail.com)
     - Developer contact: Your email
   - Click "Save and Continue"
   - Add scopes: `email`, `profile`, `openid`
   - Click "Save and Continue"
   - Add test users if using "External" (add your email)
   - Click "Save and Continue"
   - Review and click "Back to Dashboard"
4. Back at "Create OAuth client ID":
   - Application type: Select "Web application"
   - Name: "Dorkinians Admin Web Client"
   - Click "Create"
5. **Important**: Copy the Client ID and Client Secret immediately (you won't be able to see the secret again)

> [Back to Table of Contents](#table-of-contents)

### Step 4: Configure Authorized Redirect URIs

1. After creating the OAuth client, you'll see it in the credentials list
2. Click on the OAuth client name to edit it
3. Under "Authorized redirect URIs", click "Add URI"
4. Add the following URIs:

   **For Production:**
   ```
   https://dorkinians-website-v3.netlify.app/api/auth/callback/google
   ```

   **For Development:**
   ```
   http://localhost:3000/api/auth/callback/google
   ```

5. Click "Save"

> [Back to Table of Contents](#table-of-contents)

### Step 5: Add Environment Variables

Add the following environment variables to your `.env` file (or your hosting platform's environment variables):

```env
# Authentication
AUTH_SECRET=<generated-secret-see-step-6>
AUTH_GOOGLE_ID=<your-client-id-from-step-3>
AUTH_GOOGLE_SECRET=<your-client-secret-from-step-3>
AUTH_URL=https://dorkinians-website-v3.netlify.app
```

**For local development**, use:
```env
AUTH_URL=http://localhost:3000
```

> [Back to Table of Contents](#table-of-contents)

### Step 6: Generate AUTH_SECRET

Generate a secure random secret for session encryption:

**On Linux/Mac:**
```bash
openssl rand -base64 32
```

**On Windows (PowerShell):**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Or use an online generator:**
- Visit https://generate-secret.vercel.app/32
- Copy the generated secret

Add this to your `AUTH_SECRET` environment variable.

> [Back to Table of Contents](#table-of-contents)

### Troubleshooting

#### "Invalid redirect URI" error

- Ensure the redirect URI in your OAuth client matches exactly: `{AUTH_URL}/api/auth/callback/google`
- Check that `AUTH_URL` environment variable is set correctly
- For production, use `https://`; for development, use `http://localhost:3000`

#### "Access blocked: This app's request is invalid" error

- Ensure you've completed the OAuth consent screen configuration
- If using "External" app type, make sure your email is added as a test user
- Wait a few minutes after making changes for them to propagate

#### "Email not authorized" error

- Only the email address in `config/config.ts` (`contact` field) can access the admin page
- Ensure you're signing in with the correct Google account
- The email comparison is case-insensitive

#### Session not persisting

- Check that `AUTH_SECRET` is set and is at least 32 characters
- Ensure cookies are enabled in your browser
- In production, ensure you're using HTTPS (required for secure cookies)

#### Can't access /admin after authentication

- Check browser console for errors
- Verify all environment variables are set correctly
- Check that the middleware is not blocking the route
- Ensure NextAuth API routes are accessible at `/api/auth/*`

> [Back to Table of Contents](#table-of-contents)

## Chatbot Question Processing Guide

### Overview

This guide explains how a user question flows from the frontend through the chatbot system and gets converted into a Cypher query that retrieves data from the Neo4j database. It details the priority order of question breakdown steps and identifies potential efficiency improvements.

> [Back to Table of Contents](#table-of-contents)

### Question Flow Overview

The question processing follows this high-level flow:

```
Frontend (ChatbotInterface.tsx)
  ↓ POST /api/chatbot
API Route (route.ts)
  ↓ processQuestion()
ChatbotService (chatbotService.ts)
  ↓ analyzeQuestion()
EnhancedQuestionAnalyzer (enhancedQuestionAnalysis.ts)
  ↓ EntityExtractor.resolveEntitiesWithFuzzyMatching()
EntityExtractor (entityExtraction.ts)
  ↓ Returns EnhancedQuestionAnalysis
ChatbotService.queryRelevantData()
  ↓ buildPlayerQuery() / other query builders
Cypher Query Execution
  ↓ Neo4j Database
Results Returned to Frontend
```

> [Back to Table of Contents](#table-of-contents)

### Frontend to Backend Communication

**File**: `components/ChatbotInterface.tsx`

1. User submits question via form
2. Question and optional `userContext` (selected player) sent to `/api/chatbot` endpoint
3. Response includes answer, sources, and debug information

**File**: `app/api/chatbot/route.ts`

1. Validates question is a string
2. Calls `chatbotService.processQuestion()`
3. Retrieves processing details for debugging
4. Returns response with debug information

> [Back to Table of Contents](#table-of-contents)

### Question Analysis Pipeline

**File**: `lib/services/chatbotService.ts` (processQuestion method)

The main processing steps:

1. **Connection Check**: Ensures Neo4j connection is available
2. **Question Analysis**: Calls `analyzeQuestion()` which uses `EnhancedQuestionAnalyzer`
3. **Clarification Check**: If clarification needed, returns early with message
4. **Query Building**: Calls `queryRelevantData()` with the analysis
5. **Response Generation**: Formats results into user-friendly answer

> [Back to Table of Contents](#table-of-contents)

### Entity Extraction Priority Order

**File**: `lib/config/entityExtraction.ts` (extractEntityInfo method)

Entities are extracted in this priority order:

1. **"I" References** (Highest Priority)
   - Matches: `/\b(i|i've|me|my|myself)\b/gi`
   - Maps to user context if available

2. **Player Names** (Second Priority)
   - Uses NLP (compromise library) for better accuracy
   - Extracts proper nouns that match player name patterns
   - Deduplicates using normalized lowercase names

3. **Team References** (Third Priority)
   - Matches: `/\b(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)(?:\s+(team|teams))?\b/gi`
   - Removes trailing "team"/"teams" words

4. **League References** (Fourth Priority)
   - Matches: `/\b(league|premier|championship|conference|national|division|tier|level)\b/gi`
   - Attempts to extract full league name from context

5. **Opposition Team References** (Fifth Priority)
   - Matches capitalized words: `/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g`
   - Filters out common words and known player names
   - Skips if already identified as player entity

After extraction, entities go through fuzzy matching via `resolveEntitiesWithFuzzyMatching()` which:
- Resolves player names using `EntityNameResolver.getBestMatch()`
- Resolves team names using fuzzy matching
- Resolves opposition names using fuzzy matching
- Resolves league names using fuzzy matching

> [Back to Table of Contents](#table-of-contents)

### Stat Type Extraction Priority

**File**: `lib/config/entityExtraction.ts` (extractStatTypes method)

1. **Goal Involvements** (Explicit First Check)
   - Checks for "goal involvements" or "goal involvement" before other stat types

2. **Other Stat Types** (Sorted by Pseudonym Length)
   - Pseudonyms sorted by length (longest first)
   - Ensures longer, more specific matches are found before shorter ones
   - Example: "penalties scored" matched before "penalties"

The extraction uses regex patterns with word boundaries for single words and literal matching for phrases. Regex patterns (containing `.*` or similar) are used as-is without escaping.

> [Back to Table of Contents](#table-of-contents)

### Question Type Determination Priority

**File**: `lib/config/enhancedQuestionAnalysis.ts` (determineQuestionType method)

Question types are determined in this priority order:

1. **Player** (Highest Priority)
   - If `hasPlayerEntities` is true, immediately returns "player"
   - Also catches percentage queries

2. **Temporal**
   - Checks for time-related keywords: "since", "before", "between", "during", "in the", "from", "until", "after"
   - Or if `hasTimeFrames` is true

3. **Percentage**
   - Checks for "percentage", "percent", or "%"

4. **Streak**
   - Checks for "streak", "consecutive", or "in a row"

5. **Double Game**
   - Checks for "double game" or "double game week"

6. **Ranking**
   - Checks for ("which" OR "who") AND ("highest" OR "most" OR "best" OR "top")

7. **Comparison**
   - Checks for: "most", "least", "highest", "lowest", "best", "worst", "top", "who has", "penalty record", "conversion rate"

8. **Team**
   - If has team entities AND ("finish" OR "league position" OR "position" OR "table")

9. **Club**
   - Checks for "club", "captain", or "award"

10. **Fixture**
    - Checks for "fixture", "match", or "game"

11. **Player-Related Content** (Fallback)
    - Checks for player-related indicators: "scored", "goals", "assists", "appearances", etc.

12. **General** (Final Fallback)
    - Default if no other type matches

> [Back to Table of Contents](#table-of-contents)

### Metric Extraction and Correction Priority

**File**: `lib/config/enhancedQuestionAnalysis.ts` (extractLegacyMetrics method)

Metrics are corrected in this specific priority order (each correction builds on the previous):

1. **Games Queries** → Maps to "Apps"
   - `correctGamesQueries()`

2. **Team-Specific Appearance Queries**
   - `correctTeamSpecificAppearanceQueries()`
   - Handles "1s apps", "2nd XI appearances", etc.

3. **Penalty Phrases**
   - `correctPenaltyPhrases()`
   - Fixes incorrectly broken down penalty phrases

4. **Most Prolific Season Queries**
   - `correctMostProlificSeasonQueries()`

5. **Season-Specific Queries**
   - `correctSeasonSpecificQueries()`
   - Handles "2017/18 Goals" patterns

6. **Season-Specific Appearance Queries**
   - `correctSeasonSpecificAppearanceQueries()`

7. **Open Play Goals Queries**
   - `correctOpenPlayGoalsQueries()`

8. **Team-Specific Goals Queries**
   - `correctTeamSpecificGoalsQueries()`
   - Handles "1s goals", "2nd XI goals", etc.

9. **Distance/Travel Queries**
   - `correctDistanceTravelQueries()`

10. **Percentage Queries**
    - `correctPercentageQueries()`

11. **Most Appearances for Team Queries**
    - `correctMostAppearancesForTeamQueries()`

12. **Most Scored for Team Queries**
    - `correctMostScoredForTeamQueries()`

**Note**: After all corrections, Home/Away metrics are filtered out if question asks for total games/appearances without location qualifier.

After corrections, metrics are prioritized using a priority order list that ensures more specific stat types take precedence:

- Season Count queries (most specific)
- Own Goals
- Per-appearance metrics (Goals Per Appearance, Assists Per Appearance, etc.)
- Distance Travelled
- Goals Conceded
- Open Play Goals
- Penalty-related stats
- Season-specific goals (2021/22 Goals, etc.)
- Team-specific appearances (1st XI Apps, etc.)
- Team-specific goals (1st XI Goals, etc.)
- Season-specific appearances
- Position-specific appearances (Goalkeeper, Defender, etc.)
- Most Common Position
- Most Scored For Team / Most Played For Team
- General stats (Goals, Assists, Apps, Minutes)

> [Back to Table of Contents](#table-of-contents)

### Cypher Query Generation

**File**: `lib/services/chatbotService.ts` (queryRelevantData method)

Based on question type, different query methods are called:

- `player` → `queryPlayerData()`
- `team` → `queryTeamData()`
- `club` → `queryClubData()`
- `fixture` → `queryFixtureData()`
- `comparison` → `queryComparisonData()`
- `streak` → `queryStreakData()`
- `temporal` → `queryTemporalData()`
- `double_game` → `queryDoubleGameData()`
- `ranking` → `queryRankingData()`
- `general` → `queryGeneralData()`

> [Back to Table of Contents](#table-of-contents)

### Query Building Priority Order

**File**: `lib/services/queryHandlers/playerDataQueryHandler.ts` (buildPlayerQuery method)

For player queries, the Cypher query is built in this order:

#### 1. Query Structure Decision

- Check if metric needs MatchDetail join (`metricNeedsMatchDetail()`)
- Check if team-specific metric (1sApps, 2sGoals, etc.)
- Check if needs Fixture relationship (for filters like location, opposition, time range, etc.)

#### 2. Base Query Pattern

- **No MatchDetail needed**: Direct Player node query
- **MatchDetail needed, no Fixture**: Simple MatchDetail join
- **MatchDetail needed, with Fixture**: MatchDetail + Fixture join
- **Team-specific metric**: OPTIONAL MATCH for MatchDetail (to return 0 if no matches)

#### 3. WHERE Clause Conditions (Applied in Order)

1. **Team Filter** (if team entities exist AND not team-specific metric)
   - Uses `f.team` for non-team-specific metrics

2. **Team-Specific Appearance Filter** (if metric is like "1sApps")
   - Uses `md.team` directly

3. **Team-Specific Goals Filter** (if metric is like "1sGoals")
   - Uses `md.team` directly
   - For OPTIONAL MATCH, filtering happens in WITH clause after aggregation

4. **Location Filter** (if locations exist AND not HOME/AWAY metric AND not team-specific)
   - Maps to `f.homeOrAway = 'Home'` or `'Away'`

5. **Opposition Filter** (if opposition entities exist AND not team-specific)
   - Uses `f.opposition = '{name}'`

6. **Time Range Filter** (if timeRange exists AND not team-specific)
   - Converts date format and uses `f.date >= '{start}' AND f.date <= '{end}'`

7. **Competition Type Filter** (if competition types exist AND not team-specific)
   - Maps to `f.compType = 'League'/'Cup'/'Friendly'`

8. **Competition Filter** (if competitions exist AND not team-specific appearance/goals)
   - Uses `f.competition CONTAINS '{name}'`

9. **Result Filter** (if results exist AND not team-specific)
   - Maps to `f.result = 'W'/'D'/'L'`

10. **Opponent Own Goals Filter** (if opponentOwnGoals is true AND not team-specific)
    - Uses `f.oppoOwnGoals > 0`

11. **Special Metric Filters**
    - `HOME` → `f.homeOrAway = 'Home'`
    - `AWAY` → `f.homeOrAway = 'Away'`

12. **Position Filters**
    - `GK` → `md.class = 'GK'`
    - `DEF` → `md.class = 'DEF'`
    - `MID` → `md.class = 'MID'`
    - `FWD` → `md.class = 'FWD'`

13. **Seasonal Metric Filters**
    - For patterns like `2017/18GOALS` → `f.season = "2017/18"`

#### 4. RETURN Clause

- For team-specific goals with OPTIONAL MATCH: Uses WITH clause aggregation
- Otherwise: Uses `getMatchDetailReturnClause()` or `getPlayerNodeReturnClause()`

#### 5. Special Case Queries

After building the base query, special metrics override with custom queries:

- `MOSTCOMMONPOSITION`
- `MPERG` (Minutes Per Goal)
- `MPERCLS` (Minutes Per Clean Sheet)
- `FTPPERAPP` (Fantasy Points Per Appearance)
- `CPERAPP` (Conceded Per Appearance)
- `GPERAPP` (Goals Per Appearance)
- `MINPERAPP` (Minutes Per Appearance)
- `MOMPERAPP` (Man of the Match Per Appearance)
- `YPERAPP` (Yellow Cards Per Appearance)
- `RPERAPP` (Red Cards Per Appearance)
- `SAVESPERAPP` (Saves Per Appearance)
- And many more per-appearance metrics

> [Back to Table of Contents](#table-of-contents)

### Potential Efficiency Improvements

#### 1. Entity Extraction Optimization

**Current**: Entities extracted sequentially with multiple regex passes

**Improvement**:
- Combine regex patterns where possible
- Use single pass with prioritized pattern matching
- Cache common entity patterns

#### 2. Stat Type Matching

**Current**: Sorted by length, but still iterates through all pseudonyms

**Improvement**:
- Use trie data structure for faster prefix matching
- Early exit when exact match found
- Group similar stat types to reduce iterations

#### 3. Question Type Determination

**Current**: Sequential if-else checks

**Improvement**:
- Use decision tree or rule engine
- Cache question type patterns
- Parallel evaluation of independent checks

#### 4. Metric Correction Chain

**Current**: 12 sequential correction functions

**Improvement**:
- Combine related corrections (e.g., all team-specific corrections together)
- Use pattern matching instead of sequential function calls
- Early exit when no corrections needed

#### 5. Query Building

**Current**: Builds WHERE conditions sequentially, then joins

**Improvement**:
- Pre-compute filter conditions in parallel
- Use query builder pattern for better optimization
- Cache common query patterns

#### 6. Fuzzy Matching Performance

**Current**: Fuzzy matching happens for all entities

**Improvement**:
- Only fuzzy match when exact match fails
- Cache fuzzy match results
- Use more efficient string similarity algorithms for large datasets

#### 7. Database Query Optimization

**Current**: Some queries use OPTIONAL MATCH unnecessarily

**Improvement**:
- Better detection of when OPTIONAL MATCH is needed
- Use indexes hints in Cypher queries
- Batch similar queries together

#### 8. Early Exit Opportunities

**Current**: Processes full pipeline even when early exit possible

**Improvement**:
- Add early exit after entity extraction if no entities found
- Skip metric corrections if no stat types extracted
- Return cached results for identical questions

> [Back to Table of Contents](#table-of-contents)

### Conclusion

The question processing system uses a multi-stage pipeline with clear priority ordering at each stage. The priority order ensures that:

- More specific matches are found before general ones
- Player queries take precedence (most common use case)
- Complex queries are handled correctly with proper filter ordering
- Special cases are handled after general cases

Understanding this priority order helps identify where optimizations can be made and where potential issues might arise in question processing. The system's design prioritizes accuracy and correctness over speed, which is appropriate for a chatbot that needs to provide reliable answers to user questions.

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

