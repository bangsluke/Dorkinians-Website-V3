# Umami Analytics Setup Guide

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Overview](#overview)
- [Quick Start: Umami Cloud (Recommended)](#quick-start-umami-cloud-recommended)
  - [Step 1: Sign Up](#step-1-sign-up)
  - [Step 2: Add Your Website](#step-2-add-your-website)
  - [Step 3: Get Your Tracking Script](#step-3-get-your-tracking-script)
  - [Step 4: Configure Environment Variables](#step-4-configure-environment-variables)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Obtaining Website ID and Script URL](#obtaining-website-id-and-script-url)
- [Integration with Next.js](#integration-with-nextjs)
- [Troubleshooting](#troubleshooting)
- [Advanced: Self-Hosted Umami (Optional)](#advanced-self-hosted-umami-optional)
  - [Self-Hosted with Docker](#self-hosted-with-docker)
  - [Vercel Deployment](#vercel-deployment)
  - [Railway Deployment](#railway-deployment)
  - [DigitalOcean App Platform](#digitalocean-app-platform)
  - [Database Setup](#database-setup)

> [Back to Table of Contents](#table-of-contents)

## Overview

Umami is a privacy-focused, open-source web analytics platform that provides website analytics without collecting personal data or using cookies. This guide covers setting up Umami for the Dorkinians website with automatic version tracking.

**Key Features:**
- Privacy-focused (no cookies, GDPR compliant)
- Lightweight tracking script
- Managed cloud service (no hosting required)
- Custom event tracking for version numbers

> [Back to Table of Contents](#table-of-contents)

## Quick Start: Umami Cloud (Recommended)

Umami Cloud is a managed service that handles all hosting, database setup, and maintenance for you. This is the easiest way to get started with Umami analytics.

**Benefits:**
- No hosting or database setup required
- Free tier available
- Automatic updates and maintenance
- Access your analytics at [https://cloud.umami.is](https://cloud.umami.is)

### Step 1: Sign Up

1. Go to [https://cloud.umami.is](https://cloud.umami.is)
2. Click "Sign Up" or "Get Started"
3. Create your account with email and password
4. Verify your email if required

### Step 2: Add Your Website

1. After logging in, you'll see the Umami dashboard
2. Click "Add Website" or navigate to Settings → Websites
3. Enter your website details:
   - **Name:** "Dorkinians Website" (or any name you prefer)
   - **Domain:** `dorkinians-website-v3.netlify.app` (or your production domain)
4. Click "Save" or "Add Website"

### Step 3: Get Your Tracking Script

After adding your website, Umami will display a tracking script. It will look like:

```html
<script async defer 
        data-website-id="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" 
        src="https://cloud.umami.is/script.js"></script>
```

**Important Information:**
- **Website ID:** The UUID in `data-website-id` (e.g., `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- **Script URL:** `https://cloud.umami.is/script.js` (or your region-specific URL)

> [Back to Table of Contents](#table-of-contents)

### Step 4: Configure Environment Variables

Add the following to your `.env.local` file for local development:

```bash
# Umami Analytics Configuration
NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=your-website-id-here

# App Version (auto-populated from package.json at build time)
NEXT_PUBLIC_APP_VERSION=1.1.13
```

**For Production (Netlify):**
1. Go to your Netlify site dashboard
2. Navigate to Site settings → Environment variables
3. Add the same variables:
   - `NEXT_PUBLIC_UMAMI_SCRIPT_URL`
   - `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
   - `NEXT_PUBLIC_APP_VERSION` (will be auto-populated from package.json)

**Note:** The `NEXT_PUBLIC_APP_VERSION` is automatically set from your `package.json` during build, so you don't need to manually update it.

**Version Tracking:**
- The app version from `package.json` is automatically tracked as a custom event in Umami
- Each time a user visits your site, the version number is tracked once per session
- You can view version tracking data in your Umami Cloud dashboard under "Events"
- This allows you to see which version of your app users are accessing
- The event name is "App Version" with the version number as a property

> [Back to Table of Contents](#table-of-contents)

## Configuration

### Environment Variables

**Required Environment Variables for Next.js:**

Add to your `.env.local` file (development) and Netlify environment variables (production):

```bash
# Umami Analytics Configuration
NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=your-website-id-here

# App Version (auto-populated from package.json at build time)
NEXT_PUBLIC_APP_VERSION=1.1.13
```

**Note:** If you're using a region-specific Umami Cloud instance (e.g., EU region), your script URL will be different:
- EU: `https://cloud.umami.is/analytics/eu/script.js`
- US: `https://cloud.umami.is/analytics/us/script.js`

Check your Umami Cloud dashboard for the correct script URL.

> [Back to Table of Contents](#table-of-contents)

### Obtaining Website ID and Script URL

1. **Login to Umami Cloud:**
   - Go to [https://cloud.umami.is](https://cloud.umami.is) (or your region-specific URL)
   - Login with your credentials

2. **Navigate to Websites:**
   - Click on "Websites" in the sidebar
   - Or go to Settings → Websites

3. **View Your Website:**
   - Click on your website name
   - You'll see the tracking script displayed

4. **Copy the Values:**
   - **Website ID:** Copy the UUID from `data-website-id="..."` 
   - **Script URL:** Copy the URL from `src="..."` (usually `https://cloud.umami.is/script.js`)

5. **Update Environment Variables:**
   - Add both values to your `.env.local` file for development
   - Add to Netlify environment variables for production

> [Back to Table of Contents](#table-of-contents)

## Integration with Next.js

The Dorkinians website is already configured to integrate with Umami. The integration includes:

1. **Automatic Script Loading:**
   - Umami script loads via Next.js `Script` component
   - Loads asynchronously without blocking page render
   - Only loads when environment variables are configured

2. **Version Tracking:**
   - App version from `package.json` is automatically tracked
   - Tracked once per session on page load
   - Custom event: "App Version" with version property

3. **Component Structure:**
   - `components/UmamiAnalytics.tsx`: Handles version tracking
   - `app/layout.tsx`: Includes Umami script and analytics component

**To Complete Setup:**

1. Sign up for Umami Cloud at [https://cloud.umami.is](https://cloud.umami.is)
2. Add your website to the Umami dashboard
3. Copy website ID and script URL from the tracking script
4. Add environment variables to `.env.local`:
   ```bash
   NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js
   NEXT_PUBLIC_UMAMI_WEBSITE_ID=your-website-id-here
   ```
5. For production, add same variables to Netlify environment variables
6. Rebuild and deploy the website

The version tracking will work automatically once Umami is configured and environment variables are set.

> [Back to Table of Contents](#table-of-contents)

## Troubleshooting

### Common Issues

**1. Script Not Loading:**
- Verify `NEXT_PUBLIC_UMAMI_SCRIPT_URL` is correct
- Check the URL is accessible in your browser
- Verify script URL matches your Umami Cloud region
- Check browser console for errors

**2. Events Not Tracking:**
- Verify `NEXT_PUBLIC_UMAMI_WEBSITE_ID` matches dashboard
- Check website domain matches configured domain in Umami
- Verify script is loading (check Network tab in DevTools)
- Check browser console for JavaScript errors

**3. Version Not Tracking:**
- Verify `NEXT_PUBLIC_APP_VERSION` is set (auto-populated from package.json)
- Check UmamiAnalytics component is included in layout
- Verify Umami script loads before tracking component
- Check browser console for tracking errors

**4. Dashboard Access Issues:**
- Verify you're logged into the correct Umami Cloud account
- Check website appears in your dashboard
- Verify events are being received (may take a few minutes)

### Debugging Steps

1. **Check Environment Variables:**
```bash
# In Next.js, verify variables are accessible
console.log('Script URL:', process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL);
console.log('Website ID:', process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID);
console.log('App Version:', process.env.NEXT_PUBLIC_APP_VERSION);
```

2. **Verify Script Loading:**
- Open browser DevTools → Network tab
- Reload page and check for `script.js` request
- Verify request returns 200 status

3. **Check Umami Dashboard:**
   - Login to Umami Cloud dashboard
   - Check if website appears in settings
   - Verify events are being received (may take a few minutes to appear)
   - To view version tracking: Go to "Events" section and look for "App Version" events

4. **Test Custom Events:**
- Open browser console
- Run: `window.umami.track('Test Event', { test: true })`
- Check Umami dashboard for the event

> [Back to Table of Contents](#table-of-contents)

## Advanced: Self-Hosted Umami (Optional)

If you prefer to host Umami yourself for more control, data privacy, or cost reasons, you can self-host Umami. This requires setting up your own server, database, and managing updates.

**When to Consider Self-Hosting:**
- You need complete data control and privacy
- You have high traffic volumes (cost savings)
- You want to customize Umami
- You have infrastructure and DevOps expertise

> [Back to Table of Contents](#table-of-contents)

### Self-Hosted with Docker

**Prerequisites:**
- Docker and Docker Compose installed
- PostgreSQL or MySQL database (can be on same server or external)

**Steps:**

1. **Clone Umami Repository:**
```bash
git clone https://github.com/umami-software/umami.git
cd umami
```

2. **Create Environment File:**
Create a `.env` file in the root directory:
```bash
DATABASE_URL=postgresql://umami:password@localhost:5432/umami
# OR for MySQL:
# DATABASE_URL=mysql://umami:password@localhost:3306/umami

HASH_SALT=your-random-salt-here
APP_SECRET=your-random-secret-here
```

Generate secure random strings for `HASH_SALT` and `APP_SECRET`:
```bash
# On Linux/Mac:
openssl rand -base64 32

# On Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

3. **Start with Docker Compose:**
```bash
docker-compose up -d
```

4. **Access Umami Dashboard:**
- Navigate to `http://localhost:3000`
- Default credentials:
  - **Username:** `admin`
  - **Password:** `umami`
- **Important:** Change the default password immediately after first login

5. **Configure for Production:**
- Update `DATABASE_URL` to point to your production database
- Set up reverse proxy (nginx/traefik) with SSL certificate
- Configure domain name and update environment variables

> [Back to Table of Contents](#table-of-contents)

### Vercel Deployment

**Prerequisites:**
- Vercel account
- PostgreSQL database (Vercel Postgres, Supabase, or external)

**Steps:**

1. **Fork Umami Repository:**
   - Fork https://github.com/umami-software/umami to your GitHub account

2. **Deploy to Vercel:**
   - Import your forked repository in Vercel
   - Configure environment variables:
     - `DATABASE_URL`: Your PostgreSQL connection string
     - `HASH_SALT`: Random secure string
     - `APP_SECRET`: Random secure string

3. **Set Up Database:**
   - Use Vercel Postgres or connect external PostgreSQL
   - Update `DATABASE_URL` in Vercel environment variables

4. **Access Dashboard:**
   - Access via your Vercel deployment URL
   - Login with default credentials and change password

> [Back to Table of Contents](#table-of-contents)

### Railway Deployment

**Prerequisites:**
- Railway account
- GitHub account (for repository access)

**Steps:**

1. **Deploy from GitHub:**
   - Go to Railway dashboard
   - Click "New Project" → "Deploy from GitHub"
   - Select the Umami repository (fork if needed)

2. **Configure Environment Variables:**
   - Add `DATABASE_URL` (Railway can provision PostgreSQL automatically)
   - Add `HASH_SALT` and `APP_SECRET` (generate random strings)

3. **Set Up Database:**
   - Railway can auto-provision PostgreSQL
   - Or connect external database via `DATABASE_URL`

4. **Access Dashboard:**
   - Railway provides a public URL
   - Login with default credentials and change password

> [Back to Table of Contents](#table-of-contents)

### DigitalOcean App Platform

**Prerequisites:**
- DigitalOcean account
- PostgreSQL database (DigitalOcean Managed Database or external)

**Steps:**

1. **Create App:**
   - Go to DigitalOcean App Platform
   - Create new app from GitHub repository (fork Umami if needed)

2. **Configure Database:**
   - Provision managed PostgreSQL database
   - Or connect external database

3. **Set Environment Variables:**
   - `DATABASE_URL`: Connection string to PostgreSQL
   - `HASH_SALT`: Random secure string
   - `APP_SECRET`: Random secure string

4. **Deploy:**
   - DigitalOcean will build and deploy automatically
   - Access via provided URL

> [Back to Table of Contents](#table-of-contents)

### Database Setup

#### PostgreSQL Setup

**Using Docker:**
```bash
docker run --name umami-postgres \
  -e POSTGRES_USER=umami \
  -e POSTGRES_PASSWORD=your-secure-password \
  -e POSTGRES_DB=umami \
  -p 5432:5432 \
  -d postgres:15-alpine
```

**Connection String Format:**
```
postgresql://username:password@host:port/database
```

**Example:**
```
postgresql://umami:password@localhost:5432/umami
```

> [Back to Table of Contents](#table-of-contents)

#### MySQL Setup

**Using Docker:**
```bash
docker run --name umami-mysql \
  -e MYSQL_ROOT_PASSWORD=root-password \
  -e MYSQL_DATABASE=umami \
  -e MYSQL_USER=umami \
  -e MYSQL_PASSWORD=your-secure-password \
  -p 3306:3306 \
  -d mysql:8.0
```

**Connection String Format:**
```
mysql://username:password@host:port/database
```

**Example:**
```
mysql://umami:password@localhost:3306/umami
```

> [Back to Table of Contents](#table-of-contents)

### Self-Hosted Security Best Practices

1. **Change Default Password:**
   - Immediately change the default `admin`/`umami` password after first login

2. **Use Strong Secrets:**
   - Generate cryptographically secure random strings for `HASH_SALT` and `APP_SECRET`
   - Use at least 32 characters

3. **Enable HTTPS:**
   - Always use HTTPS in production
   - Set up SSL certificate (Let's Encrypt, Cloudflare, etc.)

4. **Database Security:**
   - Use strong database passwords
   - Restrict database access to only the Umami application
   - Use connection pooling for production

5. **Environment Variables:**
   - Never commit `.env` files to version control
   - Use secure environment variable management in production
   - Rotate secrets periodically

6. **Access Control:**
   - Limit admin access to trusted users only
   - Use strong, unique passwords for all accounts
   - Consider enabling 2FA if available

7. **Network Security:**
   - Use firewall rules to restrict database access
   - Consider using VPN or private networks for database connections

> [Back to Table of Contents](#table-of-contents)
