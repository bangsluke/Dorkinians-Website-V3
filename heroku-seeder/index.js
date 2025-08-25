const express = require('express');
const cors = require('cors');
const { DataSeeder } = require('./services/dataSeeder');
const { EmailService } = require('./services/emailService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const dataSeeder = new DataSeeder();
const emailService = new EmailService();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Trigger seeding endpoint
app.post('/seed', async (req, res) => {
  const { environment = 'production', jobId } = req.body;
  
  try {
    // Send start notification
    await emailService.sendSeedingStartEmail(environment, jobId);
    
    // Start seeding in background
    dataSeeder.seedAllData(environment, jobId)
      .then(async (result) => {
        await emailService.sendSeedingSummaryEmail({
          success: result.success,
          environment,
          jobId,
          nodesCreated: result.nodesCreated,
          relationshipsCreated: result.relationshipsCreated,
          errorCount: result.errors.length,
          errors: result.errors,
          duration: result.duration
        });
      })
      .catch(async (error) => {
        await emailService.sendSeedingSummaryEmail({
          success: false,
          environment,
          jobId,
          nodesCreated: 0,
          relationshipsCreated: 0,
          errorCount: 1,
          errors: [error.message],
          duration: 0
        });
      });
    
    res.json({
      success: true,
      message: 'Seeding started in background',
      jobId,
      status: 'started'
    });
    
  } catch (error) {
    console.error('Failed to start seeding:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Status endpoint
app.get('/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const status = dataSeeder.getJobStatus(jobId);
  res.json(status);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Dorkinians Seeder running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await dataSeeder.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await dataSeeder.cleanup();
  process.exit(0);
});
