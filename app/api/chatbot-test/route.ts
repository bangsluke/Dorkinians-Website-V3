import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emailAddress } = body;

    if (!emailAddress) {
      return NextResponse.json(
        { success: false, message: 'Email address is required' },
        { status: 400 }
      );
    }

    // Set the email address in environment for the script
    process.env.SMTP_TO_EMAIL = emailAddress;

    // Run the chatbot test script with timeout and proper error handling
    const scriptPath = path.join(process.cwd(), 'scripts', 'test-chatbot-email-report.js');
    console.log('Script path:', scriptPath);
    console.log('Current working directory:', process.cwd());
    
    try {
      // Use spawn instead of execSync for better control and timeout handling
      const { spawn } = require('child_process');
      
      const result = await new Promise((resolve) => {
        const child = spawn('node', [scriptPath], {
          cwd: process.cwd(),
          env: {
            ...process.env,
            SMTP_TO_EMAIL: emailAddress,
            // Skip server health check when run via API
            SKIP_SERVER_CHECK: 'true'
          },
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        console.log(`Spawned process with PID: ${child.pid}`);

        let output = '';
        let errorOutput = '';
        let timeoutId: NodeJS.Timeout;

        // Set a timeout of 5 minutes for full test suite
        timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          resolve(NextResponse.json(
            { 
              success: false, 
              message: 'Script execution timed out after 5 minutes',
              error: 'Timeout'
            },
            { status: 500 }
          ));
        }, 5 * 60 * 1000);

        child.stdout.on('data', (data: any) => {
          output += data.toString();
        });

        child.stderr.on('data', (data: any) => {
          errorOutput += data.toString();
        });

        child.on('close', (code: any) => {
          clearTimeout(timeoutId);
          console.log(`Script process closed with code: ${code}`);
          console.log(`Output length: ${output.length} characters`);
          console.log(`Error output length: ${errorOutput.length} characters`);
          
          if (code !== 0) {
            console.error('Script execution failed with code:', code);
            console.error('Error output:', errorOutput);
            resolve(NextResponse.json(
              { 
                success: false, 
                message: 'Script execution failed',
                error: errorOutput || `Process exited with code ${code}`,
                output: output.substring(0, 1000)
              },
              { status: 500 }
            ));
            return;
          }

          // Parse the output to extract test results
          const lines = output.split('\n');
          let totalTests = 0;
          let passedTests = 0;
          let failedTests = 0;
          let successRate = 0;

          for (const line of lines) {
            if (line.includes('Total Tests:')) {
              const match = line.match(/Total Tests: (\d+)/);
              if (match) totalTests = parseInt(match[1]);
            }
            if (line.includes('Passed:')) {
              const match = line.match(/Passed: (\d+)/);
              if (match) passedTests = parseInt(match[1]);
            }
            if (line.includes('Failed:')) {
              const match = line.match(/Failed: (\d+)/);
              if (match) failedTests = parseInt(match[1]);
            }
            if (line.includes('Success Rate:')) {
              const match = line.match(/Success Rate: ([\d.]+)%/);
              if (match) successRate = parseFloat(match[1]);
            }
          }

          resolve(NextResponse.json({
            success: true,
            message: 'Chatbot test completed successfully',
            totalTests,
            passedTests,
            failedTests,
            successRate,
            output: output.substring(0, 1000) // First 1000 chars for debugging
          }));
        });

        child.on('error', (error: any) => {
          clearTimeout(timeoutId);
          console.error('Script execution error:', error);
          resolve(NextResponse.json(
            { 
              success: false, 
              message: 'Script execution failed',
              error: error.message
            },
            { status: 500 }
          ));
        });
      });
      
      return result;

    } catch (error: any) {
      console.error('Script execution error:', error);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Script execution failed',
          error: error.message,
          stderr: error.stderr?.toString() || ''
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}
