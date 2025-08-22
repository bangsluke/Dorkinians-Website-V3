# 🚀 Automated Database Seeding with Netlify Functions

This document provides comprehensive instructions for setting up and using the automated database seeding system for the Dorkinians FC Website using Netlify Functions.

## 📋 Overview

The seeding system uses Netlify Functions to trigger database seeding on-demand or via external cron services. This approach is perfect for serverless environments like Netlify where you don't have persistent servers.

## 🎯 Features

- **On-Demand Execution**: Trigger seeding anytime via web interface or API
- **Netlify Functions**: Runs on Netlify's infrastructure (no server required)
- **Email Notifications**: Success/failure reports with detailed statistics
- **Error Log Access**: Hyperlinks to seeding error logs
- **Environment Support**: Development and production environments
- **Real-Time Monitoring**: Live status updates and results display

## 🛠️ Prerequisites

1. **Netlify Account** with your website deployed
2. **Email Configuration** properly set up in your `.env` file
3. **Database Access** configured for the target environment
4. **Netlify CLI** (optional, for local testing)

## 📦 Installation

The required dependencies are already installed:
```bash
npm install node-cron @types/node-cron
```

## ⚙️ Configuration

### Environment Variables

Ensure your `.env` file contains the necessary email configuration:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_TO=admin@dorkinians.com

# Neo4j Configuration
PROD_NEO4J_URI=neo4j+s://your-database.neo4j.io
PROD_NEO4J_USER=neo4j
PROD_NEO4J_PASSWORD=your-password
```

### Netlify Configuration

The `netlify.toml` file is already configured with:
- Functions directory: `netlify/functions`
- Next.js plugin for proper API handling

## 🚀 Usage

### Manual Triggering via Web Interface

1. **Access Admin Panel**: Navigate to `/admin` on your website
2. **Select Environment**: Choose production or development
3. **Click Trigger**: Start the seeding process immediately
4. **Monitor Results**: View real-time status and results

### API Endpoint

Trigger seeding programmatically:

```bash
# Production seeding
curl -X POST "https://your-domain.netlify.app/.netlify/functions/trigger-seed?environment=production"

# Development seeding
curl -X POST "https://your-domain.netlify.app/.netlify/functions/trigger-seed?environment=development"

# Force execution (bypass any locks)
curl -X POST "https://your-domain.netlify.app/.netlify/functions/trigger-seed?environment=production&force=true"
```

### Response Format

```json
{
  "success": true,
  "message": "Database seeding triggered successfully",
  "environment": "production",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "result": {
    "success": true,
    "exitCode": 0,
    "nodesCreated": 150,
    "relationshipsCreated": 300,
    "errorCount": 2,
    "errors": [],
    "duration": 45000
  }
}
```

## ⏰ Automated Scheduling

Since Netlify doesn't support persistent cron jobs, use external cron services:

### Option 1: Cron-job.org (Free)

1. **Visit**: [cron-job.org](https://cron-job.org)
2. **Create Account**: Sign up for free
3. **Add New Cronjob**:
   - **Title**: Dorkinians Database Seeding
   - **URL**: `https://your-domain.netlify.app/.netlify/functions/trigger-seed?environment=production`
   - **Schedule**: Every 6 hours (`0 */6 * * *`)
   - **Method**: POST
4. **Save**: The service will ping your endpoint every 6 hours

### Option 2: EasyCron (Free Tier)

