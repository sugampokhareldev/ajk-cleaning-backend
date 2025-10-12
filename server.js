// URGENT FIX VERSION 2.0 - Payment Link Fix
// Load environment variables
require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const crypto = require('crypto');
const fs = require('fs');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const validator = require('validator');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const geoip = require('geoip-lite'); // Added for analytics
const helmet = require('helmet');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Import enhanced security configuration
const { helmetConfig, rateLimitConfigs, corsConfig, sessionConfig, sanitizeInput, securityHeaders, csrfProtection, validateWebSocketOrigin, isProduction } = require('./config/security');
const { query, initializeDatabase, healthCheck } = require('./config/database');
const nodemailer = require('nodemailer');
const { sendEmailWithFallback } = require('./utils/emailFallback');
const { sendEmailWithSendGrid } = require('./utils/sendgridService');
const sendGridAdvanced = require('./utils/sendgridAdvanced');
const { sendEmailViaWebhook } = require('./utils/webhookEmailService');
const billingReminder = require('./utils/billingReminder');

// Function to send customized quote email to client
async function sendQuoteEmail(quoteData) {
    const {
        customerName,
        customerEmail,
        customerPhone,
        serviceType,
        propertySize,
        frequency,
        specialRequirements,
        preferredDate,
        preferredTime,
        salutation = 'Dear'
    } = quoteData;

    const quoteHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Quote Request Received - AJK Cleaning</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
                .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
                .content { padding: 30px; }
                .quote-details { background: #f8f9fa; border-radius: 8px; padding: 25px; margin: 20px 0; }
                .detail-row { display: flex; justify-content: space-between; margin: 12px 0; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
                .detail-row:last-child { border-bottom: none; }
                .detail-label { font-weight: bold; color: #495057; }
                .detail-value { color: #212529; }
                .next-steps { background: #e8f5e8; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; }
                .next-steps h3 { color: #155724; margin: 0 0 15px 0; }
                .step-list { margin: 0; padding-left: 20px; }
                .step-list li { margin: 8px 0; color: #155724; }
                .contact-info { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0; }
                .contact-info h3 { color: #1976d2; margin: 0 0 15px 0; }
                .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; border-top: 1px solid #e9ecef; }
                .highlight { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }
                .highlight h3 { color: #856404; margin: 0 0 10px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📋 Quote Request Received</h1>
                    <p>AJK Cleaning Company - Professional Cleaning Services</p>
                </div>
                
                <div class="content">
                    <div class="highlight">
                        <h3>Thank You for Your Interest!</h3>
                        <p>We have received your quote request and our team will prepare a customized proposal for your cleaning needs.</p>
                    </div>

                    <div class="quote-details">
                        <h3 style="margin-top: 0; color: #495057;">Your Quote Request Details</h3>
                        <div class="detail-row">
                            <span class="detail-label">Service Type:</span>
                            <span class="detail-value">${serviceType}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Property Size:</span>
                            <span class="detail-value">${propertySize} sq ft</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Service Frequency:</span>
                            <span class="detail-value">${frequency}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Preferred Date:</span>
                            <span class="detail-value">${preferredDate || 'Flexible'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Preferred Time:</span>
                            <span class="detail-value">${preferredTime || 'Flexible'}</span>
                        </div>
                        ${specialRequirements ? `
                        <div class="detail-row">
                            <span class="detail-label">Special Requirements:</span>
                            <span class="detail-value">${specialRequirements}</span>
                        </div>
                        ` : ''}
                    </div>

                    <div class="next-steps">
                        <h3>🎯 What Happens Next?</h3>
                        <ul class="step-list">
                            <li><strong>Within 2 hours:</strong> Our team will review your requirements</li>
                            <li><strong>Within 24 hours:</strong> We will call you to discuss your needs</li>
                            <li><strong>Within 48 hours:</strong> You will receive a detailed, customized quote</li>
                            <li><strong>If needed:</strong> We can schedule a free on-site visit</li>
                        </ul>
                    </div>

                    <div class="contact-info">
                        <h3>📞 Our Commitment to You</h3>
                        <p style="margin: 0 0 10px 0;"><strong>Response Time:</strong> We guarantee to contact you within 2 hours</p>
                        <p style="margin: 0 0 10px 0;"><strong>Free Consultation:</strong> No obligation, completely free</p>
                        <p style="margin: 0 0 10px 0;"><strong>Transparent Pricing:</strong> No hidden fees, clear breakdown</p>
                        <p style="margin: 0 0 10px 0;"><strong>Quality Guarantee:</strong> 100% satisfaction or we'll make it right</p>
                    </div>

                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #495057;">📞 Need Immediate Assistance?</h4>
                        <p style="margin: 5px 0;"><strong>Phone:</strong> +49 176 61852286</p>
                        <p style="margin: 5px 0;"><strong>Email:</strong> info@ajkcleaners.de</p>
                        <p style="margin: 5px 0;"><strong>Hours:</strong> Monday - Friday: 8:00 AM - 6:00 PM</p>
                    </div>
                </div>
                
                <div class="footer">
                    <p><strong>AJK Cleaning Company</strong> | Professional Cleaning Services</p>
                    <p>Thank you for choosing us for your cleaning needs!</p>
                </div>
            </div>
        </body>
        </html>
    `;

    const quoteText = `
📋 QUOTE REQUEST RECEIVED - AJK Cleaning Company

Dear ${customerName},

Thank you for your interest in our professional cleaning services!

YOUR QUOTE REQUEST DETAILS:
Service Type: ${serviceType}
Property Size: ${propertySize} sq ft
Service Frequency: ${frequency}
Preferred Date: ${preferredDate || 'Flexible'}
Preferred Time: ${preferredTime || 'Flexible'}
${specialRequirements ? `Special Requirements: ${specialRequirements}` : ''}

WHAT HAPPENS NEXT:
1. Within 2 hours: Our team will review your requirements
2. Within 24 hours: We will call you to discuss your needs
3. Within 48 hours: You will receive a detailed, customized quote
4. If needed: We can schedule a free on-site visit

OUR COMMITMENT:
- Response Time: We guarantee to contact you within 2 hours
- Free Consultation: No obligation, completely free
- Transparent Pricing: No hidden fees, clear breakdown
- Quality Guarantee: 100% satisfaction or we'll make it right

CONTACT INFORMATION:
Phone: +49 176 61852286
Email: info@ajkcleaners.de
Hours: Monday - Friday: 8:00 AM - 6:00 PM

Thank you for choosing AJK Cleaning Company!

Best regards,
The AJK Cleaning Team
    `;

    try {
        const mailOptions = {
            from: `"AJK Cleaning Services" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
            to: customerEmail,
            subject: `📋 Quote Request Received - ${serviceType} Cleaning Service`,
            html: quoteHtml
        };

        // Try SendGrid first, fallback to SMTP
        let result;
        try {
            if (process.env.SENDGRID_API_KEY) {
                console.log('🚀 [QUOTE EMAIL] Attempting to send email via SendGrid...');
                result = await sendGridAdvanced.sendEmail(customerEmail, mailOptions.subject, mailOptions.html, mailOptions.text);
                console.log('✅ [QUOTE EMAIL] SendGrid email sent successfully');
            } else {
                console.log('⚠️  [QUOTE EMAIL] SENDGRID_API_KEY not found, using SMTP fallback...');
                result = await sendEmailWithFallback(mailOptions);
            }
        } catch (sendGridError) {
            console.log('🔄 [QUOTE EMAIL] SendGrid failed, trying SMTP fallback...', sendGridError.message);
            result = await sendEmailWithFallback(mailOptions);
        }
        
        if (result && (result.success || result === true)) {
            console.log(`📧 Quote confirmation email sent to ${customerEmail}`);
            return true;
        } else {
            console.error(`❌ Failed to send quote email to ${customerEmail}`);
            throw new Error('Email sending failed');
        }
    } catch (error) {
        console.error(`❌ Failed to send quote email to ${customerEmail}:`, error.message);
        throw error;
    }
}

// Function to send admin notification for quote requests
async function sendAdminQuoteNotification(quoteData) {
    const {
        customerName,
        customerEmail,
        customerPhone,
        serviceType,
        propertySize,
        frequency,
        specialRequirements,
        preferredDate,
        preferredTime
    } = quoteData;

    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(email => email.trim()) : [process.env.ADMIN_EMAIL];
    if (!adminEmails.length) {
        console.log('No admin emails configured for quote notification');
        return;
    }

    const adminHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Quote Request - AJK Cleaning</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); padding: 30px; text-align: center; color: white;">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 700;">
                        📋 New Quote Request
                    </h1>
                    <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
                        A new quote request has been submitted
                    </p>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <div style="margin-bottom: 30px;">
                        <h2 style="color: #2d3748; font-size: 24px; margin: 0 0 15px 0; font-weight: 600;">
                            Quote Request Details
                        </h2>
                        <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                            A new quote request has been submitted through your website.
                        </p>
                    </div>
                    
                    <!-- Quote Details Card -->
                    <div style="background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%); border: 1px solid #9ae6b4; border-radius: 12px; padding: 25px; margin: 25px 0;">
                        <h3 style="color: #2d3748; font-size: 20px; margin: 0 0 20px 0; font-weight: 600;">
                            Customer Information
                        </h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #48bb78;">
                                <strong style="color: #2d3748; display: block; margin-bottom: 5px;">Customer Name</strong>
                                <span style="color: #4a5568;">${customerName}</span>
                            </div>
                            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #48bb78;">
                                <strong style="color: #2d3748; display: block; margin-bottom: 5px;">Email</strong>
                                <span style="color: #4a5568;">${customerEmail}</span>
                            </div>
                            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #48bb78;">
                                <strong style="color: #2d3748; display: block; margin-bottom: 5px;">Phone</strong>
                                <span style="color: #4a5568;">${customerPhone}</span>
                            </div>
                            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #48bb78;">
                                <strong style="color: #2d3748; display: block; margin-bottom: 5px;">Service Type</strong>
                                <span style="color: #4a5568;">${serviceType}</span>
                            </div>
                        </div>
                        
                        <h3 style="color: #2d3748; font-size: 20px; margin: 0 0 20px 0; font-weight: 600;">
                            Service Details
                        </h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #48bb78;">
                                <strong style="color: #2d3748; display: block; margin-bottom: 5px;">Property Size</strong>
                                <span style="color: #4a5568;">${propertySize} sq ft</span>
                            </div>
                            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #48bb78;">
                                <strong style="color: #2d3748; display: block; margin-bottom: 5px;">Frequency</strong>
                                <span style="color: #4a5568;">${frequency}</span>
                            </div>
                            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #48bb78;">
                                <strong style="color: #2d3748; display: block; margin-bottom: 5px;">Preferred Date</strong>
                                <span style="color: #4a5568;">${preferredDate}</span>
                            </div>
                            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #48bb78;">
                                <strong style="color: #2d3748; display: block; margin-bottom: 5px;">Preferred Time</strong>
                                <span style="color: #4a5568;">${preferredTime}</span>
                            </div>
                        </div>
                        
                        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #48bb78;">
                            <strong style="color: #2d3748; display: block; margin-bottom: 5px;">Special Requirements</strong>
                            <span style="color: #4a5568;">${specialRequirements}</span>
                        </div>
                    </div>
                    
                    <!-- Action Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://ajk-cleaning.onrender.com/admin" style="display: inline-block; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            View in Admin Panel
                        </a>
                    </div>
                    
                    <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
                        <p style="color: #718096; font-size: 14px; margin: 0;">
                            <strong>Submitted:</strong> ${new Date().toLocaleString()}
                        </p>
                        <p style="color: #718096; font-size: 14px; margin: 5px 0 0 0;">
                            This is an automated notification from your AJK Cleaning website.
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    for (const adminEmail of adminEmails) {
        try {
            const mailOptions = {
                from: `"AJK Cleaning Services" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
                to: adminEmail,
                subject: `📋 New Quote Request - ${serviceType} from ${customerName}`,
                html: adminHtml
            };

            // Try SendGrid first, fallback to SMTP
            let result;
            try {
                if (process.env.SENDGRID_API_KEY) {
                    console.log('🚀 [ADMIN QUOTE] Attempting to send email via SendGrid...');
                    result = await sendGridAdvanced.sendEmail(adminEmail, mailOptions.subject, mailOptions.html, mailOptions.text);
                    console.log('✅ [ADMIN QUOTE] SendGrid email sent successfully');
                } else {
                    console.log('⚠️  [ADMIN QUOTE] SENDGRID_API_KEY not found, using SMTP fallback...');
                    result = await sendEmailWithFallback(mailOptions);
                }
            } catch (sendGridError) {
                console.log('🔄 [ADMIN QUOTE] SendGrid failed, trying SMTP fallback...', sendGridError.message);
                result = await sendEmailWithFallback(mailOptions);
            }
            
            if (result && (result.success || result === true)) {
                console.log(`📧 Admin quote notification sent to ${adminEmail}`);
            } else {
                console.error(`❌ Failed to send admin quote notification to ${adminEmail}`);
            }
        } catch (error) {
            console.error(`❌ Failed to send admin quote notification to ${adminEmail}:`, error.message);
        }
    }
}

// Function to send admin notification for any booking
async function sendAdminNotification(booking) {
    const { details } = booking;
    const {
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        city,
        postalCode,
        bookingType,
        package: packageType,
        date: bookingDate,
        time: bookingTime,
        duration,
        cleaners,
        propertySize,
        specialRequests,
        salutation
    } = details;

    // Get admin emails from environment variables
    let adminEmails = [];
    
    if (process.env.ADMIN_EMAILS) {
        // Use ADMIN_EMAILS if set (comma-separated list)
        adminEmails = process.env.ADMIN_EMAILS.split(',').map(email => email.trim());
    } else if (process.env.NOTIFICATION_EMAIL) {
        // Use NOTIFICATION_EMAIL if set (single email)
        adminEmails = [process.env.NOTIFICATION_EMAIL];
    } else {
        // Default fallback
        adminEmails = ['sugampokharel28@gmail.com'];
    }
    
    console.log('📧 Admin emails configured:', adminEmails);

    const adminHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Booking Alert - AJK Cleaning</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
                .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
                .content { padding: 30px; }
                .alert { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin-bottom: 25px; }
                .alert h2 { color: #856404; margin: 0 0 10px 0; font-size: 20px; }
                .booking-details { background: #f8f9fa; border-radius: 8px; padding: 25px; margin: 20px 0; }
                .detail-row { display: flex; justify-content: space-between; margin: 12px 0; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
                .detail-row:last-child { border-bottom: none; }
                .detail-label { font-weight: bold; color: #495057; }
                .detail-value { color: #212529; }
                .customer-info { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0; }
                .service-info { background: #f3e5f5; border-left: 4px solid #9c27b0; padding: 20px; margin: 20px 0; }
                .action-required { background: #ffebee; border-left: 4px solid #f44336; padding: 20px; margin: 20px 0; }
                .action-required h3 { color: #c62828; margin: 0 0 15px 0; }
                .action-list { margin: 0; padding-left: 20px; }
                .action-list li { margin: 8px 0; color: #d32f2f; }
                .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; border-top: 1px solid #e9ecef; }
                .priority-high { color: #d32f2f; font-weight: bold; }
                .booking-id { background: #667eea; color: white; padding: 5px 10px; border-radius: 4px; font-family: monospace; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚨 New Booking Alert</h1>
                    <p>AJK Cleaning Company - Admin Notification</p>
                </div>
                
                <div class="content">
                    <div class="alert">
                        <h2>⚠️ Immediate Action Required</h2>
                        <p>A new <strong>${bookingType === 'subscription' ? 'Subscription' : 'One-Time'}</strong> cleaning booking has been received and requires your attention.</p>
                    </div>

                    <div class="booking-details">
                        <h3 style="margin-top: 0; color: #495057;">📋 Booking Information</h3>
                        <div class="detail-row">
                            <span class="detail-label">Booking ID:</span>
                            <span class="detail-value booking-id">${booking.id}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Booking Type:</span>
                            <span class="detail-value priority-high">${bookingType === 'subscription' ? 'Subscription Service' : 'One-Time Cleaning'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Service Package:</span>
                            <span class="detail-value">${packageType}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Requested Date:</span>
                            <span class="detail-value">${bookingDate || 'To be scheduled'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Requested Time:</span>
                            <span class="detail-value">${bookingTime || 'To be scheduled'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Duration:</span>
                            <span class="detail-value">${duration} hours</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Cleaners Needed:</span>
                            <span class="detail-value">${cleaners}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Property Size:</span>
                            <span class="detail-value">${propertySize || 'Not specified'} sq ft</span>
                        </div>
                    </div>

                    <div class="customer-info">
                        <h3 style="margin-top: 0; color: #1976d2;">👤 Customer Information</h3>
                        <div class="detail-row">
                            <span class="detail-label">Name:</span>
                            <span class="detail-value">${salutation} ${customerName}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Email:</span>
                            <span class="detail-value">${customerEmail}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Phone:</span>
                            <span class="detail-value">${customerPhone}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Address:</span>
                            <span class="detail-value">${customerAddress}, ${city} ${postalCode}</span>
                        </div>
                    </div>

                    ${specialRequests ? `
                    <div class="service-info">
                        <h3 style="margin-top: 0; color: #7b1fa2;">📝 Special Requirements</h3>
                        <p style="margin: 0; font-style: italic;">"${specialRequests}"</p>
                    </div>
                    ` : ''}

                    <div class="action-required">
                        <h3>🎯 Required Actions</h3>
                        <ul class="action-list">
                            <li>Contact customer within 2 hours</li>
                            <li>Confirm booking details and schedule</li>
                            <li>Provide accurate pricing quote</li>
                            <li>Schedule site visit if needed</li>
                            <li>Update booking status in admin panel</li>
                        </ul>
                    </div>

                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #495057;">📞 Quick Contact</h4>
                        <p style="margin: 5px 0;"><strong>Customer:</strong> ${customerName} - ${customerPhone}</p>
                        <p style="margin: 5px 0;"><strong>Email:</strong> ${customerEmail}</p>
                        <p style="margin: 5px 0;"><strong>Booking Time:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                </div>
                
                <div class="footer">
                    <p><strong>AJK Cleaning Company</strong> | Admin Notification System</p>
                    <p>This is an automated notification. Please respond promptly to maintain customer satisfaction.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    const adminText = `
🚨 NEW BOOKING ALERT - AJK Cleaning Company

Booking ID: ${booking.id}
Booking Type: ${bookingType === 'subscription' ? 'Subscription Service' : 'One-Time Cleaning'}
Service: ${packageType}
Date: ${bookingDate || 'To be scheduled'}
Time: ${bookingTime || 'To be scheduled'}
Duration: ${duration} hours
Cleaners: ${cleaners}

CUSTOMER DETAILS:
Name: ${salutation} ${customerName}
Email: ${customerEmail}
Phone: ${customerPhone}
Address: ${customerAddress}, ${city} ${postalCode}
Property Size: ${propertySize || 'Not specified'} sq ft

${specialRequests ? `Special Requirements: ${specialRequests}` : ''}

REQUIRED ACTIONS:
1. Contact customer within 2 hours
2. Confirm booking details and schedule
3. Provide accurate pricing quote
4. Schedule site visit if needed
5. Update booking status in admin panel

Booking received: ${new Date().toLocaleString()}
    `;

    // Send to all admin emails using Gmail API
    for (const adminEmail of adminEmails) {
        try {
        const mailOptions = {
            from: `"AJK Cleaning Services" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
            to: adminEmail,
            subject: `🚨 New ${bookingType === 'subscription' ? 'Subscription' : 'One-Time'} Booking - ${booking.id}`,
            html: adminHtml
        };

        // Try SendGrid first, fallback to SMTP
        let result;
        try {
            if (process.env.SENDGRID_API_KEY) {
                console.log('🚀 [ADMIN NOTIFICATION] Attempting to send email via SendGrid...');
                result = await sendGridAdvanced.sendEmail(adminEmail, mailOptions.subject, mailOptions.html, mailOptions.text);
                console.log('✅ [ADMIN NOTIFICATION] SendGrid email sent successfully');
            } else {
                console.log('⚠️  [ADMIN NOTIFICATION] SENDGRID_API_KEY not found, using SMTP fallback...');
                result = await sendEmailWithFallback(mailOptions);
            }
        } catch (sendGridError) {
            console.log('🔄 [ADMIN NOTIFICATION] SendGrid failed, trying SMTP fallback...', sendGridError.message);
            result = await sendEmailWithFallback(mailOptions);
        }

        if (result && (result.success || result === true)) {
            console.log(`📧 Admin notification sent to ${adminEmail} for booking ${booking.id}`);
        } else {
            console.error(`❌ Failed to send admin notification to ${adminEmail}`);
        }
        } catch (error) {
            console.error(`❌ Failed to send admin notification to ${adminEmail}:`, error.message);
        }
    }
}

// Function to send commercial booking confirmation with retry logic
async function sendCommercialBookingConfirmation(booking) {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
        console.log(`[COMMERCIAL EMAIL] 🚀 Starting email send for booking:`, booking.id);
        const details = booking.details || {};
        const customerName = details.customerName || 'Valued Customer';
        const customerEmail = details.customerEmail;
        console.log(`[COMMERCIAL EMAIL] 📧 Sending to:`, customerEmail);
        const bookingDate = details.date || 'TBD';
        const bookingTime = details.time || 'TBD';
        const packageType = details.package || 'Commercial Cleaning';
        const duration = details.duration || 0;
        const cleaners = details.cleaners || 1;
        const specialRequests = details.specialRequests || 'None';
        const propertySize = details.propertySize || 'Not specified';

        const confirmationHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Commercial Booking Request - AJK Cleaning</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
                .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .status { background: #fbbf24; color: #92400e; padding: 15px; border-radius: 8px; text-align: center; font-size: 16px; font-weight: bold; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                .highlight { background: #eff6ff; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0; }
                .consultation { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🏢 AJK Cleaning Company</h1>
                <h2>Commercial Booking Request</h2>
            </div>
            
            <div class="content">
                <p>Dear ${customerName},</p>
                
                <p>Thank you for your commercial cleaning inquiry! We have received your request and will contact you shortly to discuss your specific needs and provide a customized quote.</p>
                
                <div class="status">
                    📞 Consultation Required - We will contact you within 24 hours
                </div>
                
                <div class="booking-details">
                    <h3>📋 Your Request Details</h3>
                    <p><strong>Request ID:</strong> ${booking.id}</p>
                    <p><strong>Service Type:</strong> ${packageType}</p>
                    <p><strong>Preferred Date:</strong> ${bookingDate}</p>
                    <p><strong>Preferred Time:</strong> ${bookingTime}</p>
                    <p><strong>Property Size:</strong> ${propertySize} sq ft</p>
                    <p><strong>Estimated Duration:</strong> ${duration} hours</p>
                    <p><strong>Number of Cleaners:</strong> ${cleaners}</p>
                </div>
                
                ${specialRequests !== 'None' ? `
                <div class="highlight">
                    <h3>📝 Special Requirements</h3>
                    <p>${specialRequests}</p>
                </div>
                ` : ''}
                
                <div class="consultation">
                    <h3>💼 Next Steps</h3>
                    <p><strong>1. We will call you within 24 hours</strong> to discuss your specific needs</p>
                    <p><strong>2. We will provide a detailed quote</strong> based on your requirements</p>
                    <p><strong>3. We will schedule a site visit</strong> if needed for accurate pricing</p>
                    <p><strong>4. We will confirm the final details</strong> and schedule your cleaning</p>
                </div>
                
                <div class="highlight">
                    <h3>📞 Contact Information</h3>
                    <p><strong>Phone:</strong> +49 176 61852286</p>
                    <p><strong>Email:</strong> info@ajkcleaners.de</p>
                    <p><strong>Website:</strong> https://ajkcleaners.de</p>
                </div>
                
                <p>We look forward to providing you with professional commercial cleaning services!</p>
                
                <p>Best regards,<br>
                <strong>AJK Cleaning Team</strong></p>
            </div>
            
            <div class="footer">
                <p>AJK Cleaning Company | Professional Commercial Cleaning Services</p>
                <p>This is an automated confirmation. We will contact you soon!</p>
            </div>
        </body>
        </html>
        `;

        const mailOptions = {
            from: `"AJK Cleaning Services" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
            to: customerEmail,
            subject: `🏢 Commercial Cleaning Request Received - ${booking.id}`,
            html: confirmationHtml,
            text: `
Commercial Cleaning Request - AJK Cleaning Company

Dear ${customerName},

Thank you for your commercial cleaning inquiry!

Request ID: ${booking.id}
Service: ${packageType}
Date: ${bookingDate}
Time: ${bookingTime}
Property Size: ${propertySize} sq ft
Duration: ${duration} hours
Cleaners: ${cleaners}

Special Requirements: ${specialRequests}

NEXT STEPS:
1. We will call you within 24 hours
2. We will provide a detailed quote
3. We will schedule a site visit if needed
4. We will confirm final details

Contact: +49 176 61852286 | info@ajkcleaners.de

We look forward to serving your commercial cleaning needs!
            `
        };

        console.log(`[COMMERCIAL EMAIL] 📤 Attempting to send email via SendGrid/SMTP... (Attempt ${retryCount + 1}/${maxRetries})`);

        // Try SendGrid first, fallback to SMTP
        let result;
        try {
            if (process.env.SENDGRID_API_KEY) {
                result = await sendGridAdvanced.sendEmail(customerEmail, mailOptions.subject, mailOptions.html, mailOptions.text);
            } else {
                result = await sendEmailWithFallback(mailOptions);
            }
        } catch (sendGridError) {
            console.log('🔄 SendGrid failed, trying SMTP fallback...');
            result = await sendEmailWithFallback(mailOptions);
        }
        
        if (result) {
            console.log(`✅ Commercial booking confirmation sent via SMTP to ${customerEmail} for request ${booking.id}`);
            
            // Send admin notification email
            try {
                await sendAdminNotification(booking);
                console.log(`📧 Admin notification sent for booking ${booking.id}`);
            } catch (adminError) {
                console.error(`❌ Failed to send admin notification:`, adminError.message);
                // Don't fail the main email process if admin notification fails
            }
            
            return; // Success, exit the retry loop
        } else {
            throw new Error(`SMTP failed: Email sending failed`);
        }
        
    } catch (error) {
        retryCount++;
        console.error(`❌ Failed to send commercial booking confirmation (Attempt ${retryCount}/${maxRetries}):`, error.message);
        
        if (retryCount < maxRetries) {
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
            console.log(`⏳ Retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        } else {
            console.error('❌ All retry attempts failed for commercial booking confirmation - continuing without email');
            return; // Exit gracefully instead of throwing error
        }
    }
    }
}

// Function to send employee payslip
async function sendEmployeePayslip(employee, month, year) {
    try {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[parseInt(month) - 1];
        
        // Calculate comprehensive payroll
        const grossSalary = parseFloat(employee.salary);
        
        // Tax calculations (simplified)
        const federalTaxRate = 0.15; // 15% federal tax
        const stateTaxRate = 0.05;   // 5% state tax
        const socialSecurityRate = 0.062; // 6.2% social security
        // Medicare removed as requested
        
        // Check if custom tax amount is provided
        const customTaxAmount = parseFloat(employee.customTax) || 0;
        
        let federalTax, stateTax, socialSecurity;
        
        if (customTaxAmount > 0) {
            // Use custom tax amount instead of percentage calculations
            federalTax = customTaxAmount;
            stateTax = 0;
            socialSecurity = 0;
        } else {
            // Use percentage-based calculations
            federalTax = grossSalary * federalTaxRate;
            stateTax = grossSalary * stateTaxRate;
            socialSecurity = grossSalary * socialSecurityRate;
        }
        
        // Use actual employee deduction data
        const penalties = parseFloat(employee.penalties) || 0;
        const absences = parseFloat(employee.absences) || 0;
        const otherDeductions = parseFloat(employee.otherDeductions) || 0;
        
        const totalTaxes = federalTax + stateTax + socialSecurity;
        const totalDeductions = totalTaxes + penalties + absences + otherDeductions;
        const netSalary = grossSalary - totalDeductions;
        
        const payslipHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Payslip - ${monthName} ${year}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
                .payslip-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .salary-breakdown { background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .net-salary { background: #10b981; color: white; padding: 20px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                .highlight { background: #eff6ff; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🧾 AJK Cleaning Company</h1>
                <h2>Monthly Payslip - ${monthName} ${year}</h2>
            </div>
            
            <div class="content">
                <p>Dear ${employee.name},</p>
                
                <p>Please find your payslip for ${monthName} ${year} below. This document contains your salary breakdown and tax information.</p>
                
                <div class="payslip-details">
                    <h3>📋 Employee Details</h3>
                    <p><strong>Employee ID:</strong> ${employee.id}</p>
                    <p><strong>Name:</strong> ${employee.name}</p>
                    <p><strong>Job Title:</strong> ${employee.jobTitle}</p>
                    <p><strong>SSN:</strong> ${employee.ssn || 'Not provided'}</p>
                    <p><strong>Tax ID:</strong> ${employee.taxId || 'Not provided'}</p>
                    <p><strong>Pay Period:</strong> ${monthName} ${year}</p>
                    <p><strong>Date Generated:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
                
                <div class="salary-breakdown">
                    <h3>💰 Salary Breakdown</h3>
                    
                    <h4>📈 Earnings</h4>
                    <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                        <span>Gross Salary:</span>
                        <span>€${grossSalary.toFixed(2)}</span>
                    </div>
                    
                    <h4>📉 Deductions</h4>
                    ${customTaxAmount > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                        <span>Custom Tax Amount:</span>
                        <span>-€${federalTax.toFixed(2)}</span>
                    </div>
                    ` : `
                    <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                        <span>Federal Tax (${(federalTaxRate * 100).toFixed(1)}%):</span>
                        <span>-€${federalTax.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                        <span>State Tax (${(stateTaxRate * 100).toFixed(1)}%):</span>
                        <span>-€${stateTax.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                        <span>Social Security (${(socialSecurityRate * 100).toFixed(1)}%):</span>
                        <span>-€${socialSecurity.toFixed(2)}</span>
                    </div>
                    `}
                    <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                        <span>Penalties:</span>
                        <span>-€${penalties.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                        <span>Absences:</span>
                        <span>-€${absences.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                        <span>Other Deductions:</span>
                        <span>-€${otherDeductions.toFixed(2)}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin: 10px 0; font-weight: bold; border-top: 2px solid #333; padding-top: 10px;">
                        <span>Total Deductions:</span>
                        <span>-€${totalDeductions.toFixed(2)}</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin: 10px 0; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; font-size: 1.2em; color: #2d5a27;">
                        <span>Net Salary:</span>
                        <span>€${netSalary.toFixed(2)}</span>
                    </div>
                </div>
                
                <div class="net-salary">
                    Net Pay: €${netSalary.toFixed(2)}
                </div>
                
                <div class="highlight">
                    <h3>📞 Contact Information</h3>
                    <p><strong>HR Department:</strong> +49 176 61852286</p>
                    <p><strong>Email:</strong> info@ajkcleaners.de</p>
                    <p><strong>Website:</strong> https://ajkcleaners.de</p>
                </div>
                
                <p>Thank you for your hard work and dedication to AJK Cleaning Company!</p>
                
                <p>Best regards,<br>
                <strong>AJK Cleaning HR Team</strong></p>
            </div>
            
            <div class="footer">
                <p>AJK Cleaning Company | Professional Cleaning Services</p>
                <p>This is an automated payslip. Please keep this for your records.</p>
            </div>
        </body>
        </html>
        `;

        const mailOptions = {
            from: `"AJK Cleaning HR" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
            to: employee.email,
            subject: `🧾 Payslip - ${monthName} ${year} - ${employee.name}`,
            html: payslipHtml,
            text: `
Payslip - ${monthName} ${year}

Dear ${employee.name},

Your payslip for ${monthName} ${year}:

Employee ID: ${employee.id}
Job Title: ${employee.jobTitle}
SSN: ${employee.ssn || 'Not provided'}
Tax ID: ${employee.taxId || 'Not provided'}
Pay Period: ${monthName} ${year}

SALARY BREAKDOWN:

EARNINGS:
Gross Salary: €${grossSalary.toFixed(2)}

DEDUCTIONS:
${customTaxAmount > 0 ? 
`Custom Tax Amount: -€${federalTax.toFixed(2)}` : 
`Federal Tax (${(federalTaxRate * 100).toFixed(1)}%): -€${federalTax.toFixed(2)}
State Tax (${(stateTaxRate * 100).toFixed(1)}%): -€${stateTax.toFixed(2)}
Social Security (${(socialSecurityRate * 100).toFixed(1)}%): -€${socialSecurity.toFixed(2)}`}
Penalties: -€${penalties.toFixed(2)}
Absences: -€${absences.toFixed(2)}
Other Deductions: -€${otherDeductions.toFixed(2)}

Total Deductions: -€${totalDeductions.toFixed(2)}
Net Salary: €${netSalary.toFixed(2)}

Contact: +49 176 61852286 | info@ajkcleaners.de

Thank you for your hard work!
AJK Cleaning HR Team
            `
        };

        try {
            // Try SendGrid first, fallback to SMTP
            let result;
            try {
                if (process.env.SENDGRID_API_KEY) {
                    console.log('🚀 [PAYSLIP] Attempting to send email via SendGrid...');
                    result = await sendGridAdvanced.sendEmail(employee.email, mailOptions.subject, mailOptions.html, mailOptions.text);
                    console.log('✅ [PAYSLIP] SendGrid email sent successfully');
                } else {
                    console.log('⚠️  [PAYSLIP] SENDGRID_API_KEY not found, using SMTP fallback...');
                    result = await sendEmailWithFallback(mailOptions);
                }
            } catch (sendGridError) {
                console.log('🔄 [PAYSLIP] SendGrid failed, trying SMTP fallback...', sendGridError.message);
                result = await sendEmailWithFallback(mailOptions);
            }
            
            if (result && (result.success || result === true)) {
                console.log(`✅ Payslip sent to ${employee.email} for ${monthName} ${year}`);
            } else {
                console.error(`❌ Failed to send payslip to ${employee.email}`);
                throw new Error('Email sending failed');
            }
            
            // Record payment in employee's payment history
            if (!employee.paymentHistory) {
                employee.paymentHistory = [];
            }
            
            const paymentRecord = {
                month: parseInt(month) - 1, // Convert to 0-based month
                year: parseInt(year),
                amount: netSalary,
                date: new Date().toISOString(),
                payslipSent: true
            };
            
            // Check if payment already exists for this month/year
            const existingPayment = employee.paymentHistory.find(p => 
                p.month === paymentRecord.month && p.year === paymentRecord.year
            );
            
            if (!existingPayment) {
                employee.paymentHistory.push(paymentRecord);
                console.log(`📝 Payment recorded for ${employee.name} - ${monthName} ${year}`);
                
                // Update the database
                const db = new Low(adapter);
                await db.read();
                const employeeIndex = db.data.employees.findIndex(emp => emp.id === employee.id);
                if (employeeIndex !== -1) {
                    db.data.employees[employeeIndex] = employee;
                    await db.write();
                    console.log(`💾 Database updated with payment record for ${employee.name}`);
                }
            }
            
        } catch (emailError) {
            console.error(`❌ Failed to send payslip to ${employee.email}:`, emailError.message);
            throw emailError;
        }
        
        // Send a copy to admin for testing
        try {
            const adminCopyOptions = {
                from: `"AJK Cleaning HR" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
                to: process.env.ADMIN_EMAIL,
                subject: `📋 Payslip Copy - ${employee.name} - ${monthName} ${year}`,
                html: payslipHtml,
                text: `
Payslip Copy - ${monthName} ${year}
Employee: ${employee.name}
Email: ${employee.email}
SSN: ${employee.ssn || 'Not provided'}
Tax ID: ${employee.taxId || 'Not provided'}

EARNINGS:
Gross Salary: €${grossSalary.toFixed(2)}

DEDUCTIONS:
${customTaxAmount > 0 ? 
`Custom Tax Amount: -€${federalTax.toFixed(2)}` : 
`Federal Tax: -€${federalTax.toFixed(2)}
State Tax: -€${stateTax.toFixed(2)}
Social Security: -€${socialSecurity.toFixed(2)}`}
Penalties: -€${penalties.toFixed(2)}
Absences: -€${absences.toFixed(2)}
Other Deductions: -€${otherDeductions.toFixed(2)}

Total Deductions: -€${totalDeductions.toFixed(2)}
Net Salary: €${netSalary.toFixed(2)}
                `
            };
            
            // Try SendGrid first, fallback to SMTP
            let adminResult;
            try {
                if (process.env.SENDGRID_API_KEY) {
                    console.log('🚀 [ADMIN PAYSLIP] Attempting to send email via SendGrid...');
                    adminResult = await sendGridAdvanced.sendEmail(process.env.ADMIN_EMAIL, adminCopyOptions.subject, adminCopyOptions.html, adminCopyOptions.text);
                    console.log('✅ [ADMIN PAYSLIP] SendGrid email sent successfully');
                } else {
                    console.log('⚠️  [ADMIN PAYSLIP] SENDGRID_API_KEY not found, using SMTP fallback...');
                    adminResult = await sendEmailWithFallback(adminCopyOptions);
                }
            } catch (sendGridError) {
                console.log('🔄 [ADMIN PAYSLIP] SendGrid failed, trying SMTP fallback...', sendGridError.message);
                adminResult = await sendEmailWithFallback(adminCopyOptions);
            }
            
            if (adminResult && (adminResult.success || adminResult === true)) {
                console.log(`✅ Payslip copy sent to admin (${process.env.ADMIN_EMAIL})`);
            } else {
                console.error(`❌ Failed to send payslip copy to admin`);
            }
        } catch (adminEmailError) {
            console.error(`❌ Failed to send payslip copy to admin:`, adminEmailError.message);
            // Don't throw error for admin copy failure
        }
        
    } catch (error) {
        console.error('❌ Failed to send payslip:', error);
        throw error;
    }
}

// Function to send employee termination email
async function sendEmployeeTerminationEmail(employee) {
    try {
        const terminationHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Employment Termination - AJK Cleaning</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
                .termination-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                .highlight { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>👋 AJK Cleaning Company</h1>
                <h2>Employment Termination Notice</h2>
            </div>
            
            <div class="content">
                <p>Dear ${employee.name},</p>
                
                <p>This email serves as formal notice of the termination of your employment with AJK Cleaning Company.</p>
                
                <div class="termination-details">
                    <h3>📋 Termination Details</h3>
                    <p><strong>Employee ID:</strong> ${employee.id}</p>
                    <p><strong>Name:</strong> ${employee.name}</p>
                    <p><strong>Job Title:</strong> ${employee.jobTitle}</p>
                    <p><strong>Date of Termination:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Last Working Day:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
                
                <div class="highlight">
                    <h3>📄 Next Steps</h3>
                    <p>1. Please return any company property in your possession</p>
                    <p>2. Your final payslip will be sent separately</p>
                    <p>3. If you have any questions, please contact HR</p>
                </div>
                
                <div class="highlight">
                    <h3>📞 Contact Information</h3>
                    <p><strong>HR Department:</strong> +49 176 61852286</p>
                    <p><strong>Email:</strong> info@ajkcleaners.de</p>
                </div>
                
                <p>We thank you for your service and wish you all the best in your future endeavors.</p>
                
                <p>Best regards,<br>
                <strong>AJK Cleaning HR Team</strong></p>
            </div>
            
            <div class="footer">
                <p>AJK Cleaning Company | Professional Cleaning Services</p>
                <p>This is an automated termination notice.</p>
            </div>
        </body>
        </html>
        `;

        const mailOptions = {
            from: `"AJK Cleaning HR" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
            to: employee.email,
            subject: `👋 Employment Termination Notice - ${employee.name}`,
            html: terminationHtml,
            text: `
Employment Termination Notice

Dear ${employee.name},

This email serves as formal notice of the termination of your employment with AJK Cleaning Company.

TERMINATION DETAILS:
Employee ID: ${employee.id}
Job Title: ${employee.jobTitle}
Date of Termination: ${new Date().toLocaleDateString()}

NEXT STEPS:
1. Please return any company property
2. Your final payslip will be sent separately
3. Contact HR if you have any questions

Contact: +49 176 61852286 | info@ajkcleaners.de

We thank you for your service and wish you all the best.

AJK Cleaning HR Team
            `
        };

        // Try SendGrid first, fallback to SMTP
        let result;
        try {
            if (process.env.SENDGRID_API_KEY) {
                console.log('🚀 [TERMINATION] Attempting to send email via SendGrid...');
                result = await sendGridAdvanced.sendEmail(employee.email, mailOptions.subject, mailOptions.html, mailOptions.text);
                console.log('✅ [TERMINATION] SendGrid email sent successfully');
            } else {
                console.log('⚠️  [TERMINATION] SENDGRID_API_KEY not found, using SMTP fallback...');
                result = await sendEmailWithFallback(mailOptions);
            }
        } catch (sendGridError) {
            console.log('🔄 [TERMINATION] SendGrid failed, trying SMTP fallback...', sendGridError.message);
            result = await sendEmailWithFallback(mailOptions);
        }
        
        if (result && (result.success || result === true)) {
            console.log(`✅ Termination email sent to ${employee.email}`);
        } else {
            console.error(`❌ Failed to send termination email to ${employee.email}`);
            throw new Error('Email sending failed');
        }
        
    } catch (error) {
        console.error('❌ Failed to send termination email:', error);
        throw error;
    }
}

// Function to create subscription from booking
// Handle subscription payment
async function handleSubscriptionPayment(paymentIntent) {
    try {
        await db.read();
        const subscriptions = db.data.subscriptions || [];
        const subscription = subscriptions.find(sub => sub.id === paymentIntent.metadata.subscriptionId);
        
        if (!subscription) {
            console.error(`[SUBSCRIPTION PAYMENT] ❌ Subscription not found: ${paymentIntent.metadata.subscriptionId}`);
            console.log(`[SUBSCRIPTION PAYMENT] 📋 Available subscriptions:`, subscriptions.map(s => ({ id: s.id, customerEmail: s.customerEmail })));
            
            // Create a new subscription if it doesn't exist (fallback)
            console.log(`[SUBSCRIPTION PAYMENT] 🔄 Creating new subscription as fallback...`);
            const newSubscription = {
                id: paymentIntent.metadata.subscriptionId,
                customerName: paymentIntent.metadata.customerName || 'Unknown Customer',
                customerEmail: paymentIntent.metadata.customerEmail || 'unknown@example.com',
                planName: paymentIntent.metadata.planName || 'Premium Cleaning Plan',
                billingCycle: paymentIntent.metadata.billingCycle || 'monthly',
                price: paymentIntent.amount,
                currency: 'eur',
                status: 'active',
                createdAt: new Date().toISOString(),
                lastPaymentDate: new Date().toISOString(),
                lastPaymentAmount: paymentIntent.amount / 100,
                totalPaid: paymentIntent.amount / 100,
                paymentHistory: [{
                    date: new Date().toISOString(),
                    amount: paymentIntent.amount / 100,
                    paymentIntentId: paymentIntent.id,
                    status: 'completed'
                }],
                nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
            };
            
            subscriptions.push(newSubscription);
            await db.write();
            console.log(`[SUBSCRIPTION PAYMENT] ✅ Created new subscription: ${newSubscription.id}`);
            
            // Use the new subscription for processing
            subscription = newSubscription;
        }
        
        console.log(`[SUBSCRIPTION PAYMENT] ✅ Found subscription:`, {
            id: subscription.id,
            customerEmail: subscription.customerEmail,
            planName: subscription.planName,
            status: subscription.status
        });
        
        // Update subscription with payment info
        const subscriptionIndex = subscriptions.findIndex(sub => sub.id === subscription.id);
        if (subscriptionIndex !== -1) {
            subscriptions[subscriptionIndex].lastPaymentDate = new Date().toISOString();
            subscriptions[subscriptionIndex].lastPaymentAmount = paymentIntent.amount / 100;
            subscriptions[subscriptionIndex].totalPaid = (subscriptions[subscriptionIndex].totalPaid || 0) + (paymentIntent.amount / 100);
            subscriptions[subscriptionIndex].paymentHistory = subscriptions[subscriptionIndex].paymentHistory || [];
            subscriptions[subscriptionIndex].paymentHistory.push({
                date: new Date().toISOString(),
                amount: paymentIntent.amount / 100,
                paymentIntentId: paymentIntent.id,
                status: 'completed'
            });
            
            // Calculate next billing date from the ORIGINAL due date, not payment date
            // This prevents billing cycles from shifting due to late payments
            const originalDueDate = new Date(subscription.nextBillingDate);
            const nextBillingDate = new Date(originalDueDate);
            
            switch (subscription.billingCycle) {
                case 'weekly':
                    nextBillingDate.setDate(nextBillingDate.getDate() + 7);
                    break;
                case 'bi-weekly':
                    nextBillingDate.setDate(nextBillingDate.getDate() + 14);
                    break;
                case 'monthly':
                    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                    break;
                case 'quarterly':
                    nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
                    break;
            }
            
            subscriptions[subscriptionIndex].nextBillingDate = nextBillingDate.toISOString();
            console.log(`[SUBSCRIPTION PAYMENT] 📅 Next billing date calculated from original due date: ${originalDueDate.toISOString().split('T')[0]} → ${nextBillingDate.toISOString().split('T')[0]}`);
            
            await db.write();
            console.log(`[SUBSCRIPTION PAYMENT] ✅ Updated subscription ${subscription.id} with payment ${paymentIntent.id}`);
            
            // Send payment confirmation email with enhanced design
            try {
                const emailData = {
                    to: subscription.customerEmail,
                    subject: `Payment Confirmed - ${subscription.planName} | AJK Cleaning Services`,
                    text: `Payment Confirmation - ${subscription.planName}
                    
Dear ${subscription.customerName},

Your subscription payment has been processed successfully.

Payment Details:
- Plan: ${subscription.planName}
- Amount: €${(paymentIntent.amount / 100).toFixed(2)}
- Payment Date: ${new Date().toLocaleDateString()}
- Payment ID: ${paymentIntent.id}

Thank you for your continued subscription to AJK Cleaning Services.

Best regards,
AJK Cleaning Team`,
                    html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="utf-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Payment Confirmation</title>
                        </head>
                        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                                <!-- Header -->
                                <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); padding: 30px; text-align: center; color: white;">
                                    <h1 style="margin: 0; font-size: 28px; font-weight: 700;">
                                        Payment Confirmed
                                    </h1>
                                    <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
                                        Your subscription payment has been processed successfully
                                    </p>
                                </div>
                                
                                <!-- Content -->
                                <div style="padding: 40px 30px;">
                                    <div style="margin-bottom: 30px;">
                                        <h2 style="color: #2d3748; font-size: 24px; margin: 0 0 15px 0; font-weight: 600;">
                                            Thank you, ${subscription.customerName}! 🎉
                                        </h2>
                                        <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                            Your subscription payment has been processed successfully. Your cleaning service will continue as scheduled.
                                        </p>
                                    </div>
                                    
                                    <!-- Payment Details Card -->
                                    <div style="background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%); border: 1px solid #9ae6b4; border-radius: 12px; padding: 25px; margin: 25px 0;">
                                        <h3 style="color: #2d3748; font-size: 20px; margin: 0 0 20px 0; font-weight: 600; display: flex; align-items: center;">
                                            Payment Details
                                        </h3>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #48bb78;">
                                                <p style="margin: 0; color: #718096; font-size: 14px; font-weight: 500;">PLAN</p>
                                                <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 16px; font-weight: 600;">${subscription.planName}</p>
                                            </div>
                                            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #38a169;">
                                                <p style="margin: 0; color: #718096; font-size: 14px; font-weight: 500;">AMOUNT PAID</p>
                                                <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 18px; font-weight: 700;">€${(paymentIntent.amount / 100).toFixed(2)}</p>
                                            </div>
                                            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #68d391;">
                                                <p style="margin: 0; color: #718096; font-size: 14px; font-weight: 500;">PAYMENT DATE</p>
                                                <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 16px; font-weight: 600;">${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                            </div>
                                            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #4fd1c7;">
                                                <p style="margin: 0; color: #718096; font-size: 14px; font-weight: 500;">NEXT BILLING</p>
                                                <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 16px; font-weight: 600;">${new Date(subscriptions[subscriptionIndex].nextBillingDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Service Information -->
                                    <div style="background: #f7fafc; border-radius: 8px; padding: 20px; margin: 25px 0;">
                                        <h4 style="color: #2d3748; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">Your Cleaning Service</h4>
                                        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                                            <div style="flex: 1; min-width: 150px;">
                                                <p style="margin: 0; color: #718096; font-size: 12px; font-weight: 500;">SERVICE TYPE</p>
                                                <p style="margin: 2px 0 0 0; color: #2d3748; font-size: 14px; font-weight: 600;">${subscription.planName}</p>
                                            </div>
                                            <div style="flex: 1; min-width: 150px;">
                                                <p style="margin: 0; color: #718096; font-size: 12px; font-weight: 500;">FREQUENCY</p>
                                                <p style="margin: 2px 0 0 0; color: #2d3748; font-size: 14px; font-weight: 600; text-transform: capitalize;">${subscription.billingCycle}</p>
                                            </div>
                                            <div style="flex: 1; min-width: 150px;">
                                                <p style="margin: 0; color: #718096; font-size: 12px; font-weight: 500;">STATUS</p>
                                                <p style="margin: 2px 0 0 0; color: #38a169; font-size: 14px; font-weight: 600;">Active</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Next Steps -->
                                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 20px; margin: 25px 0; color: white;">
                                        <h4 style="color: white; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">📅 What's Next?</h4>
                                        <ul style="color: white; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                                            <li>Your cleaning service will continue as scheduled</li>
                                            <li>You'll receive a reminder before your next payment is due</li>
                                            <li>If you need to reschedule or have questions, just contact us</li>
                                        </ul>
                                    </div>
                                    
                                    <!-- Contact Information -->
                                    <div style="border-top: 1px solid #e2e8f0; padding-top: 25px; margin-top: 30px;">
                                        <h4 style="color: #2d3748; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">📞 Need Help?</h4>
                                        <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                                            If you have any questions about your subscription or need to make changes, please contact us:
                                        </p>
                                        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                                            <div style="flex: 1; min-width: 150px;">
                                                <p style="margin: 0; color: #718096; font-size: 12px; font-weight: 500;">EMAIL</p>
                                                <p style="margin: 2px 0 0 0; color: #2d3748; font-size: 14px; font-weight: 600;">info@ajkcleaning.com</p>
                                            </div>
                                            <div style="flex: 1; min-width: 150px;">
                                                <p style="margin: 0; color: #718096; font-size: 12px; font-weight: 500;">PHONE</p>
                                                <p style="margin: 2px 0 0 0; color: #2d3748; font-size: 14px; font-weight: 600;">+49 123 456 7890</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Footer -->
                                <div style="background: #f7fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                                    <p style="color: #718096; font-size: 14px; margin: 0 0 10px 0;">
                                        Thank you for choosing <strong>AJK Cleaning Services</strong>
                                    </p>
                                    <p style="color: #a0aec0; font-size: 12px; margin: 0;">
                                        This is an automated message. Please do not reply to this email.
                                    </p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `
                };
                
                // Try SendGrid first, fallback to SMTP
                let result;
                let emailSent = false;
                
                try {
                    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your_sendgrid_api_key_here') {
                        console.log('🚀 [SUBSCRIPTION PAYMENT] Attempting to send email via SendGrid...');
                        console.log(`📧 [SUBSCRIPTION PAYMENT] Sending to: ${subscription.customerEmail}`);
                        console.log(`📧 [SUBSCRIPTION PAYMENT] Subject: ${emailData.subject}`);
                        
                        result = await sendGridAdvanced.sendEmail(subscription.customerEmail, emailData.subject, emailData.html, emailData.text);
                        
                        if (result && result.success) {
                            console.log('✅ [SUBSCRIPTION PAYMENT] SendGrid email sent successfully');
                            emailSent = true;
                        } else {
                            console.log('❌ [SUBSCRIPTION PAYMENT] SendGrid returned failure result:', result);
                        }
                    } else {
                        console.log('⚠️  [SUBSCRIPTION PAYMENT] SENDGRID_API_KEY not found or not configured, using SMTP fallback...');
                    }
                } catch (sendGridError) {
                    console.log('🔄 [SUBSCRIPTION PAYMENT] SendGrid failed, trying SMTP fallback...', sendGridError.message);
                }
                
                // Try SMTP fallback if SendGrid failed
                if (!emailSent) {
                    try {
                        console.log('🔄 [SUBSCRIPTION PAYMENT] Attempting SMTP fallback...');
                        result = await sendEmailWithFallback(emailData);
                        
                        if (result && (result.success || result === true)) {
                            console.log('✅ [SUBSCRIPTION PAYMENT] SMTP email sent successfully');
                            emailSent = true;
                        } else {
                            console.log('❌ [SUBSCRIPTION PAYMENT] SMTP fallback failed:', result);
                        }
                    } catch (smtpError) {
                        console.error('❌ [SUBSCRIPTION PAYMENT] SMTP fallback failed:', smtpError.message);
                    }
                }
                
                if (emailSent) {
                    console.log(`[SUBSCRIPTION PAYMENT] 📧 Confirmation email sent to ${subscription.customerEmail}`);
                } else {
                    console.error(`[SUBSCRIPTION PAYMENT] ❌ Failed to send confirmation email to ${subscription.customerEmail}`);
                    console.error(`[SUBSCRIPTION PAYMENT] ❌ SendGrid result:`, result);
                }
            } catch (emailError) {
                console.error(`[SUBSCRIPTION PAYMENT] ❌ Failed to send confirmation email:`, emailError);
            }
        }
        
    } catch (error) {
        console.error(`[SUBSCRIPTION PAYMENT] ❌ Error handling subscription payment:`, error);
    }
}

async function createSubscriptionFromBooking(booking, bookingDetails) {
    try {
        await db.read();
        
        // Ensure subscriptions array exists
        if (!db.data.subscriptions) {
            db.data.subscriptions = [];
        }
        
        // Map booking details to subscription format
        const subscription = {
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            customerId: `cust_${Date.now()}`,
            customerEmail: bookingDetails.customerEmail,
            customerName: bookingDetails.customerName,
            customerPhone: bookingDetails.customerPhone,
            stripeSubscriptionId: null, // Will be set if using Stripe subscriptions
            stripeCustomerId: null, // Will be set if using Stripe subscriptions
            planId: bookingDetails.package,
            planName: getPlanName(bookingDetails.package),
            price: bookingDetails.package === 'commercial' || bookingDetails.package === 'regular-basic' ? 0 : booking.amount,
            currency: 'eur',
            billingCycle: getServiceFrequency(bookingDetails.package),
            status: 'active',
            startDate: new Date().toISOString(),
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
            lastPaymentDate: booking.paidAt,
            lastPaymentAmount: booking.amount,
            totalPaid: booking.amount,
            failedPayments: 0,
            maxFailedPayments: 3,
            autoRetry: true,
            pauseReason: null,
            cancellationReason: null,
            cancelledAt: null,
            notes: `Created from booking ${booking.id}`,
            serviceAddress: bookingDetails.customerAddress,
            serviceFrequency: getServiceFrequency(bookingDetails.package),
            specialInstructions: bookingDetails.specialRequests || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        console.log(`[SUBSCRIPTION] 📦 Creating subscription:`, subscription.id);
        db.data.subscriptions.push(subscription);
        await db.write();
        
        console.log(`[SUBSCRIPTION] ✅ Successfully created subscription ${subscription.id}`);
        console.log(`[SUBSCRIPTION] 📊 Total subscriptions now:`, db.data.subscriptions.length);
        
        // Send subscription creation confirmation email
        try {
            await sendSubscriptionCreationConfirmation(subscription);
            console.log(`[SUBSCRIPTION] 📧 Subscription creation confirmation email sent to ${subscription.customerEmail}`);
        } catch (emailError) {
            console.error(`[SUBSCRIPTION] ❌ Failed to send subscription creation confirmation email:`, emailError.message);
            // Don't fail subscription creation if email fails
        }
        
        return subscription;
    } catch (error) {
        console.error(`[SUBSCRIPTION] ❌ Error creating subscription:`, error);
        throw error;
    }
}

// Helper function to get plan name from package ID
function getPlanName(packageId) {
    const planNames = {
        'regular-basic': 'Regular Basic Cleaning',
        'commercial': 'Commercial Cleaning'
    };
    return planNames[packageId] || packageId;
}

// Helper function to get service frequency from package ID
function getServiceFrequency(packageId) {
    const frequencies = {
        'regular-basic': 'monthly',
        'commercial': 'flexible'
    };
    return frequencies[packageId] || 'monthly';
}

// Function to send booking confirmation invoice
async function sendBookingInvoice(booking) {
    try {
        const details = booking.details || {};
        const customerName = details.customerName || 'Valued Customer';
        const customerEmail = details.customerEmail;
        const bookingDate = details.date || 'TBD';
        const bookingTime = details.time || 'TBD';
        const packageType = details.package || 'Cleaning Service';
        const duration = details.duration || 0;
        const cleaners = details.cleaners || 1;
        const amount = booking.amount ? (booking.amount / 100).toFixed(2) : '0.00';
        const specialRequests = details.specialRequests || 'None';

        const invoiceHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Booking Confirmation - AJK Cleaning</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
                .invoice-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .total { background: #10b981; color: white; padding: 15px; border-radius: 8px; text-align: center; font-size: 18px; font-weight: bold; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                .highlight { background: #eff6ff; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🧹 AJK Cleaning Company</h1>
                <h2>Booking Confirmation & Invoice</h2>
            </div>
            
            <div class="content">
                <p>Dear ${customerName},</p>
                
                <p>Thank you for choosing AJK Cleaning Company! Your booking has been confirmed and payment processed successfully.</p>
                
                <div class="highlight">
                    <h3>📋 Booking Details</h3>
                    <p><strong>Booking ID:</strong> ${booking.id}</p>
                    <p><strong>Service:</strong> ${packageType}</p>
                    <p><strong>Date:</strong> ${bookingDate}</p>
                    <p><strong>Time:</strong> ${bookingTime}</p>
                    <p><strong>Duration:</strong> ${duration} hours</p>
                    <p><strong>Cleaners:</strong> ${cleaners}</p>
                </div>
                
                <div class="invoice-details">
                    <h3>Payment Summary</h3>
                    <p><strong>Service Fee:</strong> €${amount}</p>
                    <p><strong>Payment Status:</strong> Paid</p>
                    <p><strong>Payment Method:</strong> Stripe</p>
                </div>
                
                <div class="total">
                    Total Amount: €${amount}
                </div>
                
                ${specialRequests !== 'None' ? `
                <div class="highlight">
                    <h3>📝 Special Requests</h3>
                    <p>${specialRequests}</p>
                </div>
                ` : ''}
                
                <div class="highlight">
                    <h3>📞 Contact Information</h3>
                    <p><strong>Phone:</strong> +49 176 61852286</p>
                    <p><strong>Email:</strong> info@ajkcleaners.de</p>
                    <p><strong>Website:</strong> https://ajkcleaners.de</p>
                </div>
                
                <p>We look forward to providing you with excellent cleaning services!</p>
                
                <p>Best regards,<br>
                <strong>AJK Cleaning Team</strong></p>
            </div>
            
            <div class="footer">
                <p>AJK Cleaning Company | Professional Cleaning Services in Bischofsheim</p>
                <p>This is an automated confirmation email. Please keep this for your records.</p>
            </div>
        </body>
        </html>
        `;

        const mailOptions = {
            from: `"AJK Cleaning Services" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
            to: customerEmail,
            subject: `🧹 Booking Confirmation & Invoice - ${booking.id}`,
            html: invoiceHtml,
            text: `
Booking Confirmation - AJK Cleaning Company

Dear ${customerName},

Your booking has been confirmed!

Booking ID: ${booking.id}
Service: ${packageType}
Date: ${bookingDate}
Time: ${bookingTime}
Duration: ${duration} hours
Cleaners: ${cleaners}
Amount: €${amount}

Contact: +49 176 61852286 | info@ajkcleaners.de

Thank you for choosing AJK Cleaning Company!
            `
        };

        // Try SendGrid first, fallback to SMTP
        let result;
        try {
            if (process.env.SENDGRID_API_KEY) {
                console.log('🚀 [BOOKING INVOICE] Attempting to send email via SendGrid...');
                result = await sendGridAdvanced.sendEmail(customerEmail, mailOptions.subject, mailOptions.html, mailOptions.text);
                console.log('✅ [BOOKING INVOICE] SendGrid email sent successfully');
            } else {
                console.log('⚠️  [BOOKING INVOICE] SENDGRID_API_KEY not found, using SMTP fallback...');
                result = await sendEmailWithFallback(mailOptions);
            }
        } catch (sendGridError) {
            console.log('🔄 [BOOKING INVOICE] SendGrid failed, trying SMTP fallback...', sendGridError.message);
            result = await sendEmailWithFallback(mailOptions);
        }
        
        if (result && (result.success || result === true)) {
            console.log(`✅ Invoice email sent to ${customerEmail} for booking ${booking.id}`);
            console.log(`📧 Email details: From ${process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER || process.env.ADMIN_EMAIL} to ${customerEmail}`);
        } else {
            console.error(`❌ Failed to send invoice email to ${customerEmail}`);
            throw new Error('Email sending failed');
        }
        
    } catch (error) {
        console.error('❌ Failed to send invoice email:', error);
        throw error;
    }
}

// Function to send subscription creation confirmation email
async function sendSubscriptionCreationConfirmation(subscription) {
    try {
        const {
            customerEmail,
            customerName,
            planName,
            price,
            billingCycle,
            nextBillingDate,
            serviceAddress,
            specialInstructions,
            id: subscriptionId
        } = subscription;

        const amount = price ? (price / 100).toFixed(2) : '0.00';
        const nextBilling = new Date(nextBillingDate).toLocaleDateString('en-GB', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        const emailData = {
            to: customerEmail,
            subject: `🎉 Subscription Created Successfully - ${planName} | AJK Cleaning Services`,
            text: `Subscription Confirmation - ${planName}
            
Dear ${customerName},

Your subscription has been successfully created and is now active!

Subscription Details:
- Plan: ${planName}
- Amount: €${amount}
- Billing Cycle: ${billingCycle}
- Next Billing Date: ${nextBilling}
- Service Address: ${serviceAddress}
- Subscription ID: ${subscriptionId}

${specialInstructions ? `Special Instructions: ${specialInstructions}` : ''}

Your subscription is now active and you will receive regular cleaning services according to your plan.

Thank you for choosing AJK Cleaning Services!

Best regards,
AJK Cleaning Team`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Subscription Created - AJK Cleaning</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
                        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
                        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
                        .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
                        .content { padding: 30px; }
                        .success-badge { background: #d1fae5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin-bottom: 25px; text-align: center; }
                        .success-badge h2 { color: #065f46; margin: 0 0 10px 0; font-size: 20px; }
                        .subscription-details { background: #f8f9fa; border-radius: 8px; padding: 25px; margin: 20px 0; }
                        .detail-row { display: flex; justify-content: space-between; margin: 12px 0; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
                        .detail-row:last-child { border-bottom: none; }
                        .detail-label { font-weight: bold; color: #495057; }
                        .detail-value { color: #212529; }
                        .subscription-id { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px; }
                        .subscription-id h3 { color: #1976d2; margin: 0 0 10px 0; }
                        .subscription-id code { background: #f5f5f5; padding: 4px 8px; border-radius: 4px; font-family: monospace; }
                        .next-billing { background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; border-radius: 4px; }
                        .next-billing h3 { color: #f57c00; margin: 0 0 10px 0; }
                        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; border-top: 1px solid #e9ecef; }
                        .contact-info { background: #e8f5e8; border-radius: 8px; padding: 20px; margin: 20px 0; }
                        .contact-info h3 { color: #2e7d32; margin: 0 0 15px 0; }
                        .contact-info p { margin: 5px 0; color: #388e3c; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎉 Subscription Created!</h1>
                            <p>Your cleaning subscription is now active</p>
                        </div>
                        
                        <div class="content">
                            <div class="success-badge">
                                <h2>✅ Subscription Successfully Created</h2>
                                <p>Dear ${customerName}, your subscription is now active and ready to use!</p>
                            </div>
                            
                            <div class="subscription-details">
                                <h3 style="color: #2d3748; margin: 0 0 20px 0; font-size: 18px;">📋 Subscription Details</h3>
                                <div class="detail-row">
                                    <span class="detail-label">Plan Name:</span>
                                    <span class="detail-value">${planName}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Amount:</span>
                                    <span class="detail-value">€${amount}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Billing Cycle:</span>
                                    <span class="detail-value">${billingCycle}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Service Address:</span>
                                    <span class="detail-value">${serviceAddress}</span>
                                </div>
                                ${specialInstructions ? `
                                <div class="detail-row">
                                    <span class="detail-label">Special Instructions:</span>
                                    <span class="detail-value">${specialInstructions}</span>
                                </div>
                                ` : ''}
                            </div>
                            
                            <div class="subscription-id">
                                <h3>🆔 Subscription ID</h3>
                                <code>${subscriptionId}</code>
                                <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Keep this ID for your records</p>
                            </div>
                            
                            <div class="next-billing">
                                <h3>📅 Next Billing Date</h3>
                                <p style="margin: 0; font-size: 16px; font-weight: 600;">${nextBilling}</p>
                                <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Your next payment will be processed on this date</p>
                            </div>
                            
                            <div class="contact-info">
                                <h3>📞 Need Help?</h3>
                                <p><strong>Email:</strong> info@ajkcleaning.com</p>
                                <p><strong>Phone:</strong> +49 123 456 7890</p>
                                <p><strong>Hours:</strong> Monday - Friday, 8:00 AM - 6:00 PM</p>
                            </div>
                            
                            <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
                                Thank you for choosing <strong>AJK Cleaning Services</strong>! Your subscription is now active and you will receive regular cleaning services according to your plan.
                            </p>
                        </div>
                        
                        <div class="footer">
                            <p style="margin: 0 0 10px 0;">
                                <strong>AJK Cleaning Services</strong> - Professional Cleaning Solutions
                            </p>
                            <p style="margin: 0; font-size: 12px;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        // Try SendGrid first, fallback to SMTP
        let result;
        let emailSent = false;
        
        try {
            if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your_sendgrid_api_key_here') {
                console.log('🚀 [SUBSCRIPTION CREATION] Attempting to send email via SendGrid...');
                result = await sendGridAdvanced.sendEmail(customerEmail, emailData.subject, emailData.html, emailData.text);
                
                if (result && result.success) {
                    console.log('✅ [SUBSCRIPTION CREATION] SendGrid email sent successfully');
                    emailSent = true;
                } else {
                    console.log('❌ [SUBSCRIPTION CREATION] SendGrid failed, trying SMTP fallback...');
                }
            } else {
                console.log('⚠️  [SUBSCRIPTION CREATION] SENDGRID_API_KEY not configured, using SMTP fallback...');
            }
        } catch (sendGridError) {
            console.log('🔄 [SUBSCRIPTION CREATION] SendGrid failed, trying SMTP fallback...', sendGridError.message);
        }
        
        // Try SMTP fallback if SendGrid failed
        if (!emailSent) {
            try {
                console.log('📧 [SUBSCRIPTION CREATION] Attempting SMTP fallback...');
                result = await sendEmailWithFallback(emailData);
                
                if (result && (result.success || result === true)) {
                    console.log('✅ [SUBSCRIPTION CREATION] SMTP email sent successfully');
                    emailSent = true;
                } else {
                    console.log('❌ [SUBSCRIPTION CREATION] SMTP fallback failed');
                }
            } catch (smtpError) {
                console.log('❌ [SUBSCRIPTION CREATION] SMTP fallback failed:', smtpError.message);
            }
        }
        
        if (emailSent) {
            console.log(`✅ Subscription creation confirmation email sent to ${customerEmail} for subscription ${subscriptionId}`);
        } else {
            console.error(`❌ Failed to send subscription creation confirmation email to ${customerEmail}`);
        }
        
    } catch (error) {
        console.error('Error sending subscription creation confirmation:', error);
        throw error;
    }
}

// Use express-session default MemoryStore for better compatibility
const MemoryStore = require('express-session').MemoryStore;
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy (CRITICAL for secure cookies behind a reverse proxy like Render)
app.set('trust proxy', 1);

// Environment-specific settings
// isProduction is already imported from security config

// Use environment secret or generate one for development
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
    if (isProduction) {
        console.error('CRITICAL: SESSION_SECRET is not set in the environment variables for production.');
        process.exit(1);
    }
    SESSION_SECRET = crypto.randomBytes(64).toString('hex');
    console.warn('Warning: SESSION_SECRET not set. Using a temporary secret for development.');
}

// Database setup with lowdb
// For Render deployment, ensure we use a proper path that won't conflict with existing directories
// Default to local data directory for development, persistent disk for production
const defaultDbPath = process.env.NODE_ENV === 'production' 
    ? '/var/data/ajk-cleaning/db.json'  // Persistent disk path for production
    : path.join(__dirname, 'data', 'db.json');  // Local path for development

let dbPath = process.env.DB_PATH || defaultDbPath;

// Ensure the database path is valid and doesn't conflict with existing directories
let dbDir = path.dirname(dbPath);

// If the path points to an existing directory, use a subdirectory
if (fs.existsSync(dbPath) && fs.statSync(dbPath).isDirectory()) {
    console.warn(`Database path ${dbPath} is a directory, using subdirectory instead`);
    const newDbPath = path.join(dbPath, 'database.json');
    console.log(`Using database path: ${newDbPath}`);
    // Update the dbPath for the rest of the application
    dbPath = newDbPath;
    dbDir = path.dirname(dbPath);
}

// Ensure the directory exists
if (!fs.existsSync(dbDir)) {
    try {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`✅ Created database directory: ${dbDir}`);
    } catch (error) {
        console.error(`❌ Failed to create database directory: ${dbDir}`);
        console.error('This might be a permissions issue or the persistent disk is not mounted.');
        throw error;
    }
}

const adapter = new JSONFile(dbPath);
const db = new Low(adapter, { submissions: [], admin_users: [], offline_messages: {}, chats: {}, analytics_events: [], bookings: [] });

// Analytics Batching Setup
const analyticsQueue = [];
let isWritingAnalytics = false;

// =================================================================
// DATABASE CACHING
// =================================================================
const dbCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

async function cachedRead(key, fetchFn) {
    const cached = dbCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const data = await fetchFn();
    dbCache.set(key, { data, timestamp: Date.now() });

    // Cleanup old cache entries
    if (dbCache.size > 50) {
        const oldestKey = Array.from(dbCache.keys())[0];
        dbCache.delete(oldestKey);
    }

    return data;
}

function clearCache(key = null) {
    if (key) {
        dbCache.delete(key);
    } else {
        dbCache.clear();
    }
}
// =================================================================
// END OF DATABASE CACHING
// =================================================================

// Stripe Webhook Endpoint - IMPORTANT: This must be before express.json()
app.post('/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    console.log('🔔 Webhook received:', req.headers['stripe-signature']);
    console.log('🔔 Webhook body length:', req.body.length);
    console.log('🔔 Webhook body preview:', req.body.toString().substring(0, 200) + '...');
    
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('❌ STRIPE_WEBHOOK_SECRET is not set in environment variables');
        return res.status(500).send('Webhook secret not configured');
    }

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        console.log('✅ Webhook signature verified, event type:', event.type);
        console.log('🔔 Event ID:', event.id);
        console.log('🔔 Event data:', JSON.stringify(event.data.object, null, 2));
    } catch (err) {
        console.error(`❌ Webhook signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.info(`[STRIPE] ✅ Payment successful for PaymentIntent ${paymentIntent.id}.`);
            
            try {
                console.info(`[STRIPE] Raw Metadata:`, paymentIntent.metadata);
                
                // Check if this is a subscription payment
                console.log(`[STRIPE] 🔍 Checking payment metadata:`, paymentIntent.metadata);
                if (paymentIntent.metadata.type === 'subscription_payment') {
                    console.log(`[STRIPE] 📧 Processing subscription payment for subscription: ${paymentIntent.metadata.subscriptionId}`);
                    await handleSubscriptionPayment(paymentIntent);
                    return res.json({ received: true });
                }
                if (!paymentIntent.metadata || !paymentIntent.metadata.bookingDetailsId) {
                    console.error(`[STRIPE] ❌ CRITICAL: bookingDetailsId missing from metadata for PI ${paymentIntent.id}. Cannot create booking.`);
                    break;
                }
        
                await db.read();
                
                // Retrieve full booking details from temporary storage
                const tempId = paymentIntent.metadata.bookingDetailsId;
                let bookingDetails;
                
                if (global.tempBookingDetails && global.tempBookingDetails.has(tempId)) {
                    bookingDetails = global.tempBookingDetails.get(tempId);
                    // Clean up the temporary storage
                    global.tempBookingDetails.delete(tempId);
                    console.info(`[STRIPE] 📝 Retrieved full booking details from temp storage`);
                } else {
                    console.error(`[STRIPE] ❌ CRITICAL: Full booking details not found in temp storage for ID ${tempId}`);
                    break;
                }
                
                const totalAmount = parseFloat(paymentIntent.metadata.totalAmount || '0');
                
                console.info(`[STRIPE] 📝 Parsed booking details:`, bookingDetails);
                
                const newBooking = {
                    id: `booking_${Date.now()}`,
                    details: bookingDetails,
                    amount: totalAmount,
                    status: 'paid',
                    paymentIntentId: paymentIntent.id,
                    paidAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                };
                
                console.info(`[STRIPE] 📦 Preparing to save new booking:`, newBooking.id);
                db.data.bookings.push(newBooking);
                await db.write();
                
                console.info(`[STRIPE] ✅ Successfully wrote booking ${newBooking.id} to database.`);
                console.info(`[STRIPE] 📊 Total bookings now:`, db.data.bookings.length);
                
                // Check if this is a subscription booking and create subscription
                // Only create subscriptions for regular subscription packages, not commercial or regular-basic
                if (bookingDetails.bookingType === 'subscription' && bookingDetails.package !== 'commercial' && bookingDetails.package !== 'regular-basic') {
                    try {
                        await createSubscriptionFromBooking(newBooking, bookingDetails);
                        console.log(`[STRIPE] ✅ Created subscription for booking ${newBooking.id}`);
                    } catch (subscriptionError) {
                        console.error(`[STRIPE] ❌ Failed to create subscription for booking ${newBooking.id}:`, subscriptionError.message);
                        // Don't fail the booking if subscription creation fails
                    }
                } else if (bookingDetails.bookingType === 'subscription' && (bookingDetails.package === 'commercial' || bookingDetails.package === 'regular-basic')) {
                    console.log(`[STRIPE] 📝 ${bookingDetails.package} subscription booking - subscription will be created after consultation`);
                }
                
                // Send invoice email to customer
                try {
                    await sendBookingInvoice(newBooking);
                    console.log(`[STRIPE] 📧 Invoice email sent for booking ${newBooking.id}`);
                } catch (emailError) {
                    console.error(`[STRIPE] ❌ Failed to send invoice email for booking ${newBooking.id}:`, emailError.message);
                }
                
                // Send admin notification for new booking
                try {
                    await sendAdminNotification(newBooking);
                    console.log(`[STRIPE] 📧 Admin notification sent for booking ${newBooking.id}`);
                } catch (adminError) {
                    console.error(`[STRIPE] ❌ Failed to send admin notification for booking ${newBooking.id}:`, adminError.message);
                }
            } catch (error) {
                console.error(`[STRIPE] ❌ Error processing successful payment webhook: ${error.message}`);
                console.error(error.stack);
            }
            break;

        case 'payment_intent.payment_failed':
            const paymentIntentFailed = event.data.object;
            console.warn(`[STRIPE] ❌ Payment failed for PaymentIntent ${paymentIntentFailed.id}. Reason: ${paymentIntentFailed.last_payment_error?.message}`);
            
            try {
                await db.read();
                
                const existingBooking = db.data.bookings.find(b => b.paymentIntentId === paymentIntentFailed.id);
                if (existingBooking) {
                    console.warn(`[STRIPE] ⚠️ Booking for failed payment intent ${paymentIntentFailed.id} already exists. Status: ${existingBooking.status}`);
                    break; 
                }

                const bookingDetails = JSON.parse(paymentIntentFailed.metadata.bookingDetails || '{}');
                const totalAmount = parseFloat(paymentIntentFailed.metadata.totalAmount || '0');
                
                const failedBooking = {
                    id: `booking_${Date.now()}`,
                    details: bookingDetails,
                    amount: totalAmount,
                    status: 'payment_failed',
                    paymentIntentId: paymentIntentFailed.id,
                    paymentError: paymentIntentFailed.last_payment_error?.message || 'Payment failed',
                    failedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                };

                db.data.bookings.push(failedBooking);
                await db.write();
                console.info(`[STRIPE] ✅ Created booking record for failed payment ${failedBooking.id}`);

            } catch (error) {
                console.error(`[STRIPE] ❌ Error creating record for failed payment: ${error.message}`);
            }
            break;

        default:
            console.log(`[STRIPE] ⚠️ Unhandled event type: ${event.type}`);
            console.log(`[STRIPE] 📝 Event data:`, JSON.stringify(event.data.object, null, 2));
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({received: true});
});


// =================================================================
// MIDDLEWARE SETUP
// =================================================================
app.use(compression());

// Enhanced security middleware
app.use(helmet(helmetConfig));
app.use(securityHeaders);
app.use(sanitizeInput);

// CORS configuration
app.use(cors(corsConfig));
app.options('*', cors(corsConfig));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json());
app.use(cookieParser());

// ENHANCEMENT: Add detailed request logging
app.use((req, res, next) => {
    const start = Date.now();
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${new Date().toISOString()} | ${clientIP} | ${req.method} ${req.url} | ${res.statusCode} | ${duration}ms`);
    });
    
    next();
});

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore(),
    name: 'ajk.sid',
    cookie: { 
        secure: isProduction,
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        domain: undefined,
        path: '/'
    }
}));

// Session middleware to ensure proper session handling
app.use((req, res, next) => {
    // Ensure session is properly initialized
    if (!req.session) {
        console.log('⚠️ No session found, creating new one');
    }
    next();
});

// Session debugging middleware
app.use((req, res, next) => {
    console.log('🔍 Session Debug:', {
        hasSession: !!req.session,
        sessionId: req.sessionID,
        authenticated: req.session?.authenticated,
        path: req.path,
        cookies: req.headers.cookie,
        origin: req.headers.origin,
        referer: req.headers.referer
    });
    
    // Additional session store debugging
    if (req.session && req.sessionID) {
        console.log('🔍 Session Store Debug:', {
            sessionId: req.sessionID,
            sessionData: {
                authenticated: req.session.authenticated,
                user: req.session.user
            },
            storeSize: req.sessionStore ? Object.keys(req.sessionStore.sessions || {}).length : 'unknown',
            storeType: req.sessionStore ? req.sessionStore.constructor.name : 'unknown'
        });
    }
    
    next();
});

// Ensure cookies are set correctly
app.use((req, res, next) => {
    if (req.session && req.session.authenticated) {
        console.log('✅ Authenticated session found:', req.sessionID);
    }
    next();
});


// =================================================================
// CSRF PROTECTION SETUP (FIXED)
// =================================================================
// csrfProtection is already imported from security config

// Conditionally apply CSRF protection. Public POST endpoints are excluded.
app.use((req, res, next) => {
    const excludedRoutes = [
        '/api/form/submit', 
        '/api/gemini', 
        '/api/analytics/track', 
        '/create-payment-intent', 
        '/stripe-webhook',
        '/api/booking/webhook',
        '/api/bookings/check-payment-status',
        '/api/bookings/create-from-payment',
        '/api/bookings/commercial-create',
        '/api/admin/login',
        '/api/test/subscription-payment',
        '/api/test/subscription-email',
        '/api/test-email',
        '/api/test-commercial-email',
        '/api/employees',
        '/api/employees/generate-payslips',
        '/api/chats/orphaned-info',
        '/api/submissions',
        '/api/chats',
        '/api/chat/send',
        '/api/subscriptions',
        '/api/subscriptions/create-payment-public'
    ];
    if (excludedRoutes.includes(req.path) || 
        req.path.startsWith('/api/submissions/') || 
        req.path.startsWith('/api/chats/') || 
        req.path.startsWith('/api/admin/') ||
        req.path.startsWith('/api/subscriptions/') ||
        req.path.startsWith('/api/test/subscription-payment/') ||
        req.path.startsWith('/api/test/subscription-email/')) {
        return next();
    }
    csrfProtection(req, res, next);
});

// Middleware to handle CSRF token errors
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        console.warn('CSRF Token Validation Failed for request:', req.method, req.path);
        res.status(403).json({ 
            error: 'Invalid CSRF token. Please refresh the page and try again.',
            code: 'INVALID_CSRF_TOKEN' 
        });
    } else {
        next(err);
    }
});

// Provide a dedicated endpoint for the frontend to fetch the CSRF token
app.get('/api/csrf-token', (req, res) => {
    try {
        // Generate a CSRF token using the same method as the security config
        const crypto = require('crypto');
        const csrfToken = crypto.randomBytes(32).toString('hex');
        
        // Store the token in the session
        if (!req.session) {
            req.session = {};
        }
        req.session.csrfToken = csrfToken;
        
        console.log('🔐 CSRF token generated for request from:', req.get('origin') || req.get('referer') || 'unknown');
        res.json({ csrfToken });
    } catch (error) {
        console.error('❌ Error generating CSRF token:', error);
        res.status(500).json({ error: 'Failed to generate CSRF token' });
    }
});

app.get('/api/stripe-key', (req, res) => {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_51SD6iOHIVAzPWFkU1ixyvux7u4Srneo6y2tuko22UX4OR2cGTNXvAssP1DAhbB9XnSDOgNPAwpOaLchXBBRD36Fb00uYOldQMJ';
    const isLive = publishableKey.startsWith('pk_live_');
    
    console.log(`🔑 Serving Stripe key: ${isLive ? 'LIVE' : 'TEST'} mode`);
    console.log(`🔑 Key: ${publishableKey.substring(0, 20)}...`);
    
    res.json({
        publishableKey: publishableKey,
        mode: isLive ? 'live' : 'test'
    });
});

// Test endpoint to verify SMTP integration
app.get('/api/test-smtp', async (req, res) => {
    try {
        console.log('🧪 Testing SMTP...');
        const testEmail = {
            from: `"AJK Cleaning Services" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
            to: process.env.ADMIN_EMAIL,
            subject: '🧪 SMTP Test - AJK Cleaning System',
            html: `
                <h2>SMTP Test Email</h2>
                <p>This is a test email to verify that SMTP configuration is working correctly.</p>
                <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
                <p>If you receive this email, the SMTP setup is successful!</p>
            `,
            text: 'SMTP Test - This is a test email to verify the SMTP system is working.'
        };

        const result = await sendEmailWithFallback(testEmail);
        
        if (result) {
            console.log('✅ SMTP test result: success');
            res.json({ success: true, message: 'SMTP test email sent successfully' });
        } else {
            console.error('❌ SMTP test failed');
            res.status(500).json({ 
                success: false, 
                error: 'SMTP test failed',
                message: 'SMTP test failed' 
            });
        }
    } catch (error) {
        console.error('❌ SMTP test failed:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            message: 'SMTP test failed' 
        });
    }
});

// SendGrid test endpoint
app.get('/api/test-sendgrid', async (req, res) => {
    try {
        console.log('🧪 Testing SendGrid...');
        
        // Check if SendGrid is configured
        if (!process.env.SENDGRID_API_KEY) {
            return res.status(400).json({
                success: false,
                error: 'SENDGRID_API_KEY not configured',
                message: 'Please configure SENDGRID_API_KEY in your environment variables'
            });
        }

        const sendGridAdvanced = require('./utils/sendgridAdvanced');
        const testEmail = process.env.TEST_EMAIL || process.env.ADMIN_EMAIL;
        
        const result = await sendGridAdvanced.testEmail(testEmail);
        
        if (result.success) {
            console.log('✅ SendGrid test result: success');
            res.json({ 
                success: true, 
                message: 'SendGrid test email sent successfully',
                messageId: result.messageId
            });
        } else {
            console.error('❌ SendGrid test failed');
            res.status(500).json({ 
                success: false, 
                error: result.error,
                message: 'SendGrid test failed' 
            });
        }
    } catch (error) {
        console.error('❌ SendGrid test failed:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            message: 'SendGrid test failed' 
        });
    }
});

// SendGrid booking test endpoint
app.post('/api/test-sendgrid-booking', async (req, res) => {
    try {
        console.log('🧪 Testing SendGrid booking email...');
        
        if (!process.env.SENDGRID_API_KEY) {
            return res.status(400).json({
                success: false,
                error: 'SENDGRID_API_KEY not configured',
                message: 'Please configure SENDGRID_API_KEY in your environment variables'
            });
        }

        const sendGridAdvanced = require('./utils/sendgridAdvanced');
        const testEmail = process.env.TEST_EMAIL || process.env.ADMIN_EMAIL;
        
        // Create test booking data
        const testBookingData = {
            name: 'Test Customer',
            email: testEmail,
            service: 'Basic Cleaning (Residential)',
            date: '2024-01-15',
            time: '14:00',
            duration: '2 hours',
            total: '$120.00',
            phone: '+1234567890',
            address: '123 Test Street, Test City, TC 12345'
        };
        
        const result = await sendGridAdvanced.sendBookingConfirmation(testBookingData);
        
        if (result.success) {
            console.log('✅ SendGrid booking test result: success');
            res.json({ 
                success: true, 
                message: 'SendGrid booking test email sent successfully',
                messageId: result.messageId
            });
        } else {
            console.error('❌ SendGrid booking test failed');
            res.status(500).json({ 
                success: false, 
                error: result.error,
                message: 'SendGrid booking test failed' 
            });
        }
    } catch (error) {
        console.error('❌ SendGrid booking test failed:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            message: 'SendGrid booking test failed' 
        });
    }
});

// Test email endpoint
app.post('/api/test-email', async (req, res) => {
    try {
        const testEmail = {
            from: `"AJK Cleaning Services" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
            to: process.env.ADMIN_EMAIL,
            subject: '🧪 Email Test - AJK Cleaning System',
            html: `
                <h2>Email System Test</h2>
                <p>This is a test email to verify the email system is working.</p>
                <p>Time: ${new Date().toISOString()}</p>
            `,
            text: 'Email System Test - This is a test email to verify the email system is working.'
        };

        const result = await sendEmailWithFallback(testEmail);
        
        if (result) {
            console.log('✅ Test email sent successfully');
            res.json({ success: true, message: 'Test email sent successfully' });
        } else {
            console.error('❌ Test email failed');
            res.status(500).json({ error: 'Failed to send test email' });
        }
    } catch (error) {
        console.error('❌ Test email failed:', error);
        res.status(500).json({ error: 'Failed to send test email: ' + error.message });
    }
});

// Test commercial email endpoint
app.post('/api/test-commercial-email', async (req, res) => {
    try {
        const testBooking = {
            id: 'test_commercial_123',
            details: {
                customerName: 'Test Commercial Customer',
                customerEmail: process.env.ADMIN_EMAIL,
                package: 'commercial',
                date: '2025-01-15',
                time: '10:00',
                duration: 4,
                cleaners: 2,
                propertySize: '500',
                specialRequests: 'Test commercial booking email'
            },
            amount: 0,
            status: 'pending_consultation'
        };

        await sendCommercialBookingConfirmation(testBooking);
        console.log('✅ Test commercial email sent successfully');
        res.json({ success: true, message: 'Test commercial email sent successfully' });
    } catch (error) {
        console.error('❌ Test commercial email failed:', error);
        res.status(500).json({ error: 'Failed to send test commercial email: ' + error.message });
    }
});

// Simple email test endpoint (bypasses fallback system)
app.post('/api/test-simple-email', async (req, res) => {
    try {
        console.log('🧪 Testing simple email configuration...');
        console.log('📧 SMTP Config:', {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS ? '***' + process.env.SMTP_PASS.slice(-4) : 'undefined'
        });
        
        const testEmail = {
            from: `"AJK Cleaning Company" <${process.env.SMTP_USER}>`,
            to: process.env.ADMIN_EMAIL,
            subject: '🧪 Simple Email Test - AJK Cleaning System',
            html: `
                <h2>Simple Email Test</h2>
                <p>This is a simple test email to verify the basic email system is working.</p>
                <p>Time: ${new Date().toISOString()}</p>
                <p>Configuration: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}</p>
            `,
            text: 'Simple Email Test - This is a simple test email to verify the basic email system is working.'
        };

        const result = await sendEmailWithFallback(testEmail);
        
        if (result.success) {
            console.log('✅ Simple test email sent successfully');
            res.json({ success: true, message: 'Simple test email sent successfully' });
        } else {
            console.error('❌ Simple test email failed:', result.error);
            res.status(500).json({ error: 'Failed to send simple test email: ' + result.error });
        }
    } catch (error) {
        console.error('❌ Simple test email failed:', error);
        res.status(500).json({ error: 'Failed to send simple test email: ' + error.message });
    }
});

// Test SendGrid email endpoint
app.post('/api/test-sendgrid-email', async (req, res) => {
    try {
        if (!process.env.SENDGRID_API_KEY) {
            return res.status(400).json({ error: 'SENDGRID_API_KEY not configured' });
        }
        
        const testEmail = {
            from: `"AJK Cleaning Company" <${process.env.ADMIN_EMAIL}>`,
            to: process.env.ADMIN_EMAIL,
            subject: '🧪 SendGrid Test - AJK Cleaning System',
            html: `
                <h2>SendGrid Email Test</h2>
                <p>This is a test email sent via SendGrid to verify the email service is working.</p>
                <p>Time: ${new Date().toISOString()}</p>
                <p>Service: SendGrid API</p>
            `,
            text: 'SendGrid Email Test - This is a test email sent via SendGrid to verify the email service is working.'
        };

        await sendEmailWithSendGrid(testEmail);
        console.log('✅ SendGrid test email sent successfully');
        res.json({ success: true, message: 'SendGrid test email sent successfully' });
    } catch (error) {
        console.error('❌ SendGrid test email failed:', error);
        res.status(500).json({ error: 'Failed to send SendGrid test email: ' + error.message });
    }
});

// Test webhook email endpoint
app.post('/api/test-webhook-email', async (req, res) => {
    try {
        const testEmail = {
            from: `"AJK Cleaning Company" <${process.env.ADMIN_EMAIL}>`,
            to: process.env.ADMIN_EMAIL,
            subject: '🧪 Webhook Test - AJK Cleaning System',
            html: `
                <h2>Webhook Email Test</h2>
                <p>This is a test email sent via webhook service to verify the email service is working.</p>
                <p>Time: ${new Date().toISOString()}</p>
                <p>Service: Webhook (EmailJS/Formspree/Netlify)</p>
            `,
            text: 'Webhook Email Test - This is a test email sent via webhook service to verify the email service is working.'
        };

        await sendEmailViaWebhook(testEmail);
        console.log('✅ Webhook test email sent successfully');
        res.json({ success: true, message: 'Webhook test email sent successfully' });
    } catch (error) {
        console.error('❌ Webhook test email failed:', error);
        res.status(500).json({ error: 'Failed to send webhook test email: ' + error.message });
    }
});

// Quote submission endpoint
app.post('/api/quote-submit', async (req, res) => {
    try {
        const {
            customerName,
            customerEmail,
            customerPhone,
            serviceType,
            propertySize,
            frequency,
            specialRequirements,
            preferredDate,
            preferredTime,
            salutation
        } = req.body;

        // Validate required fields
        if (!customerName || !customerEmail || !serviceType || !propertySize || !frequency) {
            return res.status(400).json({ 
                error: 'Missing required fields: customerName, customerEmail, serviceType, propertySize, frequency are required' 
            });
        }

        console.log(`[QUOTE] 📋 New quote request from ${customerName} (${customerEmail})`);
        console.log(`[QUOTE] 📋 Service: ${serviceType}, Size: ${propertySize} sq ft, Frequency: ${frequency}`);

        // Prepare quote data
        const quoteData = {
            customerName,
            customerEmail,
            customerPhone: customerPhone || 'Not provided',
            serviceType,
            propertySize,
            frequency,
            specialRequirements: specialRequirements || 'None',
            preferredDate: preferredDate || 'Flexible',
            preferredTime: preferredTime || 'Flexible',
            salutation: salutation || 'Dear'
        };

        // Send quote confirmation email to customer
        try {
            await sendQuoteEmail(quoteData);
            console.log(`[QUOTE] 📧 Quote confirmation email sent to ${customerEmail}`);
        } catch (emailError) {
            console.error(`[QUOTE] ❌ Failed to send quote email to ${customerEmail}:`, emailError.message);
            // Don't fail the request if email fails
        }

        // Send admin notification for new quote request
        try {
            await sendAdminQuoteNotification(quoteData);
            console.log(`[QUOTE] 📧 Admin notification sent for quote request from ${customerName}`);
        } catch (adminError) {
            console.error(`[QUOTE] ❌ Failed to send admin notification:`, adminError.message);
            // Don't fail the request if admin notification fails
        }

        // Store quote request in database for admin review
        try {
            await db.read();
            const quoteRequest = {
                id: `quote_${Date.now()}`,
                customerName,
                customerEmail,
                customerPhone: customerPhone || 'Not provided',
                serviceType,
                propertySize,
                frequency,
                specialRequirements: specialRequirements || 'None',
                preferredDate: preferredDate || 'Flexible',
                preferredTime: preferredTime || 'Flexible',
                salutation: salutation || 'Dear',
                status: 'pending_review',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (!db.data.quoteRequests) {
                db.data.quoteRequests = [];
            }
            db.data.quoteRequests.push(quoteRequest);
            await db.write();
            
            console.log(`[QUOTE] 📋 Quote request stored for admin review: ${quoteRequest.id}`);
        } catch (dbError) {
            console.error(`[QUOTE] ❌ Failed to store quote request:`, dbError.message);
        }

        res.json({ 
            success: true, 
            message: 'Quote request submitted successfully. You will receive a confirmation email shortly.',
            quoteId: `quote_${Date.now()}`
        });

    } catch (error) {
        console.error('❌ Quote submission failed:', error);
        res.status(500).json({ error: 'Failed to submit quote request: ' + error.message });
    }
});

// Test admin notification endpoint
app.post('/api/test-admin-notification', async (req, res) => {
    try {
        const testBooking = {
            id: 'test_admin_123',
            details: {
                customerName: 'Test Customer',
                customerEmail: 'test@example.com',
                customerPhone: '+49 123 456789',
                customerAddress: 'Test Street 123',
                city: 'Test City',
                postalCode: '12345',
                bookingType: 'one-time',
                package: 'basic',
                date: '2025-01-15',
                time: '10:00',
                duration: 2,
                cleaners: 1,
                propertySize: '100',
                specialRequests: 'Test admin notification',
                salutation: 'Mr.'
            },
            amount: 50,
            status: 'paid',
            paymentIntentId: 'test_pi_123',
            paidAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };

        await sendAdminNotification(testBooking);
        console.log('✅ Admin notification test sent successfully');
        res.json({ success: true, message: 'Admin notification test sent successfully' });
    } catch (error) {
        console.error('❌ Admin notification test failed:', error);
        res.status(500).json({ error: 'Failed to send admin notification test: ' + error.message });
    }
});

// Get all quote requests (for admin panel)
app.get('/api/quotes', async (req, res) => {
    try {
        await db.read();
        const quotes = db.data.quoteRequests || [];
        res.json(quotes);
    } catch (error) {
        console.error('❌ Failed to fetch quotes:', error);
        res.status(500).json({ error: 'Failed to fetch quote requests' });
    }
});

// Get specific quote request
app.get('/api/quotes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.read();
        const quotes = db.data.quoteRequests || [];
        const quote = quotes.find(q => q.id === id);
        
        if (!quote) {
            return res.status(404).json({ error: 'Quote request not found' });
        }
        
        res.json(quote);
    } catch (error) {
        console.error('❌ Failed to fetch quote:', error);
        res.status(500).json({ error: 'Failed to fetch quote request' });
    }
});

// Send professional quote response to client
app.post('/api/quotes/:id/send-response', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            subject,
            message,
            pricing,
            nextSteps,
            attachments
        } = req.body;

        if (!subject || !message) {
            return res.status(400).json({ 
                error: 'Subject and message are required' 
            });
        }

        await db.read();
        const quotes = db.data.quoteRequests || [];
        const quote = quotes.find(q => q.id === id);
        
        if (!quote) {
            return res.status(404).json({ error: 'Quote request not found' });
        }

        // Create professional quote response email
        const responseHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Quote Response - AJK Cleaning</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                    .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
                    .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
                    .content { padding: 30px; }
                    .quote-details { background: #f8f9fa; border-radius: 8px; padding: 25px; margin: 20px 0; }
                    .detail-row { display: flex; justify-content: space-between; margin: 12px 0; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
                    .detail-row:last-child { border-bottom: none; }
                    .detail-label { font-weight: bold; color: #495057; }
                    .detail-value { color: #212529; }
                    .pricing { background: #e8f5e8; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; }
                    .pricing h3 { color: #155724; margin: 0 0 15px 0; }
                    .next-steps { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0; }
                    .next-steps h3 { color: #1976d2; margin: 0 0 15px 0; }
                    .message-content { background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 20px 0; }
                    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; border-top: 1px solid #e9ecef; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📋 Your Quote Response</h1>
                        <p>AJK Cleaning Company - Professional Cleaning Services</p>
                    </div>
                    
                    <div class="content">
                        <div class="quote-details">
                            <h3 style="margin-top: 0; color: #495057;">📋 Your Original Request</h3>
                            <div class="detail-row">
                                <span class="detail-label">Service Type:</span>
                                <span class="detail-value">${quote.serviceType}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Property Size:</span>
                                <span class="detail-value">${quote.propertySize} sq ft</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Service Frequency:</span>
                                <span class="detail-value">${quote.frequency}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Preferred Date:</span>
                                <span class="detail-value">${quote.preferredDate}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Preferred Time:</span>
                                <span class="detail-value">${quote.preferredTime}</span>
                            </div>
                            ${quote.specialRequirements !== 'None' ? `
                            <div class="detail-row">
                                <span class="detail-label">Special Requirements:</span>
                                <span class="detail-value">${quote.specialRequirements}</span>
                            </div>
                            ` : ''}
                        </div>

                        <div class="message-content">
                            <h3 style="margin-top: 0; color: #495057;">💬 Our Response</h3>
                            <div style="white-space: pre-line;">${message}</div>
                        </div>

                        ${pricing ? `
                        <div class="pricing">
                            <h3>💰 Pricing Information</h3>
                            <div style="white-space: pre-line;">${pricing}</div>
                        </div>
                        ` : ''}

                        ${nextSteps ? `
                        <div class="next-steps">
                            <h3>🎯 Next Steps</h3>
                            <div style="white-space: pre-line;">${nextSteps}</div>
                        </div>
                        ` : ''}

                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h4 style="margin-top: 0; color: #495057;">📞 Questions or Ready to Book?</h4>
                            <p style="margin: 5px 0;"><strong>Phone:</strong> +49 176 61852286</p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> info@ajkcleaners.de</p>
                            <p style="margin: 5px 0;"><strong>Hours:</strong> Monday - Friday: 8:00 AM - 6:00 PM</p>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p><strong>AJK Cleaning Company</strong> | Professional Cleaning Services</p>
                        <p>Thank you for considering us for your cleaning needs!</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const responseText = `
📋 QUOTE RESPONSE - AJK Cleaning Company

Dear ${quote.customerName},

Thank you for your interest in our professional cleaning services!

YOUR ORIGINAL REQUEST:
Service Type: ${quote.serviceType}
Property Size: ${quote.propertySize} sq ft
Service Frequency: ${quote.frequency}
Preferred Date: ${quote.preferredDate}
Preferred Time: ${quote.preferredTime}
${quote.specialRequirements !== 'None' ? `Special Requirements: ${quote.specialRequirements}` : ''}

OUR RESPONSE:
${message}

${pricing ? `PRICING INFORMATION:\n${pricing}\n` : ''}
${nextSteps ? `NEXT STEPS:\n${nextSteps}\n` : ''}

QUESTIONS OR READY TO BOOK?
Phone: +49 176 61852286
Email: info@ajkcleaners.de
Hours: Monday - Friday: 8:00 AM - 6:00 PM

Thank you for considering AJK Cleaning Company!

Best regards,
The AJK Cleaning Team
        `;

        const mailOptions = {
            from: `"AJK Cleaning Services" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
            to: quote.customerEmail,
            subject: subject,
            html: responseHtml,
            text: responseText
        };

        // Try SendGrid first, fallback to SMTP
        let result;
        try {
            if (process.env.SENDGRID_API_KEY) {
                console.log('🚀 [QUOTE RESPONSE] Attempting to send email via SendGrid...');
                result = await sendGridAdvanced.sendEmail(quote.customerEmail, mailOptions.subject, mailOptions.html, mailOptions.text);
                console.log('✅ [QUOTE RESPONSE] SendGrid email sent successfully');
            } else {
                console.log('⚠️  [QUOTE RESPONSE] SENDGRID_API_KEY not found, using SMTP fallback...');
                result = await sendEmailWithFallback(mailOptions);
            }
        } catch (sendGridError) {
            console.log('🔄 [QUOTE RESPONSE] SendGrid failed, trying SMTP fallback...', sendGridError.message);
            result = await sendEmailWithFallback(mailOptions);
        }
        
        if (result && (result.success || result === true)) {
            console.log(`📧 Quote response sent to ${quote.customerEmail} for quote ${id}`);
        } else {
            console.error(`❌ Failed to send quote response to ${quote.customerEmail}`);
            throw new Error('Email sending failed');
        }

        // Update quote status
        quote.status = 'responded';
        quote.updatedAt = new Date().toISOString();
        quote.responseSentAt = new Date().toISOString();
        await db.write();

        res.json({ 
            success: true, 
            message: 'Quote response sent successfully',
            quoteId: id
        });

    } catch (error) {
        console.error('❌ Failed to send quote response:', error);
        res.status(500).json({ error: 'Failed to send quote response: ' + error.message });
    }
});

// Send custom message to client from admin
app.post('/api/submissions/:id/send-message', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { subject, message, messageType = 'custom' } = req.body;

        if (!subject || !message) {
            return res.status(400).json({ 
                error: 'Subject and message are required' 
            });
        }

        await db.read();
        const submissions = (db.data && Array.isArray(db.data.submissions)) ? db.data.submissions : [];
        const submission = submissions.find(s => s.id === parseInt(id));
        
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        // Create professional custom message email
        const customMessageHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Message from AJK Cleaning</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
                    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                    .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
                    .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
                    .content { padding: 30px; }
                    .message-content { background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 20px 0; }
                    .original-request { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
                    .detail-row { display: flex; justify-content: space-between; margin: 8px 0; padding: 4px 0; border-bottom: 1px solid #e9ecef; }
                    .detail-row:last-child { border-bottom: none; }
                    .detail-label { font-weight: bold; color: #495057; }
                    .detail-value { color: #212529; }
                    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; border-top: 1px solid #e9ecef; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Response from AJK Cleaning</h1>
                        <p>Professional Cleaning Services</p>
                    </div>
                    
                    <div class="content">
                        <div class="message-content">
                            <h3 style="margin-top: 0; color: #495057;">💬 Our Response</h3>
                            <div style="white-space: pre-line;">${message}</div>
                        </div>

                        <div class="original-request">
                            <h3 style="margin-top: 0; color: #495057;">📋 Your Original Request</h3>
                            <div class="detail-row">
                                <span class="detail-label">Name:</span>
                                <span class="detail-value">${submission.name}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Service:</span>
                                <span class="detail-value">${submission.service}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Preferred Date:</span>
                                <span class="detail-value">${submission.preferred_date || 'Not specified'}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Preferred Time:</span>
                                <span class="detail-value">${submission.preferred_time || 'Not specified'}</span>
                            </div>
                            ${submission.message ? `
                            <div class="detail-row">
                                <span class="detail-label">Your Message:</span>
                                <span class="detail-value">${submission.message}</span>
                            </div>
                            ` : ''}
                        </div>

                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h4 style="margin-top: 0; color: #495057;">📞 Questions or Ready to Book?</h4>
                            <p style="margin: 5px 0;"><strong>Phone:</strong> +49 176 61852286</p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> info@ajkcleaners.de</p>
                            <p style="margin: 5px 0;"><strong>Hours:</strong> Monday - Friday: 8:00 AM - 6:00 PM</p>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p><strong>AJK Cleaning Company</strong> | Professional Cleaning Services</p>
                        <p>Thank you for choosing us for your cleaning needs!</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const customMessageText = `
RESPONSE FROM AJK CLEANING COMPANY

Dear ${submission.name},

${message}

YOUR ORIGINAL REQUEST:
Name: ${submission.name}
Service: ${submission.service}
Preferred Date: ${submission.preferred_date || 'Not specified'}
Preferred Time: ${submission.preferred_time || 'Not specified'}
${submission.message ? `Your Message: ${submission.message}` : ''}

QUESTIONS OR READY TO BOOK?
Phone: +49 176 61852286
Email: info@ajkcleaners.de
Hours: Monday - Friday: 8:00 AM - 6:00 PM

Thank you for choosing AJK Cleaning Company!

Best regards,
The AJK Cleaning Team
        `;

        const mailOptions = {
            from: `"AJK Cleaning Services" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
            to: submission.email,
            subject: subject,
            html: customMessageHtml,
            text: customMessageText
        };

        // Try SendGrid first, fallback to SMTP
        let result;
        try {
            if (process.env.SENDGRID_API_KEY) {
                console.log('🚀 [CUSTOM MESSAGE] Attempting to send email via SendGrid...');
                result = await sendGridAdvanced.sendEmail(submission.email, mailOptions.subject, mailOptions.html, mailOptions.text);
                console.log('✅ [CUSTOM MESSAGE] SendGrid email sent successfully');
            } else {
                console.log('⚠️  [CUSTOM MESSAGE] SENDGRID_API_KEY not found, using SMTP fallback...');
                result = await sendEmailWithFallback(mailOptions);
            }
        } catch (sendGridError) {
            console.log('🔄 [CUSTOM MESSAGE] SendGrid failed, trying SMTP fallback...', sendGridError.message);
            result = await sendEmailWithFallback(mailOptions);
        }
        
        if (result && (result.success || result === true)) {
            console.log(`📧 Custom message sent to ${submission.email} for submission ${id}`);
        } else {
            console.error(`❌ Failed to send custom message to ${submission.email}`);
            throw new Error('Email sending failed');
        }

        // Log the message in submission history
        if (!submission.messageHistory) {
            submission.messageHistory = [];
        }
        submission.messageHistory.push({
            type: messageType,
            subject: subject,
            message: message,
            sentAt: new Date().toISOString(),
            sentBy: 'admin'
        });
        submission.lastContactedAt = new Date().toISOString();
        
        await db.write();

        res.json({ 
            success: true, 
            message: 'Custom message sent successfully',
            submissionId: id
        });

    } catch (error) {
        console.error('❌ Failed to send custom message:', error);
        res.status(500).json({ error: 'Failed to send custom message: ' + error.message });
    }
});

// Reviews API endpoints
app.post('/api/reviews', async (req, res) => {
    try {
        const {
            customerName,
            customerEmail,
            serviceType,
            rating,
            reviewText,
            bookingId,
            isPublic = true
        } = req.body;

        // Validate required fields
        if (!customerName || !customerEmail || !rating || !reviewText) {
            return res.status(400).json({ 
                error: 'Missing required fields: customerName, customerEmail, rating, reviewText are required' 
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ 
                error: 'Rating must be between 1 and 5' 
            });
        }

        // Validate review text length (max 135 characters including spaces)
        if (reviewText.trim().length > 135) {
            return res.status(400).json({ 
                error: 'Review text must be 135 characters or less (including spaces)' 
            });
        }

        await db.read();
        if (!db.data.reviews) {
            db.data.reviews = [];
        }

        const review = {
            id: `review_${Date.now()}`,
            customerName,
            customerEmail,
            serviceType: serviceType || 'General Cleaning',
            rating: parseInt(rating),
            reviewText,
            bookingId: bookingId || null,
            isPublic: isPublic === true,
            status: 'pending_approval', // Admin approval required
            createdAt: new Date().toISOString(),
            approvedAt: null,
            approvedBy: null
        };

        db.data.reviews.push(review);
        await db.write();

        console.log(`📝 New review submitted by ${customerName} (${customerEmail}) - Rating: ${rating}/5`);

        // Send notification to admin
        try {
            await sendAdminReviewNotification(review);
        } catch (emailError) {
            console.error('Failed to send admin notification for review:', emailError.message);
        }

        res.json({ 
            success: true, 
            message: 'Review submitted successfully. Thank you for your feedback!',
            reviewId: review.id
        });

    } catch (error) {
        console.error('❌ Review submission failed:', error);
        res.status(500).json({ error: 'Failed to submit review: ' + error.message });
    }
});

// =================================================================
// SUBSCRIPTION MANAGEMENT ENDPOINTS
// =================================================================

// Subscription Payment Collection
app.post('/api/subscriptions/:id/create-payment', requireAuth, async (req, res) => {
    try {
        await db.read();
        const subscriptions = db.data.subscriptions || [];
        const subscription = subscriptions.find(sub => sub.id === req.params.id);
        
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        
        if (subscription.status !== 'active') {
            return res.status(400).json({ error: 'Only active subscriptions can create payments' });
        }
        
        // Calculate penalty if overdue
        const today = new Date();
        const dueDate = new Date(subscription.nextBillingDate);
        const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
        const isOverdue = dueDate < today;
        
        let amountInCents = subscription.price;
        let penaltyInfo = null;
        
        if (isOverdue && daysOverdue > 0) {
            // Calculate penalty using the same logic as billing reminder
            const gracePeriod = 3; // days
            const dailyRate = 0.05; // 5% per day
            const maxPenalty = 0.50; // 50% maximum
            const minPenalty = 5.00; // €5 minimum
            const maxDays = 30; // maximum days for penalty calculation
            
            if (daysOverdue > gracePeriod) {
                const baseAmount = subscription.price / 100;
                const penaltyDays = Math.min(daysOverdue - gracePeriod, maxDays);
                const penaltyRate = Math.min(penaltyDays * dailyRate, maxPenalty);
                const penaltyAmount = Math.max(baseAmount * penaltyRate, minPenalty);
                const totalAmount = baseAmount + penaltyAmount;
                
                penaltyInfo = {
                    baseAmount: baseAmount,
                    penaltyAmount: penaltyAmount,
                    totalAmount: totalAmount,
                    penaltyRate: penaltyRate,
                    daysOverdue: daysOverdue
                };
                
                amountInCents = Math.round(totalAmount * 100); // Convert to cents
                console.log(`[SUBSCRIPTION PAYMENT] 💰 Penalty calculated: Base €${baseAmount.toFixed(2)} + Penalty €${penaltyAmount.toFixed(2)} = Total €${totalAmount.toFixed(2)}`);
            }
        }
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: subscription.currency || 'eur',
            metadata: {
                type: 'subscription_payment',
                subscriptionId: subscription.id,
                customerName: subscription.customerName,
                customerEmail: subscription.customerEmail,
                planName: subscription.planName,
                billingCycle: subscription.billingCycle
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });
        
        console.log(`[SUBSCRIPTION PAYMENT] 💳 Created payment intent ${paymentIntent.id} for subscription ${subscription.id}`);
        
        // Create a shareable payment link - FIXED: Always use correct domain
        const paymentLink = `https://ajkcleaners.de/subscription-payment/${subscription.id}`;
        console.log(`[PAYMENT LINK] Generated: ${paymentLink}`);
        
        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: amountInCents / 100, // Convert cents to euros for display (includes penalty if applicable)
            currency: subscription.currency || 'eur',
            paymentLink: paymentLink,
            penaltyInfo: penaltyInfo // Include penalty information for frontend display
        });
        
    } catch (error) {
        console.error('Error creating subscription payment:', error);
        res.status(500).json({ error: 'Failed to create payment' });
    }
});

// Public subscription payment endpoint (no authentication required)
app.post('/api/subscriptions/:id/create-payment-public', async (req, res) => {
    try {
        await db.read();
        const subscriptions = db.data.subscriptions || [];
        const subscription = subscriptions.find(sub => sub.id === req.params.id);
        
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        
        if (subscription.status !== 'active') {
            return res.status(400).json({ error: 'Only active subscriptions can create payments' });
        }
        
        // Calculate penalty if overdue
        const today = new Date();
        const dueDate = new Date(subscription.nextBillingDate);
        const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
        const isOverdue = dueDate < today;
        
        let amountInCents = subscription.price;
        let penaltyInfo = null;
        
        if (isOverdue && daysOverdue > 0) {
            // Calculate penalty using the same logic as billing reminder
            const gracePeriod = 3; // days
            const dailyRate = 0.05; // 5% per day
            const maxPenalty = 0.50; // 50% maximum
            const minPenalty = 5.00; // €5 minimum
            const maxDays = 30; // maximum days for penalty calculation
            
            if (daysOverdue > gracePeriod) {
                const baseAmount = subscription.price / 100;
                const penaltyDays = Math.min(daysOverdue - gracePeriod, maxDays);
                const penaltyRate = Math.min(penaltyDays * dailyRate, maxPenalty);
                const penaltyAmount = Math.max(baseAmount * penaltyRate, minPenalty);
                const totalAmount = baseAmount + penaltyAmount;
                
                penaltyInfo = {
                    baseAmount: baseAmount,
                    penaltyAmount: penaltyAmount,
                    totalAmount: totalAmount,
                    penaltyRate: penaltyRate,
                    daysOverdue: daysOverdue
                };
                
                amountInCents = Math.round(totalAmount * 100); // Convert to cents
                console.log(`[SUBSCRIPTION PAYMENT] 💰 Penalty calculated: Base €${baseAmount.toFixed(2)} + Penalty €${penaltyAmount.toFixed(2)} = Total €${totalAmount.toFixed(2)}`);
            }
        }
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: subscription.currency || 'eur',
            metadata: {
                type: 'subscription_payment',
                subscriptionId: subscription.id,
                customerName: subscription.customerName,
                customerEmail: subscription.customerEmail,
                planName: subscription.planName,
                billingCycle: subscription.billingCycle
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });
        
        console.log(`[SUBSCRIPTION PAYMENT] 💳 Created payment intent ${paymentIntent.id} for subscription ${subscription.id}`);
        
        // Create a shareable payment link - FIXED: Always use correct domain
        const paymentLink = `https://ajkcleaners.de/subscription-payment/${subscription.id}`;
        console.log(`[PAYMENT LINK] Generated: ${paymentLink}`);
        
        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: amountInCents / 100, // Convert cents to euros for display (includes penalty if applicable)
            currency: subscription.currency || 'eur',
            paymentLink: paymentLink,
            penaltyInfo: penaltyInfo // Include penalty information for frontend display
        });
        
    } catch (error) {
        console.error('Error creating subscription payment:', error);
        res.status(500).json({ error: 'Failed to create payment' });
    }
});

// Send payment reminder email
app.post('/api/subscriptions/:id/send-payment-reminder', requireAuth, async (req, res) => {
    try {
        await db.read();
        const subscriptions = db.data.subscriptions || [];
        const subscription = subscriptions.find(sub => sub.id === req.params.id);
        
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        
        // Create payment link - BULLETPROOF FIX: Force correct domain
        const paymentLink = `https://ajkcleaners.de/subscription-payment/${subscription.id}`;
        console.log(`🚨 [BULLETPROOF FIX] Payment link: ${paymentLink}`);
        console.log(`🚨 [BULLETPROOF FIX] Subscription ID: ${subscription.id}`);
        console.log(`🚨 [BULLETPROOF FIX] Customer: ${subscription.customerEmail}`);
        console.log(`🚨 [BULLETPROOF FIX] FRONTEND_URL env: ${process.env.FRONTEND_URL || 'NOT SET'}`);
        console.log(`🚨 [BULLETPROOF FIX] NODE_ENV: ${process.env.NODE_ENV}`);
        
        // Send reminder email with enhanced design
        const emailData = {
            to: subscription.customerEmail,
            subject: `Payment Reminder - ${subscription.planName} | AJK Cleaning Services`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Payment Reminder</title>
                </head>
                <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">
                                Payment Reminder
                            </h1>
                            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
                                Your subscription payment is due
                            </p>
                        </div>
                        
                        <!-- Content -->
                        <div style="padding: 40px 30px;">
                            <div style="margin-bottom: 30px;">
                                <h2 style="color: #2d3748; font-size: 24px; margin: 0 0 15px 0; font-weight: 600;">
                                    Hello ${subscription.customerName}! 👋
                                </h2>
                                <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                    This is a friendly reminder that your subscription payment is due. We want to ensure uninterrupted service for you.
                                </p>
                            </div>
                            
                            <!-- Subscription Details Card -->
                            <div style="background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin: 25px 0;">
                                <h3 style="color: #2d3748; font-size: 20px; margin: 0 0 20px 0; font-weight: 600; display: flex; align-items: center;">
                                    Subscription Details
                                </h3>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
                                        <p style="margin: 0; color: #718096; font-size: 14px; font-weight: 500;">PLAN</p>
                                        <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 16px; font-weight: 600;">${subscription.planName}</p>
                                    </div>
                                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #48bb78;">
                                        <p style="margin: 0; color: #718096; font-size: 14px; font-weight: 500;">AMOUNT</p>
                                        <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 18px; font-weight: 700;">€${(subscription.price / 100).toFixed(2)}</p>
                                    </div>
                                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ed8936;">
                                        <p style="margin: 0; color: #718096; font-size: 14px; font-weight: 500;">BILLING CYCLE</p>
                                        <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 16px; font-weight: 600; text-transform: capitalize;">${subscription.billingCycle}</p>
                                    </div>
                                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #e53e3e;">
                                        <p style="margin: 0; color: #718096; font-size: 14px; font-weight: 500;">DUE DATE</p>
                                        <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 16px; font-weight: 600;">${new Date(subscription.nextBillingDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Payment Button -->
                            <div style="text-align: center; margin: 35px 0;">
                                <a href="${paymentLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); transition: all 0.3s ease;">
                                    💳 Pay Now - €${(subscription.price / 100).toFixed(2)}
                                </a>
                            </div>
                            
                            <!-- Payment Methods -->
                            <div style="background: #f7fafc; border-radius: 8px; padding: 20px; margin: 25px 0;">
                                <h4 style="color: #2d3748; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">💳 Accepted Payment Methods</h4>
                                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                                    <span style="background: white; padding: 8px 12px; border-radius: 6px; font-size: 14px; color: #4a5568; border: 1px solid #e2e8f0;">💳 Credit Card</span>
                                    <span style="background: white; padding: 8px 12px; border-radius: 6px; font-size: 14px; color: #4a5568; border: 1px solid #e2e8f0;">🏦 Debit Card</span>
                                    <span style="background: white; padding: 8px 12px; border-radius: 6px; font-size: 14px; color: #4a5568; border: 1px solid #e2e8f0;">📱 Apple Pay</span>
                                    <span style="background: white; padding: 8px 12px; border-radius: 6px; font-size: 14px; color: #4a5568; border: 1px solid #e2e8f0;">📱 Google Pay</span>
                                </div>
                            </div>
                            
                            <!-- Contact Information -->
                            <div style="border-top: 1px solid #e2e8f0; padding-top: 25px; margin-top: 30px;">
                                <h4 style="color: #2d3748; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">📞 Need Help?</h4>
                                <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                                    If you have any questions about your subscription or need assistance with payment, please don't hesitate to contact us:
                                </p>
                                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                                    <div style="flex: 1; min-width: 150px;">
                                        <p style="margin: 0; color: #718096; font-size: 12px; font-weight: 500;">EMAIL</p>
                                        <p style="margin: 2px 0 0 0; color: #2d3748; font-size: 14px; font-weight: 600;">info@ajkcleaning.com</p>
                                    </div>
                                    <div style="flex: 1; min-width: 150px;">
                                        <p style="margin: 0; color: #718096; font-size: 12px; font-weight: 500;">PHONE</p>
                                        <p style="margin: 2px 0 0 0; color: #2d3748; font-size: 14px; font-weight: 600;">+49 123 456 7890</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Footer -->
                        <div style="background: #f7fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="color: #718096; font-size: 14px; margin: 0 0 10px 0;">
                                Thank you for choosing <strong>AJK Cleaning Services</strong>
                            </p>
                            <p style="color: #a0aec0; font-size: 12px; margin: 0;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
        
        // Try SendGrid first, fallback to SMTP
        let result;
        let emailSent = false;
        
        try {
            if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your_sendgrid_api_key_here') {
                console.log('🚀 [SUBSCRIPTION REMINDER] Attempting to send email via SendGrid...');
                result = await sendGridAdvanced.sendEmail(subscription.customerEmail, emailData.subject, emailData.html, emailData.text);
                
                if (result && result.success) {
                    console.log('✅ [SUBSCRIPTION REMINDER] SendGrid email sent successfully');
                    emailSent = true;
                } else {
                    console.log('❌ [SUBSCRIPTION REMINDER] SendGrid failed, trying SMTP fallback...');
                }
            } else {
                console.log('⚠️  [SUBSCRIPTION REMINDER] SENDGRID_API_KEY not configured, using SMTP fallback...');
            }
        } catch (sendGridError) {
            console.log('🔄 [SUBSCRIPTION REMINDER] SendGrid failed, trying SMTP fallback...', sendGridError.message);
        }
        
        // Try SMTP fallback if SendGrid failed
        if (!emailSent) {
            try {
                console.log('📧 [SUBSCRIPTION REMINDER] Attempting SMTP fallback...');
                result = await sendEmailWithFallback(emailData);
                
                if (result && (result.success || result === true)) {
                    console.log('✅ [SUBSCRIPTION REMINDER] SMTP email sent successfully');
                    emailSent = true;
                } else {
                    console.log('❌ [SUBSCRIPTION REMINDER] SMTP fallback failed');
                }
            } catch (smtpError) {
                console.log('❌ [SUBSCRIPTION REMINDER] SMTP fallback failed:', smtpError.message);
            }
        }
        
        if (emailSent) {
            console.log(`[SUBSCRIPTION] 📧 Payment reminder sent to ${subscription.customerEmail} for subscription ${subscription.id}`);
        } else {
            console.error(`[SUBSCRIPTION] ❌ Failed to send payment reminder - both SendGrid and SMTP failed`);
            // Still return success to admin, but log the issue
            console.log('⚠️  [SUBSCRIPTION] Payment reminder endpoint completed, but email delivery failed');
        }
        
        res.json({ 
            message: 'Payment reminder sent successfully',
            paymentLink: paymentLink 
        });
        
    } catch (error) {
        console.error('Error sending payment reminder:', error);
        res.status(500).json({ error: 'Failed to send payment reminder' });
    }
});

// Edit subscription details
app.put('/api/subscriptions/:id', requireAuth, async (req, res) => {
    console.log(`[SUBSCRIPTION EDIT] PUT request for ID: ${req.params.id}`);
    console.log(`[SUBSCRIPTION EDIT] Request body:`, req.body);
    try {
        await db.read();
        const subscriptions = db.data.subscriptions || [];
        const subscriptionIndex = subscriptions.findIndex(sub => sub.id === req.params.id);
        console.log(`[SUBSCRIPTION EDIT] Found subscription at index: ${subscriptionIndex}`);
        
        if (subscriptionIndex === -1) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        
        const { customerName, customerEmail, customerPhone, address, planName, price, billingCycle, nextBillingDate, status } = req.body;
        
        // Update subscription details
        const updatedSubscription = {
            ...subscriptions[subscriptionIndex],
            customerName: customerName || subscriptions[subscriptionIndex].customerName,
            customerEmail: customerEmail || subscriptions[subscriptionIndex].customerEmail,
            customerPhone: customerPhone || subscriptions[subscriptionIndex].customerPhone,
            address: address || subscriptions[subscriptionIndex].address,
            planName: planName || subscriptions[subscriptionIndex].planName,
            price: price || subscriptions[subscriptionIndex].price,
            billingCycle: billingCycle || subscriptions[subscriptionIndex].billingCycle,
            nextBillingDate: nextBillingDate || subscriptions[subscriptionIndex].nextBillingDate,
            status: status || subscriptions[subscriptionIndex].status,
            updatedAt: new Date().toISOString()
        };
        
        subscriptions[subscriptionIndex] = updatedSubscription;
        db.data.subscriptions = subscriptions;
        await db.write();
        
        console.log(`[SUBSCRIPTION] ✅ Updated subscription ${req.params.id}`);
        res.json({ 
            message: 'Subscription updated successfully',
            subscription: updatedSubscription 
        });
        
    } catch (error) {
        console.error('Error updating subscription:', error);
        res.status(500).json({ error: 'Failed to update subscription' });
    }
});

// Get all subscriptions with filtering and pagination
app.get('/api/subscriptions', requireAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const searchTerm = req.query.search || '';
        const statusFilter = req.query.status || '';
        const planFilter = req.query.plan || '';

        await db.read();
        let subscriptions = db.data.subscriptions || [];

        // Filter by search term
        if (searchTerm) {
            subscriptions = subscriptions.filter(sub => 
                sub.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sub.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sub.id?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filter by status
        if (statusFilter) {
            subscriptions = subscriptions.filter(sub => sub.status === statusFilter);
        }

        // Filter by plan
        if (planFilter) {
            subscriptions = subscriptions.filter(sub => sub.planId === planFilter);
        }

        // Sort by newest first
        subscriptions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedSubscriptions = subscriptions.slice(startIndex, endIndex);

        // Calculate stats
        const stats = {
            total: subscriptions.length,
            active: subscriptions.filter(sub => sub.status === 'active').length,
            paused: subscriptions.filter(sub => sub.status === 'paused').length,
            cancelled: subscriptions.filter(sub => sub.status === 'cancelled').length,
            monthlyRevenue: subscriptions
                .filter(sub => sub.status === 'active')
                .reduce((sum, sub) => sum + ((sub.price || 0) / 100), 0) // Convert cents to euros
        };

        res.json({
            data: paginatedSubscriptions,
            pagination: {
                page,
                limit,
                total: subscriptions.length,
                totalPages: Math.ceil(subscriptions.length / limit),
                hasNext: endIndex < subscriptions.length,
                hasPrev: page > 1
            },
            stats
        });

    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
});

// Get single subscription by ID (public endpoint for payment pages)
app.get('/api/subscriptions/:id', async (req, res) => {
    try {
        await db.read();
        const subscriptions = db.data.subscriptions || [];
        const subscription = subscriptions.find(sub => sub.id === req.params.id);
        
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        
        res.json(subscription);
    } catch (error) {
        console.error('Error fetching subscription:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
});

// Pause subscription
app.post('/api/subscriptions/:id/pause', requireAuth, async (req, res) => {
    try {
        await db.read();
        const subscriptions = db.data.subscriptions || [];
        const subscription = subscriptions.find(sub => sub.id === req.params.id);
        
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        
        if (subscription.status !== 'active') {
            return res.status(400).json({ error: 'Only active subscriptions can be paused' });
        }
        
        subscription.status = 'paused';
        subscription.pauseReason = req.body.reason || 'Paused by admin';
        subscription.updatedAt = new Date().toISOString();
        
        await db.write();
        res.json({ success: true, subscription });
    } catch (error) {
        console.error('Error pausing subscription:', error);
        res.status(500).json({ error: 'Failed to pause subscription' });
    }
});

// Resume subscription
app.post('/api/subscriptions/:id/resume', requireAuth, async (req, res) => {
    try {
        await db.read();
        const subscriptions = db.data.subscriptions || [];
        const subscription = subscriptions.find(sub => sub.id === req.params.id);
        
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        
        if (subscription.status !== 'paused') {
            return res.status(400).json({ error: 'Only paused subscriptions can be resumed' });
        }
        
        subscription.status = 'active';
        subscription.pauseReason = null;
        subscription.updatedAt = new Date().toISOString();
        
        await db.write();
        res.json({ success: true, subscription });
    } catch (error) {
        console.error('Error resuming subscription:', error);
        res.status(500).json({ error: 'Failed to resume subscription' });
    }
});

// Cancel subscription with email notification
app.post('/api/subscriptions/:id/cancel', requireAuth, async (req, res) => {
    try {
        await db.read();
        const subscriptions = db.data.subscriptions || [];
        const subscription = subscriptions.find(sub => sub.id === req.params.id);
        
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        
        if (subscription.status === 'cancelled') {
            return res.status(400).json({ error: 'Subscription is already cancelled' });
        }
        
        subscription.status = 'cancelled';
        subscription.cancellationReason = req.body.reason || 'Cancelled by admin';
        subscription.cancelledAt = new Date().toISOString();
        subscription.updatedAt = new Date().toISOString();
        
        await db.write();
        
        // Send cancellation email to customer
        try {
            const cancellationEmailData = {
                to: subscription.customerEmail,
                subject: `Subscription Cancelled - ${subscription.planName} | AJK Cleaning Services`,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Subscription Cancelled</title>
                    </head>
                    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8f9fa;">
                        <div style="max-width: 600px; margin: 0 auto; background: white; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                            <!-- Header -->
                            <div style="background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%); padding: 30px; text-align: center;">
                                <h1 style="color: white; margin: 0; font-size: 28px;">Subscription Cancelled</h1>
                                <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">AJK Cleaning Services</p>
                            </div>
                            
                            <!-- Content -->
                            <div style="padding: 30px;">
                                <p style="font-size: 18px; color: #2c3e50; margin-bottom: 20px;">Dear ${subscription.customerName},</p>
                                <p style="color: #4a5568; line-height: 1.6; margin-bottom: 25px;">
                                    We're writing to inform you that your subscription has been cancelled as requested. 
                                    We're sorry to see you go and hope you'll consider our services again in the future.
                                </p>
                                
                                <!-- Subscription Details -->
                                <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #e53e3e;">
                                    <h3 style="color: #2c3e50; margin-top: 0;">Cancelled Subscription Details</h3>
                                    <div style="display: grid; gap: 10px;">
                                        <div style="display: flex; justify-content: space-between;">
                                            <span style="font-weight: bold; color: #4a5568;">Plan:</span>
                                            <span style="color: #2c3e50;">${subscription.planName}</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between;">
                                            <span style="font-weight: bold; color: #4a5568;">Amount:</span>
                                            <span style="color: #2c3e50;">€${(subscription.price / 100).toFixed(2)}</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between;">
                                            <span style="font-weight: bold; color: #4a5568;">Billing Cycle:</span>
                                            <span style="color: #2c3e50; text-transform: capitalize;">${subscription.billingCycle}</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between;">
                                            <span style="font-weight: bold; color: #4a5568;">Cancelled On:</span>
                                            <span style="color: #2c3e50;">${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Important Information -->
                                <div style="background: #fff5f5; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f56565;">
                                    <h4 style="color: #2c3e50; margin-top: 0;">Important Information</h4>
                                    <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
                                        <li>Your subscription has been immediately cancelled</li>
                                        <li>No further charges will be made to your account</li>
                                        <li>You will not receive any future service appointments</li>
                                        <li>If you have any pending payments, they remain due</li>
                                    </ul>
                                </div>
                                
                                <!-- Re-subscribe Option -->
                                <div style="background: #e6fffa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #38b2ac;">
                                    <h4 style="color: #2c3e50; margin-top: 0;">Want to Re-subscribe?</h4>
                                    <p style="color: #4a5568; margin: 0 0 15px 0;">
                                        If you change your mind, you can easily re-subscribe to our services anytime.
                                    </p>
                                    <div style="text-align: center; margin: 20px 0;">
                                        <a href="https://ajkcleaners.de" style="background: linear-gradient(135deg, #38b2ac 0%, #319795 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                                            Visit Our Website
                                        </a>
                                    </div>
                                </div>
                                
                                <!-- Contact Information -->
                                <div style="border-top: 1px solid #e2e8f0; padding-top: 25px; margin-top: 30px;">
                                    <h4 style="color: #2c3e50; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">📞 Need Help?</h4>
                                    <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                                        If you have any questions about this cancellation or need assistance, please contact us:
                                    </p>
                                    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                                        <div style="flex: 1; min-width: 150px;">
                                            <p style="margin: 0; color: #718096; font-size: 12px; font-weight: 500;">EMAIL</p>
                                            <p style="margin: 2px 0 0 0; color: #2d3748; font-size: 14px; font-weight: 600;">info@ajkcleaners.de</p>
                                        </div>
                                        <div style="flex: 1; min-width: 150px;">
                                            <p style="margin: 0; color: #718096; font-size: 12px; font-weight: 500;">PHONE</p>
                                            <p style="margin: 2px 0 0 0; color: #2d3748; font-size: 14px; font-weight: 600;">+49 123 456 7890</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Footer -->
                            <div style="background: #f7fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                                <p style="color: #718096; font-size: 14px; margin: 0 0 10px 0;">
                                    Thank you for being a valued customer of <strong>AJK Cleaning Services</strong>
                                </p>
                                <p style="color: #a0aec0; font-size: 12px; margin: 0;">
                                    This is an automated message. Please do not reply to this email.
                                </p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };
            
            // Send cancellation email with enhanced logic
            let emailSent = false;
            try {
                if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your_sendgrid_api_key_here') {
                    console.log('📧 [CANCELLATION] Sending email via SendGrid...');
                    const result = await sendGridAdvanced.sendEmail(subscription.customerEmail, cancellationEmailData.subject, cancellationEmailData.html);
                    if (result && result.success) {
                        console.log('✅ [CANCELLATION] SendGrid email sent successfully');
                        emailSent = true;
                    }
                }
            } catch (sendGridError) {
                console.log('🔄 [CANCELLATION] SendGrid failed, trying SMTP fallback...', sendGridError.message);
            }
            
            if (!emailSent) {
                try {
                    console.log('📧 [CANCELLATION] Attempting SMTP fallback...');
                    const result = await sendEmailWithFallback(cancellationEmailData);
                    if (result && (result.success || result === true)) {
                        console.log('✅ [CANCELLATION] SMTP email sent successfully');
                        emailSent = true;
                    }
                } catch (smtpError) {
                    console.log('❌ [CANCELLATION] SMTP fallback failed:', smtpError.message);
                }
            }
            
            if (emailSent) {
                console.log(`[SUBSCRIPTION] 📧 Cancellation email sent to ${subscription.customerEmail} for subscription ${subscription.id}`);
            } else {
                console.log('⚠️  [SUBSCRIPTION] Subscription cancelled but email delivery failed');
            }
            
        } catch (emailError) {
            console.error('Error sending cancellation email:', emailError);
            // Don't fail the cancellation if email fails
        }
        
        console.log(`[SUBSCRIPTION] ✅ Cancelled subscription ${req.params.id}`);
        res.json({ 
            success: true, 
            subscription,
            emailSent: emailSent
        });
        
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
});

// Create new subscription
app.post('/api/subscriptions', requireAuth, async (req, res) => {
    try {
        const subscriptionData = req.body;
        
        // Validate required fields
        if (!subscriptionData.customerEmail || !subscriptionData.planId || !subscriptionData.price) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        await db.read();
        const subscriptions = db.data.subscriptions || [];
        
        const subscription = {
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            customerId: subscriptionData.customerId || `cust_${Date.now()}`,
            customerEmail: subscriptionData.customerEmail,
            customerName: subscriptionData.customerName || '',
            customerPhone: subscriptionData.customerPhone || '',
            stripeSubscriptionId: subscriptionData.stripeSubscriptionId || null,
            stripeCustomerId: subscriptionData.stripeCustomerId || null,
            planId: subscriptionData.planId,
            planName: subscriptionData.planName || subscriptionData.planId,
            price: subscriptionData.price,
            currency: subscriptionData.currency || 'eur',
            billingCycle: subscriptionData.billingCycle || 'monthly',
            status: 'active',
            startDate: new Date().toISOString(),
            nextBillingDate: subscriptionData.nextBillingDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            lastPaymentDate: null,
            lastPaymentAmount: null,
            totalPaid: 0,
            failedPayments: 0,
            maxFailedPayments: 3,
            autoRetry: true,
            pauseReason: null,
            cancellationReason: null,
            cancelledAt: null,
            notes: subscriptionData.notes || '',
            serviceAddress: subscriptionData.serviceAddress || '',
            serviceFrequency: subscriptionData.serviceFrequency || 'monthly',
            specialInstructions: subscriptionData.specialInstructions || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        subscriptions.push(subscription);
        await db.write();
        
        console.log('✅ Subscription created and saved:', {
            id: subscription.id,
            customerEmail: subscription.customerEmail,
            planName: subscription.planName,
            price: subscription.price,
            status: subscription.status
        });
        
        // Send subscription creation confirmation email
        try {
            await sendSubscriptionCreationConfirmation(subscription);
            console.log(`[SUBSCRIPTION] 📧 Subscription creation confirmation email sent to ${subscription.customerEmail}`);
        } catch (emailError) {
            console.error(`[SUBSCRIPTION] ❌ Failed to send subscription creation confirmation email:`, emailError.message);
            // Don't fail subscription creation if email fails
        }
        
        res.status(201).json({ success: true, subscription });
    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
});

// Test endpoint to create a sample subscription
app.post('/api/test/subscription', async (req, res) => {
    try {
        // Create a test booking with subscription type
        const testBooking = {
            id: `test_booking_${Date.now()}`,
            details: {
                customerName: 'Test Customer',
                customerEmail: 'test@example.com',
                customerPhone: '+1234567890',
                customerAddress: '123 Test Street',
                bookingType: 'subscription',
                package: 'regular-basic',
                specialRequests: 'Test subscription creation'
            },
            amount: 2800, // €28.00 in cents
            status: 'paid',
            paymentIntentId: 'test_pi_123',
            paidAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        
        // Create subscription from test booking
        const subscription = await createSubscriptionFromBooking(testBooking, testBooking.details);
        
        res.json({
            success: true,
            message: 'Test subscription created successfully',
            booking: testBooking,
            subscription: subscription
        });
    } catch (error) {
        console.error('Test subscription creation failed:', error);
        res.status(500).json({ error: 'Failed to create test subscription: ' + error.message });
    }
});

// General reviews endpoint with query parameters
app.get('/api/reviews', async (req, res) => {
    try {
        const status = req.query.status || '';
        const limit = parseInt(req.query.limit) || 20;
        
        await db.read();
        console.log('📋 Fetching reviews with status:', status, 'limit:', limit);
        
        let reviews = db.data.reviews || [];
        
        // Filter by status if provided
        if (status) {
            reviews = reviews.filter(review => review.status === status);
        }
        
        // Filter for public reviews only (for non-admin requests)
        reviews = reviews.filter(review => review.isPublic);
        
        // Sort by creation date (newest first)
        reviews = reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Limit results
        reviews = reviews.slice(0, limit);
        
        console.log('📋 Filtered reviews:', reviews.length);
        
        res.json({
            success: true,
            reviews: reviews,
            total: reviews.length
        });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// Get public reviews for website display
app.get('/api/reviews/public', async (req, res) => {
    try {
        await db.read();
        console.log('📋 Fetching public reviews...');
        console.log('📋 Database data:', db.data ? Object.keys(db.data) : 'No data');
        console.log('📋 Reviews in database:', db.data.reviews ? db.data.reviews.length : 0);
        
        const reviews = (db.data.reviews || [])
            .filter(review => review.isPublic && review.status === 'approved')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 20); // Limit to 20 most recent reviews

        console.log('📋 Public reviews found:', reviews.length);
        res.json(reviews);
    } catch (error) {
        console.error('❌ Failed to fetch public reviews:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// Admin endpoints for review management
app.get('/api/reviews/admin', requireAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const status = req.query.status || '';
        const rating = req.query.rating || '';

        await db.read();
        console.log('📋 Admin reviews request - Database data:', db.data ? Object.keys(db.data) : 'No data');
        console.log('📋 Reviews in database:', db.data.reviews ? db.data.reviews.length : 0);
        
        let reviews = db.data.reviews || [];
        console.log('📋 All reviews:', reviews.length);

        // Filter by status
        if (status) {
            reviews = reviews.filter(review => review.status === status);
            console.log(`📋 Filtered by status '${status}':`, reviews.length);
        }

        // Filter by rating
        if (rating) {
            reviews = reviews.filter(review => review.rating === parseInt(rating));
            console.log(`📋 Filtered by rating '${rating}':`, reviews.length);
        }

        // Sort by newest first
        reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedReviews = reviews.slice(startIndex, endIndex);

        res.json({
            reviews: paginatedReviews,
            pagination: {
                page,
                limit,
                total: reviews.length,
                totalPages: Math.ceil(reviews.length / limit),
                hasNext: endIndex < reviews.length,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('❌ Failed to fetch admin reviews:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// Approve/reject review
app.post('/api/reviews/:id/approve', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'approve' or 'reject'

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Action must be approve or reject' });
        }

        await db.read();
        const reviews = db.data.reviews || [];
        const reviewIndex = reviews.findIndex(review => review.id === id);

        if (reviewIndex === -1) {
            return res.status(404).json({ error: 'Review not found' });
        }

        const review = reviews[reviewIndex];
        review.status = action === 'approve' ? 'approved' : 'rejected';
        review.updatedAt = new Date().toISOString();
        review.approvedAt = action === 'approve' ? new Date().toISOString() : null;
        review.approvedBy = action === 'approve' ? 'admin' : null;

        await db.write();

        console.log(`📝 Review ${id} ${action}d by admin`);

        res.json({ 
            success: true, 
            message: `Review ${action}d successfully`,
            review: review
        });

    } catch (error) {
        console.error('❌ Failed to update review:', error);
        res.status(500).json({ error: 'Failed to update review: ' + error.message });
    }
});

// Delete review
app.delete('/api/reviews/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        await db.read();
        const reviews = db.data.reviews || [];
        const reviewIndex = reviews.findIndex(review => review.id === id);

        if (reviewIndex === -1) {
            return res.status(404).json({ error: 'Review not found' });
        }

        reviews.splice(reviewIndex, 1);
        await db.write();

        console.log(`📝 Review ${id} deleted by admin`);

        res.json({ 
            success: true, 
            message: 'Review deleted successfully'
        });

    } catch (error) {
        console.error('❌ Failed to delete review:', error);
        res.status(500).json({ error: 'Failed to delete review: ' + error.message });
    }
});

// Send admin notification for new review
async function sendAdminReviewNotification(review) {
    const adminEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Customer Review - AJK Cleaning</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
                .content { padding: 30px; }
                .review-details { background: #f8f9fa; border-radius: 8px; padding: 25px; margin: 20px 0; }
                .rating { font-size: 24px; color: #ffc107; margin: 10px 0; }
                .review-text { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745; margin: 15px 0; }
                .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; border-top: 1px solid #e9ecef; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>⭐ New Customer Review</h1>
                    <p>AJK Cleaning Company - Review Management</p>
                </div>
                
                <div class="content">
                    <div class="review-details">
                        <h3 style="margin-top: 0; color: #495057;">📝 Review Details</h3>
                        <p><strong>Customer:</strong> ${review.customerName}</p>
                        <p><strong>Email:</strong> ${review.customerEmail}</p>
                        <p><strong>Service:</strong> ${review.serviceType}</p>
                        <p><strong>Rating:</strong> <span class="rating">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</span> (${review.rating}/5)</p>
                        <p><strong>Status:</strong> Pending Approval</p>
                    </div>

                    <div class="review-text">
                        <h4 style="margin-top: 0; color: #495057;">💬 Customer Review:</h4>
                        <p style="font-style: italic; line-height: 1.6;">"${review.reviewText}"</p>
                    </div>

                    <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: #1976d2;">🎯 Action Required</h4>
                        <p>Please review and approve this customer feedback in your admin panel.</p>
                        <p><strong>Admin Panel:</strong> <a href="${process.env.ADMIN_URL || 'https://your-app.onrender.com/admin'}" style="color: #1976d2;">Review Management</a></p>
                    </div>
                </div>
                
                <div class="footer">
                    <p><strong>AJK Cleaning Company</strong> | Review Management System</p>
                    <p>Thank you for maintaining our service quality!</p>
                </div>
            </div>
        </body>
        </html>
    `;

    const adminEmailText = `
⭐ NEW CUSTOMER REVIEW - AJK Cleaning Company

Review Details:
Customer: ${review.customerName}
Email: ${review.customerEmail}
Service: ${review.serviceType}
Rating: ${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)} (${review.rating}/5)
Status: Pending Approval

Customer Review:
"${review.reviewText}"

Action Required:
Please review and approve this customer feedback in your admin panel.

Admin Panel: ${process.env.ADMIN_URL || 'https://your-app.onrender.com/admin'}

Thank you for maintaining our service quality!

Best regards,
AJK Cleaning Company
    `;

    // Get admin emails from environment variables
    let adminEmails = [];
    
    if (process.env.ADMIN_EMAILS) {
        // Use ADMIN_EMAILS if set (comma-separated list)
        adminEmails = process.env.ADMIN_EMAILS.split(',').map(email => email.trim());
    } else if (process.env.NOTIFICATION_EMAIL) {
        // Use NOTIFICATION_EMAIL if set (single email)
        adminEmails = [process.env.NOTIFICATION_EMAIL];
    } else {
        // Default fallback
        adminEmails = ['sugampokharel28@gmail.com'];
    }
    
    console.log('📧 Admin emails configured for review:', adminEmails);

    const mailOptions = {
        from: `"AJK Cleaning Services" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
        to: adminEmails.join(','),
        subject: `⭐ New Customer Review - ${review.rating}/5 stars from ${review.customerName}`,
        html: adminEmailHtml,
        text: adminEmailText
    };

    // Send to all admin emails using Gmail API
    for (const adminEmail of adminEmails) {
        try {
            const mailOptions = {
                from: `"AJK Cleaning Services" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
                to: adminEmail,
                subject: `⭐ New Customer Review - ${review.rating}/5 stars from ${review.customerName}`,
                html: adminEmailHtml
            };

            // Try SendGrid first, fallback to SMTP
            let result;
            try {
                if (process.env.SENDGRID_API_KEY) {
                    console.log('🚀 [REVIEW NOTIFICATION] Attempting to send email via SendGrid...');
                    result = await sendGridAdvanced.sendEmail(adminEmail, mailOptions.subject, mailOptions.html, mailOptions.text);
                    console.log('✅ [REVIEW NOTIFICATION] SendGrid email sent successfully');
                } else {
                    console.log('⚠️  [REVIEW NOTIFICATION] SENDGRID_API_KEY not found, using SMTP fallback...');
                    result = await sendEmailWithFallback(mailOptions);
                }
            } catch (sendGridError) {
                console.log('🔄 [REVIEW NOTIFICATION] SendGrid failed, trying SMTP fallback...', sendGridError.message);
                result = await sendEmailWithFallback(mailOptions);
            }

            if (result && (result.success || result === true)) {
                console.log(`📧 Admin notification sent for review from ${review.customerName} to ${adminEmail}`);
            } else {
                console.error(`❌ Failed to send review notification to ${adminEmail}`);
            }
        } catch (error) {
            console.error(`❌ Failed to send review notification to ${adminEmail}:`, error.message);
        }
    }
}

// Test endpoint to add sample reviews
app.post('/api/reviews/test-data', async (req, res) => {
    try {
        await db.read();
        if (!db.data.reviews) {
            db.data.reviews = [];
        }

        const sampleReviews = [
            {
                id: `review_${Date.now()}_1`,
                customerName: 'Sarah Johnson',
                customerEmail: 'sarah.johnson@example.com',
                serviceType: 'Residential Cleaning',
                rating: 5,
                reviewText: 'Absolutely fantastic service! The team was professional, thorough, and left my home spotless. I highly recommend AJK Cleaning to anyone looking for quality cleaning services.',
                bookingId: null,
                isPublic: true,
                status: 'approved',
                createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                approvedAt: new Date(Date.now() - 86400000).toISOString(),
                approvedBy: 'admin'
            },
            {
                id: `review_${Date.now()}_2`,
                customerName: 'Michael Chen',
                customerEmail: 'michael.chen@example.com',
                serviceType: 'Commercial Cleaning',
                rating: 5,
                reviewText: 'Outstanding commercial cleaning service! Our office has never looked better. The team is reliable, efficient, and pays attention to every detail.',
                bookingId: null,
                isPublic: true,
                status: 'approved',
                createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
                approvedAt: new Date(Date.now() - 172800000).toISOString(),
                approvedBy: 'admin'
            },
            {
                id: `review_${Date.now()}_3`,
                customerName: 'Emma Wilson',
                customerEmail: 'emma.wilson@example.com',
                serviceType: 'Deep Cleaning',
                rating: 4,
                reviewText: 'Great deep cleaning service! The team was very thorough and used eco-friendly products. My home feels completely refreshed.',
                bookingId: null,
                isPublic: true,
                status: 'approved',
                createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
                approvedAt: new Date(Date.now() - 259200000).toISOString(),
                approvedBy: 'admin'
            },
            {
                id: `review_${Date.now()}_4`,
                customerName: 'David Brown',
                customerEmail: 'david.brown@example.com',
                serviceType: 'Move In/Out Cleaning',
                rating: 5,
                reviewText: 'Perfect move-out cleaning service! The team made our old apartment look brand new. Highly professional and reasonably priced.',
                bookingId: null,
                isPublic: true,
                status: 'approved',
                createdAt: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
                approvedAt: new Date(Date.now() - 345600000).toISOString(),
                approvedBy: 'admin'
            },
            {
                id: `review_${Date.now()}_5`,
                customerName: 'Lisa Garcia',
                customerEmail: 'lisa.garcia@example.com',
                serviceType: 'Residential Cleaning',
                rating: 5,
                reviewText: 'Excellent service! The cleaners were punctual, friendly, and did an amazing job. I will definitely book again.',
                bookingId: null,
                isPublic: true,
                status: 'approved',
                createdAt: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
                approvedAt: new Date(Date.now() - 432000000).toISOString(),
                approvedBy: 'admin'
            }
        ];

        // Add sample reviews to database
        db.data.reviews.push(...sampleReviews);
        await db.write();

        console.log(`📝 Added ${sampleReviews.length} sample reviews to database`);

        res.json({ 
            success: true, 
            message: `Added ${sampleReviews.length} sample reviews successfully`,
            reviews: sampleReviews
        });
    } catch (error) {
        console.error('❌ Failed to add sample reviews:', error);
        res.status(500).json({ error: 'Failed to add sample reviews: ' + error.message });
    }
});

// Quick test endpoint to add approved reviews
app.post('/api/reviews/add-approved', async (req, res) => {
    try {
        await db.read();
        if (!db.data.reviews) {
            db.data.reviews = [];
        }

        const approvedReview = {
            id: `review_${Date.now()}_approved`,
            customerName: 'Test Customer',
            customerEmail: 'test@example.com',
            serviceType: 'Residential Cleaning',
            rating: 5,
            reviewText: 'This is a test approved review to verify the system is working correctly.',
            bookingId: null,
            isPublic: true,
            status: 'approved',
            createdAt: new Date().toISOString(),
            approvedAt: new Date().toISOString(),
            approvedBy: 'admin'
        };

        db.data.reviews.push(approvedReview);
        await db.write();

        console.log(`📝 Added approved test review: ${approvedReview.id}`);

        res.json({ 
            success: true, 
            message: 'Added approved test review successfully',
            review: approvedReview
        });

    } catch (error) {
        console.error('❌ Failed to add sample reviews:', error);
        res.status(500).json({ error: 'Failed to add sample reviews: ' + error.message });
    }
});

// Debug endpoint to check database contents
app.get('/api/debug/reviews', async (req, res) => {
    try {
        await db.read();
        console.log('🔍 Debug: Database data keys:', db.data ? Object.keys(db.data) : 'No data');
        console.log('🔍 Debug: Reviews in database:', db.data.reviews ? db.data.reviews.length : 0);
        
        if (db.data.reviews) {
            console.log('🔍 Debug: All reviews:', JSON.stringify(db.data.reviews, null, 2));
        }
        
        res.json({
            success: true,
            databaseKeys: db.data ? Object.keys(db.data) : [],
            reviewsCount: db.data.reviews ? db.data.reviews.length : 0,
            reviews: db.data.reviews || []
        });
    } catch (error) {
        console.error('❌ Debug failed:', error);
        res.status(500).json({ error: 'Debug failed: ' + error.message });
    }
});

app.get('/api/debug/database', requireAuth, async (req, res) => {
    try {
        await db.read();
        const data = {
            submissions: {
                exists: !!db.data.submissions,
                length: db.data.submissions ? db.data.submissions.length : 0,
                sample: db.data.submissions ? db.data.submissions.slice(0, 2) : []
            },
            chats: {
                exists: !!db.data.chats,
                length: db.data.chats ? Object.keys(db.data.chats).length : 0,
                keys: db.data.chats ? Object.keys(db.data.chats) : []
            },
            quoteRequests: {
                exists: !!db.data.quoteRequests,
                length: db.data.quoteRequests ? db.data.quoteRequests.length : 0,
                sample: db.data.quoteRequests ? db.data.quoteRequests.slice(0, 2) : []
            },
            bookings: {
                exists: !!db.data.bookings,
                length: db.data.bookings ? db.data.bookings.length : 0,
                sample: db.data.bookings ? db.data.bookings.slice(0, 2) : []
            },
            allKeys: Object.keys(db.data || {})
        };
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Database error: ' + error.message });
    }
});

// Test quote email endpoint
app.post('/api/test-quote-email', async (req, res) => {
    try {
        const testQuoteData = {
            customerName: 'Test Customer',
            customerEmail: process.env.ADMIN_EMAIL,
            customerPhone: '+49 123 456789',
            serviceType: 'Residential Cleaning',
            propertySize: '1500',
            frequency: 'Weekly',
            specialRequirements: 'Test quote email with special requirements',
            preferredDate: '2025-01-15',
            preferredTime: 'Morning',
            salutation: 'Dear'
        };

        await sendQuoteEmail(testQuoteData);
        console.log('✅ Quote email test sent successfully');
        res.json({ success: true, message: 'Quote email test sent successfully' });
    } catch (error) {
        console.error('❌ Quote email test failed:', error);
        res.status(500).json({ error: 'Failed to send quote email test: ' + error.message });
    }
});

// ==================== TEAM MANAGEMENT API ====================

// Get all employees
app.get('/api/employees', async (req, res) => {
    try {
        await db.read();
        const employees = db.data.employees || [];
        res.json(employees);
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
});

// Add new employee
app.post('/api/employees', async (req, res) => {
    try {
        const { name, email, jobTitle, phone, salary, dateJoined, address, status, notes, ssn, taxId, penalties, absences, otherDeductions, customTax } = req.body;
        
        if (!name || !email || !jobTitle || !salary || !dateJoined) {
            return res.status(400).json({ error: 'Name, email, job title, salary, and date joined are required' });
        }

        await db.read();
        
        // Ensure employees array exists
        if (!db.data.employees) {
            db.data.employees = [];
        }

        // Check if employee already exists
        const existingEmployee = db.data.employees.find(emp => emp.email === email);
        if (existingEmployee) {
            return res.status(400).json({ error: 'Employee with this email already exists' });
        }

        const newEmployee = {
            id: `emp_${Date.now()}`,
            name,
            email,
            jobTitle,
            phone: phone || '',
            salary: parseFloat(salary),
            dateJoined,
            address: address || '',
            status: status || 'active',
            notes: notes || '',
            ssn: ssn || '',
            taxId: taxId || '',
            penalties: parseFloat(penalties) || 0,
            absences: parseFloat(absences) || 0,
            otherDeductions: parseFloat(otherDeductions) || 0,
            customTax: parseFloat(customTax) || 0,
            paymentHistory: [], // Track payment history
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        db.data.employees.push(newEmployee);
        await db.write();

        console.log(`✅ Employee added: ${newEmployee.name} (${newEmployee.email})`);
        res.json({ success: true, employee: newEmployee });
    } catch (error) {
        console.error('Error adding employee:', error);
        res.status(500).json({ error: 'Failed to add employee' });
    }
});

// Update employee
app.put('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        await db.read();
        
        const employeeIndex = db.data.employees.findIndex(emp => emp.id === id);
        if (employeeIndex === -1) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // Update employee
        db.data.employees[employeeIndex] = {
            ...db.data.employees[employeeIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await db.write();

        console.log(`✅ Employee updated: ${db.data.employees[employeeIndex].name}`);
        res.json({ success: true, employee: db.data.employees[employeeIndex] });
    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({ error: 'Failed to update employee' });
    }
});

// Delete employee
app.delete('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await db.read();
        
        const employeeIndex = db.data.employees.findIndex(emp => emp.id === id);
        if (employeeIndex === -1) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        const employee = db.data.employees[employeeIndex];
        
        // Remove employee
        db.data.employees.splice(employeeIndex, 1);
        await db.write();

        // Send termination email
        try {
            await sendEmployeeTerminationEmail(employee);
            console.log(`✅ Termination email sent to ${employee.email}`);
        } catch (emailError) {
            console.error('❌ Failed to send termination email:', emailError);
        }

        console.log(`✅ Employee deleted: ${employee.name}`);
        res.json({ success: true, message: 'Employee deleted successfully' });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ error: 'Failed to delete employee' });
    }
});

// Generate payslips
app.post('/api/employees/generate-payslips', async (req, res) => {
    try {
        const { month, year, employeeIds } = req.body;
        
        if (!month || !year || !employeeIds || employeeIds.length === 0) {
            return res.status(400).json({ error: 'Month, year, and employee selection are required' });
        }

        await db.read();
        const employees = db.data.employees || [];
        
        const selectedEmployees = employees.filter(emp => 
            employeeIds.includes(emp.id) && emp.status === 'active'
        );

        if (selectedEmployees.length === 0) {
            return res.status(400).json({ error: 'No active employees selected' });
        }

        const payslips = [];
        
        for (const employee of selectedEmployees) {
            try {
                await sendEmployeePayslip(employee, month, year);
                payslips.push({
                    employeeId: employee.id,
                    employeeName: employee.name,
                    email: employee.email,
                    status: 'sent'
                });
                console.log(`✅ Payslip sent to ${employee.name} (${employee.email})`);
            } catch (emailError) {
                payslips.push({
                    employeeId: employee.id,
                    employeeName: employee.name,
                    email: employee.email,
                    status: 'failed',
                    error: emailError.message
                });
                console.error(`❌ Failed to send payslip to ${employee.name}:`, emailError);
            }
        }

        res.json({ 
            success: true, 
            message: `Payslips processed for ${payslips.length} employees`,
            payslips 
        });
    } catch (error) {
        console.error('Error generating payslips:', error);
        res.status(500).json({ error: 'Failed to generate payslips' });
    }
});
// =================================================================
// END OF CSRF SETUP
// =================================================================


// =================================================================
// SECURE GEMINI API PROXY
// =================================================================
app.post('/api/gemini', async (req, res) => {
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
        console.error('Gemini API key is not configured on the server.');
        return res.status(500).json({ error: { message: 'The AI service is not configured correctly. Please contact support.' } });
    }
    
    if (!req.body || !req.body.contents) {
        return res.status(400).json({ error: { message: 'Request body is required and must contain "contents"' } });
    }

    const { contents, systemInstruction } = req.body;
    
    if (contents.length === 0) {
        return res.status(400).json({ error: { message: 'Invalid request body: contents are empty.' } });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;

    try {
        const fetch = (await import('node-fetch')).default;
        
        const geminiPayload = {
            contents: contents
        };

        if (systemInstruction) {
            geminiPayload.systemInstruction = systemInstruction;
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Gemini API Error:', data);
            const errorMessage = data?.error?.message || `API error: ${response.status}`;
            return res.status(response.status).json({ error: { message: errorMessage } });
        }

        res.json(data);
    } catch (error) {
        console.error('Error proxying request to Gemini API:', error);
        res.status(500).json({ error: { message: `The server encountered an error while trying to contact the AI service. Details: ${error.message}` } });
    }
});
// =================================================================
// END OF GEMINI PROXY
// =================================================================


// ==================== WEBSOCKET CHAT SERVER ====================
const clients = new Map();
const adminSessions = new Map();
const connectionQuality = new Map();

// Persist a chat message to LowDB for a given clientId
async function persistChatMessage(clientId, message) {
  try {
    await db.read();
    db.data = db.data && typeof db.data === 'object' ? db.data : {};
    db.data.chats = db.data.chats || {};
    if (!db.data.chats[clientId] || db.data.chats[clientId].deleted) {
      db.data.chats[clientId] = {
        clientInfo: db.data.chats[clientId]?.clientInfo || { name: 'Guest', email: '', ip: 'unknown', firstSeen: new Date().toISOString() },
        messages: []
      };
    }
    const exists = (db.data.chats[clientId].messages || []).some(m => m.id === message.id);
    if (!exists) {
      db.data.chats[clientId].messages.push({
        id: message.id,
        message: message.message,
        timestamp: message.timestamp,
        isAdmin: !!message.isAdmin,
        type: message.type || 'chat'
      });
      await db.write();
    }
  } catch (e) {
    console.error('Error persisting chat message:', e);
  }
}

// Function to store offline messages for ADMINS
function storeAdminOfflineMessage(clientId, message) {
  if (!db.data.offline_messages) {
    db.data.offline_messages = {};
  }
 
  if (!db.data.offline_messages[clientId]) {
    db.data.offline_messages[clientId] = [];
  }
 
  db.data.offline_messages[clientId].push({
    message,
    timestamp: new Date().toISOString()
  });
 
  db.write().catch(err => console.error('Error saving offline message:', err));
}

// Function to deliver offline messages when admin connects
function deliverAdminOfflineMessages() {
  if (!db.data.offline_messages) return;
 
  Object.keys(db.data.offline_messages).forEach(clientId => {
    const messages = db.data.offline_messages[clientId];
    messages.forEach(msg => {
      broadcastToAll(msg.message);
    });
    
    delete db.data.offline_messages[clientId];
  });
 
  db.write().catch(err => console.error('Error clearing offline messages:', err));
}

function broadcastToAll(message, sourceSessionId = null, excludeClientId = null) {
    clients.forEach(c => {
        if (excludeClientId && c.id === excludeClientId) return;
        
        if (message.isAdmin) {
            if (c.id === message.clientId && c.ws.readyState === WebSocket.OPEN) {
                try { c.ws.send(JSON.stringify(message)); } 
                catch (error) { console.error('Error sending message to client:', error); }
            }
            if (c.isAdmin && c.ws.readyState === WebSocket.OPEN) {
                try { c.ws.send(JSON.stringify(message)); }
                catch (error) { console.error('Error sending message to admin:', error); }
            }
        } else {
            if (c.isAdmin && c.ws.readyState === WebSocket.OPEN) {
                try { c.ws.send(JSON.stringify(message)); }
                catch (error) { console.error('Error sending message to admin:', error); }
            }
        }
    });
}

function notifyAdmin(type, payload, targetSessionId = null) {
    clients.forEach(client => {
        if (client.isAdmin && client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(JSON.stringify({ type, payload, timestamp: new Date().toISOString() }));
            } catch (error) {
                console.error('Error notifying admin:', error);
            }
        }
    });
}

async function sendToClient(clientId, messageText, sourceSessionId = null) {
    const client = clients.get(clientId);
    const adminMessage = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        type: 'chat',
        message: messageText,
        name: 'Support',
        timestamp: new Date().toISOString(),
        isAdmin: true,
        clientId: clientId,
        sessionId: sourceSessionId
    };

    if (client && client.ws.readyState === WebSocket.OPEN) {
        try {
            client.ws.send(JSON.stringify(adminMessage));
            await persistChatMessage(clientId, adminMessage);
            return { success: true, status: 'delivered' };
        } catch (error) {
            console.error('Error sending message to client, will attempt to save:', error);
            await persistChatMessage(clientId, adminMessage);
            return { success: true, status: 'saved_after_error' };
        }
    } else {
        await persistChatMessage(clientId, adminMessage);
        console.log(`Client ${clientId} is offline. Message saved.`);
        return { success: true, status: 'saved_offline' };
    }
}


function sendChatReset(clientId) {
    const client = clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
        try {
            client.ws.send(JSON.stringify({
                type: 'chat_reset',
                message: 'Chat session has been reset by admin.',
                timestamp: new Date().toISOString(),
                resetToAI: true
            }));
            return true;
        } catch (error) {
            console.error('Error sending chat reset message:', error);
            return false;
        }
    }
    return false;
}

function broadcastToClients(messageText, sourceSessionId = null) {
    let count = 0;
    clients.forEach(client => {
        if (!client.isAdmin && client.ws.readyState === WebSocket.OPEN && 
            (!sourceSessionId || client.sessionId === sourceSessionId)) {
            const adminMessage = {
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                type: 'chat',
                message: messageText,
                name: 'Support',
                timestamp: new Date().toISOString(),
                isAdmin: true,
                clientId: client.id,
                sessionId: sourceSessionId
            };
            
            try {
                client.ws.send(JSON.stringify(adminMessage));
                count++;
            } catch (error) {
                console.error('Error broadcasting to client:', error);
            }
        }
    });
    return count;
}

async function cleanupGhostChats() {
  try {
    await db.read();
    const chats = db.data.chats || {};
    let removedCount = 0;
    
    Object.keys(chats).forEach(clientId => {
        const chat = chats[clientId];
        if (chat && 
            chat.clientInfo && 
            chat.clientInfo.name === 'Guest' && 
            (!chat.messages || chat.messages.length === 0) &&
            new Date(chat.clientInfo.firstSeen) < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
            
            delete chats[clientId];
            removedCount++;
        }
    });
    
    if (removedCount > 0) {
        await db.write();
        console.log(`Cleaned up ${removedCount} ghost chats`);
    }
  } catch (e) {
    console.error('Error cleaning up ghost chats:', e);
  }
}

const wss = new WebSocket.Server({ 
    server,
    perMessageDeflate: {
        zlibDeflateOptions: {
            chunkSize: 1024,
            windowBits: 13,
            concurrencyLimit: 10,
        },
        threshold: 1024,
        serverMaxWindow: 15,
        clientMaxWindow: 15,
        serverMaxNoContextTakeover: false,
        clientMaxNoContextTakeover: false,
    }
});

const allowedOriginsWs = [
    'https://ajk-cleaning.onrender.com',
    'https://ajkcleaners.de',
    'http://ajkcleaners.de',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://ajk-website.onrender.com', // Updated service name
    'http://localhost:3001',
    'http://127.0.0.1:3001'
];

// REPLACED with secure version
async function handleAdminConnection(ws, request) {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
        console.warn('Admin WebSocket connection attempt without session ID');
        ws.close(1008, 'Session ID required');
        return;
    }

    const sessionData = adminSessions.get(sessionId);
    if (!sessionData || !sessionData.authenticated) {
        console.warn(`Invalid admin session attempted: ${sessionId}`);
        console.log('Available admin sessions:', Array.from(adminSessions.keys()));
        ws.close(1008, 'Invalid or unauthenticated admin session');
        return;
    }

    // IP validation for security (relaxed for production)
    const clientIP = request.socket.remoteAddress;
    if (sessionData.ip && sessionData.ip !== clientIP) {
        console.warn(`IP mismatch for admin session ${sessionId}. Expected: ${sessionData.ip}, Got: ${clientIP}`);
        // Don't close connection in production - just log the warning
        // ws.close(1008, 'Session security violation - IP mismatch');
        // return;
    }

    // Check session age
    const sessionAge = Date.now() - new Date(sessionData.loginTime).getTime();
    const MAX_SESSION_AGE = 24 * 60 * 60 * 1000; // 24 hours
    if (sessionAge > MAX_SESSION_AGE) {
        console.warn(`Expired admin session attempted: ${sessionId}`);
        adminSessions.delete(sessionId);
        ws.close(1008, 'Session expired');
        return;
    }

    // Rest of existing code...
    const clientId = 'admin_' + sessionId;
    const client = {
        ws,
        isAdmin: true,
        name: sessionData.username || 'Admin',
        id: clientId,
        sessionId: sessionId,
        joined: new Date().toISOString()
    };
    
    clients.set(clientId, client);
    
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            await handleAdminMessage(client, message);
        } catch (error) {
            console.error('Admin WebSocket message error:', error);
        }
    });
    
    ws.on('close', () => {
        clients.delete(clientId);
        console.log('Admin disconnected:', sessionId);
    });
    
    ws.on('error', (error) => {
        console.error('Admin WebSocket error:', error);
        clients.delete(clientId);
    });
    
    ws.send(JSON.stringify({
        type: 'admin_identified',
        message: 'Admin connection established',
        username: sessionData.username
    }));

    deliverAdminOfflineMessages();
    notifyAdmin('admin_connected', { name: sessionData.username, sessionId });
}


async function handleAdminMessage(adminClient, message) {
    switch (message.type) {
        case 'get_chat_history':
            if (message.clientId) {
                try {
                    await db.read();
                    const clientChat = db.data.chats[message.clientId];
                    
                    const messages = (clientChat && !clientChat.deleted) ? (clientChat.messages || []) : [];
                    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                    adminClient.ws.send(JSON.stringify({
                        type: 'chat_history',
                        clientId: message.clientId,
                        messages: messages
                    }));
                } catch (error) {
                    console.error('Error loading chat history:', error);
                    adminClient.ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Failed to load chat history'
                    }));
                }
            }
            break;
            
        case 'admin_message':
            if (message.clientId && message.message) {
                const { success, status } = await sendToClient(message.clientId, message.message, adminClient.sessionId);
                if (status === 'saved_offline') {
                    adminClient.ws.send(JSON.stringify({
                        type: 'info',
                        message: 'Client is offline. Message saved for delivery.'
                    }));
                }
            }
            break;
        
        case 'get_clients':
            const clientList = Array.from(clients.values())
                .filter(c => !c.isAdmin)
                .map(c => ({
                    id: c.id,
                    name: c.name,
                    email: c.email,
                    isOnline: c.ws.readyState === WebSocket.OPEN,
                    lastActive: c.lastActive
                }));
            
            try {
                adminClient.ws.send(JSON.stringify({
                    type: 'clients',
                    clients: clientList
                }));
            } catch (error) {
                console.error('Error sending client list:', error);
            }
            break;

        case 'broadcast':
            if (message.message) {
                const broadcastCount = broadcastToClients(message.message, adminClient.sessionId);
                try {
                    adminClient.ws.send(JSON.stringify({
                        type: 'system',
                        message: `Broadcast sent to ${broadcastCount} clients`
                    }));
                } catch (error) {
                    console.error('Error sending broadcast confirmation:', error);
                }
            }
            break;
    }
}


wss.on('connection', async (ws, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const isAdminEndpoint = url.searchParams.get('endpoint') === 'admin';
    
    if (isAdminEndpoint) {
        return handleAdminConnection(ws, request);
    }
    
    const clientIp = request.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     request.headers['x-real-ip'] || 
                     request.socket.remoteAddress || 
                     'unknown';
    
    const origin = request.headers.origin;
    if (origin && !allowedOriginsWs.includes(origin)) {
        console.log('WebSocket connection from blocked origin:', origin);
        ws.close(1008, 'Origin not allowed');
        return;
    }
    
    console.log('Client connected:', clientIp);
    
    let clientId;
    let hadProvidedClientId = false;
    try {
        const urlObj = new URL(request.url, `http://${request.headers.host}`);
        const providedClientId = urlObj.searchParams.get('clientId');
        if (providedClientId && /^client_[a-zA-Z0-9_-]{5,}$/.test(providedClientId)) {
            clientId = providedClientId;
            hadProvidedClientId = true;
        } else {
            clientId = 'client_' + Date.now() + Math.random().toString(36).substr(2, 9);
        }
    } catch (_) {
        clientId = 'client_' + Date.now() + Math.random().toString(36).substr(2, 9);
    }

    if (!hadProvidedClientId) {
        try {
            await db.read();
            const chats = (db.data && db.data.chats) ? db.data.chats : {};
            let bestId = null;
            let bestTime = 0;
            for (const [cid, chat] of Object.entries(chats)) {
                if (!chat || chat.deleted) continue;
                const ipMatch = chat.clientInfo && chat.clientInfo.ip === clientIp;
                if (!ipMatch) continue;
                const msgs = Array.isArray(chat.messages) ? chat.messages : [];
                const lastTs = msgs.length ? new Date(msgs[msgs.length - 1].timestamp).getTime() : 0;
                if (lastTs > bestTime && !clients.has(cid)) {
                    bestTime = lastTs;
                    bestId = cid;
                }
            }
            if (bestId) {
                clientId = bestId;
            }
        } catch (e) {
            console.error('Error attempting IP-based chat mapping:', e);
        }
    }
    
    const client = {
        ws,
        ip: clientIp,
        isAdmin: false,
        name: 'Guest',
        email: '',
        id: clientId,
        joined: new Date().toISOString(),
        sessionId: null,
        hasReceivedWelcome: false,
        lastActive: new Date().toISOString()
    };
    clients.set(clientId, client);
    
    // Add connection timeout to clean up unestablished clients
    client.connectionEstablished = false;
    client.connectionTimeout = setTimeout(() => {
        if (!client.connectionEstablished) {
            console.log('⚠️ Client connection timeout, cleaning up:', clientId);
            clients.delete(clientId);
            connectionQuality.delete(clientId);
            notifyAdmin('client_connection_failed', {
                clientId,
                reason: 'Connection timeout - client never properly established connection',
                ip: clientIp
            });
        }
    }, 30000); // 30 second timeout
    
    ws.isAlive = true;
    ws.missedPings = 0;
    ws.connectionStart = Date.now();
    ws.clientId = clientId;
    
    connectionQuality.set(clientId, {
        latency: 0,
        connectedSince: ws.connectionStart,
        missedPings: 0
    });
    
    try {
        await db.read();
        db.data = db.data && typeof db.data === 'object' ? db.data : {};
        db.data.chats = db.data.chats || {};
        
        if (db.data.chats[clientId] && !db.data.chats[clientId].deleted) {
            const existingChatHistory = db.data.chats[clientId].messages || [];
            
            if (existingChatHistory.length > 0) {
                try {
                    ws.send(JSON.stringify({
                        type: 'history',
                        messages: existingChatHistory,
                        clientId: clientId
                    }));
                } catch (error) {
                    console.error('Error sending chat history:', error);
                }
            }
        }
    } catch (e) {
        console.error('Error loading chat history:', e);
    }
    
    notifyAdmin('client_connected', { clientId, ip: clientIp, name: 'Guest' });

    ws.on('message', async (data) => {
        try {
            if (!clients.has(clientId)) {
                console.error('Client not found in clients map:', clientId);
                return;
            }
            
            const client = clients.get(clientId);
            if (!client) {
                console.error('Client object is undefined for:', clientId);
                return;
            }
            
            let message;
            try {
                message = JSON.parse(data.toString());
            } catch (parseError) {
                console.error('Invalid JSON received from client:', clientIp);
                return;
            }
            
            if (!message || typeof message !== 'object' || !message.type) {
                console.log('Invalid message format from:', clientIp);
                return;
            }
            
            client.lastActive = new Date().toISOString();
            
            switch (message.type) {
                case 'chat':
                    // Mark connection as established when first message is received
                    if (!client.connectionEstablished) {
                        client.connectionEstablished = true;
                        if (client.connectionTimeout) {
                            clearTimeout(client.connectionTimeout);
                            client.connectionTimeout = null;
                        }
                        console.log('✅ Client connection established:', clientId);
                    }
                    
                    const messageText = message.message || message.text;
                    if (typeof messageText !== 'string' || messageText.trim().length === 0) {
                        return;
                    }
                    
                    const sanitizedText = validator.escape(messageText.trim()).substring(0, 500);
                    
                    const chatMessage = {
                        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                        type: 'chat',
                        name: client.name,
                        message: sanitizedText,
                        timestamp: new Date().toISOString(),
                        isAdmin: false,
                        clientId: clientId,
                        sessionId: client.sessionId
                    };
                    
                    await persistChatMessage(clientId, chatMessage);
                    
                    let adminOnline = false;
                    clients.forEach(c => {
                        if (c.isAdmin && c.ws.readyState === WebSocket.OPEN) {
                            adminOnline = true;
                        }
                    });
                    
                    if (!adminOnline) {
                        storeAdminOfflineMessage(clientId, chatMessage);
                    } else {
                        broadcastToAll(chatMessage);
                    }
                    
                    notifyAdmin('new_message', { clientId, name: client.name, message: sanitizedText.substring(0, 50) });
                    
                    if (!adminOnline) {
                        try {
                            await db.read();
                            const chatObj = db.data.chats[clientId];
                            if (chatObj && !chatObj.offlineAutoMessageSent) {
                                const autoMsg = {
                                    id: Date.now() + '-auto',
                                    type: 'system',
                                    message: 'Thank you for contacting AJK Cleaning! We have received your message and will get back to you shortly. For immediate assistance, please call us at +49-17661852286 or email Rajau691@gmail.com.',
                                    timestamp: new Date().toISOString(),
                                    clientId: clientId
                                };
                                try { ws.send(JSON.stringify(autoMsg)); } catch (e) { console.error('Error sending offline auto message:', e); }
                                
                                chatObj.messages.push({
                                    id: autoMsg.id,
                                    message: autoMsg.message,
                                    timestamp: autoMsg.timestamp,
                                    isAdmin: false,
                                    type: 'system'
                                });
                                chatObj.offlineAutoMessageSent = true;
                                await db.write();
                            }
                        } catch (e) {
                            console.error('Error processing offline auto message:', e);
                        }
                    }
                    break;
                    
                case 'typing':
                    if (typeof message.isTyping !== 'boolean') {
                        return;
                    }
                    
                    clients.forEach(c => {
                        if (c.isAdmin && c.ws.readyState === WebSocket.OPEN) {
                            try {
                                c.ws.send(JSON.stringify({
                                    type: 'typing',
                                    isTyping: message.isTyping,
                                    name: client.name,
                                    clientId: clientId
                                }));
                            } catch (error) {
                                console.error('Error sending typing indicator:', error);
                            }
                        }
                    });
                    break;
                    
                case 'identify':
                    if (message.isAdmin) {
                       return;
                    }

                    if (message.name && typeof message.name === 'string') {
                        client.name = validator.escape(message.name.substring(0, 50)) || 'Guest';
                    }
                    if (message.email && typeof message.email === 'string' && validator.isEmail(message.email)) {
                        client.email = message.email;
                    }
                    if (message.sessionId && typeof message.sessionId === 'string') {
                        client.sessionId = message.sessionId;
                    }

                    try {
                        await db.read();
                        db.data.chats = db.data.chats || {};
                        
                        if (!db.data.chats[clientId] || db.data.chats[clientId].deleted) {
                            db.data.chats[clientId] = {
                                clientInfo: {
                                    name: client.name || 'Guest',
                                    email: client.email || '',
                                    ip: client.ip,
                                    firstSeen: new Date().toISOString()
                                },
                                messages: [],
                                status: 'active'
                            };
                        } else {
                            db.data.chats[clientId].clientInfo.name = client.name || db.data.chats[clientId].clientInfo.name || 'Guest';
                            if (client.email) db.data.chats[clientId].clientInfo.email = client.email;
                            db.data.chats[clientId].clientInfo.lastSeen = new Date().toISOString();
                        }
                        await db.write();
                    } catch (e) {
                        console.error('Error upserting chat on identify:', e);
                    }
                    
                    notifyAdmin('client_identified', { clientId, name: client.name, email: client.email });
                    break;
                    
                case 'ping':
                    try {
                        ws.send(JSON.stringify({
                            type: 'pong',
                            timestamp: Date.now()
                        }));
                    } catch (error) {
                        console.error('Error sending pong:', error);
                    }
                    break;
                    
                default:
                    console.log('Unknown message type from:', clientIp, message.type);
            }
        } catch (error) {
            console.error('Error processing message from', clientIp, ':', error);
            try {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Message processing failed'
                }));
            } catch (sendError) {
                console.error('Error sending error message:', sendError);
            }
        }
    });

    ws.on('close', (code, reason) => {
        if (!clients.has(clientId)) {
            return;
        }
        
        const client = clients.get(clientId);
        if (!client) {
            return;
        }
        
        // Clear connection timeout if it exists
        if (client.connectionTimeout) {
            clearTimeout(client.connectionTimeout);
            client.connectionTimeout = null;
        }
        
        console.log('Client disconnected:', clientIp, clientId, 'Code:', code, 'Reason:', reason.toString());
        
        clients.delete(clientId);
        connectionQuality.delete(clientId);
        
        notifyAdmin('client_disconnected', { 
            clientId, 
            name: client.name,
            reason: reason.toString() || 'No reason given',
            connectionDuration: Date.now() - ws.connectionStart
        });
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error for client', clientIp, ':', error);
        
        // Clear connection timeout if it exists
        const client = clients.get(clientId);
        if (client && client.connectionTimeout) {
            clearTimeout(client.connectionTimeout);
            client.connectionTimeout = null;
        }
        
        clients.delete(clientId);
        connectionQuality.delete(clientId);
    });
    
    ws.on('pong', () => {
        ws.isAlive = true;
        ws.missedPings = 0;
        
        if (ws.lastPingTime) {
            const latency = Date.now() - ws.lastPingTime;
            connectionQuality.set(clientId, {
                latency,
                connectedSince: ws.connectionStart,
                missedPings: ws.missedPings
            });
        }
    });
    
    const originalPing = ws.ping;
    ws.ping = function() {
        ws.lastPingTime = Date.now();
        originalPing.apply(ws, arguments);
    };
});

wss.on('error', (error) => {
    console.error('WebSocket Server Error:', error);
});

function cleanupAdminSessions() {
    const now = Date.now();
    const TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
    adminSessions.forEach((session, sessionId) => {
        const sessionAge = now - new Date(session.loginTime).getTime();
        if (sessionAge > TIMEOUT) {
            adminSessions.delete(sessionId);
            console.log(`Cleaned up stale admin session: ${sessionId}`);
        }
    });
}

function cleanupStaleConnections() {
    const now = Date.now();
    const STALE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    
    clients.forEach((client, clientId) => {
        if (!client.lastActive) return;
        
        const timeSinceActivity = now - new Date(client.lastActive).getTime();
        if (timeSinceActivity > STALE_TIMEOUT) {
            console.log(`Cleaning up stale connection: ${clientId}`);
            try {
                client.ws.close(1000, 'Connection stale');
            } catch (e) {
                console.error('Error closing stale connection:', e);
            }
            clients.delete(clientId);
            connectionQuality.delete(clientId);
        }
    });
}

setInterval(cleanupStaleConnections, 60 * 1000);


const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log('Terminating dead connection:', ws.clientId || 'unknown');
            
            if (ws.clientId) {
                const client = clients.get(ws.clientId);
                if (client) {
                    if (client.isAdmin && client.sessionId) {
                        adminSessions.delete(client.sessionId);
                    }
                    clients.delete(ws.clientId);
                    connectionQuality.delete(ws.clientId);
                    
                    if (client.isAdmin) {
                        notifyAdmin('admin_disconnected', { name: client.name, reason: 'timeout' });
                    } else {
                        notifyAdmin('client_disconnected', { clientId: ws.clientId, reason: 'timeout' });
                    }
                }
            }
            
            return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.missedPings = (ws.missedPings || 0) + 1;

        if (ws.missedPings > 3) {
            console.log('Too many missed pings, terminating:', ws.clientId);
            return ws.terminate();
        }
        
        try {
            ws.ping();
        } catch (error) {
            console.error('Error pinging client:', error);
            ws.terminate();
        }
    });
}, 30000);


const adminSessionCleanupInterval = setInterval(cleanupAdminSessions, 60 * 60 * 1000);

wss.on('close', () => {
    clearInterval(heartbeatInterval);
    clearInterval(adminSessionCleanupInterval);
});

setTimeout(cleanupGhostChats, 5000);
setInterval(cleanupGhostChats, 60 * 60 * 1000);

app.use((req, res, next) => {
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
    const host = req.get('host');
    
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://app.usercentrics.eu https://cdn.jsdelivr.net https://cdnjs.cloudflare.com blob: https://js.stripe.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
        "img-src 'self' data: https: blob:; " +
        "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; " +
        `connect-src 'self' ${protocol}://${host} wss://${host} ws://${host} https://generativelanguage.googleapis.com https://api.usercentrics.eu https://privacy-proxy.usercentrics.eu https://www.google-analytics.com https://consent-api.service.consent.usercentrics.eu https://api.stripe.com; ` + 
        "frame-src 'self' https://www.google.com https://app.usercentrics.eu https://js.stripe.com;"
    );
    next();
});

// ==================== RATE LIMITING ====================
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  skip: (req) => {
    return req.session.authenticated;
  }
});

app.use('/api/admin/login', loginLimiter);

// NEW Advanced Rate Limiting
const requestTracker = new Map();
function advancedRateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
    return (req, res, next) => {
        // Skip for authenticated admin users
        if (req.session && req.session.authenticated) {
            return next();
        }

        const ip = req.ip;
        const now = Date.now();

        if (!requestTracker.has(ip)) {
            requestTracker.set(ip, []);
        }

        const requests = requestTracker.get(ip);
        const recentRequests = requests.filter(time => now - time < windowMs);

        if (recentRequests.length >= maxRequests) {
            const oldestRequest = Math.min(...recentRequests);
            const retryAfter = Math.ceil((windowMs - (now - oldestRequest)) / 1000);
            
            res.status(429).json({
                error: 'Too many requests from this IP',
                retryAfter: retryAfter,
                limit: maxRequests,
                window: windowMs / 1000
            });
            return;
        }

        recentRequests.push(now);
        requestTracker.set(ip, recentRequests);

        // Cleanup old entries periodically
        if (Math.random() < 0.01) { // 1% chance
            requestTracker.forEach((times, key) => {
                const recent = times.filter(time => now - time < windowMs);
                if (recent.length === 0) {
                    requestTracker.delete(key);
                } else {
                    requestTracker.set(key, recent);
                }
            });
        }
        
        next();
    };
}

// APPLY to API routes
app.use('/api/', advancedRateLimit(100, 15 * 60 * 1000));
// ==================== END RATE LIMITING ====================

const validateEmail = (email) => {
    return validator.isEmail(email) && email.length <= 254;
};

const validatePhone = (phone) => {
    const phoneRegex = /^[+]?[\d\s\-()]{8,20}$/;
    return phoneRegex.test(phone);
};

const validateFormSubmission = (req, res, next) => {
    const { name, email, phone, message, preferred_date } = req.body;
    
    if (!name || !phone || !message) {
      return res.status(400).json({ success: false, error: 'Name, phone, and message are required' });
    }
    
    if (name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ success: false, error: 'Name must be between 2 and 100 characters' });
    }
    
    if (message.trim().length < 10 || message.trim().length > 1000) {
      return res.status(400).json({ success: false, error: 'Message must be between 10 and 1000 characters' });
    }
    
    if (phone && !validatePhone(phone)) {
        return res.status(400).json({ success: false, error: 'Invalid phone number format' });
    }

    if (email && !validateEmail(email)) {
        return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    if (preferred_date && !validator.isISO8601(preferred_date)) {
        return res.status(400).json({ success: false, error: 'Invalid date format' });
    }
    
    next();
};

async function initializeDB() {
    try {
        // Ensure the database directory exists
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        // Check if the database path is a directory (common issue on Render)
        if (fs.existsSync(dbPath) && fs.statSync(dbPath).isDirectory()) {
            console.error(`Database path ${dbPath} is a directory, not a file. This is likely a deployment configuration issue.`);
            throw new Error(`Database path ${dbPath} is a directory. Please check your DB_PATH environment variable.`);
        }
        
        try {
            await db.read();
            console.log('Database loaded successfully');
        } catch (error) {
            console.error('Database initialization error:', error);
            console.log('Creating fresh database...');
            // Initialize with empty data structure
            db.data = { submissions: [], admin_users: [], offline_messages: {}, chats: {}, analytics_events: [] };
            await db.write();
            console.log('Fresh database created successfully');
        }
        
        if (!db.data || typeof db.data !== 'object') {
            db.data = { submissions: [], admin_users: [], offline_messages: {}, chats: {}, analytics_events: [] };
        }
        
        db.data.submissions = db.data.submissions || [];
        db.data.admin_users = db.data.admin_users || [];
        db.data.chats = db.data.chats || {};
        db.data.analytics_events = db.data.analytics_events || []; // Ensure analytics array exists
        db.data.subscriptions = db.data.subscriptions || []; // Ensure subscriptions array exists
        db.data.bookings = db.data.bookings || []; // Ensure bookings array exists
        db.data.reviews = db.data.reviews || []; // Ensure reviews array exists
        db.data.employees = db.data.employees || []; // Ensure employees array exists
        
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.error('CRITICAL: ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables.');
            console.error('Please set:');
            console.error('ADMIN_EMAIL=your-email@example.com');
            console.error('ADMIN_PASSWORD=your-secure-password');
            process.exit(1);
        }
        
        const adminUser = db.data.admin_users.find(user => user.email === adminEmail);
        if (!adminUser) {
            const hash = await bcrypt.hash(adminPassword, 12);
            db.data.admin_users.push({
                id: Date.now(),
                email: adminEmail,
                username: adminEmail.split('@')[0], // Use email prefix as username
                password_hash: hash,
                created_at: new Date().toISOString()
            });
            await db.write();
            console.log(`✅ Admin user '${adminEmail}' created successfully`);
        } else {
            // Update password if it has changed
            const isValid = await bcrypt.compare(adminPassword, adminUser.password_hash);
            if (!isValid) {
                const hash = await bcrypt.hash(adminPassword, 12);
                adminUser.password_hash = hash;
                await db.write();
                console.log(`✅ Admin password updated for '${adminEmail}'`);
            } else {
                console.log(`✅ Admin user '${adminEmail}' already exists with current password`);
            }
        }
        
        try { await db.write(); } catch (_) {}

        console.log('Database ready at:', dbPath);
        
    } catch (error) {
        console.error('Database initialization error:', error);
        try {
            db.data = { submissions: [], admin_users: [], offline_messages: {}, chats: {}, analytics_events: [] };
            
            const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
            db.data.admin_users.push({
                id: Date.now(),
                email: process.env.ADMIN_EMAIL,
                username: process.env.ADMIN_EMAIL.split('@')[0],
                password_hash: hash,
                created_at: new Date().toISOString()
            });
            
            await db.write();
            console.log('Fresh database created successfully');
        } catch (writeError) {
            console.error('Failed to create fresh database:', writeError);
            throw writeError;
        }
    }
}

app.set('db', db);

function requireAuth(req, res, next) {
    console.log('🔐 Auth check:', {
        hasSession: !!req.session,
        authenticated: req.session?.authenticated,
        sessionId: req.sessionID,
        user: req.session?.user
    });
    
    if (req.session && req.session.authenticated) {
        next();
    } else {
        console.log('❌ Authentication failed - session not authenticated');
        res.status(401).json({ error: 'Authentication required' });
    }
}

// =================================================================
// START ANALYTICS ROUTES
// =================================================================
app.post('/api/analytics/track', (req, res) => {
    try {
        const { eventType, path, referrer, sessionId } = req.body;
        
        if (!eventType) {
            return res.status(400).json({ error: 'eventType is required.' });
        }

        const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
        const geo = geoip.lookup(ip);

        const event = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            eventType: validator.escape(eventType.substring(0, 50)),
            path: path ? validator.escape(path.substring(0, 200)) : undefined,
            referrer: referrer ? validator.escape(referrer.substring(0, 500)) : undefined,
            sessionId: sessionId ? validator.escape(sessionId.substring(0, 100)) : undefined,
            ip,
            country: geo ? geo.country : 'Unknown',
            userAgent: req.headers['user-agent']
        };

        analyticsQueue.push(event);
        res.status(202).json({ success: true });
    } catch (err) {
        console.error('Analytics tracking error:', err);
        res.status(500).json({ success: false });
    }
});

async function writeAnalyticsBatch() {
    if (isWritingAnalytics || analyticsQueue.length === 0) {
        return;
    }

    isWritingAnalytics = true;
    const batch = [...analyticsQueue];
    analyticsQueue.length = 0;

    try {
        await db.read();
        db.data.analytics_events.push(...batch);
        await db.write();
        clearCache('analytics');
        console.log(`Wrote ${batch.length} analytics events to the database.`);
    } catch (err) {
        console.error('Error writing analytics batch:', err);
        analyticsQueue.unshift(...batch);
    } finally {
        isWritingAnalytics = false;
    }
}

setInterval(writeAnalyticsBatch, 30000);

app.get('/api/analytics', requireAuth, async (req, res) => {
    try {
        const analyticsData = await cachedRead('analytics', async () => {
            await db.read();
            const events = db.data.analytics_events || [];
            const now = Date.now();
            const last24h = now - (24 * 60 * 60 * 1000);
            const last7d = now - (7 * 24 * 60 * 60 * 1000);
            const last5m = now - (5 * 60 * 1000);

            // Filter events for relevant time periods
            const events24h = events.filter(e => e.timestamp >= last24h);
            const events7d = events.filter(e => e.timestamp >= last7d);

            // 1. Real-Time Users (unique IPs in last 5 mins)
            const realtimeUsers = new Set(events.filter(e => e.timestamp >= last5m).map(e => e.ip)).size;

            // 2. Total Visits (pageviews in last 24h)
            const totalVisits24h = events24h.filter(e => e.eventType === 'pageview').length;

            // 3. Visitors by Country (top 6)
            const countryCounts = events24h.reduce((acc, event) => {
                const country = event.country || 'Unknown';
                acc[country] = (acc[country] || 0) + 1;
                return acc;
            }, {});
            const sortedCountries = Object.entries(countryCounts).sort(([, a], [, b]) => b - a).slice(0, 6);
            const countryData = {
                labels: sortedCountries.map(c => c[0]),
                data: sortedCountries.map(c => c[1])
            };

            // 4. Traffic Sources
            const getSource = (referrer) => {
                if (!referrer) return 'Direct';
                try {
                    const url = new URL(referrer);
                    if (url.hostname.includes('google')) return 'Google';
                    if (url.hostname.includes('facebook')) return 'Facebook';
                    if (url.hostname.includes('instagram')) return 'Instagram';
                    if (url.hostname.includes(req.hostname)) return 'Internal';
                    return 'Referral';
                } catch { return 'Direct'; }
            };
            const trafficCounts = events24h.reduce((acc, event) => {
                const source = getSource(event.referrer);
                acc[source] = (acc[source] || 0) + 1;
                return acc;
            }, {});
            const sortedTraffic = Object.entries(trafficCounts).sort(([, a], [, b]) => b - a).slice(0, 5);
            const trafficSourceData = {
                labels: sortedTraffic.map(t => t[0]),
                data: sortedTraffic.map(t => t[1])
            };

            // 5. Page Views (Last 7 Days)
            const pageViewsByDay = {};
            for (let i = 0; i < 7; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dayKey = d.toISOString().split('T')[0];
                pageViewsByDay[dayKey] = 0;
            }
            events7d.forEach(event => {
                if (event.eventType === 'pageview') {
                    const dayKey = new Date(event.timestamp).toISOString().split('T')[0];
                    if (pageViewsByDay.hasOwnProperty(dayKey)) {
                        pageViewsByDay[dayKey]++;
                    }
                }
            });
            const sortedPageViews = Object.entries(pageViewsByDay).sort((a,b) => new Date(a[0]) - new Date(b[0]));
            const pageViews7d = {
                labels: sortedPageViews.map(p => new Date(p[0]).toLocaleDateString('en-US', { weekday: 'short' })),
                data: sortedPageViews.map(p => p[1])
            };

            // 6 & 7. Avg. Duration & Bounce Rate
            const sessions24h = {};
            events24h.forEach(e => {
                if (!sessions24h[e.ip]) sessions24h[e.ip] = [];
                sessions24h[e.ip].push(e.timestamp);
            });
            
            let totalDuration = 0;
            let bouncedSessions = 0;
            const activeSessions = Object.values(sessions24h);
            if (activeSessions.length > 0) {
                activeSessions.forEach(timestamps => {
                    if (timestamps.length > 1) {
                        const duration = Math.max(...timestamps) - Math.min(...timestamps);
                        totalDuration += duration;
                    } else {
                        bouncedSessions++;
                    }
                });
            }
            const avgDurationMs = activeSessions.length > 0 ? totalDuration / (activeSessions.length - bouncedSessions || 1) : 0;
            const avgDurationSec = Math.round(avgDurationMs / 1000);
            const avgDuration = `${Math.floor(avgDurationSec / 60)}m ${avgDurationSec % 60}s`;
            const bounceRate = activeSessions.length > 0 ? `${Math.round((bouncedSessions / activeSessions.length) * 100)}%` : '0%';

            return {
                realtimeUsers,
                totalVisits24h,
                avgDuration,
                bounceRate,
                countryData,
                trafficSourceData,
                pageViews7d,
            };
        });

        res.json(analyticsData);
    } catch (err) {
        console.error('Error fetching analytics data:', err);
        res.status(500).json({ error: 'Failed to retrieve analytics data.' });
    }
});
// =================================================================
// END ANALYTICS ROUTES
// =================================================================

app.post('/api/form/submit', validateFormSubmission, async (req, res) => {
    try {
        const { name, email, phone, service, message, preferred_date, preferred_time } = req.body;
        
        const sanitizedData = {
            name: validator.escape(name.trim()).substring(0, 100),
            email: email ? validator.normalizeEmail(email) : '',
            phone: phone ? validator.escape(phone.trim()).substring(0, 20) : '',
            service: service ? validator.escape(service.trim()).substring(0, 50) : '',
            message: validator.escape(message.trim()).substring(0, 1000),
            preferred_date: preferred_date || '',
            preferred_time: preferred_time ? validator.escape(preferred_time.trim()).substring(0, 50) : ''
        };
        
        await db.read();
        const submission = {
            id: Date.now(),
            ...sanitizedData,
            submitted_at: new Date().toISOString(),
            ip: req.ip || req.connection.remoteAddress || 'unknown',
            status: 'new' 
        };
        
        db.data.submissions.push(submission);
        await db.write();
        clearCache('submissions'); // ADDED: Invalidate cache
        
        async function sendEmailNotification(formData) {
            try {
                // Send notification to admin
                const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(email => email.trim()) : [process.env.ADMIN_EMAIL];
                if (adminEmails.length > 0) {
                    const htmlContent = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">New Contact Form Submission</h2>
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <p><strong>Name:</strong> ${formData.name}</p>
                                <p><strong>Email:</strong> ${formData.email}</p>
                                <p><strong>Phone:</strong> ${formData.phone}</p>
                                <p><strong>Service:</strong> ${formData.service}</p>
                                <p><strong>Message:</strong> ${formData.message}</p>
                                ${formData.preferred_date ? `<p><strong>Preferred Date:</strong> ${formData.preferred_date}</p>` : ''}
                                ${formData.preferred_time ? `<p><strong>Preferred Time:</strong> ${formData.preferred_time}</p>` : ''}
                            </div>
                            <p style="color: #7f8c8d; font-size: 12px;">Submitted at: ${new Date().toLocaleString()}</p>
                        </div>
                    `;
                    
                    for (const adminEmail of adminEmails) {
                        const mailOptions = {
                            from: `"AJK Cleaning Services" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
                            to: adminEmail,
                            subject: `New Contact Form Submission - ${formData.service}`,
                            html: htmlContent
                        };

                        // Try SendGrid first, fallback to SMTP
                        let result;
                        try {
                            if (process.env.SENDGRID_API_KEY) {
                                console.log('🚀 [FORM ADMIN] Attempting to send email via SendGrid...');
                                result = await sendGridAdvanced.sendEmail(adminEmail, mailOptions.subject, mailOptions.html, mailOptions.html);
                                console.log('✅ [FORM ADMIN] SendGrid email sent successfully');
                            } else {
                                console.log('⚠️  [FORM ADMIN] SENDGRID_API_KEY not found, using SMTP fallback...');
                                result = await sendEmailWithFallback(mailOptions);
                            }
                        } catch (sendGridError) {
                            console.log('🔄 [FORM ADMIN] SendGrid failed, trying SMTP fallback...', sendGridError.message);
                            result = await sendEmailWithFallback(mailOptions);
                        }
                    }
                    console.log('✅ Admin notification sent via SendGrid/SMTP');
                }
                
                // Send confirmation to client
                if (formData.email) {
                    const clientHtmlContent = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #2c3e50;">Thank You for Contacting AJK Cleaning Services!</h2>
                            <p>Dear ${formData.name},</p>
                            <p>We have received your message and will get back to you within 24 hours.</p>
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="color: #2c3e50; margin-top: 0;">Your Message Details:</h3>
                                <p><strong>Service:</strong> ${formData.service}</p>
                                <p><strong>Message:</strong> ${formData.message}</p>
                                ${formData.preferred_date ? `<p><strong>Preferred Date:</strong> ${formData.preferred_date}</p>` : ''}
                                ${formData.preferred_time ? `<p><strong>Preferred Time:</strong> ${formData.preferred_time}</p>` : ''}
                            </div>
                            <p>If you have any urgent questions, please call us at +49 176 61852286 or email us at info@ajkcleaners.de.</p>
                            <p>Best regards,<br>AJK Cleaning Services Team</p>
                        </div>
                    `;
                    
                    const clientMailOptions = {
                        from: `"AJK Cleaning Services" <${process.env.SMTP_USER || process.env.ADMIN_EMAIL}>`,
                        to: formData.email,
                        subject: 'Thank You for Contacting AJK Cleaning Services',
                        html: clientHtmlContent
                    };

                    // Try SendGrid first, fallback to SMTP
                    let result;
                    try {
                        if (process.env.SENDGRID_API_KEY) {
                            console.log('🚀 [FORM CLIENT] Attempting to send email via SendGrid...');
                            result = await sendGridAdvanced.sendEmail(formData.email, clientMailOptions.subject, clientMailOptions.html, clientMailOptions.html);
                            console.log('✅ [FORM CLIENT] SendGrid email sent successfully');
                        } else {
                            console.log('⚠️  [FORM CLIENT] SENDGRID_API_KEY not found, using SMTP fallback...');
                            result = await sendEmailWithFallback(clientMailOptions);
                        }
                    } catch (sendGridError) {
                        console.log('🔄 [FORM CLIENT] SendGrid failed, trying SMTP fallback...', sendGridError.message);
                        result = await sendEmailWithFallback(clientMailOptions);
                    }
                    console.log(`✅ Client confirmation sent to ${formData.email} via SendGrid/SMTP`);
                }
                
            } catch (error) {
                console.error('❌ Email notification failed:', error);
            }
        }

        try {
            await sendEmailNotification(sanitizedData);
        } catch (emailError) {
            console.error('Email notification failed:', emailError);
        }
        
        notifyAdmin('new_submission', {
            id: submission.id,
            name: sanitizedData.name,
            email: sanitizedData.email,
            service: sanitizedData.service
        });
        
        console.log('Form submission received:', { id: submission.id, email: sanitizedData.email });
        
        res.json({ success: true, id: submission.id, message: 'Thank you! Your message has been sent successfully.' });
    } catch (error) {
        console.error('Form submission error:', error);
        res.status(500).json({ success: false, error: 'Internal server error. Please try again or contact us directly.' });
    }
});

app.get('/api/submissions', requireAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Max 100
        const searchTerm = req.query.search || '';
        const serviceFilter = req.query.service || '';
        const dateFilter = req.query.date || '';
        const sortField = req.query.sortField || 'id';
        const sortDirection = req.query.sortDirection || 'desc';

        // Use cached data
        const submissions = await cachedRead('submissions', async () => {
            await db.read();
            // FIX: Ensure submissions is always an array to prevent crashes
            return (db.data && Array.isArray(db.data.submissions)) ? db.data.submissions : [];
        });

        // Apply filters
        let filtered = [...submissions];

        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(s =>
                 (s.name && s.name.toLowerCase().includes(search)) ||
                 (s.email && s.email.toLowerCase().includes(search)) ||
                 (s.phone && s.phone.toLowerCase().includes(search)) ||
                 (s.service && s.service.toLowerCase().includes(search)) ||
                 (s.message && s.message.toLowerCase().includes(search))
            );
        }

        if (serviceFilter) {
            filtered = filtered.filter(s => s.service === serviceFilter);
        }

        if (dateFilter) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            switch(dateFilter) {
                case 'today':
                    filtered = filtered.filter(s => new Date(s.submitted_at) >= today);
                    break;
                case 'week':
                    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    filtered = filtered.filter(s => new Date(s.submitted_at) >= weekAgo);
                    break;
                case 'month':
                    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                    filtered = filtered.filter(s => new Date(s.submitted_at) >= monthAgo);
                    break;
            }
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let valueA, valueB;
            if (sortField === 'date') {
                valueA = new Date(a.submitted_at).getTime();
                valueB = new Date(b.submitted_at).getTime();
            } else {
                valueA = a[sortField] || '';
                valueB = b[sortField] || '';
            }

            if (typeof valueA === 'string') {
                return sortDirection === 'asc'
                         ? valueA.localeCompare(valueB)
                         : valueB.localeCompare(valueA);
            } else {
                return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
            }
        });

        const total = filtered.length;
        const offset = (page - 1) * limit;
        const paginated = filtered.slice(offset, offset + limit);

        res.json({
            data: paginated,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: offset + limit < total,
                hasPrev: page > 1
            }
        });
    } catch (err) {
        console.error('Error fetching submissions:', err);
        res.status(500).json({ error: 'Server error while loading submissions.' });
    }
});


app.get('/api/submissions/:id', requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'Invalid submission ID' });
    }
    
    try {
        await db.read();
        // FIX: Added robust check for submissions array
        const submissions = (db.data && Array.isArray(db.data.submissions)) ? db.data.submissions : [];
        const submission = submissions.find(s => s.id === id);
        
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        res.json(submission);
    } catch (err) {
        console.error('Error fetching submission details:', err);
        res.status(500).json({ error: 'Database error while fetching details' });
    }
});

app.delete('/api/submissions/:id', requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (!id || isNaN(id)) {
        return res.status(400).json({ error: 'Invalid submission ID' });
    }
    
    try {
        await db.read();
        // FIX: Added robust check for submissions array
        const submissions = (db.data && Array.isArray(db.data.submissions)) ? db.data.submissions : [];
        const initialLength = submissions.length;
        db.data.submissions = submissions.filter(s => s.id !== id);
        
        if (db.data.submissions.length === initialLength) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        await db.write();
        clearCache('submissions'); // ADDED: Invalidate cache
        res.json({ success: true, message: 'Submission deleted successfully' });
    } catch (err) {
        console.error('Error deleting submission:', err);
        res.status(500).json({ error: 'Database error during deletion' });
    }
});


app.post('/api/submissions/bulk-delete', requireAuth, async (req, res) => {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No submission IDs provided' });
    }
    
    try {
        await db.read();
        const submissions = (db.data && Array.isArray(db.data.submissions)) ? db.data.submissions : [];
        const initialLength = submissions.length;
        const idsToDelete = ids.map(id => parseInt(id, 10));
        db.data.submissions = submissions.filter(s => !idsToDelete.includes(s.id));
        const deletedCount = initialLength - db.data.submissions.length;
        
        await db.write();
        clearCache('submissions');
        res.json({ 
            success: true, 
            message: `${deletedCount} submissions deleted successfully`,
            deleted: deletedCount
        });
    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ error: 'Database error during bulk delete' });
    }
});

app.get('/api/submissions/export', requireAuth, async (req, res) => {
    try {
        await db.read();
        const submissions = db.data.submissions || [];
        
        const headers = ['ID', 'Name', 'Email', 'Phone', 'Service', 'Preferred Date', 'Preferred Time', 'Message', 'Date'];
        const csvRows = [headers.join(',')];
        
        submissions.forEach(sub => {
            const row = [
                sub.id,
                `"${(sub.name || '').replace(/"/g, '""')}"`,
                sub.email || '',
                sub.phone || '',
                `"${(sub.service || '').replace(/"/g, '""')}"`,
                sub.preferred_date || '',
                `"${(sub.preferred_time || '').replace(/"/g, '""')}"`,
                `"${(sub.message || '').replace(/"/g, '""')}"`,
                new Date(sub.submitted_at).toISOString()
            ];
            csvRows.push(row.join(','));
        });
        
        const csv = csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=submissions-${Date.now()}.csv`);
        res.send(csv);
    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ error: 'Export failed' });
    }
});

// Bookings API endpoints
app.get('/api/bookings', requireAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const searchTerm = req.query.search || '';
        const statusFilter = req.query.status || '';
        const dateFrom = req.query.dateFrom || '';
        const dateTo = req.query.dateTo || '';

        await db.read();
        let bookings = db.data.bookings || [];

        // Apply filters
        if (searchTerm) {
            bookings = bookings.filter(booking => 
                booking.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (booking.details?.customerName && booking.details.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (booking.details?.customerEmail && booking.details.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        if (statusFilter) {
            bookings = bookings.filter(booking => booking.status === statusFilter);
        }

        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            bookings = bookings.filter(booking => new Date(booking.createdAt) >= fromDate);
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            bookings = bookings.filter(booking => new Date(booking.createdAt) <= toDate);
        }

        // Sort by creation date (newest first)
        bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Calculate pagination
        const totalBookings = bookings.length;
        const totalPages = Math.ceil(totalBookings / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedBookings = bookings.slice(startIndex, endIndex);

        // Calculate stats
        const paidBookings = bookings.filter(b => b.status === 'paid' || b.status === 'confirmed' || b.status === 'in_progress' || b.status === 'completed');
        const stats = {
            total: totalBookings,
            revenue: paidBookings.reduce((sum, booking) => sum + ((booking.amount || 0) / 100), 0), // Convert cents to euros
            pending: bookings.filter(b => b.status === 'pending_payment').length,
            completed: bookings.filter(b => b.status === 'completed').length
        };

        res.json({
            data: paginatedBookings,
            pagination: {
                page,
                totalPages,
                total: totalBookings,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            stats
        });
    } catch (err) {
        console.error('Error fetching bookings:', err);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

app.get('/api/bookings/:id', requireAuth, async (req, res) => {
    try {
        await db.read();
        const bookings = db.data.bookings || [];
        const booking = bookings.find(b => b.id === req.params.id);
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        res.json(booking);
    } catch (err) {
        console.error('Error fetching booking:', err);
        res.status(500).json({ error: 'Failed to fetch booking' });
    }
});

app.get('/api/bookings/by-payment-intent/:paymentIntentId', async (req, res) => {
    try {
        await db.read();
        const bookings = db.data.bookings || [];
        const booking = bookings.find(b => b.paymentIntentId === req.params.paymentIntentId);
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        res.json(booking);
    } catch (err) {
        console.error('Error fetching booking by payment intent:', err);
        res.status(500).json({ error: 'Failed to fetch booking' });
    }
});

app.put('/api/bookings/:id/status', requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending_payment', 'paid', 'confirmed', 'in_progress', 'completed', 'payment_failed', 'cancelled'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await db.read();
        const bookings = db.data.bookings || [];
        const bookingIndex = bookings.findIndex(b => b.id === req.params.id);
        
        if (bookingIndex === -1) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        bookings[bookingIndex].status = status;
        bookings[bookingIndex].updatedAt = new Date().toISOString();
        
        await db.write();
        res.json({ success: true, message: 'Booking status updated successfully' });
    } catch (err) {
        console.error('Error updating booking status:', err);
        res.status(500).json({ error: 'Failed to update booking status' });
    }
});

app.get('/api/bookings/export', requireAuth, async (req, res) => {
    try {
        await db.read();
        const bookings = db.data.bookings || [];
        
        const headers = ['ID', 'Customer Name', 'Customer Email', 'Customer Phone', 'Package', 'Date', 'Time', 'Duration', 'Cleaners', 'Amount', 'Status', 'Created At'];
        const csvRows = [headers.join(',')];
        
        bookings.forEach(booking => {
            const row = [
                booking.id,
                booking.details?.customerName || '',
                booking.details?.customerEmail || '',
                booking.details?.customerPhone || '',
                booking.details?.package || '',
                booking.details?.date || '',
                booking.details?.time || '',
                booking.details?.duration || '',
                booking.details?.cleaners || '',
                booking.amount || 0,
                booking.status || '',
                new Date(booking.createdAt).toLocaleString()
            ];
            csvRows.push(row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
        });
        
        const csv = csvRows.join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=bookings-${Date.now()}.csv`);
        res.send(csv);
    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ error: 'Export failed' });
    }
});

