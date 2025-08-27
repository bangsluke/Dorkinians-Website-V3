# Schema Alignment Process

## Overview

This document explains how to keep the schema files aligned between the two repositories:
- `database-dorkinians/config/schema.js` (source of truth)
- `V3-Dorkinians-Website/lib/config/schema.js` (copy for alignment)

## Current Setup

**database-dorkinians** is the **single source of truth** for all schema definitions. The schema file in **V3-Dorkinians-Website** is a copy that must be manually updated whenever the source changes.

## How to Update Schemas

### When Making Schema Changes

1. **Always edit the schema in `database-dorkinians/config/schema.js`**
2. **Automatically sync the schema to `V3-Dorkinians-Website/lib/config/schema.js`** (see automation options below)
3. **Deploy both repositories** to ensure consistency

### Automated Schema Syncing

The repository includes several automation options to keep schemas in sync:

#### Option 1: NPM Script (Recommended)
```bash
cd database-dorkinians
npm run sync-schema
```

#### Option 2: PowerShell Script (Windows)
```powershell
cd database-dorkinians
.\scripts\sync-schema.ps1
```

#### Option 3: Batch File (Windows - Double-click)
```bash
# Simply double-click scripts/sync-schema.bat
```

#### Option 4: VS Code Tasks
- Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
- Type "Tasks: Run Task"
- Select "Sync Schema to V3-Dorkinians-Website"

#### Option 5: Git Pre-commit Hook
The pre-commit hook automatically syncs the schema when you commit changes to `config/schema.js`.

### Manual Step-by-Step Process (Fallback)

If automation fails, use the manual process:

1. **Make changes in database-dorkinians:**
   ```bash
   cd database-dorkinians
   # Edit config/schema.js
   git add config/schema.js
   git commit -m "Update schema: [description of changes]"
   git push
   ```

2. **Copy the updated schema to V3-Dorkinians-Website:**
   ```bash
   cd ../V3-Dorkinians-Website
   # Copy the entire content of database-dorkinians/config/schema.js
   # to lib/config/schema.js
   git add lib/config/schema.js
   git commit -m "Sync schema with database-dorkinians: [description of changes]"
   git push
   ```

3. **Deploy both applications:**
   - Deploy database-dorkinians to Heroku
   - Deploy V3-Dorkinians-Website to Netlify

## Why This Approach?

- **database-dorkinians** is the primary seeder service that needs the schema
- **V3-Dorkinians-Website** needs the schema for validation and UI purposes
- **Direct imports** between repositories are not possible due to deployment constraints
- **Manual copying** ensures both repos always have identical schemas

## Schema Dependencies

The following files in V3-Dorkinians-Website depend on the schema:
- `lib/config/schemaBridge.js` - Main schema bridge
- `lib/services/csvHeaderValidator.js` - CSV validation
- `lib/services/dataSeederService.js` - Data seeding logic
- `app/api/seed-data/route.js` - API endpoint

## Validation

After copying the schema, verify alignment by:
1. Checking that both files have identical content
2. Running any tests in V3-Dorkinians-Website
3. Ensuring the Admin Panel can access schema information

## Future Improvements

Consider these alternatives for better schema management:
1. **NPM Package**: Publish schema as a package that both repos can depend on
2. **Git Submodules**: Properly implement submodules with authentication
3. **Shared Repository**: Move schema to a dedicated shared repository

## Current Status

✅ **Schema files are now aligned**  
✅ **Single source of truth established**  
✅ **Clear process documented**  
⚠️ **Manual copying required for updates**
