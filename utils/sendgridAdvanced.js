const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');
require('dotenv').config();

class SendGridAdvanced {
    constructor() {
        this.apiKey = process.env.SENDGRID_API_KEY;
        this.fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.ADMIN_EMAIL;
        this.fromName = process.env.SENDGRID_FROM_NAME || 'AJK Cleaning Services';
        
        // Initialize SendGrid
        if (this.apiKey) {
            sgMail.setApiKey(this.apiKey);
            console.log('✅ SendGrid API initialized');
        } else {
            console.log('⚠️  SENDGRID_API_KEY not found - SendGrid API disabled');
        }
    }

    // Send email using SendGrid API (recommended method)
    async sendEmailAPI(to, subject, htmlContent, textContent = null) {
        if (!this.apiKey) {
            throw new Error('SendGrid API key not configured');
        }

        try {
            const msg = {
                to: to,
                from: {
                    email: this.fromEmail,
                    name: this.fromName
                },
                subject: subject,
                html: htmlContent,
                text: textContent || this.stripHtml(htmlContent)
            };

            const response = await sgMail.send(msg);
            console.log(`✅ SendGrid API email sent to ${to}`);
            return {
                success: true,
                messageId: response[0].headers['x-message-id'],
                message: 'Email sent successfully via SendGrid API'
            };
        } catch (error) {
            console.error('❌ SendGrid API email failed:', error.message);
            throw error;
        }
    }

    // Send email using SendGrid SMTP (fallback method)
    async sendEmailSMTP(to, subject, htmlContent, textContent = null) {
        if (!this.apiKey) {
            throw new Error('SendGrid API key not configured');
        }

        try {
            const transporter = nodemailer.createTransporter({
                host: 'smtp.sendgrid.net',
                port: 587,
                secure: false,
                auth: {
                    user: 'apikey',
                    pass: this.apiKey
                }
            });

            const mailOptions = {
                from: `${this.fromName} <${this.fromEmail}>`,
                to: to,
                subject: subject,
                html: htmlContent,
                text: textContent || this.stripHtml(htmlContent)
            };

            const result = await transporter.sendMail(mailOptions);
            console.log(`✅ SendGrid SMTP email sent to ${to}`);
            return {
                success: true,
                messageId: result.messageId,
                message: 'Email sent successfully via SendGrid SMTP'
            };
        } catch (error) {
            console.error('❌ SendGrid SMTP email failed:', error.message);
            throw error;
        }
    }

    // Send email with fallback (API first, then SMTP)
    async sendEmail(to, subject, htmlContent, textContent = null) {
        try {
            // Try API first
            return await this.sendEmailAPI(to, subject, htmlContent, textContent);
        } catch (apiError) {
            console.log('🔄 SendGrid API failed, trying SMTP...');
            try {
                return await this.sendEmailSMTP(to, subject, htmlContent, textContent);
            } catch (smtpError) {
                console.error('❌ Both SendGrid API and SMTP failed');
                throw new Error(`SendGrid failed: API (${apiError.message}), SMTP (${smtpError.message})`);
            }
        }
    }

