# PWA Setup Guide for Dorkinians FC Stats

## Table of Contents

- [Overview](#overview)
- [Required Files](#required-files)
- [Icon Requirements](#icon-requirements)
- [iOS Splash Screens](#ios-splash-screens)
- [Update Strategy](#update-strategy)
- [Testing](#testing)
- [Deployment](#deployment)

## Overview

This guide covers the complete setup of a Progressive Web App (PWA) for Dorkinians FC Stats, ensuring compatibility across iOS, Android, and desktop platforms.

**Key Features:**

- **Cross-platform PWA** with native app-like experience
- **Persistent data storage** using localStorage for user preferences
- **Automatic updates** with service worker version management
- **Offline functionality** with intelligent caching strategies

## Required Files

### Core PWA Files

```
public/
├── manifest.json                 # PWA manifest
├── sw.js                        # Service worker (auto-generated)
├── workbox-*.js                 # Workbox library (auto-generated)
└── icons/                       # Icon directory
    ├── icon-16x16.png          # Small favicon
    ├── icon-32x32.png          # Standard favicon
    ├── icon-72x72.png          # Android small
    ├── icon-96x96.png          # Android medium
    ├── icon-128x128.png        # Android large
    ├── icon-144x144.png        # Android xlarge
    ├── icon-152x152.png        # iOS touch icon
    ├── icon-192x192.png        # Android xlarge + maskable
    ├── icon-384x384.png        # Android xxlarge
    └── icon-512x512.png        # Android xxlarge + maskable
```

### iOS Splash Screens

```
public/
├── apple-touch-startup-image-1290x2796.png    # iPhone 6.7" Portrait
├── apple-touch-startup-image-2796x1290.png    # iPhone 6.7" Landscape
├── apple-touch-startup-image-1170x2532.png    # iPhone 6.1" Portrait
├── apple-touch-startup-image-2532x1170.png    # iPhone 6.1" Landscape
├── apple-touch-startup-image-1242x2208.png    # iPhone 5.5" Portrait
├── apple-touch-startup-image-2208x1242.png    # iPhone 5.5" Landscape
├── apple-touch-startup-image-2048x2732.png    # iPad 12.9" Portrait
├── apple-touch-startup-image-2732x2048.png    # iPad 12.9" Landscape
├── apple-touch-startup-image-1668x2388.png    # iPad 11" Portrait
└── apple-touch-startup-image-2388x1668.png    # iPad 11" Landscape
```

## Icon Requirements

### Design Specifications

- **Background**: #1C8841 (Dorkinians green)
- **Foreground**: White elements (logo, text)
- **Format**: PNG with transparency support
- **Quality**: High resolution, crisp edges

### Icon Sizes and Purposes

| Size    | Purpose                    | Platform        |
| ------- | -------------------------- | --------------- |
| 16x16   | Favicon                    | All browsers    |
| 32x32   | Favicon                    | All browsers    |
| 72x72   | Android small              | Android devices |
| 96x96   | Android medium             | Android devices |
| 128x128 | Android large              | Android devices |
| 144x144 | Android xlarge             | Android devices |
| 152x152 | iOS touch                  | iOS devices     |
| 192x192 | Android xlarge + maskable  | Android + PWA   |
| 384x384 | Android xxlarge            | Android devices |
| 512x512 | Android xxlarge + maskable | Android + PWA   |

## iOS Splash Screens

### Generation Process

1. Open `public/apple-touch-startup-image.html` in a browser
2. Use the download buttons to generate each splash screen
3. Save files with exact names in the `public/` directory

### Device Coverage

- **iPhone 6.7"**: 1290x2796 (portrait), 2796x1290 (landscape)
- **iPhone 6.1"**: 1170x2532 (portrait), 2532x1170 (landscape)
- **iPhone 5.5"**: 1242x2208 (portrait), 2208x1242 (landscape)
- **iPad 12.9"**: 2048x2732 (portrait), 2732x2048 (landscape)
- **iPad 11"**: 1668x2388 (portrait), 2388x1668 (landscape)

## Data Persistence

### localStorage Implementation

The PWA uses `localStorage` to persist user preferences across sessions:

- **Player Selection**: Automatically saves and restores the last selected player
- **Cross-Session Persistence**: Data survives browser restarts, app closures, and device reboots
- **PWA Integration**: Works seamlessly with PWA installation and offline functionality

**Storage Keys:**

- `dorkinians-selected-player`: Stores the currently selected player name

**Benefits:**

- **Seamless UX**: Users don't need to re-select their player each time
- **Offline Ready**: Player selection works even without internet connection
- **Cross-Platform**: Consistent experience across all devices and browsers

## Update Strategy

### Version Management

1. **Increment version** in `package.json` for each release
2. **Service worker** automatically detects updates
3. **Update notification** appears to installed PWA users
4. **One-click update** process for seamless experience

### Update Flow

```
User has PWA installed → New version deployed →
Service worker detects update → Update notification appears →
User clicks "Update Now" → Page reloads → New version active
```

### Best Practices

- Deploy updates during low-traffic periods
- Test updates thoroughly before deployment
- Monitor update adoption rates
- Provide clear update descriptions

## Testing

### PWA Installation Testing

1. **Chrome DevTools**: Application tab → Manifest
2. **Lighthouse**: PWA audit score
3. **Real devices**: Install on iOS/Android
4. **Offline functionality**: Test without internet

### Device Testing Matrix

| Platform        | Browser | Installation | Offline | Updates |
| --------------- | ------- | ------------ | ------- | ------- |
| iOS Safari      | ✅      | ✅           | ✅      | ✅      |
| Android Chrome  | ✅      | ✅           | ✅      | ✅      |
| Desktop Chrome  | ✅      | ✅           | ✅      | ✅      |
| Desktop Edge    | ✅      | ✅           | ✅      | ✅      |
| Desktop Firefox | ✅      | ✅           | ✅      | ✅      |

## Deployment

### Netlify Configuration

- **Build command**: `npm run build`
- **Publish directory**: `.next`
- **Environment**: Production
- **Headers**: PWA-friendly caching

### Post-Deployment Checklist

- [ ] Verify manifest.json is accessible
- [ ] Confirm service worker is registered
- [ ] Test PWA installation on target devices
- [ ] Validate offline functionality
- [ ] Check update notification system

### Monitoring

- **Service worker registration** success rate
- **PWA installation** conversion rate
- **Update adoption** rate
- **Offline usage** patterns

## Troubleshooting

### Common Issues

1. **Icons not displaying**: Check file paths and sizes
2. **Install prompt not showing**: Verify manifest.json validity
3. **Updates not detected**: Check service worker configuration
4. **iOS splash screens not working**: Verify media query syntax

### Debug Commands

```bash
# Check PWA status
npm run build
npm run start

# Verify service worker
# Open DevTools → Application → Service Workers

# Test offline functionality
# DevTools → Network → Offline
```

## Maintenance

### Regular Tasks

- **Monthly**: Review PWA performance metrics
- **Quarterly**: Update icon designs if needed
- **Bi-annually**: Review and update manifest.json
- **Annually**: Audit PWA compliance standards

### Performance Optimization

- **Icon compression**: Optimize PNG files
- **Cache strategies**: Review service worker caching
- **Bundle analysis**: Monitor JavaScript bundle size
- **Loading times**: Optimize critical rendering path

---

> [Back to Table of Contents](#table-of-contents)
