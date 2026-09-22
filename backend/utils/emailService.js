const nodemailer = require('nodemailer');

/**
 * Email Service Module
 * Handles sending emails using Nodemailer
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize the Nodemailer transporter based on environment variables
   */
  initializeTransporter() {
    try {
      // Get configuration from environment variables
      const emailService = process.env.EMAIL_SERVICE || 'gmail';
      const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
      const emailPort = parseInt(process.env.EMAIL_PORT || '587');
      const emailUser = process.env.EMAIL_USER;
      const emailPassword = process.env.EMAIL_PASSWORD;

      if (!emailUser || !emailPassword) {
        console.warn('⚠️  Email credentials not configured in .env');
        return;
      }

      // Create transporter configuration
      const transporterConfig = {
        host: emailHost,
        port: emailPort,
        secure: emailPort === 465, // true for 465, false for other ports
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      };

      // Initialize transporter
      this.transporter = nodemailer.createTransport(transporterConfig);
      console.log('✓ Email service initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing email service:', error.message);
      this.transporter = null;
    }
  }

  /**
   * Send an email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML email body
   * @param {string} options.text - Plain text email body (optional)
   * @returns {Promise<Object>} - Nodemailer response
   */
  async sendEmail({ to, subject, html, text }) {
    try {
      if (!this.transporter) {
        throw new Error('Email service not initialized. Check .env configuration.');
      }

      // Validate inputs
      if (!to || !subject || !html) {
        throw new Error('Missing required email fields: to, subject, html');
      }

      // Email options
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        html,
        text: text || 'HTML email. Please use an HTML-compatible email client.',
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      console.log(`✓ Email sent successfully to ${to}`);
      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
      };
    } catch (error) {
      console.error('❌ Error sending email:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate HTML email template for customer contact
   * @param {Object} data - Email template data
   * @returns {string} - HTML email body
   */
  generateContactEmailTemplate(data) {
    const {
      customerName,
      venueName,
      bookingDate,
      bookingTime,
      totalPrice,
      customMessage,
      businessOwnerName,
      businessEmail,
    } = data;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f9f9f9;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #98e209 0%, #89cb08 100%);
            color: #010101;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: bold;
          }
          .header p {
            margin: 5px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
          }
          .content {
            padding: 30px 20px;
          }
          .greeting {
            font-size: 18px;
            font-weight: 600;
            color: #010101;
            margin-bottom: 20px;
          }
          .message {
            background-color: #f5f5f5;
            border-left: 4px solid #98e209;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            line-height: 1.8;
          }
          .booking-details {
            background-color: #f9f9f9;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
          }
          .booking-details h3 {
            margin-top: 0;
            color: #010101;
            font-size: 16px;
            font-weight: 600;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #555;
          }
          .detail-value {
            color: #010101;
            text-align: right;
          }
          .cta-button {
            display: inline-block;
            background-color: #98e209;
            color: #010101;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
          }
          .cta-button:hover {
            background-color: #89cb08;
          }
          .footer {
            background-color: #f5f5f5;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #e0e0e0;
          }
          .contact-info {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e0e0e0;
            font-size: 13px;
          }
          .contact-info p {
            margin: 5px 0;
          }
          @media (max-width: 600px) {
            .container {
              margin: 0;
              border-radius: 0;
            }
            .detail-row {
              flex-direction: column;
            }
            .detail-value {
              text-align: left;
              margin-top: 5px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <h1>CourtConnect</h1>
            <p>Your Booking Confirmation</p>
          </div>

          <!-- Content -->
          <div class="content">
            <div class="greeting">Hello ${customerName},</div>

            <!-- Custom Message from Business Owner -->
            ${
              customMessage
                ? `
              <div class="message">
                <strong>${businessOwnerName}</strong> says:<br>
                ${customMessage.replace(/\n/g, '<br>')}
              </div>
            `
                : ''
            }

            <!-- Booking Details -->
            <div class="booking-details">
              <h3>📋 Booking Details</h3>
              <div class="detail-row">
                <span class="detail-label">Venue</span>
                <span class="detail-value">${venueName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date</span>
                <span class="detail-value">${bookingDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time</span>
                <span class="detail-value">${bookingTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Total Price</span>
                <span class="detail-value" style="font-size: 18px; font-weight: bold; color: #98e209;">$${totalPrice}</span>
              </div>
            </div>

            <!-- Contact Information -->
            ${
              businessEmail
                ? `
              <div class="contact-info">
                <p><strong>Questions or need to reschedule?</strong></p>
                <p>Contact us at: <a href="mailto:${businessEmail}" style="color: #98e209;">${businessEmail}</a></p>
              </div>
            `
                : ''
            }

            <!-- Call to Action -->
            <a href="${process.env.BUSINESS_URL || 'http://localhost:3000'}" class="cta-button">View Your Booking</a>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p style="margin: 0;">© 2025 CourtConnect. All rights reserved.</p>
            <p style="margin: 10px 0 0 0; color: #999;">
              This is an automated email. Please do not reply to this address.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Test email service by sending a test email
   * @param {string} testEmail - Email address to send test email to
   * @returns {Promise<Object>} - Test result
   */
  async testEmail(testEmail = null) {
    try {
      if (!this.transporter) {
        return {
          success: false,
          error: 'Email service not initialized. Check .env configuration.',
        };
      }

      const to = testEmail || process.env.EMAIL_USER;

      const result = await this.sendEmail({
        to,
        subject: 'CourtConnect - Test Email',
        html: `
          <h2>Test Email</h2>
          <p>This is a test email from CourtConnect email service.</p>
          <p>If you received this, the email service is working correctly!</p>
          <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
        `,
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Create and export singleton instance
const emailService = new EmailService();

module.exports = emailService;
