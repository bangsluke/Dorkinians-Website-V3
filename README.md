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

### Prerequisites
- Node.js 18+ 
- Neo4j Aura database access
- OpenAI API key (for chatbot)

### 1. Environment Setup
Copy `.env.example` to `.env.local` and configure:

```bash
# Development Neo4j Configuration
DEV_NEO4J_URI=your-connection-type-and-url
DEV_NEO4J_USER=your-username
DEV_NEO4J_PASSWORD=your_local_password

# Production Neo4j Configuration (Aura)
PROD_NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io
PROD_NEO4J_USER=your-username
PROD_NEO4J_PASSWORD=your_aura_db_password

# OpenAI API (for chatbot)
OPENAI_API_KEY=your_openai_api_key_here

# SMTP Configuration (for automated emails)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=your-email@gmail.com
TO_EMAIL=recipient@example.com
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
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

## 🚨 Important Notes

- **Data Updates**: Google Sheets updated daily, automated refresh desired
- **Rate Limiting**: Implement caching for Google Sheets API calls
- **Mobile First**: All development should prioritize mobile experience
- **Neo4j Limits**: Free tier sufficient for current and projected data volume

## 🤝 Contributing

This is a solo developer project. All development follows the architecture outlined in `context/ARCHITECTURE_ANALYSIS.md`.

## 📄 License

Private project for Dorkinians FC.