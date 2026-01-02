# Architectural Review Action Plan

> **Generated**: Based on comprehensive codebase review  
> **Goal**: Transform V3-Dorkinians-Website into a lightning-fast PWA  
> **Status**: In Progress

## Original Request

> **User Prompt**: "Acting as an experienced systems architect, review the full code base of @V3-Dorkinians-Website/ and its set up and structure. Provide a detailed report highlighting its strengths and weaknesses and providing recommendations for improvement. The app aims to be a lightning fast PWA for users to check on their football stats."

## Codebase Context

### Project Overview
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (with some JavaScript)
- **State Management**: Zustand
- **Database**: Neo4j Aura (graph database)
- **Deployment**: Netlify
- **PWA**: Configured with `next-pwa`
- **Styling**: Tailwind CSS
- **Testing**: Jest with ts-jest

### Key Architecture Components

#### Chatbot System (Core Feature)
- **Main Service**: `lib/services/chatbotService.ts` (5,324 lines - needs refactoring)
- **Entity Extraction**: `lib/config/entityExtraction.ts` + `lib/config/enhancedQuestionAnalysis.ts` (2,990 lines)
- **Query Handlers**: 
  - `lib/services/queryHandlers/playerDataQueryHandler.ts` (1,839 lines)
  - `lib/services/queryHandlers/leagueTableQueryHandler.ts` (776 lines)
  - `lib/services/queryHandlers/rankingQueryHandler.ts` (270 lines)
  - Plus: teamDataQueryHandler, clubDataQueryHandler, fixtureDataQueryHandler, temporalQueryHandler, awardsQueryHandler, relationshipQueryHandler
- **Query Builders**: `lib/services/queryBuilders/playerQueryBuilder.ts` (1,517 lines)
- **API Route**: `app/api/chatbot/route.ts`

#### State Management
- **Main Store**: `lib/stores/navigation.ts` (2,038 lines - needs splitting)
- **Store Type**: Zustand with complex nested state

#### Database Layer
- **Connection**: `lib/neo4j.ts` (singleton service)
- **Netlify Functions**: `netlify/functions/lib/neo4j.js` (separate implementation)
- **Issue**: Connection created per request, no pooling

#### API Structure
- **Next.js Routes**: `app/api/*` (most endpoints)
- **Netlify Functions**: `netlify/functions/*` (some endpoints)
- **Issue**: Mixed patterns, inconsistent error handling

### Current Issues Summary

1. **TypeScript Errors**: 325+ lines of errors in `typescript-errors-log.txt`
   - Mostly implicit `any` types in chatbotService.ts
   - Missing type annotations in query handlers

2. **Monolithic Files**:
   - `chatbotService.ts`: 5,324 lines
   - `navigation.ts`: 2,038 lines
   - `enhancedQuestionAnalysis.ts`: 2,990 lines

3. **Security**:
   - CORS set to `*` (wildcard)
   - No rate limiting
   - No input validation

4. **Performance**:
   - Images unoptimized
   - No request deduplication
   - In-memory cache only (lost on restart)
   - No service worker caching strategy

5. **Architecture**:
   - Mixed API patterns (Next.js routes + Netlify Functions)
   - No connection pooling
   - Large state store needs splitting

### File Structure Reference

```
V3-Dorkinians-Website/
├── app/
│   ├── api/
│   │   ├── chatbot/route.ts          # Main chatbot endpoint
│   │   └── [40+ other API routes]
│   ├── layout.tsx                    # Root layout with PWA config
│   └── page.tsx                     # Home page
├── components/                      # React components
│   ├── ChatbotInterface.tsx         # Main chatbot UI
│   ├── ErrorBoundary.tsx            # Error handling
│   └── [80+ other components]
├── lib/
│   ├── config/
│   │   ├── enhancedQuestionAnalysis.ts  # NLP question analysis
│   │   ├── entityExtraction.ts         # Entity recognition
│   │   └── naturalLanguageResponses.ts  # Response templates
│   ├── services/
│   │   ├── chatbotService.ts           # Main chatbot orchestrator (5,324 lines)
│   │   ├── queryHandlers/              # Specialized query handlers
│   │   ├── queryBuilders/              # Cypher query construction
│   │   └── entityNameResolver.ts      # Fuzzy matching
│   ├── stores/
│   │   └── navigation.ts               # Zustand store (2,038 lines)
│   └── neo4j.ts                       # Database connection
├── netlify/
│   └── functions/                    # Netlify serverless functions
├── public/
│   └── manifest.json                 # PWA manifest
├── next.config.js                    # Next.js + PWA config
├── tsconfig.json                     # TypeScript config
└── package.json                      # Dependencies
```

### Dependencies of Note

