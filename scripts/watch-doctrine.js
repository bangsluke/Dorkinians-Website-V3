#!/usr/bin/env node

/**
 * Engineering Doctrine File Watcher
 * 
 * Watches for changes to ENGINEERING_DOCTRINE.md and automatically syncs to .cursor/rules/
 * Run with: node scripts/watch-doctrine.js
 */

const fs = require('fs');
const path = require('path');

const SOURCE_FILE = 'docs/ENGINEERING_DOCTRINE.md';
const TARGET_FILE = '.cursor/rules/engineering-doctrine.mdc';

function syncDoctrine() {
    try {
        console.log('🔄 Syncing Engineering Doctrine files...');
        
        // Check if source file exists
        if (!fs.existsSync(SOURCE_FILE)) {
            console.error(`❌ Source file not found: ${SOURCE_FILE}`);
            return;
        }
        
        // Read source file
        const sourceContent = fs.readFileSync(SOURCE_FILE, 'utf8');
        
        // Ensure target directory exists
        const targetDir = path.dirname(TARGET_FILE);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
            console.log(`📁 Created directory: ${targetDir}`);
        }
        
        // Write to target file
        fs.writeFileSync(TARGET_FILE, sourceContent, 'utf8');
        
        console.log(`✅ Successfully synced ${SOURCE_FILE} → ${TARGET_FILE}`);
        
        // Show file sizes for verification
        const sourceSize = fs.statSync(SOURCE_FILE).size;
        const targetSize = fs.statSync(TARGET_FILE).size;
        
        console.log(`📊 Source: ${sourceSize} bytes, Target: ${targetSize} bytes`);
        
        if (sourceSize === targetSize) {
            console.log('✅ File sizes match - sync successful');
        } else {
            console.warn('⚠️  File sizes differ - check for issues');
        }
        
    } catch (error) {
        console.error('❌ Error syncing doctrine files:', error.message);
    }
}

const WATCH_FILE = 'docs/ENGINEERING_DOCTRINE.md';

function startWatching() {
    console.log(`👀 Watching for changes to ${WATCH_FILE}...`);
    console.log('Press Ctrl+C to stop watching');
    
    if (!fs.existsSync(WATCH_FILE)) {
        console.error(`❌ File not found: ${WATCH_FILE}`);
        process.exit(1);
    }
    
    fs.watchFile(WATCH_FILE, { interval: 1000 }, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
            console.log(`\n📝 ${WATCH_FILE} changed at ${new Date().toLocaleTimeString()}`);
            syncDoctrine();
        }
    });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Stopping file watcher...');
    process.exit(0);
});

// Start watching
startWatching();
