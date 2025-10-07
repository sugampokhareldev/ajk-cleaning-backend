const { Pool } = require('pg');
const logger = require('./logger');

// Database configuration
const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'ajk_cleaning',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    maxUses: 7500, // Close (and replace) a connection after it has been used this many times
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err, client) => {
    logger.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Database initialization
async function initializeDatabase() {
    try {
        const client = await pool.connect();
        
        // Create tables if they don't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS submissions (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(50) NOT NULL,
                service VARCHAR(100),
                message TEXT,
                preferred_date DATE,
                preferred_time VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                client_id VARCHAR(100) NOT NULL,
                message TEXT NOT NULL,
                sender VARCHAR(50) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_read BOOLEAN DEFAULT FALSE
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS bookings (
                id SERIAL PRIMARY KEY,
                booking_id VARCHAR(100) UNIQUE NOT NULL,
                customer_name VARCHAR(255) NOT NULL,
                customer_email VARCHAR(255),
                customer_phone VARCHAR(50) NOT NULL,
                service_type VARCHAR(100) NOT NULL,
                property_size INTEGER,
                frequency VARCHAR(50),
                special_requirements TEXT,
                preferred_date DATE,
                preferred_time VARCHAR(50),
                amount DECIMAL(10,2),
                status VARCHAR(50) DEFAULT 'pending',
                payment_intent_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS performance_metrics (
                id SERIAL PRIMARY KEY,
                url VARCHAR(500) NOT NULL,
                user_agent TEXT,
                connection_type VARCHAR(50),
                lcp DECIMAL(10,2),
                fid DECIMAL(10,2),
                cls DECIMAL(10,2),
                fcp DECIMAL(10,2),
                tti DECIMAL(10,2),
                dom_content_loaded DECIMAL(10,2),
                load_complete DECIMAL(10,2),
                dom_interactive DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create indexes for better performance
        await client.query('CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_chat_messages_client_id ON chat_messages(client_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON performance_metrics(created_at)');
        
        client.release();
        logger.info('Database initialized successfully');
        
    } catch (error) {
        logger.error('Database initialization failed:', error);
        throw error;
    }
}

// Database query helper
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug('Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        logger.error('Database query error', { text, error: error.message });
        throw error;
    }
}

// Transaction helper
async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Health check
async function healthCheck() {
    try {
        const result = await query('SELECT NOW()');
        return {
            status: 'healthy',
            timestamp: result.rows[0].now,
            pool: {
                totalCount: pool.totalCount,
                idleCount: pool.idleCount,
                waitingCount: pool.waitingCount
            }
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message
        };
    }
}

// Graceful shutdown
async function closePool() {
    try {
        await pool.end();
        logger.info('Database pool closed');
    } catch (error) {
        logger.error('Error closing database pool:', error);
    }
}

module.exports = {
    pool,
    query,
    transaction,
    initializeDatabase,
    healthCheck,
    closePool
};