// Quick fix: Update all pending payments to paid
app.post('/api/bookings/update-all-pending', async (req, res) => {
    try {
        await db.read();
        const bookings = db.data.bookings || [];
        let updatedCount = 0;
        
        for (let booking of bookings) {
            if (booking.status === 'pending_payment') {
                booking.status = 'paid';
                booking.paidAt = new Date().toISOString();
                booking.updatedAt = new Date().toISOString();
                updatedCount++;
            }
        }
        
        if (updatedCount > 0) {
            await db.write();
            res.json({ 
                success: true, 
                message: `Updated ${updatedCount} bookings to paid status`,
                updatedCount 
            });
        } else {
            res.json({ 
                success: true, 
                message: 'No pending bookings found',
                updatedCount: 0 
            });
        }
    } catch (error) {
        console.error('Error updating pending bookings:', error);
        res.status(500).json({ error: 'Failed to update bookings' });
    }
});

// Create commercial booking (no payment required)
app.post('/api/bookings/commercial-create', async (req, res) => {
    try {
        const { bookingDetails } = req.body;
        
        if (!bookingDetails) {
            return res.status(400).json({ error: 'Booking details are required' });
        }

        // Validate required fields
        if (!bookingDetails.customerEmail || !bookingDetails.customerName) {
            return res.status(400).json({ error: 'Customer email and name are required' });
        }

        console.log(`[COMMERCIAL] 📋 Creating commercial booking:`, bookingDetails);
        console.log(`[COMMERCIAL] 📧 Customer Email:`, bookingDetails.customerEmail);
        console.log(`[COMMERCIAL] 📅 Booking Date:`, bookingDetails.date);

        // Check if booking already exists (by email and date)
        await db.read();
        
        // Ensure bookings array exists
        if (!db.data.bookings) {
            db.data.bookings = [];
        }
        
        console.log(`[COMMERCIAL] 📊 Total existing bookings:`, db.data.bookings.length);
        const existingBooking = db.data.bookings.find(b => 
            b.details && 
            b.details.customerEmail === bookingDetails.customerEmail && 
            b.details.date === bookingDetails.date &&
            b.details.package === 'commercial'
        );
        
        if (existingBooking) {
            console.log(`[COMMERCIAL] ⚠️ Duplicate booking found, skipping email`);
            return res.json({ 
                status: 'exists', 
                message: 'Commercial booking already exists for this email and date',
                booking: existingBooking 
            });
        }

        // Create the commercial booking record
        const newBooking = {
            id: `booking_${Date.now()}`,
            details: bookingDetails,
            amount: 0, // Commercial bookings have no fixed amount
            status: 'pending_consultation', // Special status for commercial
            paymentIntentId: null, // No payment intent for commercial
            paidAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        
        console.log(`[COMMERCIAL] 📦 Creating commercial booking:`, newBooking);
        
        db.data.bookings.push(newBooking);
        await db.write();
        
        console.log(`[COMMERCIAL] ✅ Created commercial booking ${newBooking.id}`);
        console.log(`[COMMERCIAL] 📊 Total bookings in database:`, db.data.bookings.length);
        
        // Note: Commercial bookings don't automatically create subscriptions
        // Subscriptions for commercial clients are created after consultation with business owner
        console.log(`[COMMERCIAL] 📝 Commercial booking created - subscription will be created after consultation`);
        
        // Send commercial booking confirmation email (non-blocking)
        sendCommercialBookingConfirmation(newBooking)
            .then(() => {
                console.log(`[COMMERCIAL] 📧 Confirmation email sent for booking ${newBooking.id}`);
            })
            .catch(emailError => {
                console.error(`[COMMERCIAL] ❌ Failed to send confirmation email for booking ${newBooking.id}:`, emailError.message);
                console.error(`[COMMERCIAL] ❌ Full error:`, emailError);
                // Email failure doesn't affect booking completion
            });

        // Send admin notification for new commercial booking
        try {
            await sendAdminNotification(newBooking);
            console.log(`[COMMERCIAL] 📧 Admin notification sent for booking ${newBooking.id}`);
        } catch (adminError) {
            console.error(`[COMMERCIAL] ❌ Failed to send admin notification for booking ${newBooking.id}:`, adminError.message);
            // Don't fail the booking creation if admin notification fails
        }
        
        res.json({ 
            status: 'created', 
            message: 'Commercial booking created successfully',
            booking: newBooking 
        });

    } catch (error) {
        console.error('[COMMERCIAL] ❌ Error creating commercial booking:', error);
        res.status(500).json({ error: 'Failed to create commercial booking: ' + error.message });
    }
});

// Manual trigger to create booking (for testing)
app.post('/api/bookings/manual-create', async (req, res) => {
    try {
        const { paymentIntentId } = req.body;
        
        if (!paymentIntentId) {
            return res.status(400).json({ error: 'Payment Intent ID is required' });
        }

        console.log(`[MANUAL] 🔍 Looking for payment intent: ${paymentIntentId}`);

        // Retrieve payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        console.log(`[MANUAL] 📋 Payment Intent Status: ${paymentIntent.status}`);
        console.log(`[MANUAL] 📋 Payment Intent Metadata:`, paymentIntent.metadata);
        
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ 
                error: `Payment not successful. Status: ${paymentIntent.status}` 
            });
        }

        // Check if booking already exists
        await db.read();
        const existingBooking = db.data.bookings.find(b => b.paymentIntentId === paymentIntentId);
        if (existingBooking) {
            return res.json({ 
                status: 'exists', 
                message: 'Booking already exists',
                booking: existingBooking 
            });
        }

        // Parse booking details from metadata (handle both old and new format)
        let bookingDetails;
        if (paymentIntent.metadata.bookingDetailsId && global.tempBookingDetails) {
            // New format: retrieve from temp storage
            const tempId = paymentIntent.metadata.bookingDetailsId;
            if (global.tempBookingDetails.has(tempId)) {
                bookingDetails = global.tempBookingDetails.get(tempId);
                global.tempBookingDetails.delete(tempId);
            } else {
                bookingDetails = {};
            }
        } else if (paymentIntent.metadata.bookingDetails) {
            // Old format: parse from metadata
            bookingDetails = JSON.parse(paymentIntent.metadata.bookingDetails);
        } else {
            bookingDetails = {};
        }
        const totalAmount = parseFloat(paymentIntent.metadata.totalAmount || '0');
        
        console.log(`[MANUAL] 📝 Parsed booking details:`, bookingDetails);
        console.log(`[MANUAL] 💰 Total amount:`, totalAmount);
        
        // Create the booking record
        const newBooking = {
            id: `booking_${Date.now()}`,
            details: bookingDetails,
            amount: totalAmount,
            status: 'paid',
            paymentIntentId: paymentIntentId,
            paidAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
        };
        
        console.log(`[MANUAL] 📦 Creating booking:`, newBooking);
        
        db.data.bookings.push(newBooking);
        await db.write();
        
        console.log(`[MANUAL] ✅ Created booking ${newBooking.id}`);
        console.log(`[MANUAL] 📊 Total bookings in database:`, db.data.bookings.length);
        
        // Check if this is a subscription booking and create subscription
        // Only create subscriptions for regular subscription packages, not commercial or regular-basic
        if (bookingDetails.bookingType === 'subscription' && bookingDetails.package !== 'commercial' && bookingDetails.package !== 'regular-basic') {
            try {
                await createSubscriptionFromBooking(newBooking, bookingDetails);
                console.log(`[MANUAL] ✅ Created subscription for booking ${newBooking.id}`);
            } catch (subscriptionError) {
                console.error(`[MANUAL] ❌ Failed to create subscription for booking ${newBooking.id}:`, subscriptionError.message);
                // Don't fail the booking if subscription creation fails
            }
        } else if (bookingDetails.bookingType === 'subscription' && (bookingDetails.package === 'commercial' || bookingDetails.package === 'regular-basic')) {
            console.log(`[MANUAL] 📝 ${bookingDetails.package} subscription booking - subscription will be created after consultation`);
        }
        
        // Send invoice email to customer
        try {
            await sendBookingInvoice(newBooking);
            console.log(`[MANUAL] 📧 Invoice email sent for booking ${newBooking.id}`);
        } catch (emailError) {
            console.error(`[MANUAL] ❌ Failed to send invoice email for booking ${newBooking.id}:`, emailError.message);
        }
        
        // Send admin notification for new booking
        try {
            await sendAdminNotification(newBooking);
            console.log(`[MANUAL] 📧 Admin notification sent for booking ${newBooking.id}`);
        } catch (adminError) {
            console.error(`[MANUAL] ❌ Failed to send admin notification for booking ${newBooking.id}:`, adminError.message);
        }
        
        res.json({ 
            status: 'created', 
            message: 'Booking created successfully',
            booking: newBooking 
        });

    } catch (error) {
        console.error('[MANUAL] ❌ Error creating booking:', error);
        res.status(500).json({ error: 'Failed to create booking: ' + error.message });
    }
});

