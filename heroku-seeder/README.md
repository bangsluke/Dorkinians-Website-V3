# Dorkinians FC Database Seeder - Heroku Service

## Overview
This service handles the long-running database seeding process for Dorkinians FC website, running on Heroku to bypass Netlify's 30-second HTTP timeout limitation.

## Architecture
- **Netlify Function**: Lightweight trigger endpoint that starts the seeding process
- **Heroku Service**: Long-running seeding service that processes data and sends email notifications
- **Hybrid Approach**: Best of both worlds - Netlify's reliability + Heroku's long-running capabilities

## Deployment Steps

### 1. Create Heroku App
```bash
# Install Heroku CLI if not already installed
# https://devcenter.heroku.com/articles/heroku-cli

# Login to Heroku
heroku login

# Create new app
heroku create dorkinians-seeder

# Set buildpack to Node.js
heroku buildpacks:set heroku/nodejs
```

### 2. Configure Environment Variables
```bash
# Neo4j Database Configuration
heroku config:set PROD_NEO4J_URI="neo4j+s://your-prod-instance.neo4j.io:7687"
heroku config:set PROD_NEO4J_USER="neo4j"
heroku config:set PROD_NEO4J_PASSWORD="your-prod-password"

heroku config:set DEV_NEO4J_URI="neo4j+s://your-dev-instance.neo4j.io:7687"
heroku config:set DEV_NEO4J_USER="neo4j"
heroku config:set DEV_NEO4J_PASSWORD="your-dev-password"

# Email Configuration
heroku config:set SMTP_SERVER="smtp.gmail.com"
heroku config:set SMTP_PORT="587"
heroku config:set SMTP_EMAIL_SECURE="false"
heroku config:set SMTP_USERNAME="your-email@gmail.com"
heroku config:set SMTP_PASSWORD="your-app-password"
heroku config:set SMTP_FROM_EMAIL="your-email@gmail.com"
heroku config:set SMTP_TO_EMAIL="admin@dorkinians.com"
```

### 3. Deploy to Heroku
```bash
# Deploy the service
git add .
git commit -m "Initial Heroku seeder deployment"
git push heroku main

# Ensure the service is running
heroku ps:scale web=1
```

### 4. Configure Netlify
Add the Heroku URL to your Netlify environment variables:
```bash
# In Netlify dashboard or via CLI
netlify env:set HEROKU_SEEDER_URL "https://your-heroku-app.herokuapp.com"
```

## Usage

### Manual Trigger
```bash
# Trigger seeding via Netlify function
curl -X POST "https://your-netlify-site.netlify.app/.netlify/functions/trigger-seed?environment=production"

# Or trigger directly on Heroku
curl -X POST "https://your-heroku-app.herokuapp.com/seed" \
  -H "Content-Type: application/json" \
  -d '{"environment": "production", "jobId": "manual_123"}'
```

### Check Status
```bash
# Check job status
curl "https://your-heroku-app.herokuapp.com/status/job_id_here"

# Health check
curl "https://your-heroku-app.herokuapp.com/health"
```

## Scheduling

### Daily Cron Job (5 AM)
Use an external cron service like cron-job.org:

**URL**: `https://your-netlify-site.netlify.app/.netlify/functions/trigger-seed?environment=production`
**Schedule**: `0 5 * * *` (Daily at 5 AM)
**Method**: POST

### Alternative: Heroku Scheduler
```bash
# Install Heroku Scheduler addon
heroku addons:create scheduler:standard

# Add job via Heroku dashboard:
# Command: curl -X POST "https://your-heroku-app.herokuapp.com/seed" -H "Content-Type: application/json" -d '{"environment": "production"}'
# Frequency: Daily at 5:00 AM
```

## Monitoring

### Heroku Logs
```bash
# View real-time logs
heroku logs --tail

# View recent logs
heroku logs --num 100
```

### Email Notifications
The service automatically sends:
- **Start Notification**: When seeding begins
- **Completion Notification**: When seeding finishes (success/failure)

### Health Checks
```bash
# Check service health
curl "https://your-heroku-app.herokuapp.com/health"
```

## Troubleshooting

### Common Issues

1. **Service Not Starting**
   ```bash
   heroku logs --tail
   heroku ps:scale web=1
   ```

2. **Environment Variables Missing**
   ```bash
   heroku config
   ```

3. **Database Connection Issues**
   - Verify Neo4j credentials
   - Check network connectivity
   - Ensure Neo4j instance is running

4. **Email Not Sending**
   - Verify SMTP credentials
   - Check Gmail app password setup
   - Review Heroku logs for email errors

### Performance Optimization

1. **Dyno Size**: Start with `basic` dyno ($7/month)
2. **Scaling**: Scale down during off-hours to save costs
3. **Monitoring**: Use Heroku metrics to track performance

## Cost Management

- **Basic Dyno**: $7/month (recommended for daily use)
- **Eco Dyno**: $5/month (sleeps after 30 minutes of inactivity)
- **Standard Dyno**: $25/month (always on, better performance)

## Security Notes

- All environment variables are encrypted in Heroku
- Service runs in isolated container
- No persistent storage (stateless design)
- HTTPS enforced for all communications

## Support

For issues or questions:
1. Check Heroku logs first
2. Verify environment variables
3. Test individual components
4. Review this documentation
