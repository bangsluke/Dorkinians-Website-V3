# Dorkinians FC Statistics Website

A **mobile-first PWA chatbot statistics website** for Dorkinians FC that processes natural language queries and returns visualized data using reusable chart components.

## 🎯 Project Overview

- **Mobile-First Design**: Optimized for mobile devices with native app feel
- **PWA Interface**: Progressive Web App with chatbot as primary interface
- **Natural Language Processing**: Process user questions and return visualized answers
- **Multiple Screens**: Footer navigation with swipeable sub-screens
- **Data Sources**: Google Sheets CSV endpoints + FA website data
- **Database**: Neo4j Aura for efficient data storage and querying

## 🚀 Quick Start

### Development Start

To quickly get started in development mode:

1. Start up Neo4j desktop locally
2. Start the Neo4j graph database (on Neo4j desktop) and use the command `MATCH (n)-[r]->(m) RETURN n, r, m;` to see all nodes and edges or `MATCH (n) RETURN n` to see all nodes
3. Start the backend by running: `npm run dev` in a terminal - Note: This will generate types from the GraphQL schema in the backend and start up the Python script in development mode
4. Open up whatever frontend app you are connecting to the backend-server and check that data is coming through

> [Back to Table of Contents](#table-of-contents)

## Setting Up

### Prerequisites

- Node.js 18+
- Neo4j Aura database access
- OpenAI API key (for chatbot)

### 1. Environment Setup

#### Option A: Local Neo4j Desktop (Recommended for Development)

1. Install [Neo4j Desktop](https://neo4j.com/download/)
2. Create local database: `neo4j` on port `7687`
3. Update your `.env` file with:

```bash
# Local Development Neo4j Configuration
DEV_NEO4J_URI=bolt://localhost:7687
DEV_NEO4J_USER=neo4j
DEV_NEO4J_PASSWORD=password
DEV_NEO4J_DATABASE=neo4j

# Production Neo4j Configuration (Aura)
PROD_NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io
PROD_NEO4J_USER=your-username
PROD_NEO4J_PASSWORD=your_aura_db_password
```

**See [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) for detailed setup instructions.**

**Note**: The system uses a single `.env` file with `DEV_` and `PROD_` prefixes for environment-specific values.

#### Option B: Neo4j Aura (Production)

Use your existing Aura database configuration.

# OpenAI API (for chatbot)

OPENAI_API_KEY=your_openai_api_key_here

# SMTP Configuration (for automated emails)

SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL_SECURE=false
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_TO_EMAIL=recipient@example.com

````

### 2. Install Dependencies
```bash
npm install
````

### 3. Test Neo4j Connection (Local Development)

```bash
npm run test-neo4j
```

### 4. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Next.js 14 + App Router
- **Mobile Navigation**: Framer Motion + Hybrid Navigation
- **UI Components**: Tailwind CSS + Headless UI
- **Database**: Neo4j Aura
- **Chatbot**: OpenAI API + Function Calling
- **Visualization**: Recharts + Custom Components
- **State Management**: Zustand

### Screen Structure

- **Homepage**: Chatbot input interface
- **Stats**: Container with 4 swipeable sub-screens
  - Player Stats
  - Team Stats
  - Club Stats
  - Comparison
- **TOTW**: Team of the week with interactive graphics
- **Club Information**: Static content display

### Navigation Pattern

- **Header**: Club logo + settings icon (all screens)
- **Footer**: 4 main navigation icons
- **Sub-navigation**: Swipe gestures within Stats page

## 📊 Data Sources

### Google Sheets CSV Endpoints

- **FixturesAndResults**: ~2,400 rows (fixtures, results, team data)
- **Players**: ~631 rows (player information)
- **MatchDetails**: ~18,500 rows (individual match statistics)
- **WeeklyTOTW**: ~308 rows (team of the week selections)
- **SeasonTOTW**: ~18 rows (season awards)
- **PlayersOfTheMonth**: ~308 rows (monthly player awards)
- **Other tables**: ~400 rows total

### Data Volume Projections

- **Current**: ~22,000 total rows
- **5-year projection**: ~34,000 total rows
- **Neo4j Aura Free Tier**: 200,000 nodes, 400,000 relationships ✅

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
```

### Project Structure

```
├── app/                 # Next.js 14 app directory
│   ├── globals.css     # Global styles with Tailwind
│   ├── layout.tsx      # Root layout with PWA meta
│   └── page.tsx        # Homepage with chatbot
├── components/          # Reusable React components
├── lib/                 # Utility libraries
│   └── neo4j.ts        # Neo4j database service
├── types/               # TypeScript type definitions
├── public/              # Static assets
│   └── manifest.json   # PWA manifest
└── context/             # Project context and documentation
```

## 📱 PWA Features

- **Service Worker**: Offline-first strategy
- **App Manifest**: Native app installation
- **Mobile Optimized**: Touch-friendly interactions
- **Responsive Design**: Mobile-first breakpoints

## 🚧 Current Status

### ✅ Completed (Phase 1)

- [x] Next.js 14 project setup
- [x] PWA configuration
- [x] Tailwind CSS setup
- [x] Basic project structure
- [x] Homepage chatbot interface
- [x] Footer navigation
- [x] Header with logo and settings
- [x] Neo4j service setup
- [x] TypeScript type definitions

### 🔄 Next Steps (Phase 2)

- [ ] Navigation framework implementation
- [ ] Screen routing and transitions
- [ ] Stats page container structure
- [ ] Basic screen layouts

### 📋 Future Phases

- **Phase 3**: Data integration & chatbot
- **Phase 4**: Individual screen development
- **Phase 5**: Performance & PWA optimization

## 🛠️ Configuration Files

- **`next.config.js`**: Next.js + PWA configuration
- **`tailwind.config.js`**: Tailwind CSS with custom theme
- **`tsconfig.json`**: TypeScript configuration
- **`package.json`**: Dependencies and scripts

## 📚 Documentation

- **`context/ARCHITECTURE_ANALYSIS.md`**: Complete architecture documentation
- **`example-data/`**: Sample CSV data and example questions
- **`data_sources.json`**: Data source URLs and structure

## Neo4j Queries

- `MATCH ()-[r {graphLabel: 'dorkiniansWebsite'}]->() RETURN count(r) AS totalRelationships` - This will return the total number of relationships in the database for the dorkiniansWebsite graph label
- `MATCH (p:Player {graphLabel: 'dorkiniansWebsite'}) RETURN p.name as playerName ORDER BY p.name LIMIT 50` - This will return the names of the first 50 players in the database for the dorkiniansWebsite graph label
- `MATCH (p:Player {name: "Luke Bangs"}) RETURN p` - This will return the node for the player with the exact name "Luke Bangs"
- `MATCH (p:Player {graphLabel: 'dorkiniansWebsite'}) WHERE p.name CONTAINS "Luke" OR p.name CONTAINS "Bangs" OR p.name CONTAINS "luke" OR p.name CONTAINS "bangs" RETURN p.name as playerName ORDER BY p.name` - This will return the names of the players in the database for the dorkiniansWebsite graph label that contain the string "Luke" or "Bangs" or "luke" or "bangs"
- `MATCH (p:Player {name: "Luke Bangs"}) OPTIONAL MATCH (p)-[r]->(n) RETURN p.name as playerName, type(r) as relationshipType, labels(n) as nodeLabels, n.name as nodeName ORDER BY type(r)` - Return the player name and all the relationships and nodes that the player has

## 🚨 Important Notes

- **Data Updates**: Google Sheets updated daily, automated refresh desired
- **Rate Limiting**: Implement caching for Google Sheets API calls
- **Mobile First**: All development should prioritize mobile experience
- **Neo4j Limits**: Free tier sufficient for current and projected data volume

## 🤝 Contributing

This is a solo developer project. All development follows the architecture outlined in `context/ARCHITECTURE_ANALYSIS.md`.

## 📄 License

Private project for Dorkinians FC.