    // Send booking confirmation email
    async sendBookingConfirmation(bookingData) {
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">Booking Confirmed!</h1>
                    <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">AJK Cleaning Services</p>
                </div>
                
                <div style="padding: 30px;">
                    <p style="font-size: 18px; color: #2c3e50; margin-bottom: 20px;">Dear ${bookingData.name},</p>
                    <p style="color: #4a5568; line-height: 1.6;">Your cleaning service has been successfully booked! We're excited to provide you with our professional cleaning services.</p>
                    
                    <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #667eea;">
                        <h3 style="color: #2c3e50; margin-top: 0;">Booking Details</h3>
                        <div style="display: grid; gap: 10px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span style="font-weight: bold; color: #4a5568;">Service:</span>
                                <span style="color: #2c3e50;">${bookingData.service}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="font-weight: bold; color: #4a5568;">Date:</span>
                                <span style="color: #2c3e50;">${bookingData.date}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="font-weight: bold; color: #4a5568;">Time:</span>
                                <span style="color: #2c3e50;">${bookingData.time}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="font-weight: bold; color: #4a5568;">Duration:</span>
                                <span style="color: #2c3e50;">${bookingData.duration || '2 hours'}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="font-weight: bold; color: #4a5568;">Total:</span>
                                <span style="color: #2c3e50; font-weight: bold;">$${bookingData.total}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="background: #e6fffa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #38b2ac;">
                        <h4 style="color: #2c3e50; margin-top: 0;">What's Next?</h4>
                        <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
                            <li>Our team will contact you within 2 hours to confirm details</li>
                            <li>We'll provide an accurate pricing quote based on your property</li>
                            <li>If needed, we'll schedule a site visit</li>
                            <li>You'll receive a final confirmation 24 hours before service</li>
                        </ul>
                    </div>
                    
                    <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 25px 0;">
                        <h4 style="color: #2c3e50; margin-top: 0;">Contact Information</h4>
                        <p style="margin: 5px 0; color: #4a5568;"><strong>Phone:</strong> ${bookingData.phone}</p>
                        <p style="margin: 5px 0; color: #4a5568;"><strong>Email:</strong> ${bookingData.email}</p>
                        <p style="margin: 5px 0; color: #4a5568;"><strong>Address:</strong> ${bookingData.address}</p>
                    </div>
                    
                    <p style="color: #4a5568; line-height: 1.6;">If you have any questions or need to make changes to your booking, please don't hesitate to contact us.</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <p style="color: #2c3e50; font-weight: bold; margin: 0;">Thank you for choosing AJK Cleaning Services!</p>
                        <p style="color: #4a5568; margin: 5px 0 0 0;">We look forward to serving you.</p>
                    </div>
                </div>
                
                <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #718096; font-size: 12px; margin: 0;">
                        This is an automated confirmation email. Please keep this for your records.<br>
                        AJK Cleaning Services | Email: info@ajkcleaners.de
                    </p>
                </div>
            </div>
        `;

        return await this.sendEmail(bookingData.email, 'Booking Confirmation - AJK Cleaning Services', htmlContent);
    }

    // Send admin notification email
    async sendAdminNotification(notificationData) {
        const adminEmails = this.getAdminEmails();
        if (!adminEmails.length) {
            throw new Error('No admin emails configured');
        }

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
                <div style="background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">🚨 New Booking Alert</h1>
                    <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">AJK Cleaning Services</p>
                </div>
                
                <div style="padding: 30px;">
                    <div style="background: #fff5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e53e3e;">
                        <h3 style="color: #2c3e50; margin-top: 0;">Booking ID: ${notificationData.bookingId}</h3>
                        <p style="color: #4a5568; margin: 0;"><strong>Type:</strong> ${notificationData.type}</p>
                        <p style="color: #4a5568; margin: 0;"><strong>Service:</strong> ${notificationData.service}</p>
                        <p style="color: #4a5568; margin: 0;"><strong>Date:</strong> ${notificationData.date}</p>
                        <p style="color: #4a5568; margin: 0;"><strong>Time:</strong> ${notificationData.time}</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="color: #2c3e50; margin-top: 0;">Customer Details</h4>
                        <p style="margin: 5px 0; color: #4a5568;"><strong>Name:</strong> ${notificationData.customerName}</p>
                        <p style="margin: 5px 0; color: #4a5568;"><strong>Email:</strong> ${notificationData.customerEmail}</p>
                        <p style="margin: 5px 0; color: #4a5568;"><strong>Phone:</strong> ${notificationData.customerPhone}</p>
                        <p style="margin: 5px 0; color: #4a5568;"><strong>Address:</strong> ${notificationData.customerAddress}</p>
                    </div>
                    
                    <div style="background: #e6fffa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #38b2ac;">
                        <h4 style="color: #2c3e50; margin-top: 0;">Required Actions</h4>
                        <ol style="color: #4a5568; margin: 0; padding-left: 20px;">
                            <li>Contact customer within 2 hours</li>
                            <li>Confirm booking details and schedule</li>
                            <li>Provide accurate pricing quote</li>
                            <li>Schedule site visit if needed</li>
                            <li>Update booking status in admin panel</li>
                        </ol>
                    </div>
                    
                    <p style="color: #4a5568; line-height: 1.6;">Please take immediate action on this new booking request.</p>
                </div>
            </div>
        `;

        const results = [];
        for (const adminEmail of adminEmails) {
            try {
                const result = await this.sendEmail(adminEmail, 'New Booking Alert - AJK Cleaning Services', htmlContent);
                results.push({ email: adminEmail, success: true, ...result });
            } catch (error) {
                results.push({ email: adminEmail, success: false, error: error.message });
            }
        }

        return results;
    }

    // Test email functionality
    async testEmail(testEmail = null) {
        const email = testEmail || process.env.TEST_EMAIL || 'sugampokharel28@gmail.com';
        
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2c3e50;">SendGrid Test Email</h2>
                <p>This is a test email to verify that SendGrid integration is working correctly.</p>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Test Details:</strong></p>
                    <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>Method:</strong> SendGrid Advanced Service</p>
                    <p><strong>From:</strong> ${this.fromEmail}</p>
                    <p><strong>To:</strong> ${email}</p>
                </div>
                <p>If you receive this email, SendGrid is working correctly!</p>
            </div>
        `;

        return await this.sendEmail(email, 'SendGrid Test - AJK Cleaning Services', htmlContent);
    }

    // Get admin emails from environment
    getAdminEmails() {
        const adminEmails = process.env.ADMIN_EMAILS;
        const notificationEmail = process.env.NOTIFICATION_EMAIL;
        
        if (adminEmails) {
            return adminEmails.split(',').map(email => email.trim());
        } else if (notificationEmail) {
            return [notificationEmail];
        } else {
            return ['sugampokharel28@gmail.com']; // Default fallback
        }
    }

    // Strip HTML tags for text content
    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
}

// Create singleton instance
const sendGridAdvanced = new SendGridAdvanced();

module.exports = sendGridAdvanced;
