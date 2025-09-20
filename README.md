<p align="center">
  <img src="https://i.imgur.com/wMPmx9P.png" alt="Dorkinians FC Logo" width="200"/>
</p>

# Dorkinians FC Statistics Website

> Mobile-first PWA chatbot statistics website for Dorkinians FC with unified schema architecture.

[![Netlify Status](https://api.netlify.com/api/v1/badges/d6b1056f-438c-4a15-8c02-5c390705543e/deploy-status)](https://app.netlify.com/projects/dorkinians-website-v3/deploys)

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Project Overview](#project-overview)
  - [Key Features](#key-features)
- [Chatbot Architecture](#chatbot-architecture)
  - [Enhanced Entity Extraction](#enhanced-entity-extraction)
  - [Natural Language Processing](#natural-language-processing)
  - [Query Processing Flow](#query-processing-flow)
  - [Response Generation](#response-generation)
- [Quick Start](#quick-start)
  - [Development Start](#development-start)
  - [Production Start](#production-start)
  - [Database Seeding](#database-seeding)
  - [Database Verification](#database-verification)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Schema Management](#schema-management)
- [API Endpoints](#api-endpoints)
  - [Chatbot Query Endpoint](#chatbot-query-endpoint)
  - [Database Seeding Endpoint](#database-seeding-endpoint)
- [Additional Documentation](#additional-documentation)

## Project Overview

**Mobile-first PWA chatbot statistics website** for Dorkinians FC that processes natural language queries and returns visualized data using reusable chart components.

### Key Features

- **Mobile-First Design**: Optimized for mobile devices with native app feel
- **PWA Interface**: Progressive Web App with chatbot as primary interface
- **Natural Language Processing**: Process user questions and return visualized answers
- **Unified Data Schema**: Single source of truth for all data definitions
- **Database**: Neo4j Aura for efficient data storage and querying

> [!top] [Back to top](#table-of-contents)

## Chatbot Architecture

The chatbot is the core functionality of the application, processing natural language queries about Dorkinians FC statistics and returning visualized responses.

### Enhanced Entity Extraction

The system uses a sophisticated 7-class classification system implemented in `lib/config/entityExtraction.ts`:

**Entity Types** (`EntityExtractor` class):
- **Players**: Up to 3 per question with fuzzy matching and pseudonym support
- **Teams**: 1st, 2nd, 3rd, 4th team recognition with ordinal number parsing
- **Stat Types**: Goals, appearances, TOTW, penalties, etc. with 50+ pseudonyms
- **Stat Indicators**: Highest, lowest, average, longest, shortest, consecutive
- **Question Types**: How many, where, who, what, which, when
- **Negative Clauses**: Excluding, without, not (for filtered queries)
- **Locations**: Home, away, specific grounds (up to 2 per question)
- **Time Frames**: Seasons, dates, gameweeks, streaks, temporal expressions

**Advanced Features**:
- **Multi-Entity Support**: Complex comparisons (e.g., "How many goals have I, Kieran Mackrell and Ali Robins scored?")
- **Fuzzy Matching**: Uses `natural` library for approximate player name matching
- **Context Integration**: Incorporates user context from player selection
- **Special Logic**: "Goal involvements" = goals + assists, comprehensive pseudonym recognition
- **Clarification Detection**: Identifies ambiguous queries requiring user clarification

**Implementation**: `EnhancedQuestionAnalyzer` class orchestrates the extraction process and provides backward compatibility with legacy question analysis.

> [!top] [Back to top](#table-of-contents)

### Natural Language Processing

**Core Libraries** (`lib/services/chatbotService.ts`):
- **`natural`**: Fuzzy string matching for player name recognition and approximate matching
- **`compromise`**: Advanced text parsing and linguistic analysis for question structure
- **Custom Entity Extraction**: `lib/config/entityExtraction.ts` for domain-specific sports terminology

**Processing Pipeline**:
1. **Text Preprocessing**: Question normalization and context extraction
2. **Entity Recognition**: Multi-pass extraction using regex patterns and fuzzy matching
3. **Context Integration**: Player selection context merged with question analysis
4. **Validation**: Question clarity assessment and clarification request generation

**Integration**: Seamless Next.js integration with comprehensive frontend logging and debug information

**Context Awareness**: Superior understanding of sports queries with player context switching and team-specific terminology

> [!top] [Back to top](#table-of-contents)

### Query Processing Flow

The chatbot processes natural language queries through a sophisticated multi-stage pipeline:

1. **Input Reception** (`app/api/chatbot/route.ts`)
   - User submits query via `ChatbotInterface` component
   - API endpoint validates input and extracts player context
   - Handles "About [Player]:" prefixed questions for context switching

2. **Enhanced Entity Extraction** (`lib/config/enhancedQuestionAnalysis.ts`)
   - `EnhancedQuestionAnalyzer` class processes the question
   - Uses `EntityExtractor` to identify 7 entity types: players, teams, stats, indicators, question types, locations, timeframes
   - Supports complex multi-entity queries (e.g., "How many goals have I, Kieran Mackrell and Ali Robins scored?")
   - Handles pseudonyms and fuzzy matching for player names

3. **Question Analysis** (`lib/services/chatbotService.ts`)
   - `analyzeQuestion()` method determines query type and complexity
   - Classifies as: player, team, club, fixture, comparison, streak, double_game, temporal, or general
   - Validates question clarity and requests clarification if needed

4. **Cypher Query Generation** (`lib/services/chatbotService.ts`)
   - `queryRelevantData()` method builds Neo4j Cypher queries
   - Uses extracted entities to construct graph database queries
   - Implements query caching for performance optimization

5. **Database Execution** (`netlify/functions/lib/neo4j.js`)
   - Queries executed against Neo4j Aura database
   - Connection validation and error handling
   - Structured error responses for debugging

6. **Response Generation** (`lib/services/chatbotService.ts`)
   - `generateResponse()` method processes database results
   - Uses `naturalLanguageResponses.ts` for human-readable formatting
   - Applies metric-specific formatting (decimal places, units)

7. **Visualization & Delivery** (`components/ChatbotInterface.tsx`)
   - Data converted to appropriate chart components using Recharts
   - Response delivered with debug information for development
   - Mobile-optimized visualization components

> [!top] [Back to top](#table-of-contents)

### Response Generation

**Core Processing** (`lib/services/chatbotService.ts`):
- **`generateResponse()` method**: Processes database results into user-friendly responses
- **`naturalLanguageResponses.ts`**: Human-readable formatting and response templates
- **Metric Formatting**: Applies decimal places and units based on `config/config.ts` settings
- **Error Handling**: Structured error responses with debugging information

**Visualization Pipeline** (`components/ChatbotInterface.tsx`):
- **Recharts Integration**: Seamless Next.js integration with mobile-optimized charts
- **Custom Components**: Reusable chart components for different data types
- **Response Types**: Statistical summaries, player comparisons, team analytics, historical trends
- **Mobile Optimization**: Touch-friendly components with responsive design
- **Performance**: Tree-shakeable, minimal bundle impact

**Response Structure**:
```typescript
interface ChatbotResponse {
  answer: string;           // Human-readable answer
  data?: any;              // Raw data for visualization
  visualization?: {        // Chart configuration
    type: "chart" | "table" | "calendar" | "stats";
    data: any;
    config?: any;
  };
  sources: string[];       // Data source references
  cypherQuery?: string;    // Debug: executed Cypher query
}
```

> **For detailed technical implementation**: See [AdditionalDetail.md](./docs/AdditionalDetail.md#architecture-details) for complete architecture details, service implementations, and development workflow.

> [!top] [Back to top](#table-of-contents)

## Quick Start

### Development Start

1. Start Neo4j Desktop locally
2. Run development server: `npm run dev`
3. Access application: http://localhost:3000 and review

> [!top] [Back to top](#table-of-contents)

### Production Start

1. Check that the [Neo4j Aura database](https://console-preview.neo4j.io/projects/7a5b41a0-6373-5c3c-9fcf-48b80d5d38f2/instances) is running
2. Access application: https://dorkinians-website-v3.netlify.app and review

> [!top] [Back to top](#table-of-contents)

### Database Seeding

- To seed the database, visit the admin panel (https://dorkinians-website-v3.netlify.app/admin) and click the "Trigger Production Seeding" button.
- All environments now use the same Neo4j Aura database for consistency.

> [!top] [Back to top](#table-of-contents)

### Database Verification

- To view all nodes, run the following query:
  - `MATCH (n) RETURN n;`
- To view all nodes and relationships, run the following query:
  - `MATCH (n)-[r]->(m) RETURN n, r, m;`
- To count all nodes with the Dorkinians Website label by type, run the following query:
  - `MATCH (n) WHERE n.graphLabel = 'dorkiniansWebsite' RETURN labels(n) AS NodeType, count(n) AS Count ORDER BY Count DESC`
- To find a specific player by name and see all of their relationships, run the following query:
  - `MATCH (player {playerName: 'Luke Bangs', graphLabel: 'dorkiniansWebsite'})-[r]-(connected) RETURN player, r, connected;`

> [!top] [Back to top](#table-of-contents)

## Configuration

### Environment Variables

**Required Environment Variables:**

```bash
# Neo4j Database
PROD_NEO4J_URI=neo4j+s://your-aura-instance.databases.neo4j.io
PROD_NEO4J_USER=neo4j
PROD_NEO4J_PASSWORD=your-aura-password

# OpenAI API (for chatbot)
OPENAI_API_KEY=your_openai_api_key_here

# Email Configuration (for notifications)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL_SECURE=false
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_TO_EMAIL=recipient@example.com
```

> [!top] [Back to top](#table-of-contents)

### Schema Management

The project uses a unified schema system where configuration files are synchronized between repositories:

**Master Locations:**
- **Schema**: `database-dorkinians/config/schema.js` (master)
- **Data Sources**: `database-dorkinians/config/dataSources.js` (master)

**Sync Process:**
1. Edit schema in `database-dorkinians/config/schema.js`
2. Run sync script: `npm run sync-config`
3. Deploy both repositories

> [!top] [Back to top](#table-of-contents)

## API Endpoints

### Chatbot Query Endpoint

**Endpoint**: `/api/chatbot/query`

**Method**: POST

**Request Body**:
```json
{
  "query": "How many goals has Luke Bangs scored this season?",
  "context": {
    "userId": "optional-user-id",
    "sessionId": "optional-session-id"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "answer": "Luke Bangs has scored 15 goals this season",
    "visualization": {
      "type": "bar-chart",
      "data": [...],
      "config": {...}
    },
    "entities": {
      "players": ["Luke Bangs"],
      "statType": "goals",
      "timeframe": "this season"
    }
  }
}
```

> [!top] [Back to top](#table-of-contents)

### Database Seeding Endpoint

**Endpoint**: `/.netlify/functions/trigger-seed`

**Method**: GET

**Query Parameters**:
- `environment`: "production" or "development"

**Response**:
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

> [!top] [Back to top](#table-of-contents)

## Additional Documentation

For detailed technical documentation including:

- Complete architecture details
- Environment setup instructions
- Development workflow
- Deployment procedures
- PWA configuration
- Email setup
- Troubleshooting guides

See: [AdditionalDetail.md](./docs/AdditionalDetail.md)

For development guidelines and best practices:

- React & Next.js best practices
- Component lifecycle & hooks safety
- State management patterns
- Testing & data validation protocols
- Quality gates and debugging strategies

See: [ENGINEERING_DOCTRINE.md](./docs/ENGINEERING_DOCTRINE.md)

> [!top] [Back to top](#table-of-contents)