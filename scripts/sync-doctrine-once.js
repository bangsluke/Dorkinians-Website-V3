#!/usr/bin/env node

/**
 * One-time Engineering Doctrine Synchronization
 * 
 * Syncs ENGINEERING_DOCTRINE.md to .cursor/rules/engineering-doctrine.mdc once
 * Run with: node scripts/sync-doctrine-once.js
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
            process.exit(1);
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
        process.exit(1);
    }
}

// Run the sync
syncDoctrine();
