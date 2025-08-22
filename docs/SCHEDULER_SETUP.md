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

All required dependencies are already installed. The system uses:
- **Netlify Functions**: For serverless execution
- **Next.js API Routes**: For web interface integration
- **Neo4j Driver**: For database operations
- **Nodemailer**: For email notifications

## ⚙️ Configuration

### Environment Variables

Ensure your `.env` file contains the necessary configuration:

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

# Development Neo4j (optional)
DEV_NEO4J_URI=bolt://localhost:7687
DEV_NEO4J_USER=neo4j
DEV_NEO4J_PASSWORD=password
```

### Netlify Configuration

The `netlify.toml` file is already configured with:
- Functions directory: `netlify/functions`
- Next.js plugin for proper API handling
- Proper redirects for API routes

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
  "message": "Database seeding completed successfully",
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

### Option 1: Cron-job.org (Free) - RECOMMENDED

1. **Visit**: [cron-job.org](https://cron-job.org)
2. **Create Account**: Sign up for free
3. **Add New Cronjob**:
   - **Title**: Dorkinians Database Seeding
   - **URL**: `https://your-domain.netlify.app/.netlify/functions/trigger-seed?environment=production`
   - **Schedule**: Every 6 hours (`0 */6 * * *`)
   - **Method**: POST
   - **Timeout**: 300 seconds (5 minutes)
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

## 🚨 TROUBLESHOOTING: 500 Server Error

If you're getting a 500 server error when testing your cron job, follow these detailed troubleshooting steps:

### Step 1: Check Netlify Function Logs

1. **Go to Netlify Dashboard**: [app.netlify.com](https://app.netlify.com)
2. **Select Your Site**: Click on your website
3. **Navigate to Functions**: Click "Functions" in the left sidebar
4. **Find trigger-seed**: Look for the `trigger-seed` function
5. **Check Function Logs**: Click on the function and view the logs

**Look for these specific error messages:**
- `Module not found` errors
- `Import/require` failures
- Database connection errors
- Environment variable issues

### Step 1.5: Build Lib Directory (CRITICAL)

**This step is required before deploying to Netlify:**

1. **Run the build script**:
   ```bash
   npm run build:lib
   ```
   This copies the `lib` directory to `netlify/functions/lib` where the function can access it.

2. **Verify the build**:
   ```bash
   npm run test-function
   ```
   This should show all services as available.

### Step 2: Verify Environment Variables in Netlify

1. **In Netlify Dashboard**: Go to Site Settings → Environment Variables
2. **Check Required Variables**:
   ```
   PROD_NEO4J_URI=neo4j+s://your-database.neo4j.io
   PROD_NEO4J_USER=neo4j
   PROD_NEO4J_PASSWORD=your-password
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   EMAIL_FROM=your-email@gmail.com
   EMAIL_TO=admin@dorkinians.com
   ```
3. **Verify Values**: Make sure all values are correct and not truncated

### Step 3: Test Function Locally

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Create `.env.local`** for local testing:
   ```env
   NODE_ENV=production
   PROD_NEO4J_URI=neo4j+s://your-database.neo4j.io
   PROD_NEO4J_USER=neo4j
   PROD_NEO4J_PASSWORD=your-password
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   EMAIL_FROM=your-email@gmail.com
   EMAIL_TO=admin@dorkinians.com
   ```

3. **Start Local Development**:
   ```bash
   netlify dev
   ```

4. **Test Function**:
   ```bash
   curl -X POST "http://localhost:8888/.netlify/functions/trigger-seed?environment=production"
   ```

5. **Check Local Logs**: Look for any import or connection errors

### Step 4: Common Error Solutions

#### Error: "Module not found" or "Cannot resolve module"

**Solution**: This usually means the function can't find the required services.

1. **Check File Paths**: Ensure all imports use correct relative paths
2. **Verify Build**: Run `npm run build` to ensure no compilation errors
3. **Check Netlify Deploy**: Make sure the latest code is deployed

#### Error: "Database connection failed"

**Solution**: Neo4j connection issues.

1. **Verify Database Credentials**: Check URI, username, and password
2. **Test Database Connection**: Try connecting manually to verify credentials
3. **Check Network Access**: Ensure Netlify can reach your Neo4j instance
4. **Verify SSL**: Make sure SSL certificates are valid

#### Error: "Email service not configured"

**Solution**: Email configuration issues.

1. **Check SMTP Settings**: Verify host, port, username, and password
2. **Test Email Service**: Try sending a test email manually
3. **Check App Passwords**: If using Gmail, ensure you're using an app password

#### Error: "Function timeout"

**Solution**: Function execution takes too long.

1. **Check Seeding Duration**: Monitor how long seeding takes locally
2. **Optimize Database Queries**: Look for slow queries in the seeding process
3. **Consider Chunking**: Break large seeding operations into smaller parts

### Step 5: Debug Function Execution

1. **Add More Logging**: The function already includes extensive logging
2. **Check Function Size**: Ensure the function bundle isn't too large
3. **Verify Dependencies**: Make sure all required packages are available

### Step 6: Test with Minimal Configuration

1. **Comment Out Complex Logic**: Temporarily disable email notifications
2. **Test Basic Connection**: Just try to connect to the database
3. **Gradually Enable Features**: Add back functionality one by one

### Step 7: Verify Cron Job Configuration

1. **Check URL**: Ensure the cron job is calling the correct endpoint
2. **Verify HTTP Method**: Must be POST, not GET
3. **Check Timeout**: Set appropriate timeout (at least 5 minutes)
4. **Test Manually**: Try the URL in a browser or with curl first

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
- **Timeout**: 10-second execution limit (may need to increase)

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

## 🚀 Deployment Checklist

**Before deploying to Netlify, ensure you've completed these steps:**

1. **✅ Build the project**:
   ```bash
   npm run build
   ```

2. **✅ Build the lib directory**:
   ```bash
   npm run build:lib
   ```

3. **✅ Test the function locally**:
   ```bash
   npm run test-function
   ```

4. **✅ Verify environment variables** are set in your `.env` file

5. **✅ Deploy to Netlify** (this will happen automatically on git push)

6. **✅ Set environment variables in Netlify Dashboard**:
   - Go to Site Settings → Environment Variables
   - Add all required variables from your `.env` file

7. **✅ Test the deployed function**:
   ```bash
   curl -X POST "https://your-domain.netlify.app/.netlify/functions/trigger-seed?environment=production"
   ```

8. **✅ Set up external cron job** (cron-job.org recommended)

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Netlify function logs
3. Verify configuration and environment setup
4. Test with minimal configuration first
5. Ensure you've run `npm run build:lib` before deploying

## 📝 Changelog

- **v3.0.0**: Complete rewrite for Netlify Functions with direct service integration
- **v2.0.0**: Migrated to Netlify Functions architecture
- **v1.0.0**: Initial local scheduler implementation
- Added cron-based scheduling
- Email notifications with detailed reports
- Configurable intervals and environments
- Process management and error handling