1. **Visit**: [easycron.com](https://easycron.com)
2. **Sign Up**: Free tier includes 5 cron jobs
3. **Create Cron Job**:
   - **URL**: Your Netlify function endpoint
   - **Schedule**: Every 6 hours
   - **HTTP Method**: POST

### Option 3: GitHub Actions (Free)

Create `.github/workflows/seed-database.yml`:

```yaml
name: Database Seeding
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:  # Manual trigger

jobs:
  seed:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Database Seeding
        run: |
          curl -X POST "https://your-domain.netlify.app/.netlify/functions/trigger-seed?environment=production"
```

## 📧 Email Notifications

### Email Content

The system sends detailed email reports including:

- **Execution Status**: Success/Failure with visual indicators
- **Performance Metrics**: Duration, nodes created, relationships created
- **Error Summary**: Count and details of errors encountered
- **Log File Access**: Direct link to seeding error logs
- **Environment Information**: Production/Development context

### Email Templates

- **HTML Version**: Rich, styled emails with color-coded status
- **Text Version**: Plain text fallback for email clients that don't support HTML

## 📊 Monitoring and Logging

### Netlify Function Logs

1. **Netlify Dashboard**: Go to your site → Functions → trigger-seed
2. **Function Logs**: View execution logs and errors
3. **Real-time Monitoring**: See function invocations and performance

### Admin Panel Monitoring

- **Live Status**: Real-time execution status
- **Result Display**: Immediate feedback on seeding results
- **Error Reporting**: Detailed error information
- **Statistics**: Nodes and relationships created

## 🔧 Local Development

### Testing Netlify Functions Locally

1. **Install Netlify CLI**:
```bash
npm install -g netlify-cli
```

2. **Start Local Development**:
```bash
netlify dev
```

3. **Test Function**:
```bash
curl -X POST "http://localhost:8888/.netlify/functions/trigger-seed?environment=development"
```

### Environment Variables

For local testing, create `.env.local`:
```env
NODE_ENV=development
DEV_NEO4J_URI=bolt://localhost:7687
DEV_NEO4J_USER=neo4j
DEV_NEO4J_PASSWORD=password
```

## 🚨 Troubleshooting

### Common Issues

#### Function Not Found (404)
1. Verify `netlify.toml` has functions directory configured
2. Check function file is in `netlify/functions/`
3. Ensure function is properly exported

#### Database Connection Issues
1. Verify environment variables are set in Netlify
2. Check database credentials and network access
3. Test database connection manually

#### Function Timeout
1. Netlify Functions have a 10-second timeout limit
2. For long-running seeding, consider breaking into smaller chunks
3. Monitor function execution time

### Debug Mode

Enable verbose logging in Netlify:
1. Go to Site Settings → Environment Variables
2. Add `DEBUG=*` for verbose logging
3. Check function logs in Netlify dashboard

## 🔒 Security Considerations

### Access Control

- **Admin Panel**: Consider adding authentication to `/admin` route
- **API Endpoint**: Implement rate limiting if needed
- **Environment Variables**: Never commit sensitive data to Git

### Function Security

- **Input Validation**: All inputs are validated
- **Error Handling**: Errors don't expose sensitive information
- **CORS**: Configured for web interface access

## 📈 Performance Optimization

### Function Optimization

- **Cold Starts**: Functions may have 100-500ms cold start
- **Memory**: Functions have 1024MB memory limit
- **Timeout**: 10-second execution limit

### Seeding Optimization

- **Batch Processing**: Process data in smaller chunks
- **Connection Pooling**: Reuse database connections
- **Error Handling**: Continue processing on non-critical errors

## 🔄 Maintenance

### Regular Tasks

1. **Monitor Function Logs**: Check for errors and performance issues
2. **Update Dependencies**: Keep Node.js and npm packages current
3. **Review Cron Jobs**: Ensure external services are still running
4. **Backup Configuration**: Save working configurations

### Updates and Upgrades

1. **Test Changes**: Always test in development first
2. **Gradual Rollout**: Update one environment at a time
3. **Rollback Plan**: Keep previous working versions
4. **Documentation**: Update this guide with any changes

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Netlify function logs
3. Verify configuration and environment setup
4. Test with minimal configuration first

## 📝 Changelog

- **v2.0.0**: Migrated to Netlify Functions architecture
- **v1.0.0**: Initial local scheduler implementation
- Added cron-based scheduling
- Email notifications with detailed reports
- Configurable intervals and environments
- Process management and error handling
