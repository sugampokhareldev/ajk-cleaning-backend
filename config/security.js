const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./logger');

// Environment-based configuration
const isProduction = process.env.NODE_ENV === 'production';

// Enhanced security headers configuration
const helmetConfig = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'", // Required for Tailwind CSS
                "'unsafe-eval'", // Required for some dynamic features
                "https://cdn.tailwindcss.com",
                "https://cdnjs.cloudflare.com",
                "https://cdn.jsdelivr.net",
                "https://js.stripe.com",
                "https://app.usercentrics.eu"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'", // Required for inline styles
                "https://cdn.tailwindcss.com",
                "https://cdnjs.cloudflare.com",
                "https://fonts.googleapis.com"
            ],
            imgSrc: [
                "'self'",
                "data:",
                "https:",
                "blob:",
                "https://images.unsplash.com",
                "https://upload.wikimedia.org",
                "https://placehold.co",
                "https://randomuser.me"
            ],
            fontSrc: [
                "'self'",
                "https://cdnjs.cloudflare.com",
                "https://fonts.gstatic.com"
            ],
            connectSrc: [
                "'self'",
                "ws:",
                "wss:",
                "https://ajkcleaners.de",
                "wss://ajkcleaners.de",
                "https://api.stripe.com",
                "https://generativelanguage.googleapis.com",
                "https://app.usercentrics.eu",
                "https://cdn.jsdelivr.net",
                "https://*.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                "https://www.google-analytics.com",
                "https://consent-api.service.consent.usercentrics.eu",
                "https://privacy-proxy.usercentrics.eu",
                "https://cdn.jsdelivr.net/npm/chart.umd.min.js.map"
            ],
            frameSrc: [
                "'self'",
                "https://js.stripe.com",
                "https://hooks.stripe.com"
            ],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            workerSrc: ["'self'", "blob:"],
            manifestSrc: ["'self'"],
            upgradeInsecureRequests: [],
            blockAllMixedContent: []
        }
    },
    crossOriginEmbedderPolicy: false, // Disable for compatibility
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: { action: 'deny' },
    hidePoweredBy: true
};

// Rate limiting configurations
const rateLimitConfigs = {
    // General API rate limiting
    api: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: {
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
            // Skip rate limiting for admin endpoints if user is authenticated
            return req.path.startsWith('/api/admin') && req.session?.authenticated;
        },
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                path: req.path,
                userAgent: req.get('User-Agent')
            });
            res.status(429).json({
                error: 'Too many requests from this IP, please try again later.',
                retryAfter: '15 minutes'
            });
        }
    }),

    // Stricter limiter for login attempts
    login: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
        message: {
            error: 'Too many login attempts, please try again later.',
            retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
            // Skip if already authenticated
            return req.session?.authenticated;
        },
        handler: (req, res) => {
            logger.warn('Login rate limit exceeded', {
                ip: req.ip,
                username: req.body?.username,
                userAgent: req.get('User-Agent')
            });
            res.status(429).json({
                error: 'Too many login attempts, please try again later.',
                retryAfter: '15 minutes'
            });
        }
    }),

    // Form submission rate limiting
    form: rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 3, // Limit each IP to 3 form submissions per minute
        message: {
            error: 'Too many form submissions, please wait before submitting again.',
            retryAfter: '1 minute'
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            logger.warn('Form submission rate limit exceeded', {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            res.status(429).json({
                success: false,
                error: 'Too many form submissions, please wait before submitting again.'
            });
        }
    })
};

// CORS configuration
const corsConfig = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const defaultOrigins = [
            'https://ajk-cleaning.onrender.com',
            'https://ajkcleaners.de',
            'https://www.ajkcleaners.de',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3001'
        ];
        
        const allowedOrigins = process.env.ALLOWED_ORIGINS 
            ? [...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()), ...defaultOrigins]
            : defaultOrigins;
        
        console.log(`🔍 CORS check for origin: ${origin}`);
        console.log(`🔍 Environment ALLOWED_ORIGINS: ${process.env.ALLOWED_ORIGINS || 'not set'}`);
        console.log(`🔍 Final allowed origins:`, allowedOrigins);
        
        if (allowedOrigins.indexOf(origin) !== -1 || 
            (!isProduction && origin.includes('localhost'))) {
            console.log(`✅ CORS allowed for origin: ${origin}`);
            callback(null, true);
        } else {
            console.log(`❌ CORS blocked origin: ${origin}`);
            console.log(`❌ Allowed origins:`, allowedOrigins);
            logger.warn('CORS blocked origin', { origin, allowedOrigins });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Set-Cookie'],
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

// Session configuration
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'ajk.sid', // Change default session name
    cookie: { 
        secure: isProduction,
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        domain: isProduction ? '.ajkcleaners.de' : undefined
    }
};

