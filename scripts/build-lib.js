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
function copyDir(src, dest) {
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}
	
	const items = fs.readdirSync(src);
	
	for (const item of items) {
		const srcPath = path.join(src, item);
		const destPath = path.join(dest, item);
		
		if (fs.statSync(srcPath).isDirectory()) {
			copyDir(srcPath, destPath);
		} else if (item.endsWith('.ts')) {
			// Copy TypeScript files as-is (Netlify will handle compilation)
			fs.copyFileSync(srcPath, destPath);
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
