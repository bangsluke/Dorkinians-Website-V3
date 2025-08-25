const neo4j = require('neo4j-driver');
const Papa = require('papaparse');
const https = require('https');
const http = require('http');

class DataSeeder {
  constructor() {
    this.neo4jDriver = null;
    this.session = null;
    this.jobStatus = new Map();
  }

  async initialize(environment) {
    try {
      const uri = environment === 'production' ? process.env.PROD_NEO4J_URI : process.env.DEV_NEO4J_URI;
      const user = environment === 'production' ? process.env.PROD_NEO4J_USER : process.env.DEV_NEO4J_USER;
      const password = environment === 'production' ? process.env.PROD_NEO4J_PASSWORD : process.env.DEV_NEO4J_PASSWORD;

      if (!uri || !user || !password) {
        throw new Error(`Missing Neo4j environment variables for ${environment}`);
      }

      this.neo4jDriver = neo4j.driver(uri, neo4j.auth.basic(user, password));
      this.session = this.neo4jDriver.session();
      
      // Test connection
      await this.session.run('RETURN 1 as test');
      console.log('✅ Neo4j connection established');
      
    } catch (error) {
      console.error('❌ Failed to initialize Neo4j connection:', error);
      throw error;
    }
  }

  async cleanup() {
    try {
      if (this.session) {
        await this.session.close();
      }
      if (this.neo4jDriver) {
        await this.neo4jDriver.close();
      }
      console.log('✅ Neo4j connection closed');
    } catch (error) {
      console.warn('⚠️ Error during cleanup:', error);
    }
  }

  async seedAllData(environment, jobId) {
    const startTime = Date.now();
    
    try {
      // Initialize job status
      this.jobStatus.set(jobId, {
        status: 'running',
        progress: 0,
        currentStep: 'Initializing',
        startTime: new Date().toISOString()
      });

      // Initialize Neo4j connection
      await this.initialize(environment);
      this.updateJobStatus(jobId, 'Neo4j Connected', 10);

      // Data sources configuration
      const dataSources = [
        {
          name: "TBL_SiteDetails",
          url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=77050817&single=true&output=csv",
        },
        {
          name: "TBL_Players",
          url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1796371215&single=true&output=csv",
        },
        {
          name: "TBL_FixturesAndResults",
          url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=103750289&single=true&output=csv",
        },
        {
          name: "TBL_MatchDetails",
          url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=564691931&single=true&output=csv",
        },
        {
          name: "TBL_WeeklyTOTW",
          url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1985336995&single=true&output=csv",
        },
        {
          name: "TBL_SeasonTOTW",
          url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=91372781&single=true&output=csv",
        },
        {
          name: "TBL_PlayersOfTheMonth",
          url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=2007852556&single=true&output=csv",
        },
        {
          name: "TBL_CaptainsAndAwards",
          url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1753413613&single=true&output=csv",
        },
        {
          name: "TBL_OppositionDetails",
          url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=1977394709&single=true&output=csv",
        },
        {
          name: "TBL_TestData",
          url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSTuGFCG-p_UAnaoatD7rVjSBLPEEXGYawgsAcDZCJgCSPyNvqEgSG-8wRX7bnqZm4YtI0TGiUjdL9a/pub?gid=14183891&single=true&output=csv",
        }
      ];

      this.updateJobStatus(jobId, 'Clearing existing data', 20);
      await this.clearGraphData();

      this.updateJobStatus(jobId, 'Applying schema', 30);
      await this.applySchema();

      this.updateJobStatus(jobId, 'Fetching CSV data', 40);
      const csvResults = await this.fetchAllCSVData(dataSources);

      this.updateJobStatus(jobId, 'Processing data sources', 60);
      let totalNodesCreated = 0;
      let totalRelationshipsCreated = 0;
      const errors = [];

      for (let i = 0; i < csvResults.length; i++) {
        const csvResult = csvResults[i];
        if (!csvResult.success) {
          errors.push(`Failed to fetch ${csvResult.name}: ${csvResult.error}`);
          continue;
        }

        try {
          const result = await this.processDataSource(csvResult.name, csvResult.data);
          totalNodesCreated += result.nodesCreated;
          totalRelationshipsCreated += result.relationshipsCreated;
          
          if (result.errors.length > 0) {
            errors.push(...result.errors);
          }
          
          // Update progress based on data source completion
          const progress = 60 + ((i + 1) / csvResults.length) * 30;
          this.updateJobStatus(jobId, `Processed ${csvResult.name}`, progress);
          
        } catch (error) {
          errors.push(`Failed to process ${csvResult.name}: ${error.message}`);
        }
      }

      this.updateJobStatus(jobId, 'Creating relationships', 90);
      const relationshipResult = await this.createAllRelationships();
      totalRelationshipsCreated += relationshipResult;

      this.updateJobStatus(jobId, 'Completed', 100);
      
      const duration = Date.now() - startTime;
      
      const result = {
        success: errors.length === 0,
        nodesCreated: totalNodesCreated,
        relationshipsCreated: totalRelationshipsCreated,
        errors: errors,
        duration: duration
      };

      this.jobStatus.set(jobId, {
        ...this.jobStatus.get(jobId),
        status: 'completed',
        progress: 100,
        currentStep: 'Completed',
        endTime: new Date().toISOString(),
        result: result
      });

      return result;

    } catch (error) {
      console.error('❌ Seeding failed:', error);
      
      this.jobStatus.set(jobId, {
        ...this.jobStatus.get(jobId),
        status: 'failed',
        progress: 0,
        currentStep: 'Failed',
        endTime: new Date().toISOString(),
        error: error.message
      });

      return {
        success: false,
        nodesCreated: 0,
        relationshipsCreated: 0,
        errors: [error.message],
        duration: Date.now() - startTime
      };
    } finally {
      await this.cleanup();
    }
  }