// Enhanced input sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Recursively sanitize all string inputs
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            return obj
                .trim()
                .replace(/[<>]/g, '') // Basic XSS prevention
                .replace(/javascript:/gi, '') // Remove javascript: protocols
                .replace(/on\w+\s*=/gi, '') // Remove event handlers
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
                .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
                .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '') // Remove object tags
                .replace(/<embed\b[^<]*>/gi, '') // Remove embed tags
                .replace(/<link\b[^<]*>/gi, '') // Remove link tags
                .replace(/<meta\b[^<]*>/gi, '') // Remove meta tags
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove style tags
                .replace(/expression\s*\(/gi, '') // Remove CSS expressions
                .replace(/url\s*\(/gi, '') // Remove CSS url() functions
                .replace(/@import/gi, '') // Remove CSS imports
                .replace(/data:text\/html/gi, '') // Remove data URLs with HTML
                .replace(/vbscript:/gi, '') // Remove vbscript protocols
                .replace(/data:/gi, '') // Remove data protocols
                .replace(/file:/gi, '') // Remove file protocols
                .replace(/ftp:/gi, '') // Remove ftp protocols
                .replace(/gopher:/gi, '') // Remove gopher protocols
                .replace(/jar:/gi, '') // Remove jar protocols
                .replace(/ldap:/gi, '') // Remove ldap protocols
                .replace(/mailto:/gi, '') // Remove mailto protocols
                .replace(/news:/gi, '') // Remove news protocols
                .replace(/nntp:/gi, '') // Remove nntp protocols
                .replace(/telnet:/gi, '') // Remove telnet protocols
                .replace(/wais:/gi, '') // Remove wais protocols
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters
        }
        if (typeof obj === 'object' && obj !== null) {
            for (const key in obj) {
                obj[key] = sanitize(obj[key]);
            }
        }
        return obj;
    };

    if (req.body) {
        req.body = sanitize(req.body);
    }
    if (req.query) {
        req.query = sanitize(req.query);
    }
    if (req.params) {
        req.params = sanitize(req.params);
    }

    next();
};

// Additional security middleware
const securityHeaders = (req, res, next) => {
    // Add additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Remove server information
    res.removeHeader('X-Powered-By');
    
    next();
};

// CSRF protection enhancement
const csrfProtection = (req, res, next) => {
    // Skip CSRF for GET requests and static files
    if (req.method === 'GET' || req.path.startsWith('/static/')) {
        return next();
    }
    
    // Check for CSRF token in headers or body
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;
    
    console.log('🔐 CSRF Protection Check:', {
        path: req.path,
        method: req.method,
        hasToken: !!token,
        hasSessionToken: !!sessionToken,
        tokensMatch: token === sessionToken,
        sessionId: req.sessionID
    });
    
    if (!token || !sessionToken || token !== sessionToken) {
        console.warn('❌ CSRF token validation failed:', {
            providedToken: token ? `${token.substring(0, 8)}...` : 'none',
            sessionToken: sessionToken ? `${sessionToken.substring(0, 8)}...` : 'none',
            path: req.path
        });
        return res.status(403).json({ 
            error: 'Invalid CSRF token',
            code: 'CSRF_TOKEN_MISMATCH'
        });
    }
    
    console.log('✅ CSRF token validation passed');
    next();
};

// Security middleware for WebSocket origins
const validateWebSocketOrigin = (origin) => {
    if (!origin) return true; // Allow requests with no origin
    
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [
            'https://ajk-cleaning.onrender.com',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3001'
        ];
    
    return allowedOrigins.includes(origin) || 
           (!isProduction && origin.includes('localhost'));
};

module.exports = {
    helmetConfig,
    rateLimitConfigs,
    corsConfig,
    sessionConfig,
    sanitizeInput,
    securityHeaders,
    csrfProtection,
    validateWebSocketOrigin,
    isProduction
};
