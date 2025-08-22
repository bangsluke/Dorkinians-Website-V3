#!/usr/bin/env node

/**
 * Build script for lib directory to make it compatible with Netlify Functions
 */

const fs = require('fs');
const path = require('path');

console.log('🔨 Building lib directory for Netlify Functions...');

const libDir = path.join(__dirname, '..', 'lib');
const buildDir = path.join(__dirname, '..', 'netlify', 'functions', 'lib');

// Create build directory
if (!fs.existsSync(buildDir)) {
	fs.mkdirSync(buildDir, { recursive: true });
}

// Copy and compile lib files
function copyDir(src, dest, relativeDepth = 0) {
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}
	
	const items = fs.readdirSync(src);
	
	for (const item of items) {
		const srcPath = path.join(src, item);
		const destPath = path.join(dest, item);
		
		if (fs.statSync(srcPath).isDirectory()) {
			copyDir(srcPath, destPath, relativeDepth + 1);
		} else if (item.endsWith('.ts')) {
			// Copy TypeScript files and update import paths
			let content = fs.readFileSync(srcPath, 'utf8');
			
			// Replace @/lib/ imports with relative paths
			// For files in config/, imports to services/ need to go up one level
			if (relativeDepth > 0) {
				content = content.replace(/@\/lib\/services\//g, '../services/');
				content = content.replace(/@\/lib\//g, '../');
			} else {
				content = content.replace(/@\/lib\//g, './');
			}
			
			fs.writeFileSync(destPath, content);
		} else {
			// Copy other files
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

try {
	copyDir(libDir, buildDir);
	console.log('✅ Lib directory built successfully');
	console.log(`📁 Output: ${buildDir}`);
} catch (error) {
	console.error('❌ Build failed:', error);
	process.exit(1);
}
