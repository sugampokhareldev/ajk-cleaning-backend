#!/usr/bin/env node

/**
 * Persistent Disk Setup Script
 * Helps configure the persistent disk for Render deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up persistent disk configuration...\n');

// Check if we're in production
const isProduction = process.env.NODE_ENV === 'production';
const dbPath = process.env.DB_PATH || (isProduction ? '/var/data/ajk-cleaning/db.json' : path.join(__dirname, '..', 'data', 'db.json'));

console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Database path: ${dbPath}`);

// Check if the path is on a persistent disk
if (isProduction && !dbPath.startsWith('/var/data')) {
    console.warn('⚠️  WARNING: You are in production but not using a persistent disk path!');
    console.warn('   Your data will be lost on deployment/restart.');
    console.warn('   Recommended path: /var/data/ajk-cleaning/db.json');
}

// Try to create the directory
const dbDir = path.dirname(dbPath);
try {
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`✅ Created database directory: ${dbDir}`);
    } else {
        console.log(`✅ Database directory exists: ${dbDir}`);
    }
    
    // Test write permissions
    const testFile = path.join(dbDir, '.test-write');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('✅ Write permissions confirmed');
    
} catch (error) {
    console.error('❌ Error setting up database directory:');
    console.error(`   ${error.message}`);
    
    if (isProduction && dbPath.startsWith('/var/data')) {
        console.error('\n💡 Troubleshooting tips:');
        console.error('   1. Make sure you have added a persistent disk in Render');
        console.error('   2. Set the mount path to /var/data');
        console.error('   3. Ensure the disk has enough space');
        console.error('   4. Check that the disk is properly mounted');
    }
    
    process.exit(1);
}

console.log('\n✅ Persistent disk setup completed successfully!');
console.log('   Your data will persist across deployments and restarts.');
