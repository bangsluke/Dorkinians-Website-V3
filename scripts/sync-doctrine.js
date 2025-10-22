#!/usr/bin/env node

/**
 * Engineering Doctrine Sync Script
 * 
 * Simple sync script for git hooks
 */

const fs = require('fs');
const path = require('path');

const SOURCE_FILE = 'docs/ENGINEERING_DOCTRINE.md';
const TARGET_FILE = '.cursor/rules/engineering-doctrine.mdc';

try {
    // Read source file
    const sourceContent = fs.readFileSync(SOURCE_FILE, 'utf8');
    
    // Ensure target directory exists
    const targetDir = path.dirname(TARGET_FILE);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Write to target file
    fs.writeFileSync(TARGET_FILE, sourceContent, 'utf8');
    
    console.log(`✅ Synced ${SOURCE_FILE} → ${TARGET_FILE}`);
    
} catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
}