  updateJobStatus(jobId, currentStep, progress) {
    if (this.jobStatus.has(jobId)) {
      const status = this.jobStatus.get(jobId);
      status.currentStep = currentStep;
      status.progress = progress;
      status.lastUpdate = new Date().toISOString();
    }
  }

  getJobStatus(jobId) {
    return this.jobStatus.get(jobId) || { status: 'not_found' };
  }

  // ... existing methods from your current seeder ...
  async clearGraphData() {
    try {
      const clearQuery = 'MATCH (n {graphLabel: "dorkiniansWebsite"}) DETACH DELETE n';
      await this.session.run(clearQuery);
      console.log('✅ Existing graph data cleared');
    } catch (error) {
      console.error('❌ Failed to clear graph data:', error.message);
    }
  }

  async applySchema() {
    try {
      const constraints = [
        'CREATE CONSTRAINT player_id IF NOT EXISTS FOR (p:Player) REQUIRE p.id IS UNIQUE',
        'CREATE CONSTRAINT fixture_id IF NOT EXISTS FOR (f:Fixture) REQUIRE f.id IS UNIQUE',
        'CREATE CONSTRAINT matchdetail_id IF NOT EXISTS FOR (md:MatchDetail) REQUIRE md.id IS UNIQUE'
      ];
      
      for (const constraint of constraints) {
        try {
          await this.session.run(constraint);
        } catch (error) {
          console.log(`ℹ️ Constraint setup: ${error.message}`);
        }
      }
      
      console.log('✅ Database schema applied');
    } catch (error) {
      console.error('❌ Failed to apply schema:', error.message);
    }
  }

  async fetchAllCSVData(dataSources) {
    const results = [];
    
    for (const source of dataSources) {
      try {
        const data = await this.fetchCSVData(source.url);
        results.push({ name: source.name, data: data, success: true });
      } catch (error) {
        results.push({ name: source.name, data: [], success: false, error: error.message });
      }
    }
    
    return results;
  }

