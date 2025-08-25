const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.config = null;
    this.configure();
  }

  configure() {
    const emailConfig = {
      host: process.env.SMTP_SERVER,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_EMAIL_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
      },
      from: process.env.SMTP_FROM_EMAIL,
      to: process.env.SMTP_TO_EMAIL
    };

    if (emailConfig.host && emailConfig.auth.user && emailConfig.auth.pass && emailConfig.from && emailConfig.to) {
      try {
        this.transporter = nodemailer.createTransporter({
          host: emailConfig.host,
          port: emailConfig.port,
          secure: emailConfig.secure,
          auth: emailConfig.auth,
          tls: {
            rejectUnauthorized: false,
            checkServerIdentity: () => undefined
          }
        });
        this.config = emailConfig;
        console.log('📧 Email service configured successfully');
      } catch (error) {
        console.warn('⚠️ Failed to configure email service:', error.message);
      }
    } else {
      console.log('ℹ️ Email service not configured - missing environment variables');
    }
  }

  async sendSeedingStartEmail(environment, jobId) {
    if (!this.transporter || !this.config) {
      console.log('Email service not configured, skipping start notification');
      return true;
    }

    try {
      const subject = `🔄 Database Seeding Started - ${environment}`;
      
      const htmlBody = this.generateSeedingStartEmail(environment, jobId);
      const textBody = this.generateSeedingStartEmailText(environment, jobId);

      const mailOptions = {
        from: this.config.from,
        to: this.config.to,
        subject: subject,
        html: htmlBody,
        text: textBody
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('📧 Start notification sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send start notification:', error.message);
      return false;
    }
  }

  async sendSeedingSummaryEmail(summary) {
    if (!this.transporter || !this.config) {
      console.log('Email service not configured, skipping email notification');
      return true;
    }

    try {
      const subject = `Database Seeding ${summary.success ? 'Success' : 'Failed'} - ${summary.environment}`;
      
      const htmlBody = this.generateSeedingSummaryEmail(summary);
      const textBody = this.generateSeedingSummaryEmailText(summary);

      const mailOptions = {
        from: this.config.from,
        to: this.config.to,
        subject: subject,
        html: htmlBody,
        text: textBody
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error.message);
      return false;
    }
  }

  generateSeedingStartEmail(environment, jobId) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
          .info-box { background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔄 Database Seeding Started</h1>
            <p>Environment: ${environment.toUpperCase()}</p>
            <p>Job ID: ${jobId}</p>
            <p>Timestamp: ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="content">
            <h2>Seeding Process Initiated</h2>
            
            <div class="info-box">
              <h3>What's Happening:</h3>
              <ul>
                <li>✅ Database connection established</li>
                <li>🔄 Processing 10 data sources from Google Sheets</li>
                <li>🗑️ Clearing existing data and applying schema</li>
                <li>📊 Creating nodes and relationships</li>
                <li>📧 You'll receive another email when complete</li>
              </ul>
            </div>
            
            <div class="info-box">
              <h3>Expected Duration:</h3>
              <p>Based on current performance: <strong>~30 minutes</strong></p>
              <p>This process runs on Heroku infrastructure and will continue even if you close this email.</p>
            </div>
            
            <div class="footer">
              <p>This is an automated notification from the Dorkinians Website V3 seeding system.</p>
              <p>Monitor progress via the admin panel or wait for completion email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateSeedingStartEmailText(environment, jobId) {
    return `
Database Seeding Started
Environment: ${environment.toUpperCase()}
Job ID: ${jobId}
Timestamp: ${new Date().toLocaleString()}

SEEDING PROCESS INITIATED:
✅ Database connection established
🔄 Processing 10 data sources from Google Sheets
🗑️ Clearing existing data and applying schema
📊 Creating nodes and relationships
📧 You'll receive another email when complete

EXPECTED DURATION: ~30 minutes

This process runs on Heroku infrastructure and will continue even if you close this email.

Monitor progress via the admin panel or wait for completion email.

This is an automated notification from the Dorkinians Website V3 seeding system.
    `.trim();
  }

  generateSeedingSummaryEmail(summary) {
    const statusIcon = summary.success ? '✅' : '❌';
    const statusText = summary.success ? 'Success' : 'Failed';
    const statusColor = summary.success ? '#28a745' : '#dc3545';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${statusColor}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
          .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
          .summary-item { background: white; padding: 15px; border-radius: 5px; text-align: center; }
          .summary-number { font-size: 24px; font-weight: bold; color: ${statusColor}; }
          .summary-label { font-size: 14px; color: #666; margin-top: 5px; }
          .error-list { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0; }
          .error-item { margin: 5px 0; padding: 5px; background: white; border-radius: 3px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${statusIcon} Database Seeding ${statusText}</h1>
            <p>Environment: ${summary.environment.toUpperCase()}</p>
            <p>Job ID: ${summary.jobId}</p>
            <p>Timestamp: ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="content">
            <h2>Seeding Summary</h2>
            
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-number">${summary.nodesCreated}</div>
                <div class="summary-label">Nodes Created</div>
              </div>
              <div class="summary-item">
                <div class="summary-number">${summary.relationshipsCreated}</div>
                <div class="summary-label">Relationships Created</div>
              </div>
              <div class="summary-item">
                <div class="summary-number">${summary.errorCount}</div>
                <div class="summary-label">Errors in Log</div>
              </div>
            </div>
            
            ${summary.errors && summary.errors.length > 0 ? `
              <div class="error-list">
                <h3>Errors Encountered:</h3>
                ${summary.errors.map(error => `<div class="error-item">❌ ${error}</div>`).join('')}
              </div>
            ` : ''}
            
            <div class="footer">
              <p>This is an automated notification from the Dorkinians Website V3 seeding system.</p>
              <p>For detailed error logs, check the Heroku logs.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateSeedingSummaryEmailText(summary) {
    const statusText = summary.success ? 'SUCCESS' : 'FAILED';
    
    return `
Database Seeding ${statusText}
Environment: ${summary.environment.toUpperCase()}
Job ID: ${summary.jobId}
Timestamp: ${new Date().toLocaleString()}

SUMMARY:
- Nodes Created: ${summary.nodesCreated}
- Relationships Created: ${summary.relationshipsCreated}
- Errors in Log: ${summary.errorCount}

${summary.errors && summary.errors.length > 0 ? `
ERRORS ENCOUNTERED:
${summary.errors.map(error => `- ${error}`).join('\n')}
` : ''}

This is an automated notification from the Dorkinians Website V3 seeding system.
For detailed error logs, check the Heroku logs.
    `.trim();
  }
}

module.exports = { EmailService };
