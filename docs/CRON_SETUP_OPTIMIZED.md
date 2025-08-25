# Automated Database Updates - Optimized Setup

## 🎯 Overview

Your existing `trigger-seed.js` Netlify function already provides a complete, production-ready database seeding system. This guide shows how to set up automated daily updates using external cron services.

## 🏗️ Existing Infrastructure

**Netlify Function**: `netlify/functions/trigger-seed.js`
- ✅ Processes 10 Google Sheets data sources
- ✅ Applies Neo4j schema automatically
- ✅ Handles CSV parsing and validation
- ✅ Creates nodes and relationships
- ✅ Sends email notifications
- ✅ Comprehensive error handling
- ✅ 30-minute timeout protection with email notification
- ✅ Automatic timeout cleanup

**Data Sources** (Configured in `lib/config/dataSources.ts`):
- TBL_SiteDetails
- TBL_Players  
- TBL_FixturesAndResults
- TBL_MatchDetails
- TBL_WeeklyTOTW
- TBL_SeasonTOTW
- TBL_PlayersOfTheMonth
- TBL_CaptainsAndAwards
- TBL_OppositionDetails
- TBL_TestData

**Configuration Management:**
- Data sources are centrally managed in `lib/config/dataSources.ts`
- Easy to add/remove/modify data sources without touching the function code
- Supports different data source types (StatsData, FASiteData)

## 🚀 Setup Steps

### 1. Deploy to Netlify
```bash
npm run build
git add .
git commit -m "Optimize existing seeding system"
git push
```

### 2. Environment Variables
Set these in your Netlify dashboard:

```bash
# Neo4j Production Database
PROD_NEO4J_URI=neo4j+s://your-database.databases.neo4j.io
PROD_NEO4J_USER=neo4j
PROD_NEO4J_PASSWORD=your-password

# SMTP Configuration
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL_SECURE=false
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_TO_EMAIL=your-email@gmail.com
```

### 3. External Cron Service

**Using cron-job.org (Free):**
1. Sign up at [cron-job.org](https://cron-job.org)
2. Create new cronjob:
   - **Title**: `Dorkinians Daily Database Update`
   - **URL**: `https://your-site.netlify.app/.netlify/functions/trigger-seed?environment=production`
   - **Schedule**: Daily at 5:00 AM (`0 5 * * *`)
   - **Timeout**: 1800 seconds (30 minutes)
   - **Retry**: 3 attempts on failure

**Alternative Services:**
- EasyCron: [easycron.com](https://easycron.com)
- Cronitor: [cronitor.io](https://cronitor.io)
- UptimeRobot: [uptimerobot.com](https://uptimerobot.com)

## 🧪 Testing

### Manual Test
```bash
# Test the function directly
curl "https://your-site.netlify.app/.netlify/functions/trigger-seed?environment=production"
```

### Expected Response
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
    "relationshipsCreated": 3000,
    "errorCount": 0,
    "errors": [],
    "duration": 1800000
  }
}
```

## 📧 Email Notifications

The system automatically sends detailed emails:
- **Success**: Green header with performance metrics
- **Failure**: Red header with error details
- **Content**: Nodes created, relationships, duration, errors

## 🔍 Monitoring

### Netlify Dashboard
1. Go to Functions → trigger-seed
2. Check execution logs
3. Monitor response times
4. Review error patterns

### Performance Metrics
- **Current**: ~30 minutes (as reported)
- **Target**: Optimize to <15 minutes
- **Monitoring**: Track duration trends

## 🚨 Troubleshooting

### Timeout Protection
The system includes automatic timeout protection:
- **30-minute limit**: Function automatically stops after 30 minutes
- **Timeout notification**: Email sent if timeout is reached
- **Cleanup**: All resources properly cleaned up on timeout
- **No data loss**: Partial progress is preserved until timeout

### Common Issues

1. **Function Timeout (30+ minutes)**
   - Check Neo4j connection performance
   - Verify CSV data accessibility
   - Monitor network latency

2. **Email Notifications Failing**
   - Verify SMTP credentials
   - Check email server settings
   - Test manual execution

3. **Database Connection Issues**
   - Confirm Neo4j credentials
   - Check network connectivity
   - Verify database status

### Debugging Steps

1. **Check Function Logs**
   - Netlify dashboard → Functions → trigger-seed
   - Review execution logs for errors
   - Monitor performance metrics

2. **Test Data Sources**
   - Verify Google Sheets URLs are accessible
   - Check CSV format consistency
   - Monitor data volume changes

3. **Database Performance**
   - Check Neo4j query performance
   - Monitor connection pool usage
   - Verify schema application

## 🎯 Performance Optimization

### Current Bottlenecks (30-minute runtime)
1. **CSV Fetching**: 10 data sources sequentially
2. **Database Operations**: Individual node creation
3. **Schema Application**: Full database rebuild

### Optimization Strategies
1. **Parallel Processing**: Fetch CSV data concurrently
2. **Batch Operations**: Use Neo4j bulk operations
3. **Incremental Updates**: Only process changed data
4. **Connection Pooling**: Optimize Neo4j connections

## 📊 Success Indicators

✅ **Function responds with 200 status**  
✅ **Email notifications received**  
✅ **Database populated with fresh data**  
✅ **Execution time <30 minutes**  
✅ **No critical errors in logs**  

## 🔒 Security

- **Function Access**: Publicly accessible (intended for cron)
- **Environment Variables**: Secure in Netlify dashboard
- **Data Validation**: CSV data validated before processing
- **Database Access**: Read-write access required for seeding

## 🛠️ Maintenance

### Daily Tasks
- Check email notifications
- Monitor execution duration
- Review error logs

### Weekly Tasks
- Check function performance
- Verify cron service status
- Monitor database health

### Monthly Tasks
- Review performance trends
- Update dependencies
- Optimize data processing

---

**Your automated database update system is ready!** 🚀

The existing `trigger-seed.js` function provides everything needed for production database updates. Focus on performance optimization rather than rebuilding the system.