  async fetchCSVData(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      
      const fetchWithRedirect = (fetchUrl, isRedirect = false) => {
        const options = {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/csv,text/plain,*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache'
          }
        };
        
        protocol.get(fetchUrl, options, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
            const location = res.headers.location;
            if (location) {
              fetchWithRedirect(location, true);
              return;
            } else {
              reject(new Error(`Redirect response (${res.statusCode}) but no location header`));
              return;
            }
          }
          
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (data.includes('<html') || data.includes('<HTML') || data.includes('<!DOCTYPE')) {
              reject(new Error(`URL returned HTML instead of CSV. Check sheet permissions and URL validity.`));
              return;
            }
            
            if (!data.includes(',') || data.split('\n').length < 2) {
              reject(new Error(`Invalid CSV data received. Expected comma-separated values.`));
              return;
            }
            
            try {
              const result = Papa.parse(data, { header: true });
              
              if (result.data.length === 0 || Object.keys(result.data[0] || {}).length === 0) {
                reject(new Error(`CSV parsed but contains no valid data rows.`));
                return;
              }
              
              const filteredData = result.data.filter(row => {
                return Object.values(row).some(val => val && val.trim() !== '');
              });
              
              resolve(filteredData);
            } catch (error) {
              reject(new Error(`Failed to parse CSV: ${error.message}`));
            }
          });
        }).on('error', (error) => {
          reject(new Error(`Failed to fetch CSV: ${error.message}`));
        });
      };
      
      fetchWithRedirect(url);
    });
  }

  async processDataSource(sourceName, csvData) {
    let nodesCreated = 0;
    let relationshipsCreated = 0;
    const errors = [];
    
    try {
      switch (sourceName) {
        case 'TBL_Players':
          nodesCreated = await this.createPlayerNodes(csvData);
          break;
        case 'TBL_FixturesAndResults':
          nodesCreated = await this.createFixtureNodes(csvData);
          break;
        case 'TBL_MatchDetails':
          nodesCreated = await this.createMatchDetailNodes(csvData);
          break;
        case 'TBL_SiteDetails':
          nodesCreated = await this.createSiteDetailNodes(csvData);
          break;
        case 'TBL_WeeklyTOTW':
          nodesCreated = await this.createWeeklyTOTWNodes(csvData);
          break;
        case 'TBL_SeasonTOTW':
          nodesCreated = await this.createSeasonTOTWNodes(csvData);
          break;
        case 'TBL_PlayersOfTheMonth':
          nodesCreated = await this.createPlayerOfTheMonthNodes(csvData);
          break;
        case 'TBL_CaptainsAndAwards':
          nodesCreated = await this.createCaptainAndAwardNodes(csvData);
          break;
        case 'TBL_OppositionDetails':
          nodesCreated = await this.createOppositionDetailNodes(csvData);
          break;
        case 'TBL_TestData':
          nodesCreated = await this.createTestDataNodes(csvData);
          break;
        default:
          console.log(`⚠️ Unknown data source: ${sourceName}`);
      }
    } catch (error) {
      errors.push(`Failed to process ${sourceName}: ${error.message}`);
    }
    
    return { nodesCreated, relationshipsCreated, errors };
  }

  // Node creation methods (simplified for brevity)
  async createPlayerNodes(csvData) {
    let nodesCreated = 0;
    
    for (const row of csvData) {
      try {
        if (row['ALLOW ON SITE'] && row['ALLOW ON SITE'].toLowerCase() === 'false') {
          continue;
        }
        
        if (!row['PLAYER NAME'] || row['PLAYER NAME'].trim() === '') {
          continue;
        }
        
        const query = `
          MERGE (p:Player {id: $id})
          ON CREATE SET 
            p.name = $name,
            p.position = $position,
            p.graphLabel = 'dorkiniansWebsite'
          ON MATCH SET
            p.name = $name,
            p.position = $position,
            p.graphLabel = 'dorkiniansWebsite'
        `;
        
        const params = {
          id: `player_${row['PLAYER NAME'].replace(/\s+/g, '_')}`,
          name: row['PLAYER NAME'],
          position: row['MOST COMMON POSITION'] || 'Unknown'
        };
        
        await this.session.run(query, params);
        nodesCreated++;
      } catch (error) {
        console.error(`❌ Failed to create player node for ${row['PLAYER NAME']}: ${error.message}`);
      }
    }
    
    return nodesCreated;
  }

  // Additional node creation methods would follow the same pattern...
  async createFixtureNodes(csvData) { return 0; }
  async createMatchDetailNodes(csvData) { return 0; }
  async createSiteDetailNodes(csvData) { return 0; }
  async createWeeklyTOTWNodes(csvData) { return 0; }
  async createSeasonTOTWNodes(csvData) { return 0; }
  async createPlayerOfTheMonthNodes(csvData) { return 0; }
  async createCaptainAndAwardNodes(csvData) { return 0; }
  async createOppositionDetailNodes(csvData) { return 0; }
  async createTestDataNodes(csvData) { return 0; }

  async createAllRelationships() {
    return 0; // Simplified for brevity
  }
}

module.exports = { DataSeeder };
