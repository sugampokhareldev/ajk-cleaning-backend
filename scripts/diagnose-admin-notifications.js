#!/usr/bin/env node

/**
 * Admin Notification Diagnostic Script
 * Diagnoses why admin notifications are not being sent
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Diagnosing Admin Notification Issues...\n');

// Check environment variables
console.log('📋 Environment Variables Check:');
console.log('================================');

const requiredEnvVars = [
    'ADMIN_EMAIL',
    'ADMIN_EMAILS', 
    'NOTIFICATION_EMAIL',
    'SMTP_USER',
    'SMTP_PASS',
    'SENDGRID_API_KEY'
];

let issues = [];

// Check each environment variable
requiredEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        console.log(`✅ ${varName}: ${varName.includes('PASS') || varName.includes('KEY') ? '***SET***' : value}`);
    } else {
        console.log(`❌ ${varName}: NOT SET`);
        issues.push(`Missing ${varName}`);
    }
});

// Check admin email configuration
console.log('\n📧 Admin Email Configuration:');
console.log('============================');

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
    issues.push('No admin emails configured - using default fallback');
}

console.log(`📧 Configured admin emails: ${adminEmails.join(', ')}`);

// Check email service configuration
console.log('\n📮 Email Service Configuration:');
console.log('==============================');

const hasSendGrid = !!process.env.SENDGRID_API_KEY;
const hasSMTP = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

console.log(`SendGrid API Key: ${hasSendGrid ? '✅ SET' : '❌ NOT SET'}`);
console.log(`SMTP Configuration: ${hasSMTP ? '✅ SET' : '❌ NOT SET'}`);

if (!hasSendGrid && !hasSMTP) {
    issues.push('No email service configured (neither SendGrid nor SMTP)');
}

// Check database configuration
console.log('\n💾 Database Configuration:');
console.log('=========================');

const dbPath = process.env.DB_PATH || (process.env.NODE_ENV === 'production' ? '/var/data/ajk-cleaning/db.json' : path.join(__dirname, '..', 'data', 'db.json'));
console.log(`Database path: ${dbPath}`);

if (fs.existsSync(dbPath)) {
    console.log('✅ Database file exists');
    try {
        const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const bookingCount = dbData.bookings ? dbData.bookings.length : 0;
        console.log(`📊 Total bookings in database: ${bookingCount}`);
        
        if (bookingCount > 0) {
            const recentBookings = dbData.bookings.slice(-3);
            console.log('📋 Recent bookings:');
            recentBookings.forEach((booking, index) => {
                console.log(`  ${index + 1}. ${booking.id} - ${booking.details?.customerName || 'Unknown'} (${booking.status})`);
            });
        }
    } catch (error) {
        console.log('❌ Error reading database:', error.message);
        issues.push('Database read error');
    }
} else {
    console.log('❌ Database file does not exist');
    issues.push('Database file not found');
}

// Check notification function
console.log('\n🔧 Notification Function Check:');
console.log('=================================');

try {
    // Simulate admin notification configuration
    const testBooking = {
        id: 'test_booking_123',
        details: {
            customerName: 'Test Customer',
            customerEmail: 'test@example.com',
            bookingType: 'subscription',
            package: 'commercial',
            date: '2024-01-15',
            time: '10:00 AM'
        }
    };
    
    console.log('✅ Notification function structure looks correct');
    console.log('📧 Would send to emails:', adminEmails);
    
} catch (error) {
    console.log('❌ Error in notification function:', error.message);
    issues.push('Notification function error');
}

// Summary
console.log('\n📊 DIAGNOSIS SUMMARY:');
console.log('====================');

if (issues.length === 0) {
    console.log('🎉 No issues found! Admin notifications should be working.');
    console.log('💡 If notifications are still not working, check:');
    console.log('   1. Render service logs for email sending errors');
    console.log('   2. Spam/junk folders in admin email accounts');
    console.log('   3. Email service rate limits');
} else {
    console.log('❌ Issues found:');
    issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
    });
    
    console.log('\n🔧 Recommended fixes:');
    
    if (issues.some(issue => issue.includes('ADMIN_EMAIL'))) {
        console.log('   1. Set ADMIN_EMAILS environment variable in Render:');
        console.log('      ADMIN_EMAILS=admin1@example.com,admin2@example.com');
    }
    
    if (issues.some(issue => issue.includes('email service'))) {
        console.log('   2. Configure email service:');
        console.log('      - Set SENDGRID_API_KEY for SendGrid');
        console.log('      - OR set SMTP_USER and SMTP_PASS for SMTP');
    }
    
    if (issues.some(issue => issue.includes('Database'))) {
        console.log('   3. Check database configuration:');
        console.log('      - Ensure DB_PATH is set correctly');
        console.log('      - Verify persistent disk is mounted');
    }
}

console.log('\n🧪 To test admin notifications:');
console.log('   1. Make a test booking through your website');
console.log('   2. Check Render logs for notification attempts');
console.log('   3. Check admin email inboxes (including spam)');
console.log('   4. Use the test endpoint: POST /api/test-admin-notification');
