# Email Configuration for CSV Header Validation

## Overview

The CSV header validation system can send email notifications when CSV headers change, preventing data corruption during database seeding.

## Required Environment Variables

Add these to your `.env` file:

```bash
# Email Configuration for CSV Header Validation Notifications
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL_SECURE=false
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_TO_EMAIL=your-email@gmail.com
```

## Email Provider Examples

### Gmail
```bash
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL_SECURE=false
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Use App Password, not regular password
```

### Outlook/Hotmail
```bash
SMTP_SERVER=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_EMAIL_SECURE=false
SMTP_USERNAME=your-email@outlook.com
SMTP_PASSWORD=your-password
```

### Custom SMTP Server
```bash
SMTP_SERVER=mail.yourdomain.com
SMTP_PORT=587
SMTP_EMAIL_SECURE=false
SMTP_USERNAME=notifications@yourdomain.com
SMTP_PASSWORD=your-password
```

## Gmail App Password Setup

1. Enable 2-Factor Authentication on your Google account
2. Go to Google Account settings → Security → App passwords
3. Generate an app password for "Mail"
4. Use this app password in `SMTP_PASSWORD` (not your regular Gmail password)

## Testing Email Configuration

Run the header validation test to verify email configuration:

```bash
npm run test-headers
```

## What Happens When Headers Change

1. **Validation Fails**: Seeding process stops immediately
2. **Email Sent**: Detailed notification with:
   - Which data sources failed
   - Expected vs. actual headers
   - Missing and extra headers
   - Direct links to CSV files
3. **Logging**: All failures logged to `logs/seeding-errors.log`
4. **Seeding Halted**: Database remains unchanged until headers are fixed

## Troubleshooting

### Email Not Sending
- Check all environment variables are set
- Verify SMTP credentials
- Check firewall/network restrictions
- Test with `npm run test-headers`

### Headers Not Matching
- Review CSV files in Google Sheets
- Update `lib/config/csvHeaders.ts` with new headers
- Test again with `npm run test-headers`

### False Positives
- Ensure CSV files are accessible
- Check for extra spaces or special characters in headers
- Verify CSV encoding (should be UTF-8)
