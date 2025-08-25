# Database Seeding Scheduler Setup

This document provides complete instructions for setting up automated database seeding for the Dorkinians Website V3.

## Overview

The system uses a **Netlify Function + External Cron Service** approach:
- **Netlify Function**: `trigger-seed.js` handles database seeding remotely
- **External Cron Service**: Schedules the function to run every 6 hours
- **Email Notifications**: Sends detailed reports on success/failure

## Architecture

```
External Cron Service (cron-job.org)
    ↓ (HTTP POST every 6 hours)
Netlify Function (/api/trigger-seed)
    ↓ (executes seeding)
Neo4j Aura Database
    ↓ (sends email report)
SMTP Server → Your Email
```

## Prerequisites

1. **Netlify Account**: Your website must be deployed on Netlify
2. **Neo4j Aura Database**: Production database with credentials
3. **SMTP Server**: For sending email notifications
4. **External Cron Service**: Free service like cron-job.org

## Step 1: Environment Variables

Ensure these environment variables are set in your Netlify dashboard:

### Neo4j Configuration
```bash
PROD_NEO4J_URI=neo4j+s://your-database.databases.neo4j.io
PROD_NEO4J_USER=neo4j
PROD_NEO4J_PASSWORD=your-password
```

### SMTP Configuration
```bash
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL_SECURE=false
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_TO_EMAIL=your-email@gmail.com
```

## Step 2: Deploy to Netlify

1. **Build and Deploy**:
   ```bash
   npm run build
   git add .
   git commit -m "Update seeding system"
   git push
   ```

2. **Verify Deployment**: Check Netlify dashboard for successful build

## Step 3: Test the Netlify Function

1. **Test URL**: `https://your-site.netlify.app/.netlify/functions/trigger-seed`
2. **Test with Parameters**: `?environment=production`
3. **Expected Response**: JSON with seeding results

## Step 4: Set Up External Cron Service

### Using cron-job.org (Recommended)

1. **Sign Up**: Create free account at [cron-job.org](https://cron-job.org)
2. **Create New Cronjob**:
   - **Title**: `Dorkinians Database Seeding`
   - **URL**: `https://your-site.netlify.app/.netlify/functions/trigger-seed?environment=production`
   - **Schedule**: Every 6 hours (0 */6 * * *)
   - **HTTP Method**: GET
   - **Timeout**: 300 seconds (5 minutes)
   - **Retry on Failure**: Yes (3 retries)

3. **Advanced Settings**:
   - **HTTP Headers**: None required
   - **Expected Status**: 200
   - **Notifications**: Email on failure (optional)

### Alternative Cron Services

- **EasyCron**: [easycron.com](https://easycron.com)
- **Cronitor**: [cronitor.io](https://cronitor.io)
- **UptimeRobot**: [uptimerobot.com](https://uptimerobot.com)

## Step 5: Verify Setup

1. **Manual Test**: Visit the function URL in browser
2. **Check Logs**: Monitor Netlify function logs
3. **Email Verification**: Confirm email notifications are working
4. **Database Check**: Verify data is being seeded

## Monitoring and Troubleshooting

### Check Function Logs

1. **Netlify Dashboard** → Functions → trigger-seed
2. **View Logs**: Check for errors or successful execution
3. **Response Times**: Should complete within 2-3 minutes

### Common Issues

#### 1. Function Timeout (500 Error)
- **Cause**: Seeding takes longer than function timeout
- **Solution**: Increase timeout in cron service settings

#### 2. Email Notifications Not Working
- **Check**: SMTP environment variables
- **Verify**: SMTP credentials and server settings
- **Test**: Manual function execution

#### 3. Database Connection Failed
- **Verify**: Neo4j credentials in environment variables
- **Check**: Network access from Netlify to Neo4j
- **Confirm**: Database is running and accessible

#### 4. CSV Data Fetching Issues
- **Check**: Google Sheets URLs are accessible
- **Verify**: CSV format is correct
- **Monitor**: Network connectivity from Netlify

### Performance Monitoring

- **Seeding Duration**: Typically 1-3 minutes
- **Data Volume**: Monitor nodes/relationships created
- **Error Rate**: Track failed seeding attempts
- **Email Delivery**: Ensure notifications are received

## Manual Triggering

### Via Browser
```
https://your-site.netlify.app/.netlify/functions/trigger-seed?environment=production
```

### Via cURL
```bash
curl "https://your-site.netlify.app/.netlify/functions/trigger-seed?environment=production"
```

### Via Postman
- **Method**: GET
- **URL**: Function endpoint with query parameters
- **Headers**: None required

## Email Notification Format

### Success Email
- ✅ Green header with success status
- Summary grid showing nodes, relationships, errors, duration
- Timestamp and environment information

### Failure Email
- ❌ Red header with failure status
- Error details and stack trace
- Duration and partial results if available

## Security Considerations

1. **Environment Variables**: Never commit credentials to Git
2. **Function Access**: Function is publicly accessible (intended for cron)
3. **Rate Limiting**: Consider implementing if needed
4. **Data Validation**: CSV data is validated before processing

## Maintenance

### Regular Tasks
1. **Monitor Function Logs**: Check for errors weekly
2. **Verify Email Delivery**: Ensure notifications are received
3. **Database Health**: Monitor Neo4j performance
4. **Update Dependencies**: Keep packages current

### Updates
1. **Code Changes**: Deploy via Git push
2. **Environment Variables**: Update in Netlify dashboard
3. **Cron Schedule**: Modify in external service if needed

## Support

If you encounter issues:

1. **Check Function Logs**: First source of debugging information
2. **Verify Environment Variables**: Ensure all required variables are set
3. **Test Manually**: Execute function directly to isolate issues
4. **Check Dependencies**: Verify all required packages are available

## Summary

This setup provides:
- ✅ **Automated Seeding**: Every 6 hours via external cron
- ✅ **Email Notifications**: Detailed success/failure reports
- ✅ **Manual Triggering**: On-demand seeding when needed
- ✅ **Error Handling**: Comprehensive logging and reporting
- ✅ **Scalability**: Serverless architecture handles load automatically

The system is now fully automated and will maintain your database with fresh data from Google Sheets every 6 hours, with detailed email reports on each execution.
