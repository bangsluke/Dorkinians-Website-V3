#!/usr/bin/env node

/**
 * Test Runner Script for Dorkinians Website
 * 
 * This script provides a convenient way to run tests with proper configuration
 * and handles common testing scenarios.
 */

const { spawn } = require('child_process');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  unit: 'jest --testPathPattern=services',
  integration: 'jest --testPathPattern=integration',
  all: 'jest',
  coverage: 'jest --coverage',
  watch: 'jest --watch',
  debug: 'jest --verbose --detectOpenHandles'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    log(`🚀 Running: ${command} ${args.join(' ')}`, 'cyan');
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd()
    });

    child.on('close', (code) => {
      if (code === 0) {
        log(`✅ Command completed successfully`, 'green');
        resolve(code);
      } else {
        log(`❌ Command failed with code ${code}`, 'red');
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    child.on('error', (error) => {
      log(`❌ Command error: ${error.message}`, 'red');
      reject(error);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';

  log('🧪 Dorkinians Website Test Runner', 'bright');
  log('=====================================', 'blue');
  
  if (!TEST_CONFIG[testType]) {
    log(`❌ Unknown test type: ${testType}`, 'red');
    log('Available test types:', 'yellow');
    Object.keys(TEST_CONFIG).forEach(type => {
      log(`  - ${type}`, 'cyan');
    });
    process.exit(1);
  }

  try {
    // Check if Jest is available
    log('🔍 Checking Jest installation...', 'yellow');
    await runCommand('npx', ['jest', '--version']);
    
    // Run the selected test
    log(`🧪 Running ${testType} tests...`, 'yellow');
    const [command, ...commandArgs] = TEST_CONFIG[testType].split(' ');
    await runCommand(command, commandArgs);
    
    log(`🎉 ${testType} tests completed successfully!`, 'green');
    
  } catch (error) {
    log(`❌ Test execution failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Handle command line arguments
if (require.main === module) {
  main().catch((error) => {
    log(`❌ Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runCommand, TEST_CONFIG };
