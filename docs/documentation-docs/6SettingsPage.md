---
slug: /projects/dorkinians-website/settings-page
---

# Settings

> [Back to Dorkinians Website Documentation](1DorkiniansWebsite.md)

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Overview](#overview)
- [Accessing Settings](#accessing-settings)
- [Available Screens Navigation](#available-screens-navigation)
  - [Main Pages](#main-pages)
  - [Sub-Pages](#sub-pages)
  - [Quick Navigation](#quick-navigation)
- [Database Status](#database-status)
  - [Seeding Status](#seeding-status)
  - [Status Indicators](#status-indicators)
  - [Database Information](#database-information)
- [PWA Installation](#pwa-installation)
  - [Install Prompt](#install-prompt)
  - [Installation Benefits](#installation-benefits)
  - [Update Notifications](#update-notifications)
- [App Information](#app-information)
- [Tips and Tricks](#tips-and-tricks)

## Overview

The Settings page provides quick navigation to all app sections, displays database status information, and offers PWA (Progressive Web App) installation options. It serves as a central hub for app management and navigation.

:::info
The Settings page is accessible from the header menu icon on any page in the app.
:::

[Image: Settings Page Screenshot]

> [Back to Table of Contents](#table-of-contents)

## Accessing Settings

To access the Settings page:

1. **From Any Page**: Tap the menu icon (three horizontal lines or hamburger menu) in the header
2. **Settings Option**: Select "Settings" from the menu
3. **Direct Access**: The Settings page can also be accessed via direct URL (where supported)

:::tip
The Settings page is hidden from the bottom navigation bar to keep the main navigation clean, but it's always accessible via the header menu.
:::

[Image: Accessing Settings Screenshot]

> [Back to Table of Contents](#table-of-contents)

## Available Screens Navigation

The Available Screens section provides a comprehensive navigation tree showing all available pages and sub-pages in the app.

### Main Pages

The main navigation pages are displayed with icons:

- **Home**: Chatbot interface (no sub-pages)
- **Stats**: Statistics section with multiple sub-pages
- **TOTW**: Team of the Week section with sub-pages
- **Club Info**: Club information section with sub-pages

Each main page is displayed as a button that navigates directly to that page when tapped.

[Image: Main Pages Navigation Screenshot]

> [Back to Table of Contents](#table-of-contents)

### Sub-Pages

Sub-pages are displayed under their respective main pages:

**Stats Sub-Pages:**
- Player Stats
- Team Stats
- Club Stats
- Comparison

**TOTW Sub-Pages:**
- Team of the Week
- Players of the Month

**Club Info Sub-Pages:**
- Club Information
- League Information
- Club Captains
- Club Awards
- Useful Links

Each sub-page is displayed as a nested button that navigates directly to that specific sub-page when tapped.

:::tip
Use the sub-page navigation to jump directly to a specific section without having to navigate through the main pages first.
:::

[Image: Sub-Pages Navigation Screenshot]

> [Back to Table of Contents](#table-of-contents)

### Quick Navigation

The Available Screens section can be expanded or collapsed:

- **Expand/Collapse**: Tap the "Available Screens" header to expand or collapse the navigation tree
- **Quick Access**: When expanded, you can quickly navigate to any page or sub-page with a single tap
- **Visual Hierarchy**: Main pages and sub-pages are visually distinguished with different styling

This provides a quick way to navigate to any section of the app without using the bottom navigation or swiping through pages.

[Image: Quick Navigation Screenshot]

> [Back to Table of Contents](#table-of-contents)

## Database Status

The Database Status section displays information about the app's database connection and data seeding status.

### Seeding Status

The seeding status indicates whether the database has been successfully populated with the latest statistics data:

- **Success**: Database has been successfully seeded with the latest data
- **Failed**: Database seeding encountered an error
- **Running**: Database seeding is currently in progress
- **Unknown**: Seeding status is not available

:::info
Database seeding is the process of loading statistics data into the database. This typically happens automatically but may need to be triggered manually in some cases.
:::

[Image: Seeding Status Screenshot]

> [Back to Table of Contents](#table-of-contents)

### Status Indicators

Status indicators use color-coded icons to show the current state:

- **Green Checkmark**: Seeding was successful
- **Red X**: Seeding failed
- **Yellow Clock (Pulsing)**: Seeding is currently running
- **Gray Clock**: Status is unknown or not available

The status indicator is accompanied by a text summary explaining the current state.

[Image: Status Indicators Screenshot]

> [Back to Table of Contents](#table-of-contents)

### Database Information

When seeding is successful, additional information may be displayed:

- **Nodes Created**: Number of database nodes (data entries) created during seeding
- **Relationships Created**: Number of relationships between data entries created
- **Last Seeding Time**: When the database was last successfully seeded

This information helps verify that the database contains the expected amount of data.

:::tip
If you notice statistics seem outdated, check the database status to see when data was last updated.
:::

[Image: Database Information Screenshot]

> [Back to Table of Contents](#table-of-contents)

## PWA Installation

The PWA Installation section provides options for installing the Dorkinians Website as a Progressive Web App on your device.

### Install Prompt

The install prompt appears when:

- The app detects that it can be installed on your device
- You haven't already installed the app
- Your browser supports PWA installation

**To Install:**
1. Tap the "Install App" button
2. Follow your device's installation prompts
3. The app will be added to your home screen or app drawer

:::info
PWA installation is supported on most modern mobile browsers and some desktop browsers (Chrome, Edge, Safari).
:::

[Image: Install Prompt Screenshot]

> [Back to Table of Contents](#table-of-contents)

### Installation Benefits

Installing the app as a PWA provides several benefits:

- **Home Screen Access**: Quick access from your device's home screen
- **App-Like Experience**: Full-screen experience without browser UI
- **Offline Capabilities**: Some features may work offline (where supported)
- **Faster Loading**: Improved performance and faster load times
- **Push Notifications**: Receive updates and notifications (where enabled)

:::tip
Installing the app provides a more native, app-like experience compared to using it in a browser.
:::

[Image: Installation Benefits Screenshot]

> [Back to Table of Contents](#table-of-contents)

### Update Notifications

When the app is installed as a PWA, you may receive notifications about:

- **App Updates**: When a new version of the app is available
- **Data Updates**: When new statistics data is available
- **Important Announcements**: Club or app-related announcements

Update notifications help ensure you're always using the latest version with the most current data.

[Image: Update Notifications Screenshot]

> [Back to Table of Contents](#table-of-contents)

## App Information

The Settings page may display additional app information, such as:

- **App Version**: Current version number
- **Last Updated**: When the app was last updated
- **Build Information**: Technical details about the app build

This information helps identify which version of the app you're using and when it was last updated.

[Image: App Information Screenshot]

> [Back to Table of Contents](#table-of-contents)

## Tips and Tricks

1. **Use Quick Navigation**: The Available Screens section is the fastest way to jump to any specific page or sub-page

2. **Check Database Status**: If statistics seem outdated or incorrect, check the database status to see when data was last updated

3. **Install as PWA**: For the best experience, install the app as a PWA on your mobile device

4. **Monitor Updates**: Keep an eye on update notifications to ensure you're using the latest version

5. **Expand Navigation Tree**: Expand the Available Screens section to see all available pages at a glance

6. **Use Settings as Hub**: The Settings page serves as a central hub - use it to quickly navigate to any section

:::warning
If database seeding fails, some statistics may not be available. Check the database status and contact support if issues persist.
:::

> [Back to Table of Contents](#table-of-contents)

