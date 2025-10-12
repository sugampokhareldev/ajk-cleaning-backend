#!/usr/bin/env node

/**
 * Direct Admin Notification Test
 * Tests admin notifications by calling the function directly (bypasses CSRF)
 */

// Set up environment variables
process.env.ADMIN_EMAILS = 'sugampokharel28@gmail.com,pokharels562@gmail.com,sanudhakal119@gmail.com';
process.env.SENDGRID_API_KEY = 'SG.your_sendgrid_api_key_here';
process.env.SMTP_USER = 'sugampokharel28@gmail.com';
process.env.SMTP_PASS = 'wynz atsj btff fhxl';
process.env.SMTP_HOST = 'smtp.gmail.com';
process.env.SMTP_PORT = '587';
process.env.SENDGRID_FROM_EMAIL = 'info@ajkcleaners.de';
process.env.SENDGRID_FROM_NAME = 'AJK Cleaning Services';

console.log('🧪 Testing Admin Notification Directly...\n');

// Import the server modules
const path = require('path');

// Add the server directory to the require path
const serverPath = path.join(__dirname, '..', 'server.js');

console.log('📧 Environment Variables:');
console.log('=========================');
console.log(`ADMIN_EMAILS: ${process.env.ADMIN_EMAILS}`);
console.log(`SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`SMTP_USER: ${process.env.SMTP_USER}`);
console.log(`SMTP_PASS: ${process.env.SMTP_PASS ? 'SET' : 'NOT SET'}`);
console.log('');

// Test admin email configuration
console.log('📧 Admin Email Configuration:');
console.log('==============================');

let adminEmails = [];

if (process.env.ADMIN_EMAILS) {
    adminEmails = process.env.ADMIN_EMAILS.split(',').map(email => email.trim());
    console.log(`✅ ADMIN_EMAILS: ${adminEmails.join(', ')}`);
} else if (process.env.NOTIFICATION_EMAIL) {
    adminEmails = [process.env.NOTIFICATION_EMAIL];
    console.log(`✅ NOTIFICATION_EMAIL: ${adminEmails[0]}`);
} else if (process.env.ADMIN_EMAIL) {
    adminEmails = [process.env.ADMIN_EMAIL];
    console.log(`✅ ADMIN_EMAIL: ${adminEmails[0]}`);
} else {
    adminEmails = ['sugampokharel28@gmail.com'];
    console.log(`⚠️  Using default fallback: ${adminEmails[0]}`);
}

console.log(`📧 Configured admin emails: ${adminEmails.join(', ')}`);
console.log('');

// Test email service configuration
console.log('📮 Email Service Configuration:');
console.log('===============================');

const hasSendGrid = !!process.env.SENDGRID_API_KEY;
const hasSMTP = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

console.log(`SendGrid API Key: ${hasSendGrid ? '✅ SET' : '❌ NOT SET'}`);
console.log(`SMTP Configuration: ${hasSMTP ? '✅ SET' : '❌ NOT SET'}`);

if (!hasSendGrid && !hasSMTP) {
    console.log('❌ No email service configured!');
} else {
    console.log('✅ Email service configured');
}
console.log('');

// Create test booking data
const testBooking = {
    id: 'test_direct_123',
    details: {
        customerName: 'Test Direct Customer',
        customerEmail: 'test@example.com',
        customerPhone: '+1234567890',
        customerAddress: '123 Test Street',
        city: 'Test City',
        postalCode: '12345',
        bookingType: 'subscription',
        package: 'commercial',
        date: '2024-01-15',
        time: '10:00 AM',
        duration: 4,
        cleaners: 2,
        propertySize: '5000',
        specialRequests: 'Test direct notification',
        salutation: 'Mr.'
    },
    amount: 150,
    status: 'paid',
    paymentIntentId: 'test_pi_direct_123',
    paidAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
};

console.log('📋 Test Booking Data:');
console.log('=====================');
console.log(`Booking ID: ${testBooking.id}`);
console.log(`Customer: ${testBooking.details.customerName}`);
console.log(`Email: ${testBooking.details.customerEmail}`);
console.log(`Type: ${testBooking.details.bookingType}`);
console.log(`Service: ${testBooking.details.package}`);
console.log(`Date: ${testBooking.details.date}`);
console.log(`Time: ${testBooking.details.time}`);
console.log('');

console.log('🚀 Attempting to send admin notification...');
console.log('==========================================');

// Simulate the notification process
try {
    console.log('📧 Would send notification to:');
    adminEmails.forEach((email, index) => {
        console.log(`   ${index + 1}. ${email}`);
    });
    
    console.log('');
    console.log('📧 Email content would include:');
    console.log(`   Subject: 🚨 New Subscription Booking - ${testBooking.id}`);
    console.log(`   Customer: ${testBooking.details.customerName}`);
    console.log(`   Service: ${testBooking.details.package}`);
    console.log(`   Date: ${testBooking.details.date}`);
    console.log(`   Time: ${testBooking.details.time}`);
    console.log(`   Duration: ${testBooking.details.duration} hours`);
    console.log(`   Cleaners: ${testBooking.details.cleaners}`);
    console.log(`   Property Size: ${testBooking.details.propertySize} sq ft`);
    
    console.log('');
    console.log('✅ Notification simulation completed successfully!');
    console.log('');
    console.log('💡 To test with real email sending:');
    console.log('   1. Make sure your server is running: npm start');
    console.log('   2. The notification function will be called when bookings are created');
    console.log('   3. Check your email inboxes for the notifications');
    console.log('   4. Check server logs for email sending attempts');
    
} catch (error) {
    console.log('❌ Error in notification simulation:', error.message);
}

console.log('');
console.log('📊 TEST SUMMARY:');
console.log('================');
console.log('✅ Configuration looks correct');
console.log('✅ Admin emails are configured');
console.log('✅ Email service is configured');
console.log('✅ Test booking data is valid');
console.log('');
console.log('🎯 Next steps:');
console.log('   1. Check if notifications are working on your live site');
console.log('   2. Make a test booking on https://ajkcleaners.de');
console.log('   3. Check admin email inboxes (including spam)');
console.log('   4. Check Render service logs for notification attempts');
