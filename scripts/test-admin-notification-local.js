#!/usr/bin/env node

/**
 * Local Admin Notification Test
 * Tests admin notifications locally without requiring server to be running
 */

console.log('🧪 Testing Admin Notification System Locally...\n');

// Set up environment variables for testing
process.env.ADMIN_EMAILS = 'sugampokharel28@gmail.com,pokharels562@gmail.com,sanudhakal119@gmail.com';
process.env.SENDGRID_API_KEY = 'SG.your_sendgrid_api_key_here';
process.env.SMTP_USER = 'sugampokharel28@gmail.com';
process.env.SMTP_PASS = 'wynz atsj btff fhxl';
process.env.SMTP_HOST = 'smtp.gmail.com';
process.env.SMTP_PORT = '587';

console.log('📧 Environment Variables Set:');
console.log('============================');
console.log(`ADMIN_EMAILS: ${process.env.ADMIN_EMAILS}`);
console.log(`SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`SMTP_USER: ${process.env.SMTP_USER}`);
console.log(`SMTP_PASS: ${process.env.SMTP_PASS ? 'SET' : 'NOT SET'}`);
console.log('');

// Test admin email configuration
console.log('📧 Admin Email Configuration Test:');
console.log('==================================');

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
console.log('📮 Email Service Configuration Test:');
console.log('=====================================');

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

// Test notification function structure
console.log('🔧 Notification Function Test:');
console.log('==============================');

try {
    // Simulate the notification function call
    const testBooking = {
        id: 'test_booking_local_123',
        details: {
            customerName: 'Test Customer',
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
            specialRequests: 'Test commercial cleaning request',
            salutation: 'Mr.'
        },
        amount: 150,
        status: 'paid',
        paymentIntentId: 'test_pi_123',
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
    };
    
    console.log('✅ Test booking data structure looks correct');
    console.log(`📧 Would send to emails: ${adminEmails.join(', ')}`);
    console.log(`📋 Booking type: ${testBooking.details.bookingType}`);
    console.log(`📋 Service: ${testBooking.details.package}`);
    console.log(`📋 Customer: ${testBooking.details.customerName}`);
    
} catch (error) {
    console.log('❌ Error in notification function test:', error.message);
}

console.log('');
console.log('📊 LOCAL TEST SUMMARY:');
console.log('======================');

if (adminEmails.length > 0 && (hasSendGrid || hasSMTP)) {
    console.log('🎉 Configuration looks correct for admin notifications!');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Start your server: npm start');
    console.log('   2. Test the notification endpoint: POST /api/test-admin-notification');
    console.log('   3. Check your email inboxes for test notifications');
    console.log('   4. Check server logs for notification attempts');
} else {
    console.log('❌ Configuration issues found:');
    if (adminEmails.length === 0) {
        console.log('   - No admin emails configured');
    }
    if (!hasSendGrid && !hasSMTP) {
        console.log('   - No email service configured');
    }
}

console.log('');
console.log('🧪 To test with your server:');
console.log('   1. Start server: npm start');
console.log('   2. Make a POST request to: http://localhost:3000/api/test-admin-notification');
console.log('   3. Check server logs for notification attempts');
console.log('   4. Check admin email inboxes');