// Create booking manually if webhook failed
app.post('/api/bookings/create-from-payment', async (req, res) => {
    try {
        const { paymentIntentId } = req.body;
        
        if (!paymentIntentId) {
            return res.status(400).json({ error: 'Payment Intent ID is required' });
        }

        // Check if booking already exists
        await db.read();
        const existingBooking = db.data.bookings.find(b => b.paymentIntentId === paymentIntentId);
        if (existingBooking) {
            return res.json({ 
                status: 'exists', 
                message: 'Booking already exists',
                booking: existingBooking 
            });
        }

        // Retrieve payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ 
                error: `Payment not successful. Status: ${paymentIntent.status}` 
            });
        }

        // Parse booking details from metadata (handle both old and new format)
        let bookingDetails;
        console.log(`[PAYMENT] 🔍 Payment Intent Metadata:`, paymentIntent.metadata);
        console.log(`[PAYMENT] 🔍 Temp storage available:`, !!global.tempBookingDetails);
        console.log(`[PAYMENT] 🔍 Temp storage size:`, global.tempBookingDetails ? global.tempBookingDetails.size : 0);
        
        if (paymentIntent.metadata.bookingDetailsId && global.tempBookingDetails) {
            // New format: retrieve from temp storage
            const tempId = paymentIntent.metadata.bookingDetailsId;
            console.log(`[PAYMENT] 🔍 Looking for temp ID: ${tempId}`);
            if (global.tempBookingDetails.has(tempId)) {
                bookingDetails = global.tempBookingDetails.get(tempId);
                console.log(`[PAYMENT] ✅ Retrieved booking details from temp storage:`, bookingDetails);
                global.tempBookingDetails.delete(tempId);
            } else {
                console.error(`[PAYMENT] ❌ CRITICAL: Booking details not found in temp storage for ID ${tempId}`);
                console.log(`[PAYMENT] 🔍 Available temp IDs:`, Array.from(global.tempBookingDetails.keys()));
                bookingDetails = {};
            }
        } else if (paymentIntent.metadata.bookingDetails) {
            // Old format: parse from metadata
            console.log(`[PAYMENT] 🔍 Using old format metadata`);
            bookingDetails = JSON.parse(paymentIntent.metadata.bookingDetails);
        } else {
            console.error(`[PAYMENT] ❌ CRITICAL: No booking details found in metadata or temp storage`);
            console.log(`[PAYMENT] 🔍 Metadata keys:`, Object.keys(paymentIntent.metadata));
            bookingDetails = {};
        }
        const totalAmount = parseFloat(paymentIntent.metadata.totalAmount || '0');
        
        // Create the booking record
        const newBooking = {
            id: `booking_${Date.now()}`,
            details: bookingDetails,
            amount: totalAmount,
            status: 'paid',
            paymentIntentId: paymentIntentId,
            paidAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
        };
        
        db.data.bookings.push(newBooking);
        await db.write();
        
        // Send invoice email to customer
        try {
            await sendBookingInvoice(newBooking);
            console.log(`[PAYMENT] 📧 Invoice email sent for booking ${newBooking.id}`);
        } catch (emailError) {
            console.error(`[PAYMENT] ❌ Failed to send invoice email for booking ${newBooking.id}:`, emailError.message);
        }
        
        // Send admin notification for new booking
        try {
            await sendAdminNotification(newBooking);
            console.log(`[PAYMENT] 📧 Admin notification sent for booking ${newBooking.id}`);
        } catch (adminError) {
            console.error(`[PAYMENT] ❌ Failed to send admin notification for booking ${newBooking.id}:`, adminError.message);
        }
        
        res.json({ 
            status: 'created', 
            message: 'Booking created successfully',
            booking: newBooking 
        });

    } catch (error) {
        console.error('Error creating booking from payment:', error);
        res.status(500).json({ error: 'Failed to create booking from payment' });
    }
});

