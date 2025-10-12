#!/usr/bin/env node

/**
 * Deployment Validation Script
 * Validates that the application is configured correctly for deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating deployment configuration...\n');

// Check if we're in a production environment
const isProduction = process.env.NODE_ENV === 'production';
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Check database path configuration
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'db.json');
console.log(`Database path: ${dbPath}`);

// Check if database path conflicts with existing directory
if (fs.existsSync(dbPath) && fs.statSync(dbPath).isDirectory()) {
    console.error('❌ ERROR: Database path is a directory, not a file!');
    console.error('   This will cause the EISDIR error on deployment.');
    console.error('   Please set DB_PATH to a file path, not a directory path.');
    process.exit(1);
}

// Check required environment variables
const requiredEnvVars = [
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
        console.error(`   - ${varName}`);
    });
    process.exit(1);
}

// Check if database directory can be created
const dbDir = path.dirname(dbPath);
try {
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`✅ Created database directory: ${dbDir}`);
    } else {
        console.log(`✅ Database directory exists: ${dbDir}`);
    }
} catch (error) {
    console.error('❌ Cannot create database directory:', error.message);
    process.exit(1);
}

console.log('\n✅ Deployment validation passed!');
console.log('   Your application should deploy successfully on Render.');