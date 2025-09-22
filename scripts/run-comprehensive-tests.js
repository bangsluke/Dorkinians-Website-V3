#!/usr/bin/env node

/**
 * Comprehensive Test Runner
 * 
 * This script orchestrates multiple batch calls to run comprehensive chatbot tests
 * without hitting Netlify function timeout limits.
 * 
 * Usage:
 *   node scripts/run-comprehensive-tests.js [email] [batchSize] [totalBatches]
 * 
 * Example:
 *   node scripts/run-comprehensive-tests.js luke.bangs@outlook.com 20 5
 */

const https = require('https');

// Configuration
const DEFAULT_EMAIL = 'luke.bangs@outlook.com';
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_TOTAL_BATCHES = 10;
const API_URL = 'https://dorkinians-website-v3.netlify.app/api/chatbot-test-async';

// Parse command line arguments
const email = process.argv[2] || DEFAULT_EMAIL;
const batchSize = parseInt(process.argv[3]) || DEFAULT_BATCH_SIZE;
const totalBatches = parseInt(process.argv[4]) || DEFAULT_TOTAL_BATCHES;

console.log('🚀 Starting Comprehensive Chatbot Test Suite');
console.log(`📧 Email: ${email}`);
console.log(`📦 Batch Size: ${batchSize}`);
console.log(`🔄 Total Batches: ${totalBatches}`);
console.log('');

// Function to make HTTP request
function makeRequest(url, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(url, options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    resolve({ statusCode: res.statusCode, data: result });
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${error.message}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}

// Function to run a single batch
async function runBatch(batchNumber, startIndex) {
    console.log(`🔄 Running Batch ${batchNumber}/${totalBatches} (startIndex: ${startIndex})`);
    
    try {
        const response = await makeRequest(API_URL, {
            emailAddress: email,
            batchSize: batchSize,
            startIndex: startIndex
        });
        
        if (response.statusCode === 200 && response.data.success) {
            const result = response.data;
            console.log(`✅ Batch ${batchNumber} completed:`);
            console.log(`   📊 Processed: ${result.processedTests} tests`);
            console.log(`   ✅ Passed: ${result.passedTests}`);
            console.log(`   ❌ Failed: ${result.failedTests}`);
            console.log(`   📈 Success Rate: ${result.processedTests > 0 ? ((result.passedTests / result.processedTests) * 100).toFixed(1) : 0}%`);
            console.log(`   🔄 Has More: ${result.hasMore ? 'Yes' : 'No'}`);
            console.log('');
            
            return {
                success: true,
                processedTests: result.processedTests,
                passedTests: result.passedTests,
                failedTests: result.failedTests,
                hasMore: result.hasMore,
                nextStartIndex: result.nextStartIndex
            };
        } else {
            console.error(`❌ Batch ${batchNumber} failed:`, response.data.message);
            return { success: false, error: response.data.message };
        }
    } catch (error) {
        console.error(`❌ Batch ${batchNumber} error:`, error.message);
        return { success: false, error: error.message };
    }
}

// Function to wait between batches
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Main execution
async function main() {
    const startTime = Date.now();
    let totalProcessed = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let currentStartIndex = 0;
    let successfulBatches = 0;
    let failedBatches = 0;
    
    console.log('🎯 Starting batch processing...\n');
    
    for (let batchNumber = 1; batchNumber <= totalBatches; batchNumber++) {
        const result = await runBatch(batchNumber, currentStartIndex);
        
        if (result.success) {
            totalProcessed += result.processedTests;
            totalPassed += result.passedTests;
            totalFailed += result.failedTests;
            currentStartIndex = result.nextStartIndex;
            successfulBatches++;
            
            // If no more tests available, stop
            if (!result.hasMore) {
                console.log('🏁 All tests completed - stopping early');
                break;
            }
            
            // Wait 2 seconds between batches to avoid rate limiting
            if (batchNumber < totalBatches) {
                console.log('⏳ Waiting 2 seconds before next batch...\n');
                await wait(2000);
            }
        } else {
            failedBatches++;
            console.log(`⚠️ Batch ${batchNumber} failed, continuing with next batch...\n`);
            
            // Wait 5 seconds before retrying
            if (batchNumber < totalBatches) {
                await wait(5000);
            }
        }
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('📊 COMPREHENSIVE TEST SUITE SUMMARY');
    console.log('=====================================');
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`🔄 Batches: ${successfulBatches} successful, ${failedBatches} failed`);
    console.log(`📊 Total Tests: ${totalProcessed}`);
    console.log(`✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`📈 Overall Success Rate: ${totalProcessed > 0 ? ((totalPassed / totalProcessed) * 100).toFixed(1) : 0}%`);
    console.log('');
    
    if (totalFailed === 0) {
        console.log('🎉 All tests passed!');
        process.exit(0);
    } else {
        console.log('⚠️ Some tests failed - check the logs above for details');
        process.exit(1);
    }
}

// Run the main function
main().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
});
