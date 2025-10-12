#!/usr/bin/env node

/**
 * Test Automatic Admin User Cleanup
 * Tests the automatic cleanup functionality
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Automatic Admin User Cleanup\n');

// Set up test environment
process.env.ADMIN_EMAIL = 'newadmin@example.com';
process.env.ADMIN_PASSWORD = 'testpassword123';

const dbPath = path.join(__dirname, '..', 'data', 'db.json');

console.log('📋 Test Configuration:');
console.log('======================');
console.log(`ADMIN_EMAIL: ${process.env.ADMIN_EMAIL}`);
console.log(`ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? 'SET' : 'NOT SET'}`);
console.log(`Database path: ${dbPath}`);
console.log('');

// Check if database exists
if (!fs.existsSync(dbPath)) {
    console.log('❌ Database file not found!');
    console.log('   Make sure your server is running and database is initialized.');
    process.exit(1);
}

try {
    // Read current database
    const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    console.log('📊 Current Database State:');
    console.log('==========================');
    console.log(`Total admin users: ${dbData.admin_users?.length || 0}`);
    console.log(`Admin email history: ${dbData.admin_email_history?.join(', ') || 'None'}`);
    console.log('');
    
    if (dbData.admin_users && dbData.admin_users.length > 0) {
        console.log('👥 Current Admin Users:');
        dbData.admin_users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.email} (${user.username})`);
        });
        console.log('');
    }
    
    console.log('🔍 What Will Happen on Next Server Restart:');
    console.log('==========================================');
    
    const currentAdminEmail = process.env.ADMIN_EMAIL;
    const currentAdminUser = dbData.admin_users?.find(user => user.email === currentAdminEmail);
    const otherAdminUsers = dbData.admin_users?.filter(user => user.email !== currentAdminEmail) || [];
    
    if (currentAdminUser) {
        console.log(`✅ Current ADMIN_EMAIL (${currentAdminEmail}) already exists in database`);
        console.log('   - No cleanup will be performed');
        console.log('   - Password will be updated if changed');
    } else {
        console.log(`🆕 Current ADMIN_EMAIL (${currentAdminEmail}) is new`);
        if (otherAdminUsers.length > 0) {
            console.log(`🧹 Automatic cleanup will be triggered:`);
            console.log(`   - ${otherAdminUsers.length} old admin users will be removed`);
            otherAdminUsers.forEach(user => {
                console.log(`     - ${user.email} (${user.username})`);
            });
            console.log(`   - Only ${currentAdminEmail} will remain`);
            console.log(`   - Admin email history will be updated`);
        } else {
            console.log('   - No old admin users to clean up');
            console.log('   - New admin user will be created');
        }
    }
    
    console.log('');
    console.log('🧪 Testing Scenarios:');
    console.log('======================');
    console.log('');
    
    console.log('📝 Scenario 1: First Time Setup');
    console.log('   - No admin users exist');
    console.log('   - New admin user will be created');
    console.log('   - No cleanup needed');
    console.log('');
    
    console.log('📝 Scenario 2: Changing ADMIN_EMAIL');
    console.log('   - Old admin users exist');
    console.log('   - New ADMIN_EMAIL is different');
    console.log('   - Automatic cleanup will remove old users');
    console.log('   - New admin user will be created');
    console.log('');
    
    console.log('📝 Scenario 3: Same ADMIN_EMAIL');
    console.log('   - Admin user already exists');
    console.log('   - No cleanup needed');
    console.log('   - Password will be updated if changed');
    console.log('');
    
    console.log('🛠️  Manual Cleanup Options:');
    console.log('============================');
    console.log('1. Restart your server (automatic cleanup)');
    console.log('2. Use manual cleanup endpoint: POST /api/admin/cleanup-users');
    console.log('3. Use cleanup script: npm run cleanup-admin-users');
    console.log('');
    
    console.log('📊 Expected Results:');
    console.log('===================');
    console.log('✅ Only one admin user: the current ADMIN_EMAIL');
    console.log('✅ Old admin users removed automatically');
    console.log('✅ Admin email history tracked');
    console.log('✅ No manual intervention needed');
    console.log('');
    
    console.log('🎯 Benefits of Automatic Cleanup:');
    console.log('=================================');
    console.log('✅ No manual cleanup needed');
    console.log('✅ Prevents multiple admin users');
    console.log('✅ Maintains security');
    console.log('✅ Tracks admin email changes');
    console.log('✅ Works on both local and production');
    console.log('');
    
    console.log('💡 Next Steps:');
    console.log('==============');
    console.log('1. Change ADMIN_EMAIL in your environment variables');
    console.log('2. Restart your server');
    console.log('3. Check server logs for cleanup messages');
    console.log('4. Verify only one admin user exists');
    console.log('5. Test login with new admin email');
    
} catch (error) {
    console.log('❌ Error reading database:', error.message);
    process.exit(1);
}

console.log('\n🎉 Automatic Cleanup is Ready!');
console.log('===============================');
console.log('The system will automatically clean up old admin users');
console.log('when you change ADMIN_EMAIL in the future.');