- **next-pwa**: ^5.6.0 (PWA support)
- **neo4j-driver**: ^5.28.2 (database)
- **zustand**: ^4.4.7 (state management)
- **natural**: ^8.1.0 (NLP/fuzzy matching)
- **compromise**: ^14.14.4 (text parsing)
- **recharts**: ^2.8.0 (data visualization)
- **framer-motion**: ^10.16.16 (animations)

### Current TypeScript Configuration

- **Location**: `tsconfig.json`
- **Current**: `"strict": true` (but many errors exist)
- **Issue**: Errors not blocking build, but reducing type safety

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Quick Start Guide](#quick-start-guide)
- [Priority 1: Critical Fixes (Do First)](#priority-1-critical-fixes-do-first)
- [Priority 2: TypeScript Compliance](#priority-2-typescript-compliance)
- [Priority 3: Security Fixes](#priority-3-security-fixes)
- [Priority 4: Architecture Improvements](#priority-4-architecture-improvements)
- [Priority 5: Performance Optimizations](#priority-5-performance-optimizations)
- [Priority 6: Developer Experience](#priority-6-developer-experience)
- [Priority 7: Testing & Quality](#priority-7-testing--quality)
- [Progress Tracking](#progress-tracking)

> [Back to Table of Contents](#table-of-contents)

## Quick Start Guide

**Recommended Workflow:**
1. ✅ Fix TypeScript errors incrementally as you work on chatbot features
2. ✅ Fix CORS security issue immediately
3. ✅ Continue chatbot development with proper types
4. ⏸️ Defer large refactoring until chatbot features are stable
5. ⏸️ Then tackle performance and architecture improvements

**Estimated Timeline:**
- Priority 1-2: 1-2 weeks (parallel with chatbot development)
- Priority 3: 1 day
- Priority 4: 2-3 weeks (after chatbot completion)
- Priority 5: 1-2 weeks
- Priority 6-7: Ongoing

> [Back to Table of Contents](#table-of-contents)

---

## Priority 1: Critical Fixes (Do First)

### 1.1 Fix CORS Security Issue

- [ ] **File**: `app/api/chatbot/route.ts`
- [ ] Replace wildcard CORS with environment-based origin
- [ ] Add `ALLOWED_ORIGIN` environment variable
- [ ] Update Netlify environment variables
- [ ] Test CORS in production

**Code Change:**
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "https://dorkinians-website-v3.netlify.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
```

**Files to Update:**
- `app/api/chatbot/route.ts` (line 6)

> [Back to Table of Contents](#table-of-contents)

### 1.2 Fix logToBoth Method Calls

- [ ] **File**: `lib/services/chatbotService.ts`
- [ ] Find all `logToBoth` calls with missing parameters (grep for pattern)
- [ ] Fix calls missing `data` parameter (add `null` as second arg)
- [ ] Fix calls missing `level` parameter (add `"log"` as third arg)
- [ ] Verify no TypeScript errors remain for logToBoth

**Context:**
- `logToBoth` method signature: `logToBoth(message: string, data?: unknown, level: "log" | "warn" | "error" = "log")`
- Located at line 188 in chatbotService.ts
- Calls `loggingService.log()` internally
- Many calls throughout the 5,324-line file are missing the optional parameters

**Pattern to Fix:**
```typescript
// Before:
this.logToBoth(`message ${var}`);

// After:
this.logToBoth(`message ${var}`, null, "log");
```

**Known Locations:**
- Line 554: `queryTeamData` method - missing `data` parameter
- Line 1176: `buildContextualResponse` method - missing `data` parameter
- **Search Command**: `grep -n "logToBoth" lib/services/chatbotService.ts | grep -v ", null"` to find all instances

**Related Files:**
- `lib/services/loggingService.ts` - underlying logging service

> [Back to Table of Contents](#table-of-contents)

### 1.3 Add Environment Variable Validation

- [ ] **File**: Create `lib/config/envValidation.ts`
- [ ] Validate all required environment variables at startup
- [ ] Provide clear error messages for missing variables
- [ ] Use Zod or similar for schema validation
- [ ] Add validation to app startup (layout.tsx or middleware)

**Required Variables to Validate:**
- `PROD_NEO4J_URI`
- `PROD_NEO4J_USER`
- `PROD_NEO4J_PASSWORD`
- `OPENAI_API_KEY` (if used)
- `ALLOWED_ORIGIN` (new)

> [Back to Table of Contents](#table-of-contents)

---

## Priority 2: TypeScript Compliance

### 2.1 Fix TypeScript Errors in chatbotService.ts

- [ ] **File**: `lib/services/chatbotService.ts` (5,324 lines)
- [ ] Fix line 553: Add type to `queryTeamData(entities, metrics)`
- [ ] Fix line 565: Add types to `queryClubData(entities, metrics)`
- [ ] Fix line 574: Add types to `queryFixtureData(entities, metrics)`
- [ ] Fix line 583: Add types to `queryDoubleGameData(entities, metrics)`
- [ ] Fix line 615: Add type to `metricNeedsMatchDetail(metric)`
- [ ] Fix line 647: Add type to `getPlayerNodeReturnClause(metric)`
- [ ] Fix line 693: Add type to `getMatchDetailReturnClause(metric)`
- [ ] Fix line 731: Add types to `buildPlayerQuery(playerName, metric, analysis)`
- [ ] Fix line 781-782: Add types to `mapTeamName` callbacks
- [ ] Fix line 787: Add type to `locations.map(loc => ...)`
- [ ] Fix line 814: Add type to `competitionTypes.map(compType => ...)`
- [ ] Fix line 828: Add type to `competitions.map(comp => ...)`
- [ ] Fix line 833: Add type to `results.map(result => ...)`
- [ ] Fix line 1167: Add types to `buildContextualResponse(playerName, metric, value, analysis)`
- [ ] Fix line 1230: Add types to `generateResponse(question, data, analysis)`
- [ ] Fix line 1432: Add type to `data.data.map((p) => ...)`
- [ ] Run `npm run type-check` to verify all errors resolved

**Context:**
- All errors are in `chatbotService.ts` - the main orchestrator service
- Errors are from `typescript-errors-log.txt` (325 lines of errors)
- Most errors are implicit `any` types on method parameters
- Some errors are from callback functions in array methods

**Existing Type Definitions:**
- `lib/services/types/chatbotTypes.ts` - Contains `ChatbotResponse`, `QuestionContext`, `ProcessingDetails`
- `lib/config/enhancedQuestionAnalysis.ts` - Contains `EnhancedQuestionAnalysis` type
- `lib/config/chatbotMetrics.ts` - Contains metric-related types

**Strategy:**
- Create type definitions file: `lib/services/types/chatbotServiceTypes.ts`
- Define interfaces for:
  - `EntityCollection` (for entities parameter)
  - `MetricConfig` (for metrics parameter)
  - `QueryAnalysis` (for analysis parameter)
- Import existing types from `enhancedQuestionAnalysis.ts` where applicable
- Import and use throughout chatbotService.ts

**Example Type Definitions:**
```typescript
// lib/services/types/chatbotServiceTypes.ts
import type { EnhancedQuestionAnalysis } from '../../config/enhancedQuestionAnalysis';

export interface EntityCollection {
  players?: string[];
  teams?: string[];
  locations?: string[];
  // ... other entity types
}

export interface MetricConfig {
  metric: string;
  displayName?: string;
  // ... other metric properties
}

export type QueryAnalysis = EnhancedQuestionAnalysis;
```

> [Back to Table of Contents](#table-of-contents)

### 2.2 Fix TypeScript Errors in Query Handlers

- [ ] **File**: `lib/services/queryHandlers/playerDataQueryHandler.ts`
- [ ] Review and fix any implicit `any` types
- [ ] **File**: `lib/services/queryHandlers/teamDataQueryHandler.ts`
- [ ] Review and fix any implicit `any` types
- [ ] **File**: `lib/services/queryHandlers/clubDataQueryHandler.ts`
- [ ] Review and fix any implicit `any` types
- [ ] **File**: `lib/services/queryHandlers/fixtureDataQueryHandler.ts`
- [ ] Review and fix any implicit `any` types
- [ ] **File**: `lib/services/queryHandlers/rankingQueryHandler.ts`
- [ ] Review and fix any implicit `any` types
- [ ] **File**: `lib/services/queryHandlers/leagueTableQueryHandler.ts`
- [ ] Review and fix any implicit `any` types
- [ ] Run `npm run type-check` to verify

> [Back to Table of Contents](#table-of-contents)

### 2.3 Enable Strict TypeScript Mode

- [ ] **File**: `tsconfig.json`
- [ ] Set `"strict": true` (if not already)
- [ ] Set `"noImplicitAny": true`
- [ ] Set `"strictNullChecks": true`
- [ ] Run `npm run type-check` and fix all resulting errors
- [ ] Add type checking to CI/CD pipeline

> [Back to Table of Contents](#table-of-contents)

---

## Priority 3: Security Fixes

### 3.1 Implement Rate Limiting

- [ ] **Decision**: Choose rate limiting solution
  - [ ] Option A: Upstash Rate Limit (serverless-friendly)
  - [ ] Option B: Netlify Edge Functions
  - [ ] Option C: Next.js middleware with in-memory store
- [ ] Implement rate limiting for `/api/chatbot` endpoint
- [ ] Configure rate limits (e.g., 10 requests/minute per IP)
- [ ] Add rate limit headers to responses
- [ ] Test rate limiting behavior
- [ ] Document rate limits for users

**Files to Create/Update:**
- `lib/middleware/rateLimiter.ts` (new)
- `app/api/chatbot/route.ts` (update)

> [Back to Table of Contents](#table-of-contents)

### 3.2 Add Input Validation

- [ ] **File**: `app/api/chatbot/route.ts`
- [ ] Add request body validation (Zod schema)
- [ ] Validate question length (max 500 characters)
- [ ] Sanitize user input
- [ ] Add request size limits
- [ ] Return appropriate error messages

> [Back to Table of Contents](#table-of-contents)

### 3.3 Review Environment Variable Security

- [ ] Audit all environment variables
- [ ] Ensure no secrets in code
- [ ] Verify `.env` files in `.gitignore`
- [ ] Document required environment variables
- [ ] Set up environment variable rotation process

> [Back to Table of Contents](#table-of-contents)

---

## Priority 4: Architecture Improvements

### 4.1 Refactor ChatbotService (Defer Until After Chatbot Features Complete)

**Context:**
- Current file: `lib/services/chatbotService.ts` (5,324 lines)
- This is the main orchestrator for the chatbot system
- Contains: entity resolution, query building, response generation, error handling
- **IMPORTANT**: Defer this refactoring until chatbot features are stable to avoid merge conflicts

**Current Structure Analysis:**
- Lines 1-100: Imports and class setup
- Lines 100-200: Helper methods (resolvePlayerName, logToBoth, etc.)
- Lines 200-600: Query methods (queryTeamData, queryClubData, etc.)
- Lines 600-1200: Query building methods
- Lines 1200-2000: Response generation methods
- Lines 2000-5324: Main processQuestion method and supporting logic

**Logical Service Boundaries:**
1. **Entity Extraction Service**: Currently uses `EnhancedQuestionAnalyzer` and `EntityNameResolver`
2. **Query Builder Service**: Methods like `buildPlayerQuery`, `getPlayerNodeReturnClause`, etc.
3. **Response Generation Service**: Methods like `generateResponse`, `buildContextualResponse`
4. **Chatbot Orchestrator**: Main `processQuestion` method that coordinates everything

- [ ] **Planning Phase**
  - [ ] Document current ChatbotService structure (create diagram)
  - [ ] Identify all dependencies between methods
  - [ ] Identify logical service boundaries
  - [ ] Create refactoring plan with migration steps
  - [ ] Identify breaking changes
- [ ] **Create New Services**
  - [ ] Create `lib/services/entityExtractionService.ts`
    - Extract: `resolvePlayerName`, entity resolution logic
    - Dependencies: `EntityNameResolver`, `EnhancedQuestionAnalyzer`
  - [ ] Create `lib/services/queryBuilderService.ts`
    - Extract: `buildPlayerQuery`, `getPlayerNodeReturnClause`, `getMatchDetailReturnClause`
    - Dependencies: Query builders in `lib/services/queryBuilders/`
  - [ ] Create `lib/services/responseGenerationService.ts`
    - Extract: `generateResponse`, `buildContextualResponse`
    - Dependencies: `naturalLanguageResponses.ts`, `responseBuilder.ts`
  - [ ] Create `lib/services/chatbotOrchestrator.ts`
    - Extract: Main `processQuestion` method
    - Coordinates: Entity extraction → Query building → Response generation
- [ ] **Migration**
  - [ ] Extract entity extraction logic (test after extraction)
  - [ ] Extract query building logic (test after extraction)
  - [ ] Extract response generation logic (test after extraction)
  - [ ] Update ChatbotService to use new services (keep as facade initially)
  - [ ] Update all imports across codebase
  - [ ] Remove old code from ChatbotService
- [ ] **Testing**
  - [ ] Run all existing tests: `npm test`
  - [ ] Verify chatbot functionality unchanged (manual testing)
  - [ ] Update tests for new structure
  - [ ] Test error handling paths
- [ ] **Target**: Each service < 500 lines

**Related Files to Update:**
- `app/api/chatbot/route.ts` - May need to update imports
- `__tests__/services/chatbotService.test.ts` - Update test imports
- All components using `chatbotService` - Verify imports still work

> [Back to Table of Contents](#table-of-contents)

### 4.2 Standardize API Patterns

- [ ] **Decision**: Choose single API pattern
  - [ ] Option A: Migrate all to Next.js API routes (recommended)
  - [ ] Option B: Migrate all to Netlify Functions
- [ ] **If Option A:**
  - [ ] Audit all Netlify Functions
  - [ ] Migrate `netlify/functions/trigger-seed.js` to `app/api/trigger-seed/route.ts`
  - [ ] Migrate `netlify/functions/players.js` to `app/api/players/route.ts`
  - [ ] Update `netlify.toml` redirects
  - [ ] Remove unused Netlify Functions
- [ ] **If Option B:**
  - [ ] Migrate all Next.js routes to Netlify Functions
  - [ ] Update routing configuration
- [ ] **Standardize Error Handling**
  - [ ] Create unified error response format
  - [ ] Implement consistent error handling across all routes

> [Back to Table of Contents](#table-of-contents)

### 4.3 Optimize State Management

**Context:**
- Current file: `lib/stores/navigation.ts` (2,038 lines)
- Store type: Zustand with complex nested state
- **Issue**: Single massive store handles navigation, filters, caching, player selection
- **Impact**: Components re-render unnecessarily when unrelated state changes
- **Current State Structure**:
  - Navigation state (current pages, sub-pages)
  - Player selection state
  - Filter state (per page, complex nested structure)
  - Cache state (player data, TOTW data, POM data)
  - UI state (loading, edit mode, etc.)

**Current Usage:**
- Components import: `import { useNavigationStore } from '@/lib/stores/navigation'`
- Store has 50+ properties and methods
- Filter state is duplicated per stats sub-page

**Zustand Best Practices:**
- Use selectors to prevent unnecessary re-renders
- Split large stores into focused stores
- Normalize state structure

- [ ] **File**: `lib/stores/navigation.ts` (2,038 lines)
- [ ] **Analysis Phase**
  - [ ] Document all store properties and their usage
  - [ ] Identify which components use which properties
  - [ ] Identify state dependencies
- [ ] **Split into Multiple Stores**
  - [ ] Create `lib/stores/navigationStore.ts`
    - Properties: `currentMainPage`, `currentStatsSubPage`, `currentTOTWSubPage`, `currentClubInfoSubPage`
    - Methods: `setMainPage`, `setStatsSubPage`, etc.
  - [ ] Create `lib/stores/filterStore.ts`
    - Properties: `playerFiltersByPage`, `playerFilters`, `filterData`, `isFilterSidebarOpen`
    - Methods: Filter management methods
  - [ ] Create `lib/stores/cacheStore.ts`
    - Properties: `cachedPlayerData`, `cachedTOTWSeasons`, `cachedPOMSeasons`, etc.
    - Methods: Cache management methods
  - [ ] Create `lib/stores/playerStore.ts`
    - Properties: `selectedPlayer`, `isPlayerSelected`, `isEditMode`
    - Methods: Player selection methods
- [ ] **Implement Selectors**
  - [ ] Create selector functions for each store
  - [ ] Use Zustand's selector pattern: `useNavigationStore(state => state.currentMainPage)`
  - [ ] Prevent unnecessary re-renders
- [ ] **State Normalization**
  - [ ] Normalize nested state structures (especially filters)
  - [ ] Reduce state duplication (filters per page)
  - [ ] Use IDs/references instead of duplicating data
- [ ] **Update Components**
  - [ ] Find all components using `useNavigationStore`: `grep -r "useNavigationStore" components/`
  - [ ] Update imports to use new stores
  - [ ] Update selectors to use new store structure
  - [ ] Test navigation functionality
  - [ ] Test filter functionality
  - [ ] Test player selection functionality

**Migration Strategy:**
1. Create new stores alongside existing store
2. Migrate components one by one
3. Remove old store once all components migrated
4. Test thoroughly at each step

**Related Files:**
- All components in `components/` directory (80+ files)
- Search for: `useNavigationStore` usage

> [Back to Table of Contents](#table-of-contents)

### 4.4 Implement Database Connection Pooling

**Context:**
- Current file: `lib/neo4j.ts` (405 lines)
- Also exists: `netlify/functions/lib/neo4j.js` (separate implementation)
- **Issue**: Connection created per request in `executeQuery()` method
- **Current Pattern**: `neo4j.driver()` called in `connect()` method, but connection may be recreated
- **Neo4j Driver**: Already supports connection pooling internally, but we need to reuse the driver instance

**Current Implementation Analysis:**
- `Neo4jService` class with singleton pattern (instance created at bottom of file)
- `connect()` method creates driver: `this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password))`
- `executeQuery()` calls `connect()` if not connected, but may create new driver
- Driver should be created once and reused

**Neo4j Driver Pooling:**
- Neo4j driver automatically manages connection pool
- Default max pool size: 50 connections
- Pool configuration can be set in driver options

- [ ] **File**: `lib/neo4j.ts`
- [ ] **Implement Singleton Driver Pattern**
  - [ ] Ensure driver is created only once
  - [ ] Store driver instance in class property
  - [ ] Reuse driver for all queries
- [ ] **Add Connection Pool Configuration**
  - [ ] Configure max pool size (default: 50)
  - [ ] Configure connection timeout
  - [ ] Configure max connection lifetime
  - [ ] Add pool configuration to driver options
- [ ] **Implement Connection Health Checks**
  - [ ] Add `healthCheck()` method
  - [ ] Ping database periodically
  - [ ] Reconnect if connection lost
- [ ] **Add Connection Retry Logic**
  - [ ] Implement exponential backoff for retries
  - [ ] Add max retry attempts
  - [ ] Log retry attempts
- [ ] **Add Connection Pool Metrics**
  - [ ] Track active connections
  - [ ] Track connection pool size
  - [ ] Add metrics endpoint (optional)
- [ ] **Testing**
  - [ ] Test under load (multiple concurrent requests)
  - [ ] Test connection recovery after failure
  - [ ] Test connection pool exhaustion scenarios
- [ ] **Documentation**
  - [ ] Document connection management strategy
  - [ ] Document pool configuration
  - [ ] Document retry behavior

**Key Changes:**
- Driver should be created once in `connect()`, stored in `this.driver`
- `executeQuery()` should reuse existing driver, not create new one
- Add `getConnection()` method that returns existing driver or connects
- Implement health check endpoint: `app/api/health/route.ts`

**Code Pattern:**
```typescript
class Neo4jService {
  private driver: Driver | null = null;
  
  async connect() {
    if (this.driver) {
      return true; // Already connected
    }
    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
      maxConnectionPoolSize: 50,
      connectionTimeout: 30000,
    });
    await this.driver.verifyConnectivity();
    return true;
  }
  
  getDriver(): Driver {
    if (!this.driver) {
      throw new Error('Driver not initialized. Call connect() first.');
    }
    return this.driver;
  }
}
```

**Related Files:**
- `netlify/functions/lib/neo4j.js` - May need similar updates if still in use
- `lib/services/chatbotService.ts` - Uses `neo4jService.connect()` and `neo4jService.executeQuery()`

> [Back to Table of Contents](#table-of-contents)

---

## Priority 5: Performance Optimizations

### 5.1 Enable Image Optimization

**Context:**
- Current config: `next.config.js` line 56 has `unoptimized: true`
- This disables Next.js Image Optimization API
- Images are served as-is, increasing bundle size and load times
- Next.js Image component requires optimization to be enabled

**Current Configuration:**
```javascript
images: {
  unoptimized: true,  // ← Remove this
  domains: ["docs.google.com"],
}
```

- [ ] **File**: `next.config.js` (line 56)
- [ ] Remove `unoptimized: true` line
- [ ] Configure image domains properly (already has "docs.google.com")
- [ ] Add AVIF and WebP format support
- [ ] **Test Image Loading**
  - [ ] Test in development mode
  - [ ] Test in production build
  - [ ] Verify images load correctly
  - [ ] Check image file sizes (should be reduced)
- [ ] **Performance Testing**
  - [ ] Measure image load times before/after
  - [ ] Check Lighthouse score improvement
  - [ ] Verify no broken images

**Code Change:**
```javascript
images: {
  domains: ["docs.google.com"],
  formats: ['image/avif', 'image/webp'],
  // Remove: unoptimized: true
}
```

**Note**: If deploying to Netlify, ensure Next.js Image Optimization is supported. Netlify supports it, but may require additional configuration.

**Related Files:**
- Check all `<Image>` components in `components/` directory
- Verify image sources are from allowed domains

> [Back to Table of Contents](#table-of-contents)

### 5.2 Implement Request Deduplication

- [ ] **File**: Create `lib/utils/requestDeduplication.ts`
- [ ] Implement request ID hashing
- [ ] Cache in-flight requests
- [ ] Return same promise for duplicate requests
- [ ] Add TTL for cached requests
- [ ] Integrate with chatbot API route
- [ ] Test deduplication behavior

> [Back to Table of Contents](#table-of-contents)

### 5.3 Add Distributed Caching

- [ ] **Decision**: Choose caching solution
  - [ ] Option A: Upstash Redis (serverless-friendly)
  - [ ] Option B: Vercel KV (if migrating to Vercel)
  - [ ] Option C: In-memory with TTL (fallback)
- [ ] **Implementation**
  - [ ] Create `lib/services/cacheService.ts`
  - [ ] Implement cache interface
  - [ ] Add cache to chatbot queries
  - [ ] Add cache to API responses
  - [ ] Configure cache TTLs by data type
- [ ] **Cache Strategy**
  - [ ] Static data: 24 hours
  - [ ] Player stats: 5 minutes
  - [ ] Query results: 5 minutes
- [ ] **Testing**
  - [ ] Test cache hit/miss rates
  - [ ] Test cache invalidation
  - [ ] Monitor cache performance

> [Back to Table of Contents](#table-of-contents)

### 5.4 Implement Service Worker Caching

- [ ] **File**: Create `public/sw.js` or configure in `next.config.js`
- [ ] Cache API responses for offline support
- [ ] Implement stale-while-revalidate for stats data
- [ ] Cache static assets aggressively
- [ ] Add cache versioning
- [ ] Test offline functionality
- [ ] Test cache updates

> [Back to Table of Contents](#table-of-contents)

### 5.5 Optimize Bundle Size

- [ ] **Analysis**
  - [ ] Install `@next/bundle-analyzer`
  - [ ] Run bundle analysis
  - [ ] Identify large dependencies
- [ ] **Optimization**
  - [ ] Code split large components
  - [ ] Lazy load heavy dependencies (charts, maps)
  - [ ] Remove unused dependencies
  - [ ] Use dynamic imports where appropriate
- [ ] **Target**: <250KB initial load

> [Back to Table of Contents](#table-of-contents)

### 5.6 Implement Data Prefetching

- [ ] **Prefetching Strategy**
  - [ ] Prefetch common queries on page load
  - [ ] Use Next.js `<Link prefetch>` for navigation
  - [ ] Implement optimistic UI updates
- [ ] **Implementation**
  - [ ] Identify common queries
  - [ ] Add prefetch hooks
  - [ ] Add loading states
- [ ] **Testing**
  - [ ] Test prefetch behavior
  - [ ] Measure performance improvement

> [Back to Table of Contents](#table-of-contents)

### 5.7 Add Response Compression

- [ ] **File**: `next.config.js`
- [ ] Enable gzip compression
- [ ] Test compression in production
- [ ] Verify response sizes reduced

**Code Change:**
```javascript
compress: true, // Enable gzip compression
```

> [Back to Table of Contents](#table-of-contents)

---

## Priority 6: Developer Experience

### 6.1 Centralize Logging

- [ ] **File**: Create `lib/services/unifiedLoggingService.ts`
- [ ] **Features**
  - [ ] Single logging interface
  - [ ] Structured JSON logging
  - [ ] Log levels (debug, info, warn, error)
  - [ ] Integration with error tracking
- [ ] **Migration**
  - [ ] Replace `loggingService` usage
  - [ ] Replace `logToBoth` usage
  - [ ] Replace `logMinimal` usage
  - [ ] Update all service files
- [ ] **Configuration**
  - [ ] Environment-based log levels
  - [ ] Production vs development logging

> [Back to Table of Contents](#table-of-contents)

### 6.2 Add Error Tracking

- [ ] **Decision**: Choose error tracking solution
  - [ ] Option A: Sentry (recommended)
  - [ ] Option B: LogRocket
  - [ ] Option C: Custom error logging service
- [ ] **Implementation**
  - [ ] Install and configure error tracking
  - [ ] Add error boundaries
  - [ ] Add API error tracking
  - [ ] Configure error filtering
  - [ ] Set up alerts
- [ ] **Integration**
  - [ ] Integrate with existing ErrorBoundary
  - [ ] Add to API routes
  - [ ] Add to service layer

> [Back to Table of Contents](#table-of-contents)

### 6.3 Add Performance Monitoring

- [ ] **Web Vitals**
  - [ ] Verify Umami Analytics tracking Web Vitals
  - [ ] Add custom Web Vitals tracking if needed
- [ ] **Custom Metrics**
  - [ ] Track chatbot query performance
  - [ ] Track database query performance
  - [ ] Track API response times
- [ ] **Dashboard**
  - [ ] Create performance dashboard
  - [ ] Set up alerts for slow queries
  - [ ] Monitor P95/P99 response times

> [Back to Table of Contents](#table-of-contents)

### 6.4 Improve Documentation

- [ ] **Code Documentation**
  - [ ] Add JSDoc comments to all public methods
  - [ ] Document complex algorithms
  - [ ] Add inline comments for non-obvious code
- [ ] **Architecture Documentation**
  - [ ] Update architecture diagrams
  - [ ] Document data flow
  - [ ] Document service interactions
- [ ] **API Documentation**
  - [ ] Document all API endpoints
  - [ ] Add request/response examples
  - [ ] Document error responses

> [Back to Table of Contents](#table-of-contents)

---

## Priority 7: Testing & Quality

### 7.1 Increase Test Coverage

- [ ] **Current State**
  - [ ] Run `npm run test:coverage`
  - [ ] Document current coverage percentage
- [ ] **Target**: >80% coverage
- [ ] **Add Tests**
  - [ ] Unit tests for all services
  - [ ] Integration tests for API routes
  - [ ] Component tests for UI
  - [ ] E2E tests for critical flows
- [ ] **Test Quality**
  - [ ] Ensure tests are meaningful (not just coverage)
  - [ ] Test edge cases
  - [ ] Test error scenarios

> [Back to Table of Contents](#table-of-contents)

### 7.2 Add E2E Testing

- [ ] **Setup**
  - [ ] Install Playwright or Cypress
  - [ ] Configure E2E test environment
  - [ ] Set up test data
- [ ] **Critical Flows**
  - [ ] Test chatbot query flow
  - [ ] Test player selection
  - [ ] Test filter application
  - [ ] Test navigation
- [ ] **CI/CD Integration**
  - [ ] Add E2E tests to CI pipeline
  - [ ] Run tests on PRs

> [Back to Table of Contents](#table-of-contents)

### 7.3 Add Performance Regression Tests

- [ ] **Setup**
  - [ ] Create performance test suite
  - [ ] Define performance benchmarks
- [ ] **Tests**
  - [ ] API response time tests
  - [ ] Database query performance tests
  - [ ] Bundle size tests
  - [ ] Lighthouse score tests
- [ ] **CI Integration**
  - [ ] Fail builds on performance regression
  - [ ] Track performance over time

> [Back to Table of Contents](#table-of-contents)

### 7.4 Add Load Testing

- [ ] **Setup**
  - [ ] Choose load testing tool (k6, Artillery, etc.)
  - [ ] Configure test scenarios
- [ ] **Scenarios**
  - [ ] Test chatbot endpoint under load
  - [ ] Test concurrent user scenarios
  - [ ] Test database connection limits
- [ ] **Analysis**
  - [ ] Identify bottlenecks
  - [ ] Document performance characteristics
  - [ ] Set up monitoring

> [Back to Table of Contents](#table-of-contents)

---

## Progress Tracking

### Overall Progress

- **Priority 1 (Critical Fixes)**: 0/3 completed
- **Priority 2 (TypeScript)**: 0/3 completed
- **Priority 3 (Security)**: 0/3 completed
- **Priority 4 (Architecture)**: 0/4 completed
- **Priority 5 (Performance)**: 0/7 completed
- **Priority 6 (DX)**: 0/4 completed
- **Priority 7 (Testing)**: 0/4 completed

**Total**: 0/29 major sections completed

### Quick Wins (Can Do Today)

- [ ] Fix CORS configuration (5 minutes)
- [ ] Fix logToBoth calls (30 minutes)
- [ ] Add environment variable validation (1 hour)
- [ ] Enable image optimization (5 minutes)

### Estimated Time Investment

- **Week 1-2**: Priority 1-2 (parallel with chatbot development)
- **Week 3**: Priority 3 (1 day)
- **Week 4-6**: Priority 4 (after chatbot completion)
- **Week 7-8**: Priority 5
- **Ongoing**: Priority 6-7

### Notes

_Add your notes here as you work through items:_

- 
- 
- 

---

## How to Use This Document

1. **Check off items** as you complete them
2. **Add notes** in the Notes section for context
3. **Update progress** in the Progress Tracking section
4. **Feed back into chat** for assistance with specific items
5. **Prioritize** based on your current development phase

**Remember**: Fix TypeScript errors incrementally as you work. Defer large refactoring until chatbot features are stable.

## Working with This Document in Chat

When feeding sections back into chat, include:
- The specific section you're working on
- Any notes you've added
- Current status of checkboxes
- Any blockers or questions

**Example prompts:**
- "Help me implement Priority 1.1: Fix CORS Security Issue"
- "I'm working on Priority 2.1, I've fixed lines 553-583, help me with the remaining errors"
- "I need help with Priority 4.4: Database Connection Pooling - how do I test connection pooling?"

## Key Commands Reference

```bash
# Type checking
npm run type-check

# Testing
npm test
npm run test:coverage

# Linting
npm run lint

# Build
npm run build

# Development
npm run dev
```

## Important File Locations

- **TypeScript Errors**: `typescript-errors-log.txt` (325 lines of errors)
- **Main Chatbot Service**: `lib/services/chatbotService.ts` (5,324 lines)
- **State Store**: `lib/stores/navigation.ts` (2,038 lines)
- **Database Connection**: `lib/neo4j.ts` (405 lines)
- **Next.js Config**: `next.config.js`
- **TypeScript Config**: `tsconfig.json`
- **API Route**: `app/api/chatbot/route.ts`
- **PWA Config**: `next.config.js` (withPWA), `public/manifest.json`

> [Back to Table of Contents](#table-of-contents)

