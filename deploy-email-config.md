# Email Configuration Deployment Guide

## **Issue Identified** 🚨

Your local email configuration is working perfectly, but the Netlify function doesn't have access to the environment variables. The function logs show "Email service not configured, skipping email notification".

## **Solution: Set Environment Variables in Netlify** ✅

### **Step 1: Go to Netlify Dashboard**
1. Open [Netlify Dashboard](https://app.netlify.com/)
2. Select your Dorkinians website
3. Go to **Site settings** → **Environment variables**

### **Step 2: Add These Environment Variables**

Copy these **exactly** from your `.env` file:

| Variable Name | Value |
|---------------|-------|
| `SMTP_SERVER` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_EMAIL_SECURE` | `false` |
| `SMTP_USERNAME` | `bangsluke@gmail.com` |
| `SMTP_PASSWORD` | `[Your Gmail App Password]` |
| `SMTP_FROM_EMAIL` | `bangsluke@gmail.com` |
| `SMTP_TO_EMAIL` | `bangsluke@gmail.com` |

### **Step 3: Deploy Changes**
1. After adding the variables, go to **Deploys**
2. Click **Trigger deploy** → **Deploy site**
3. Wait for deployment to complete

### **Step 4: Test Email Function**
Once deployed, test the email function:

```bash
curl "https://YOUR_SITE.netlify.app/.netlify/functions/test-email"
```

**Expected Result:** JSON response with `"success": true`

### **Step 5: Test Full Seeding**
Test the main seeding function:

```bash
curl "https://YOUR_SITE.netlify.app/.netlify/functions/trigger-seed?environment=production"
```

**Expected Result:** You should receive email notifications for start, completion, and any errors.

## **Alternative: Use Netlify CLI** 🛠️

If you prefer command line:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Set environment variables
netlify env:set SMTP_SERVER "smtp.gmail.com"
netlify env:set SMTP_PORT "587"
netlify env:set SMTP_EMAIL_SECURE "false"
netlify env:set SMTP_USERNAME "bangsluke@gmail.com"
netlify env:set SMTP_PASSWORD "your-app-password"
netlify env:set SMTP_FROM_EMAIL "bangsluke@gmail.com"
netlify env:set SMTP_TO_EMAIL "bangsluke@gmail.com"

# Deploy
netlify deploy --prod
```

## **Verification Checklist** ✅

- [ ] Environment variables added to Netlify
- [ ] Site redeployed
- [ ] Test email function returns success
- [ ] Full seeding function sends email notifications
- [ ] Check Netlify function logs for email activity

## **Common Issues** ⚠️

1. **Variables not showing**: Wait for deployment to complete
2. **Still getting "not configured"**: Check variable names are exact (case-sensitive)
3. **Authentication errors**: Verify Gmail App Password is correct
4. **No emails received**: Check spam folder and Gmail settings
