const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GmailService {
    constructor() {
        this.gmail = null;
        this.oauth2Client = null;
        this.isAuthenticated = false;
    }

    // Initialize Gmail API with OAuth2
    async initialize() {
        try {
    // Create OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    );

            // Set credentials if available
            if (process.env.GOOGLE_REFRESH_TOKEN) {
                this.oauth2Client.setCredentials({
                    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
                });
            }

            // Initialize Gmail API
            this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
            this.isAuthenticated = true;

            console.log('✅ Gmail API initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Gmail API initialization failed:', error.message);
            this.isAuthenticated = false;
            return false;
        }
    }

    // Generate OAuth2 authorization URL
    getAuthUrl() {
        const scopes = [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.compose'
        ];

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent'
        });
    }

    // Exchange authorization code for tokens
    async getTokens(code) {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);
            return tokens;
        } catch (error) {
            console.error('Error getting tokens:', error);
            throw error;
        }
    }

    // Create email message in RFC 2822 format
    createMessage(to, subject, htmlContent, from = null) {
        const fromEmail = from || process.env.GOOGLE_EMAIL || process.env.ADMIN_EMAIL;
        const fromName = process.env.EMAIL_FROM_NAME || 'AJK Cleaning Company';
        
        const message = [
            `From: ${fromName} <${fromEmail}>`,
            `To: ${to}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            htmlContent
        ].join('\n');

        return Buffer.from(message, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    // Send email using Gmail API
    async sendEmail(to, subject, htmlContent, from = null) {
        try {
            if (!this.isAuthenticated) {
                throw new Error('Gmail API not authenticated');
            }

            const message = this.createMessage(to, subject, htmlContent, from);

            const response = await this.gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: message
                }
            });

            console.log('✅ Email sent successfully:', response.data.id);
            return {
                success: true,
                messageId: response.data.id,
                message: 'Email sent successfully'
            };
        } catch (error) {
            console.error('❌ Error sending email:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to send email'
            };
        }
    }

    // Send notification email to admin
    async sendNotificationEmail(submission) {
        try {
            const adminEmails = this.getAdminEmails();
            if (!adminEmails.length) {
                console.log('No admin emails configured');
                return { success: false, message: 'No admin emails configured' };
            }

            const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c3e50;">New Contact Form Submission - AJK Cleaning</h2>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Name:</strong> ${submission.name}</p>
                        <p><strong>Email:</strong> ${submission.email}</p>
                        <p><strong>Phone:</strong> ${submission.phone || 'Not provided'}</p>
                        <p><strong>Service:</strong> ${submission.service || 'Not specified'}</p>
                        <p><strong>Message:</strong> ${submission.message || 'No message'}</p>
                        <p><strong>Date:</strong> ${new Date(submission.date).toLocaleString()}</p>
                    </div>
                    <p style="color: #666; font-size: 12px;">
                        This is an automated notification from your AJK Cleaning website.
                    </p>
                </div>
            `;

            const results = [];
            for (const adminEmail of adminEmails) {
                const result = await this.sendEmail(
                    adminEmail,
                    'New Contact Form Submission - AJK Cleaning',
                    htmlContent
                );
                results.push({ email: adminEmail, ...result });
            }

            return {
                success: true,
                results: results,
                message: `Notifications sent to ${adminEmails.length} admin(s)`
            };
        } catch (error) {
            console.error('Error sending notification email:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to send notification email'
            };
        }
    }

    // Send confirmation email to customer
    async sendConfirmationEmail(submission) {
        try {
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c3e50;">Thank You for Contacting AJK Cleaning!</h2>
                    <p>Dear ${submission.name},</p>
                    <p>Thank you for reaching out to us. We have received your message and will get back to you within 24 hours.</p>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #2c3e50;">Your Message Details:</h3>
                        <p><strong>Service:</strong> ${submission.service || 'General Inquiry'}</p>
                        <p><strong>Message:</strong> ${submission.message || 'No specific message'}</p>
                        <p><strong>Submitted:</strong> ${new Date(submission.date).toLocaleString()}</p>
                    </div>
                    
                    <p>If you have any urgent questions, please call us directly.</p>
                    <p>Best regards,<br>AJK Cleaning Team</p>
                </div>
            `;

            return await this.sendEmail(
                submission.email,
                'Thank You for Contacting AJK Cleaning',
                htmlContent
            );
        } catch (error) {
            console.error('Error sending confirmation email:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to send confirmation email'
            };
        }
    }

    // Send booking confirmation email
    async sendBookingConfirmation(bookingData) {
        try {
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c3e50;">Booking Confirmation - AJK Cleaning</h2>
                    <p>Dear ${bookingData.name},</p>
                    <p>Your cleaning service has been booked successfully!</p>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #2c3e50;">Booking Details:</h3>
                        <p><strong>Service:</strong> ${bookingData.service}</p>
                        <p><strong>Date:</strong> ${bookingData.date}</p>
                        <p><strong>Time:</strong> ${bookingData.time}</p>
                        <p><strong>Address:</strong> ${bookingData.address}</p>
                        <p><strong>Phone:</strong> ${bookingData.phone}</p>
                        <p><strong>Total:</strong> $${bookingData.total}</p>
                    </div>
                    
                    <p>We will contact you soon to confirm the details.</p>
                    <p>Best regards,<br>AJK Cleaning Team</p>
                </div>
            `;

            return await this.sendEmail(
                bookingData.email,
                'Booking Confirmation - AJK Cleaning',
                htmlContent
            );
        } catch (error) {
            console.error('Error sending booking confirmation:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to send booking confirmation'
            };
        }
    }

    // Get admin emails from environment variables
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

    // Test email functionality
    async testEmail() {
        try {
            const testEmail = 'sugampokharel28@gmail.com';
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c3e50;">Gmail API Test Email</h2>
                    <p>This is a test email to verify that Gmail API integration is working correctly.</p>
                    <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
                    <p>If you receive this email, the Gmail API setup is successful!</p>
                </div>
            `;

            return await this.sendEmail(
                testEmail,
                'Gmail API Test - AJK Cleaning',
                htmlContent
            );
        } catch (error) {
            console.error('Error in test email:', error);
            return {
                success: false,
                error: error.message,
                message: 'Test email failed'
            };
        }
    }
}

// Create singleton instance
const gmailService = new GmailService();

module.exports = gmailService;
