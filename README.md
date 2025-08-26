<p align="center">
  <img src="https://i.imgur.com/wMPmx9P.png" alt="Dorkinians FC Logo" width="200"/>
</p>

# Dorkinians FC Statistics Website

> Mobile-first PWA chatbot statistics website for Dorkinians FC with unified schema architecture.

[![Netlify Status](https://api.netlify.com/api/v1/badges/d6b1056f-438c-4a15-8c02-5c390705543e/deploy-status)](https://app.netlify.com/projects/dorkinians-website-v3/deploys)

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Environment Setup](#environment-setup)
- [Development Workflow](#development-workflow)
- [Deployment](#deployment)
- [Maintenance](#maintenance)
- [Contributing](#contributing)
- [Support](#support)

## Project Overview

**Mobile-first PWA chatbot statistics website** for Dorkinians FC that processes natural language queries and returns visualized data using reusable chart components.

### **Key Features**
- **Mobile-First Design**: Optimized for mobile devices with native app feel
- **PWA Interface**: Progressive Web App with chatbot as primary interface
- **Natural Language Processing**: Process user questions and return visualized answers
- **Multiple Screens**: Footer navigation with swipeable sub-screens
- **Unified Data Schema**: Single source of truth for all data definitions via Git submodule
- **Database**: Neo4j Aura for efficient data storage and querying

## Architecture

### **Unified Schema System**

The project uses a centralized schema approach where all data definitions are maintained in the `database-dorkinians` repository:

```
┌─────────────────────────────────────────────────────────────┐
│                    V3-Dorkinians-Website                   │
│  ├── Frontend (Next.js PWA)                               │
│  ├── Netlify Functions                                    │
│  └── API Routes                                           │
└─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Git Submodule Integration                     │
├─────────────────────────────────────────────────────────────┤
│  database-dorkinians/                                      │
│  ├── config/schema.js          # Unified schema definition │
│  ├── services/schemaDrivenSeeder.js                        │
│  └── (database seeding logic)                              │
└─────────────────────────────────────────────────────────────┘
```

### **Key Components**
- **Frontend**: Next.js PWA with chatbot interface
- **Backend Services**: Netlify functions for API endpoints
- **Database Seeder**: Heroku service using unified schema
- **Schema Management**: Centralized in database-dorkinians repo
- **Data Sources**: Google Sheets CSV endpoints + FA website data

> [Back to Table of Contents](#table-of-contents)

## Quick Start

### **Development Setup**

1. **Start Neo4j Desktop locally**
2. **Start Neo4j graph database** on port `7687`
3. **Run development server**: `npm run dev`
4. **Access application**: http://localhost:3000

### **Database Verification**

```bash
# View all nodes and relationships
MATCH (n)-[r]->(m) RETURN n, r, m;

# View all nodes
MATCH (n) RETURN n;
```

> [Back to Table of Contents](#table-of-contents)

## Environment Setup

### **Prerequisites**
- Node.js 18+
- Neo4j Aura database access
- OpenAI API key (for chatbot)

### **Neo4j Configuration**

#### **Local Development (Recommended)**
```bash
# Install Neo4j Desktop
# Create local database: neo4j on port 7687

# Environment variables
DEV_NEO4J_URI=bolt://localhost:7687
DEV_NEO4J_USER=neo4j
DEV_NEO4J_PASSWORD=password
DEV_NEO4J_DATABASE=neo4j
```

#### **Production (Neo4j Aura)**
```bash
PROD_NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io
PROD_NEO4J_USER=your-username
PROD_NEO4J_PASSWORD=your_aura_db_password
```

### **OpenAI Configuration**
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### **SMTP Configuration**
```bash
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL_SECURE=false
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_TO_EMAIL=recipient@example.com
```

### **Installation**
```bash
npm install
npm run test-neo4j  # Test Neo4j connection
npm run dev          # Start development server
```

> [Back to Table of Contents](#table-of-contents)

## Development Workflow

### **Schema Updates**

When data structures change:

1. **Update Unified Schema**: Modify `database-dorkinians/config/schema.js`
2. **Test Changes**: Use database seeder test endpoints
3. **Deploy Updates**: Push changes to both repositories
4. **Verify Integration**: Test frontend functionality

### **Managing Schema Changes**

#### **Adding/Removing CSV Columns**

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

#### **Schema Validation**

The system automatically validates:
- **Column Presence**: Required columns exist
- **Data Types**: Type conversions work correctly
- **Required Fields**: Mandatory fields have values
- **Relationship Rules**: Relationship creation logic

### **Git Submodule Management**

#### **How Submodule Works**

```
V3-Dorkinians-Website/
├── .git/                    # Main repository
├── v3-repo/                 # Git submodule (database-dorkinians)
│   ├── config/schema.js     # Unified schema definitions
│   └── services/            # Database seeding services
└── lib/config/
    └── schemaBridge.js      # Bridge to access submodule schema
```

#### **Submodule Updates**

**Automatic Updates (Recommended)**:
```bash
git submodule update --remote
git add v3-repo
git commit -m "Update database-dorkinians submodule"
git push origin main
```

**Manual Updates**:
```bash
cd v3-repo
git pull origin main
cd ..
git add v3-repo
git commit -m "Update database-dorkinians submodule manually"
git push origin main
```

**Verify Status**:
```bash
git submodule status  # Should show: v3-repo <commit-hash> (main)
```

#### **Submodule Troubleshooting**

**Reset Submodule**:
```bash
git submodule deinit v3-repo
git rm v3-repo
git commit -m "Remove problematic submodule"
git submodule add https://github.com/bangsluke/Dorkinians-Website-V2.git v3-repo
git commit -m "Re-add database-dorkinians submodule"
git push origin main
```

**Check Configuration**:
```bash
cat .gitmodules
# Should show:
# [submodule "v3-repo"]
#   path = v3-repo
#   url = https://github.com/bangsluke/Dorkinians-Website-V2.git
```

#### **Best Practices**
1. **Always update submodules after schema changes**
2. **Test schema integration after submodule updates**
3. **Keep submodule commits in sync with main repository**
4. **Document submodule changes in commit messages**

### **Data Seeding**

**Hybrid Approach**:
- **Netlify Function**: Lightweight trigger endpoint
- **Heroku Service**: Long-running seeding process using unified schema
- **Email Notifications**: Automated status updates during seeding

### **Testing**

```bash
# Frontend tests
npm test

# API endpoint tests
npm run test:api

# Database seeding tests
npm run test:seeding

# Schema integration test
node -e "const { hasUnifiedSchema } = require('./lib/config/schemaBridge'); console.log('Schema available:', hasUnifiedSchema());"
```

> [Back to Table of Contents](#table-of-contents)

## Deployment

### **Netlify Deployment**

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

### **Database Seeder Deployment**

**Separate Heroku Service**:
- **Repository**: `database-dorkinians`
- **Service**: Long-running Neo4j seeding operations
- **Integration**: Triggered via Netlify functions
- **Monitoring**: Email notifications and status endpoints

> [Back to Table of Contents](#table-of-contents)

## Maintenance

### **Regular Tasks**

1. **Schema Review**: Periodically review unified schema configuration
2. **Data Quality**: Monitor CSV data quality and structure
3. **Performance**: Track API response times and database query performance
4. **Security**: Review API access and authentication mechanisms

### **Troubleshooting**

- **Schema Issues**: Check `database-dorkinians/config/schema.js`
- **Data Problems**: Verify CSV structure and Google Sheets permissions
- **Performance**: Monitor Neo4j query execution times
- **Integration**: Test database seeder connectivity

> [Back to Table of Contents](#table-of-contents)

## Contributing

### **Development Guidelines**

1. **Schema Changes**: Always update the unified schema first
2. **Testing**: Include tests for new functionality
3. **Documentation**: Update relevant documentation
4. **Code Quality**: Follow established patterns and linting rules

### **Repository Structure**

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

## License

This project is licensed under the MIT License.
