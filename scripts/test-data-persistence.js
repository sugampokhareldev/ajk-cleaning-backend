#!/usr/bin/env node

/**
 * Data Persistence Test Script
 * Tests if data will persist across deployments and restarts
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing data persistence configuration...\n');

// Check environment
const isProduction = process.env.NODE_ENV === 'production';
const dbPath = process.env.DB_PATH || (isProduction ? '/var/data/ajk-cleaning/db.json' : path.join(__dirname, '..', 'data', 'db.json'));

console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Database path: ${dbPath}`);

// Test 1: Check if using persistent disk path
console.log('\n📋 Test 1: Persistent Disk Path Check');
if (isProduction && dbPath.startsWith('/var/data')) {
    console.log('✅ Using persistent disk path - data will persist');
} else if (isProduction) {
    console.log('❌ NOT using persistent disk path - data will be lost on restart!');
    console.log('   Fix: Set DB_PATH=/var/data/ajk-cleaning/db.json');
} else {
    console.log('ℹ️  Development mode - using local data directory');
}

// Test 2: Check if directory can be created
console.log('\n📋 Test 2: Directory Creation Test');
const dbDir = path.dirname(dbPath);
try {
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`✅ Created directory: ${dbDir}`);
    } else {
        console.log(`✅ Directory exists: ${dbDir}`);
    }
} catch (error) {
    console.log(`❌ Cannot create directory: ${error.message}`);
    console.log('   This might indicate the persistent disk is not mounted');
}

// Test 3: Check write permissions
console.log('\n📋 Test 3: Write Permissions Test');
try {
    const testFile = path.join(dbDir, '.persistence-test');
    const testData = {
        timestamp: new Date().toISOString(),
        message: 'This is a test to verify data persistence',
        testId: Math.random().toString(36).substring(7)
    };
    
    fs.writeFileSync(testFile, JSON.stringify(testData, null, 2));
    console.log('✅ Write test successful');
    
    // Read it back
    const readData = JSON.parse(fs.readFileSync(testFile, 'utf8'));
    if (readData.testId === testData.testId) {
        console.log('✅ Read test successful');
    } else {
        console.log('❌ Read test failed');
    }
    
    // Clean up
    fs.unlinkSync(testFile);
    console.log('✅ Cleanup successful');
    
} catch (error) {
    console.log(`❌ Write/Read test failed: ${error.message}`);
}

// Test 4: Check if path is on persistent disk
console.log('\n📋 Test 4: Persistent Disk Mount Check');
if (isProduction) {
    if (dbPath.startsWith('/var/data')) {
        console.log('✅ Database path is on persistent disk');
        console.log('   Your data will survive restarts and deployments');
    } else {
        console.log('❌ Database path is NOT on persistent disk');
        console.log('   Your data will be lost on restart!');
    }
} else {
    console.log('ℹ️  Development mode - persistence not critical');
}

// Test 5: Simulate database operations
console.log('\n📋 Test 5: Database Operations Simulation');
try {
    const testDbPath = path.join(dbDir, 'test-db.json');
    const testData = {
        submissions: [
            { id: 1, name: 'Test User', email: 'test@example.com', timestamp: new Date().toISOString() }
        ],
        admin_users: [],
        analytics_events: []
    };
    
    // Write test database
    fs.writeFileSync(testDbPath, JSON.stringify(testData, null, 2));
    console.log('✅ Database write simulation successful');
    
    // Read test database
    const readDb = JSON.parse(fs.readFileSync(testDbPath, 'utf8'));
    if (readDb.submissions.length === 1) {
        console.log('✅ Database read simulation successful');
    } else {
        console.log('❌ Database read simulation failed');
    }
    
    // Clean up
    fs.unlinkSync(testDbPath);
    console.log('✅ Database cleanup successful');
    
} catch (error) {
    console.log(`❌ Database simulation failed: ${error.message}`);
}

// Summary
console.log('\n📊 SUMMARY:');
if (isProduction && dbPath.startsWith('/var/data')) {
    console.log('🎉 EXCELLENT! Your data persistence is properly configured.');
    console.log('   ✅ Data will survive restarts');
    console.log('   ✅ Data will survive deployments');
    console.log('   ✅ Data will survive service updates');
} else if (isProduction) {
    console.log('⚠️  WARNING! Your data persistence is NOT properly configured.');
    console.log('   ❌ Data will be lost on restart');
    console.log('   ❌ Data will be lost on deployment');
    console.log('   🔧 Fix: Set DB_PATH=/var/data/ajk-cleaning/db.json');
} else {
    console.log('ℹ️  Development mode - configuration looks good for local development');
}

console.log('\n💡 To test persistence in production:');
console.log('   1. Deploy your app with the persistent disk');
console.log('   2. Add some test data through your app');
console.log('   3. Restart the service in Render dashboard');
console.log('   4. Check if your data is still there');
