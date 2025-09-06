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

    // Run the chatbot test script
    const scriptPath = path.join(process.cwd(), 'scripts', 'test-chatbot-email-report.js');
    
    try {
      const output = execSync(`node ${scriptPath}`, {
        encoding: 'utf8',
        cwd: process.cwd(),
        stdio: 'pipe',
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        env: {
          ...process.env,
          SMTP_TO_EMAIL: emailAddress
        }
      });

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

      return NextResponse.json({
        success: true,
        message: 'Chatbot test completed successfully',
        totalTests,
        passedTests,
        failedTests,
        successRate,
        output: output.substring(0, 1000) // First 1000 chars for debugging
      });

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