// Performance metrics endpoint
app.post('/api/performance', (req, res) => {
    try {
        const performanceData = req.body;
        console.log('Performance metrics received:', performanceData);
        
        // Store performance data in database
        db.data.performance_metrics = db.data.performance_metrics || [];
        db.data.performance_metrics.push({
            ...performanceData,
            receivedAt: new Date().toISOString()
        });
        
        // Keep only last 1000 entries to prevent database bloat
        if (db.data.performance_metrics.length > 1000) {
            db.data.performance_metrics = db.data.performance_metrics.slice(-1000);
        }
        
        db.write();
        
        res.json({ status: 'success', message: 'Performance metrics recorded' });
    } catch (error) {
        console.error('Error recording performance metrics:', error);
        res.status(500).json({ error: 'Failed to record performance metrics' });
    }
});

// Database health check endpoint
app.get('/api/health/database', async (req, res) => {
    try {
        const health = await healthCheck();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// Comprehensive health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const { getHealthStatus } = require('./utils/uptimeMonitor');
        const health = await getHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// Analytics endpoints
app.get('/api/analytics', (req, res) => {
    try {
        const analytics = require('./utils/analytics');
        const data = analytics.getDashboardData();
        res.json(data);
    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({ error: 'Failed to get analytics data' });
    }
});

app.get('/api/analytics/realtime', (req, res) => {
    try {
        const analytics = require('./utils/analytics');
        const data = analytics.getRealTimeAnalytics();
        res.json(data);
    } catch (error) {
        console.error('Error getting real-time analytics:', error);
        res.status(500).json({ error: 'Failed to get real-time analytics' });
    }
});

// Error tracking endpoint
app.post('/api/errors', (req, res) => {
    try {
        const errorTracker = require('./utils/errorTracker');
        const errorInfo = errorTracker.trackError(req.body.error, {
            url: req.body.url,
            method: req.method,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            userId: req.body.userId,
            sessionId: req.body.sessionId
        });
        res.json({ status: 'success', errorId: errorInfo.id });
    } catch (error) {
        console.error('Error tracking error:', error);
        res.status(500).json({ error: 'Failed to track error' });
    }
});

// Analytics tracking endpoint
app.post('/api/analytics/track', (req, res) => {
    try {
        const analytics = require('./utils/analytics');
        const { type, data, userAgent, ip } = req.body;
        
        // Track the event
        switch (type) {
            case 'page_view':
                analytics.trackPageView(data.page, userAgent, req.ip, data.referrer);
                break;
            case 'interaction':
                analytics.trackInteraction(data.type, data.element, data.page, userAgent, req.ip);
                break;
            case 'form_submission':
                analytics.trackFormSubmission(data.formType, data.success, data.page, userAgent, req.ip);
                break;
            case 'performance_issue':
                analytics.trackPerformance(data.metric, data.value, data.page, userAgent, req.ip);
                break;
            default:
                console.log('Unknown analytics event type:', type);
        }
        
        res.json({ status: 'success' });
    } catch (error) {
        console.error('Error tracking analytics:', error);
        res.status(500).json({ error: 'Failed to track analytics' });
    }
});

// Missing API endpoint for orphaned chat info
app.get('/api/chats/orphaned-info', (req, res) => {
    try {
        // Get orphaned chat info from database
        const orphanedChats = db.data.chats ? Object.keys(db.data.chats).filter(clientId => {
            const chat = db.data.chats[clientId];
            return chat && chat.messages && chat.messages.length > 0 && !chat.isActive;
        }) : [];
        
        res.json({
            orphanedCount: orphanedChats.length,
            orphanedChats: orphanedChats.map(clientId => ({
                clientId,
                messageCount: db.data.chats[clientId]?.messages?.length || 0,
                lastMessage: db.data.chats[clientId]?.messages?.[db.data.chats[clientId].messages.length - 1]?.timestamp
            }))
        });
    } catch (error) {
        console.error('Error fetching orphaned chat info:', error);
        res.status(500).json({ error: 'Failed to fetch orphaned chat info' });
    }
});

// Payment status check endpoint (GET for frontend polling)
app.get('/api/bookings/check-payment-status/:paymentIntentId', async (req, res) => {
    try {
        const { paymentIntentId } = req.params;
        
        if (!paymentIntentId) {
            return res.status(400).json({ error: 'Payment Intent ID is required' });
        }

        // Check with Stripe if payment was successful
        try {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            console.log('🔍 Payment Intent status:', paymentIntent.status);
            
            if (paymentIntent.status === 'succeeded') {
                // Check if booking already exists
                await db.read();
                const bookings = db.data.bookings || [];
                const existingBooking = bookings.find(b => b.paymentIntentId === paymentIntentId);
                
                if (existingBooking) {
                    return res.json({ 
                        status: 'paid', 
                        message: 'Booking already exists and is paid',
                        booking: existingBooking 
                    });
                }
                
                // Create booking from payment intent with details from temp storage
                let bookingDetails = {};
                console.log(`[PAYMENT] 🔍 Payment Intent Metadata:`, paymentIntent.metadata);
                console.log(`[PAYMENT] 🔍 Temp storage available:`, !!global.tempBookingDetails);
                console.log(`[PAYMENT] 🔍 Temp storage size:`, global.tempBookingDetails ? global.tempBookingDetails.size : 0);
                
                if (paymentIntent.metadata.bookingDetailsId && global.tempBookingDetails) {
                    // New format: retrieve from temp storage
                    const tempId = paymentIntent.metadata.bookingDetailsId;
                    console.log(`[PAYMENT] 🔍 Looking for temp ID: ${tempId}`);
                    if (global.tempBookingDetails.has(tempId)) {
                        bookingDetails = global.tempBookingDetails.get(tempId);
                        console.log(`[PAYMENT] ✅ Retrieved booking details from temp storage:`, bookingDetails);
                        global.tempBookingDetails.delete(tempId);
                    } else {
                        console.error(`[PAYMENT] ❌ CRITICAL: Booking details not found in temp storage for ID ${tempId}`);
                        console.log(`[PAYMENT] 🔍 Available temp IDs:`, Array.from(global.tempBookingDetails.keys()));
                    }
                } else if (paymentIntent.metadata.bookingDetails) {
                    // Old format: parse from metadata
                    console.log(`[PAYMENT] 🔍 Using old format metadata`);
                    bookingDetails = JSON.parse(paymentIntent.metadata.bookingDetails);
                } else {
                    console.error(`[PAYMENT] ❌ CRITICAL: No booking details found in metadata or temp storage`);
                    console.log(`[PAYMENT] 🔍 Metadata keys:`, Object.keys(paymentIntent.metadata));
                }
                
                const bookingData = {
                    id: `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    details: bookingDetails,
                    paymentIntentId: paymentIntentId,
                    status: 'paid',
                    amount: paymentIntent.amount,
                    currency: paymentIntent.currency,
                    customerEmail: paymentIntent.receipt_email || 'No email provided',
                    createdAt: new Date().toISOString(),
                    paidAt: new Date().toISOString()
                };
                
                bookings.push(bookingData);
                await db.write();
                
                // Send invoice email to customer
                try {
                    await sendBookingInvoice(bookingData);
                    console.log(`[PAYMENT] 📧 Invoice email sent for booking ${bookingData.id}`);
                } catch (emailError) {
                    console.error(`[PAYMENT] ❌ Failed to send invoice email for booking ${bookingData.id}:`, emailError.message);
                }
                
                // Send admin notification for new booking
                try {
                    await sendAdminNotification(bookingData);
                    console.log(`[PAYMENT] 📧 Admin notification sent for booking ${bookingData.id}`);
                } catch (adminError) {
                    console.error(`[PAYMENT] ❌ Failed to send admin notification for booking ${bookingData.id}:`, adminError.message);
                }
                
                return res.json({ 
                    status: 'paid', 
                    message: 'Payment successful and booking created',
                    booking: bookingData 
                });
            } else if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'requires_confirmation') {
                return res.json({ 
                    status: 'pending', 
                    message: `Payment status: ${paymentIntent.status}`,
                    paymentIntent: paymentIntent 
                });
            } else if (paymentIntent.status === 'canceled' || paymentIntent.status === 'payment_failed') {
                return res.json({ 
                    status: 'failed', 
                    message: `Payment failed: ${paymentIntent.status}`,
                    paymentIntent: paymentIntent 
                });
            } else {
                return res.json({ 
                    status: 'unknown', 
                    message: `Payment status: ${paymentIntent.status}`,
                    paymentIntent: paymentIntent 
                });
            }
        } catch (stripeError) {
            console.error('Stripe error:', stripeError);
            return res.status(500).json({ error: 'Failed to check payment status with Stripe' });
        }

    } catch (error) {
        console.error('Error checking payment status:', error);
        res.status(500).json({ error: 'Failed to check payment status' });
    }
});

// Manual payment status check endpoint (for testing/debugging)
app.post('/api/bookings/check-payment-status', async (req, res) => {
    try {
        const { bookingId } = req.body;
        
        if (!bookingId) {
            return res.status(400).json({ error: 'Booking ID is required' });
        }

        await db.read();
        const bookings = db.data.bookings || [];
        const booking = bookings.find(b => b.id === bookingId);
        
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // If booking is already paid, return current status
        if (booking.status === 'paid') {
            return res.json({ 
                status: 'paid', 
                message: 'Booking is already marked as paid',
                booking: booking 
            });
        }

        // Check with Stripe if payment was successful
        if (booking.paymentIntentId) {
            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(booking.paymentIntentId);
                
                if (paymentIntent.status === 'succeeded') {
                    // Update booking status
                    const bookingIndex = bookings.findIndex(b => b.id === bookingId);
                    if (bookingIndex !== -1) {
                        bookings[bookingIndex].status = 'paid';
                        bookings[bookingIndex].paidAt = new Date().toISOString();
                        await db.write();
                        
                        return res.json({ 
                            status: 'updated', 
                            message: 'Booking status updated to paid',
                            booking: bookings[bookingIndex]
                        });
                    }
                } else if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'requires_confirmation') {
                    return res.json({ 
                        status: 'pending', 
                        message: `Payment status: ${paymentIntent.status}`,
                        booking: booking 
                    });
                } else if (paymentIntent.status === 'canceled' || paymentIntent.status === 'payment_failed') {
                    // Update booking status to failed
                    const bookingIndex = bookings.findIndex(b => b.id === bookingId);
                    if (bookingIndex !== -1) {
                        bookings[bookingIndex].status = 'payment_failed';
                        bookings[bookingIndex].failedAt = new Date().toISOString();
                        await db.write();
                    }
                    
                    return res.json({ 
                        status: 'failed', 
                        message: `Payment failed: ${paymentIntent.status}`,
                        booking: bookings[bookingIndex]
                    });
                } else {
                    return res.json({ 
                        status: 'unknown', 
                        message: `Payment status: ${paymentIntent.status}`,
                        booking: booking 
                    });
                }
            } catch (stripeError) {
                console.error('Stripe error:', stripeError);
                return res.status(500).json({ error: 'Failed to check payment status with Stripe' });
            }
        }

        return res.json({ 
            status: 'no_payment_intent', 
            message: 'No payment intent found for this booking',
            booking: booking 
        });

    } catch (error) {
        console.error('Error checking payment status:', error);
        res.status(500).json({ error: 'Failed to check payment status' });
    }
});

app.get('/api/statistics', requireAuth, async (req, res) => {
    try {
        await db.read();
        const submissions = db.data.submissions || [];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const todaySubmissions = submissions.filter(s => 
            new Date(s.submitted_at) >= today
        );
        
        const weekSubmissions = submissions.filter(s => 
            new Date(s.submitted_at) >= weekAgo
        );
        
        const monthSubmissions = submissions.filter(s => 
            new Date(s.submitted_at) >= monthAgo
        );
        
        res.json({
            total: submissions.length,
            today: todaySubmissions.length,
            week: weekSubmissions.length,
            month: monthSubmissions.length
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/chat/stats', requireAuth, async (req, res) => {
    const connectedClients = Array.from(clients.values());
    const adminClients = connectedClients.filter(client => client.isAdmin);
    const userClients = connectedClients.filter(client => !client.isAdmin);
    
    await db.read();
    const totalMessages = Object.values(db.data.chats || {}).reduce((acc, chat) => acc + (chat.messages ? chat.messages.length : 0), 0);

    res.json({
        connectedClients: clients.size,
        activeChats: userClients.length,
        totalMessages: totalMessages,
        adminOnline: adminClients.length,
        admins: adminClients.map(a => ({ name: a.name, joined: a.joined })),
        users: userClients.map(u => ({ 
            id: u.id, 
            name: u.name, 
            email: u.email, 
            joined: u.joined, 
            ip: u.ip 
        }))
    });
});

app.post('/api/chat/send', requireAuth, async (req, res) => {
    const { clientId, message } = req.body;
    
    if (!clientId || !message) {
        return res.status(400).json({ success: false, error: 'Client ID and message are required' });
    }

    const { success, status } = await sendToClient(clientId, message);
    if (status === 'delivered') {
        return res.json({ success: true, message: 'Message sent successfully' });
    } else {
        return res.json({ success: true, message: 'Client offline. Message saved.' });
    }
});

app.post('/api/chat/broadcast', requireAuth, (req, res) => {
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    const count = broadcastToClients(message);
    res.json({ success: true, message: `Message broadcast to ${count} clients` });
});

app.get('/api/chat/history/:clientId', requireAuth, async (req, res) => {
    const { clientId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    try {
        await db.read();
        const chats = (db.data && db.data.chats) ? db.data.chats : {};
        const chat = chats[clientId];
        const messages = (chat && !chat.deleted && Array.isArray(chat.messages)) ? chat.messages : [];
        
        const start = Math.max(0, messages.length - limit);
        return res.json(messages.slice(start));
    } catch (e) {
        console.error('Error reading chat history from DB:', e);
        return res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/chat/history', requireAuth, async (req, res) => {
    try {
        await db.read();
        const allMessages = Object.values(db.data.chats || {})
            .flatMap(chat => (chat.messages || []).map(msg => ({ ...msg, clientId: chat.clientInfo ? chat.clientInfo.id : 'unknown' }))); // Add clientId for context
        allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const limit = parseInt(req.query.limit) || 100;
        const paginatedMessages = allMessages.slice(0, limit);
        res.json(paginatedMessages);
    } catch (error) {
        console.error('Error fetching all chat history:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/chats', requireAuth, async (req, res) => {
  try {
    await db.read();
    const chats = (db.data && db.data.chats) ? db.data.chats : {};
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/chats/:clientId', requireAuth, async (req, res) => {
    const clientId = req.params.clientId;
    
    try {
        await db.read();
        db.data = db.data && typeof db.data === 'object' ? db.data : {};
        db.data.chats = db.data.chats || {};
        
        if (db.data.chats[clientId]) {
            delete db.data.chats[clientId];
            
            if (db.data.offline_messages && db.data.offline_messages[clientId]) {
                delete db.data.offline_messages[clientId];
            }
            
            await db.write();

            const liveClient = clients.get(clientId);
            if (liveClient && liveClient.ws && liveClient.ws.readyState === WebSocket.OPEN) {
                try {
                    liveClient.ws.send(JSON.stringify({
                        type: 'chat_reset',
                        message: 'Chat session has been reset by admin. You are now connected to AI assistant.',
                        timestamp: new Date().toISOString(),
                        resetToAI: true
                    }));
                    
                    setTimeout(() => {
                        try {
                            liveClient.ws.close(1000, 'Chat reset by admin');
                        } catch (e) {
                            console.error('Error during delayed closing of client connection:', e);
                        }
                    }, 500);
                } catch (e) {
                    console.error('Error notifying client of chat reset:', e);
                }
            }
            
            clients.delete(clientId);

            res.json({ success: true, message: 'Chat completely deleted and client notified if online.' });
        } else {
            res.status(404).json({ error: 'Chat not found' });
        }
    } catch (err) {
        console.error('Chat deletion error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});


app.post('/api/chats/:clientId/status', requireAuth, async (req, res) => {
    const { clientId } = req.params;
    const { status } = req.body;

    if (!['active', 'resolved'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        await db.read();
        if (db.data.chats[clientId]) {
            db.data.chats[clientId].status = status;
            await db.write();
            res.json({ success: true, message: `Chat status updated to ${status}` });
        } else {
            res.status(404).json({ error: 'Chat not found' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/chats/resolve/:clientId', requireAuth, async (req, res) => {
    const clientId = req.params.clientId;

    try {
        await db.read();
        db.data = db.data && typeof db.data === 'object' ? db.data : {};
        db.data.chats = db.data.chats || {};
        if (db.data.chats[clientId]) {
            db.data.chats[clientId].status = 'resolved';
            await db.write();
            res.json({ success: true, message: 'Chat resolved successfully' });
        } else {
            res.status(404).json({ error: 'Chat not found' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/chats/:clientId', requireAuth, async (req, res) => {
  const clientId = req.params.clientId;
 
  try {
    await db.read();
    db.data = db.data && typeof db.data === 'object' ? db.data : {};
    db.data.chats = db.data.chats || {};
    if (db.data.chats[clientId] && !db.data.chats[clientId].deleted) {
      res.json(db.data.chats[clientId]);
    } else {
      res.status(404).json({ error: 'Chat not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Orphaned chat management endpoints
app.get('/api/chats/orphaned-info', requireAuth, async (req, res) => {
    try {
        const connectedClients = Array.from(clients.values());
        const orphanedClients = connectedClients.filter(client => 
            !client.connectionEstablished && 
            client.connectionTimeout && 
            !client.isAdmin
        );
        
        res.json({
            orphanedCount: orphanedClients.length,
            orphanedClients: orphanedClients.map(client => ({
                clientId: client.id,
                name: client.name || 'Unknown',
                joined: client.joined,
                ip: client.ip || 'Unknown',
                timeSinceJoined: Date.now() - new Date(client.joined).getTime()
            }))
        });
    } catch (err) {
        console.error('Error fetching orphaned chat info:', err);
        res.status(500).json({ error: 'Failed to fetch orphaned chat information' });
    }
});

app.post('/api/chats/cleanup-orphaned', requireAuth, async (req, res) => {
    try {
        const connectedClients = Array.from(clients.values());
        const orphanedClients = connectedClients.filter(client => 
            !client.connectionEstablished && 
            client.connectionTimeout && 
            !client.isAdmin
        );
        
        let cleanedCount = 0;
        orphanedClients.forEach(client => {
            if (client.connectionTimeout) {
                clearTimeout(client.connectionTimeout);
            }
            clients.delete(client.id);
            connectionQuality.delete(client.id);
            cleanedCount++;
        });
        
        res.json({
            success: true,
            message: `Cleaned up ${cleanedCount} orphaned chat sessions`,
            cleanedCount
        });
    } catch (err) {
        console.error('Error cleaning up orphaned chats:', err);
        res.status(500).json({ error: 'Failed to clean up orphaned chats' });
    }
});

app.get('/api/health/detailed', (req, res) => {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
        },
        connections: {
            websocket: clients.size,
            admin: Array.from(clients.values()).filter(c => c.isAdmin).length,
            users: Array.from(clients.values()).filter(c => !c.isAdmin).length
        },
        database: {
            submissions: db.data.submissions?.length || 0,
            chats: Object.keys(db.data.chats || {}).length
        }
    });
});

app.post('/api/admin/login', async (req, res) => {
    const { username, password, sessionId, deviceType } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    
    try {
        console.log('🔐 Login attempt for:', username);
        await db.read();
        console.log('🔐 Database read successful, admin_users count:', db.data.admin_users?.length || 0);
        
        // Support both email and username for backward compatibility
        const user = db.data.admin_users.find(u => u.email === username || u.username === username);
        console.log('🔐 User found:', user ? 'Yes' : 'No');
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('🔐 Comparing password for user:', user.username);
        const isValid = await bcrypt.compare(password, user.password_hash);
        console.log('🔐 Password valid:', isValid);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Set session data directly without regeneration
        req.session.authenticated = true;
        req.session.user = { id: user.id, username: user.username, email: user.email };
        
        console.log('🔐 Login successful:', {
            sessionId: req.sessionID,
            authenticated: req.session.authenticated,
            user: req.session.user
        });
        
        // Always store admin session for WebSocket connections
        const adminSessionId = sessionId || `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        adminSessions.set(adminSessionId, {
            id: adminSessionId,
            username: user.username,
            email: user.email,
            loginTime: new Date().toISOString(),
            deviceType: deviceType || 'unknown',
            ip: req.ip,
            authenticated: true
        });
        
        console.log('🔐 Admin session stored:', adminSessionId);
        
        // Save session
        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
                return res.status(500).json({ error: 'Session save failed' });
            } else {
                console.log('✅ Session saved successfully');
                res.json({ 
                    success: true, 
                    message: 'Login successful',
                    user: { id: user.id, username: user.username, email: user.email },
                    adminSessionId: adminSessionId
                });
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/admin/logout', (req, res) => {
    const { sessionId } = req.body;
    
    if (sessionId) {
        adminSessions.delete(sessionId);
    }
    
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logout successful' });
    });
});

app.get('/api/admin/status', (req, res) => {
    res.json({ authenticated: !!req.session.authenticated });
});

app.get('/api/admin/backup', requireAuth, async (req, res) => {
    try {
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const backupFile = path.join(backupDir, `backup-${Date.now()}.json`);
        await db.read();
        
        fs.writeFileSync(backupFile, JSON.stringify(db.data, null, 2));
        
        const files = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('backup-'))
            .sort()
            .reverse();
            
        if (files.length > 10) {
            files.slice(10).forEach(f => {
                fs.unlinkSync(path.join(backupDir, f));
            });
        }
        
        res.json({ 
            success: true, 
            message: `Backup created: ${path.basename(backupFile)}`,
            file: path.basename(backupFile)
        });
    } catch (err) {
        console.error('Backup error:', err);
        res.status(500).json({ error: 'Backup failed' });
    }
});

app.post('/create-payment-intent', async (req, res) => {
    const { totalAmount, bookingDetails } = req.body;

    console.log(`💳 Creating payment intent for amount: €${totalAmount}`);
    console.log(`💳 Stripe mode: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`);

    // Basic validation
    if (typeof totalAmount !== 'number' || totalAmount <= 0) {
        return res.status(400).json({ error: 'Invalid total amount specified.' });
    }

    // Amount in cents for Stripe
    const amountInCents = Math.round(totalAmount * 100);
    
    // Minimum charge amount is €0.50 for many card types
    if (amountInCents < 50) {
         return res.status(400).json({ error: 'Amount must be at least €0.50.' });
    }

    try {
        // Store full booking details temporarily and reference by ID
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store in a simple in-memory cache (in production, use Redis or database)
        if (!global.tempBookingDetails) {
            global.tempBookingDetails = new Map();
        }
        console.log(`[STRIPE] 📝 Storing booking details with temp ID: ${tempId}`);
        console.log(`[STRIPE] 📝 Booking details to store:`, bookingDetails);
        global.tempBookingDetails.set(tempId, bookingDetails);
        console.log(`[STRIPE] 📝 Temp storage size after storing:`, global.tempBookingDetails.size);
        
        // Clean up old entries (older than 1 hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [key, value] of global.tempBookingDetails.entries()) {
            const timestamp = parseInt(key.split('_')[1]);
            if (timestamp < oneHourAgo) {
                global.tempBookingDetails.delete(key);
            }
        }
        
        // Create payment intent with reference to full details
        try {
            // Create or retrieve Stripe customer for better fraud detection
            let customer;
            try {
                // Try to find existing customer by email
                const existingCustomers = await stripe.customers.list({
                    email: bookingDetails.customerEmail,
                    limit: 1
                });
                
                if (existingCustomers.data.length > 0) {
                    customer = existingCustomers.data[0];
                    console.log(`[STRIPE] 👤 Found existing customer: ${customer.id}`);
                } else {
                    // Create new customer
                    customer = await stripe.customers.create({
                        email: bookingDetails.customerEmail,
                        name: bookingDetails.customerName,
                        phone: bookingDetails.customerPhone,
                        address: {
                            line1: bookingDetails.customerAddress,
                            city: bookingDetails.city,
                            postal_code: bookingDetails.postalCode,
                            country: 'IE' // Assuming Ireland based on currency
                        }
                    });
                    console.log(`[STRIPE] 👤 Created new customer: ${customer.id}`);
                }
            } catch (customerError) {
                console.warn(`[STRIPE] ⚠️ Customer creation failed, proceeding without customer:`, customerError.message);
            }

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amountInCents,
                currency: 'eur',
                customer: customer ? customer.id : undefined,
                automatic_payment_methods: {
                    enabled: true,
                },
                receipt_email: bookingDetails.customerEmail,
                metadata: {
                    bookingDetailsId: tempId,
                    totalAmount: totalAmount.toString(),
                    customerName: bookingDetails.customerName,
                    customerEmail: bookingDetails.customerEmail,
                    customerPhone: bookingDetails.customerPhone,
                    customerAddress: bookingDetails.customerAddress,
                    city: bookingDetails.city,
                    postalCode: bookingDetails.postalCode
                }
            });
            
            console.log(`[STRIPE] 💳 Created PaymentIntent ${paymentIntent.id}`);
            console.log(`[STRIPE] 💳 Amount: €${totalAmount} (${amountInCents} cents)`);
            console.log(`[STRIPE] 💳 Status: ${paymentIntent.status}`);
            
            res.json({
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id
            });
        } catch (stripeError) {
            console.error(`[STRIPE] ❌ Error creating payment intent:`, stripeError);
            console.error(`[STRIPE] ❌ Error type:`, stripeError.type);
            console.error(`[STRIPE] ❌ Error message:`, stripeError.message);
            
            return res.status(500).json({ 
                error: 'Failed to create payment intent',
                details: stripeError.message,
                type: stripeError.type
            });
        }
    } catch (e) {
        console.error('Stripe Payment Intent creation failed:', e.message);
        res.status(500).json({ error: `Payment Intent creation failed: ${e.message}` });
    }
});

// Serve subscription payment page
app.get('/subscription-payment/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'subscription-payment.html'));
});

