#!/usr/bin/env node

/**
 * Setup Git Hooks for Engineering Doctrine Auto-Sync
 * 
 * This script sets up git hooks to automatically sync the Engineering Doctrine
 * whenever docs/ENGINEERING_DOCTRINE.md is committed.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GIT_HOOKS_DIR = '.git/hooks';
const PRE_COMMIT_HOOK = path.join(GIT_HOOKS_DIR, 'pre-commit');

function setupGitHooks() {
    try {
        console.log('🔧 Setting up git hooks for Engineering Doctrine auto-sync...');
        
        // Check if we're in a git repository
        if (!fs.existsSync('.git')) {
            console.error('❌ Not in a git repository. Please run this from the project root.');
            process.exit(1);
        }
        
        // Ensure hooks directory exists
        if (!fs.existsSync(GIT_HOOKS_DIR)) {
            fs.mkdirSync(GIT_HOOKS_DIR, { recursive: true });
            console.log(`📁 Created directory: ${GIT_HOOKS_DIR}`);
        }
        
        // Create the pre-commit hook
        const hookContent = `#!/bin/sh

# Engineering Doctrine Auto-Sync Hook
# Automatically syncs ENGINEERING_DOCTRINE.md to .cursor/rules/ on commit

# Check if ENGINEERING_DOCTRINE.md is being committed
if git diff --cached --name-only | grep -q "docs/ENGINEERING_DOCTRINE.md"; then
    echo "🔄 Engineering Doctrine changed - auto-syncing to .cursor/rules/..."
    
    # Run the sync script
    node scripts/sync-doctrine-once.js
    
    if [ $? -eq 0 ]; then
        echo "✅ Engineering Doctrine synced successfully"
    else
        echo "❌ Failed to sync Engineering Doctrine"
        exit 1
    fi
fi`;

        fs.writeFileSync(PRE_COMMIT_HOOK, hookContent, 'utf8');
        
        // Make the hook executable (Unix/Linux/Mac)
        try {
            execSync(`chmod +x "${PRE_COMMIT_HOOK}"`, { stdio: 'inherit' });
        } catch (error) {
            // Ignore chmod errors on Windows
            console.log('ℹ️  Note: chmod not available (Windows environment)');
        }
        
        console.log('✅ Git hooks setup complete!');
        console.log('📝 The Engineering Doctrine will now auto-sync on commit when docs/ENGINEERING_DOCTRINE.md changes');
        
    } catch (error) {
        console.error('❌ Error setting up git hooks:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    setupGitHooks();
}

module.exports = { setupGitHooks };