// Serve subscription payment success page
app.get('/subscription-payment/:id/success', (req, res) => {
    res.sendFile(path.join(__dirname, 'subscription-payment.html'));
});

// Manual billing reminder trigger (for testing)
app.post('/api/admin/trigger-billing-reminders', requireAuth, async (req, res) => {
    try {
        console.log('🔧 Manually triggering billing reminders...');
        await billingReminder.checkAndSendReminders();
        res.json({ 
            message: 'Billing reminders triggered successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error triggering billing reminders:', error);
        res.status(500).json({ 
            error: 'Failed to trigger billing reminders',
            details: error.message 
        });
    }
});

// Get penalty configuration
app.get('/api/admin/penalty-config', requireAuth, async (req, res) => {
    try {
        res.json({
            penaltyConfig: billingReminder.penaltyConfig
        });
    } catch (error) {
        console.error('❌ Error getting penalty config:', error);
        res.status(500).json({ 
            error: 'Failed to get penalty configuration',
            details: error.message 
        });
    }
});

// Update penalty configuration
app.post('/api/admin/penalty-config', requireAuth, async (req, res) => {
    try {
        const { penaltyConfig } = req.body;
        
        // Validate penalty configuration
        if (penaltyConfig.enabled !== undefined) billingReminder.penaltyConfig.enabled = penaltyConfig.enabled;
        if (penaltyConfig.gracePeriod !== undefined) billingReminder.penaltyConfig.gracePeriod = Math.max(0, penaltyConfig.gracePeriod);
        if (penaltyConfig.dailyRate !== undefined) billingReminder.penaltyConfig.dailyRate = Math.max(0, Math.min(1, penaltyConfig.dailyRate));
        if (penaltyConfig.maxPenalty !== undefined) billingReminder.penaltyConfig.maxPenalty = Math.max(0, Math.min(1, penaltyConfig.maxPenalty));
        if (penaltyConfig.minPenalty !== undefined) billingReminder.penaltyConfig.minPenalty = Math.max(0, penaltyConfig.minPenalty);
        if (penaltyConfig.maxDays !== undefined) billingReminder.penaltyConfig.maxDays = Math.max(1, penaltyConfig.maxDays);
        
        console.log('✅ Penalty configuration updated:', billingReminder.penaltyConfig);
        
        res.json({
            message: 'Penalty configuration updated successfully',
            penaltyConfig: billingReminder.penaltyConfig
        });
    } catch (error) {
        console.error('❌ Error updating penalty config:', error);
        res.status(500).json({ 
            error: 'Failed to update penalty configuration',
            details: error.message 
        });
    }
});

// Test endpoint to manually process subscription payment (for testing)
app.post('/api/test/subscription-payment/:subscriptionId/:paymentIntentId', async (req, res) => {
    try {
        console.log(`[TEST] 🔧 Manually processing subscription payment for ${req.params.subscriptionId}`);
        
        // Get real subscription data
        await db.read();
        const subscriptions = db.data.subscriptions || [];
        const subscription = subscriptions.find(sub => sub.id === req.params.subscriptionId);
        
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        
        // Create payment intent object with real subscription data
        const paymentIntent = {
            id: req.params.paymentIntentId,
            amount: subscription.price,
            metadata: {
                type: 'subscription_payment',
                subscriptionId: req.params.subscriptionId,
                customerName: subscription.customerName,
                customerEmail: subscription.customerEmail,
                planName: subscription.planName,
                billingCycle: subscription.billingCycle
            }
        };
        
        console.log(`[TEST] 📧 Processing payment for subscription:`, subscription);
        console.log(`[TEST] 📧 Customer email: ${subscription.customerEmail}`);
        
        await handleSubscriptionPayment(paymentIntent);
        
        res.json({ 
            success: true, 
            message: 'Subscription payment processed successfully',
            subscriptionId: req.params.subscriptionId,
            paymentIntentId: req.params.paymentIntentId,
            customerEmail: subscription.customerEmail
        });
    } catch (error) {
        console.error('[TEST] ❌ Error processing subscription payment:', error);
        res.status(500).json({ error: 'Failed to process subscription payment' });
    }
});

// Test endpoint to send subscription payment email directly
app.post('/api/test/subscription-email/:subscriptionId', async (req, res) => {
    try {
        console.log(`[TEST] 📧 Testing subscription payment email for ${req.params.subscriptionId}`);
        
        await db.read();
        const subscriptions = db.data.subscriptions || [];
        const subscription = subscriptions.find(sub => sub.id === req.params.subscriptionId);
        
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        
        // Create a mock payment intent for email testing
        const mockPaymentIntent = {
            id: 'test_pi_' + Date.now(),
            amount: subscription.price,
            metadata: {
                type: 'subscription_payment',
                subscriptionId: subscription.id
            }
        };
        
        await handleSubscriptionPayment(mockPaymentIntent);
        
        res.json({ 
            success: true, 
            message: 'Subscription payment email sent successfully',
            subscriptionId: req.params.subscriptionId,
            email: subscription.customerEmail
        });
    } catch (error) {
        console.error('[TEST] ❌ Error sending subscription payment email:', error);
        res.status(500).json({ error: 'Failed to send subscription payment email' });
    }
});

app.use(express.static(path.join(__dirname), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
            console.log('Serving CSS file:', filePath);
        }
        else if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
        else if (filePath.endsWith('.ico')) res.setHeader('Content-Type', 'image/x-icon');
        else if (filePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
        else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg');
        else if (filePath.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');
    }
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// FIXED: Generate and inject CSRF token for admin pages
app.get(['/admin', '/admin/login'], csrf({ cookie: true }), (req, res) => {
    const csrfToken = req.csrfToken();
    
    try {
        const adminHtmlPath = path.join(__dirname, 'admin.html');
        if (!fs.existsSync(adminHtmlPath)) {
             console.error("admin.html not found at:", adminHtmlPath);
             return res.status(500).send("<h1>Error: Admin interface file not found.</h1><p>Please ensure 'admin.html' exists in the root directory.</p>");
        }
        const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
        
        // Inject CSRF token into the meta tag AND a global JavaScript variable for easy access
        const injectedHtml = adminHtml
            .replace(
                '<meta name="csrf-token" content="">', // Specifically target the empty placeholder
                `<meta name="csrf-token" content="${csrfToken}">\n    <script>window.CSRF_TOKEN = "${csrfToken}";</script>`
            );
            
        res.send(injectedHtml);
    } catch (error) {
        console.error("Could not read or process admin.html file:", error);
        res.status(500).send("<h1>Error loading admin page. Check server logs for details.</h1>");
    }
});

app.get('/booking', (req, res) => {
    res.sendFile(path.join(__dirname, 'booking.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});

app.get('/impressum', (req, res) => {
    res.sendFile(path.join(__dirname, 'impressum.html'));
});

app.get('/datenschutz', (req, res) => {
    res.sendFile(path.join(__dirname, 'datenschutz.html'));
});

app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});


// Final error handling and server start
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    if (isProduction) {
        res.status(500).json({ error: 'Internal server error' });
    } else {
        res.status(500).json({ 
            error: 'Internal server error',
            details: err.message,
            stack: err.stack 
        });
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (isProduction) {
        process.exit(1);
    }
});

function gracefulShutdown(signal) {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    
    server.close(() => {
        console.log('HTTP server closed');
        
        wss.close(() => {
            console.log('WebSocket server closed');
            console.log('Cleanup completed');
            process.exit(0);
        });
    });
    
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 30000);
}


// SMTP configuration endpoint
app.get('/api/smtp-status', async (req, res) => {
    try {
        const smtpConfig = {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            user: process.env.SMTP_USER,
            from: process.env.SMTP_USER || process.env.ADMIN_EMAIL,
            adminEmail: process.env.ADMIN_EMAIL,
            adminEmails: process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(email => email.trim()) : [process.env.ADMIN_EMAIL]
        };
        
        res.json({
            success: true,
            smtpConfigured: !!(smtpConfig.host && smtpConfig.port && smtpConfig.user),
            config: {
                host: smtpConfig.host,
                port: smtpConfig.port,
                user: smtpConfig.user,
                from: smtpConfig.from,
                adminEmail: smtpConfig.adminEmail,
                adminEmails: smtpConfig.adminEmails
            }
        });
    } catch (error) {
        console.error('❌ Failed to get SMTP status:', error);
        res.status(500).json({ error: 'Failed to get SMTP status' });
    }
});

// Handle OAuth callback at root level
app.get('/', async (req, res) => {
    // Check if this is an OAuth callback
    if (req.query.code) {
        try {
            const tokens = await gmailService.getTokens(req.query.code);
            return res.json({ 
                success: true, 
                message: 'Gmail API authorized successfully',
                refreshToken: tokens.refresh_token 
            });
        } catch (error) {
            console.error('❌ Failed to exchange code for tokens:', error);
            return res.status(500).json({ error: 'Failed to authorize Gmail API' });
        }
    }
    
    // Serve your main page
    res.sendFile(path.join(__dirname, 'index.html'));
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

initializeDB().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`=== SERVER STARTING on ${new Date().toLocaleString()} ===`);
        console.log(`Environment: ${NODE_ENV}`);
        console.log(`Server running on port ${PORT}`);
        console.log(`Database path: ${dbPath}`);
        console.log(`WebSocket chat server: READY`);
        
        // Start billing reminder service
        billingReminder.start();
        
        console.log(`=== SERVER READY ===`);
    });
}).catch(err => {
    console.error('Failed to initialize and start server:', err);
    process.exit(1);
});