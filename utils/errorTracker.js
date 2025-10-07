const winston = require('winston');
const path = require('path');

// Enhanced error tracking and logging system
class ErrorTracker {
    constructor() {
        this.logger = this.createLogger();
        this.errorCounts = new Map();
        this.alertThresholds = {
            errorRate: 10, // errors per minute
            criticalErrors: 5, // critical errors per hour
            memoryUsage: 0.9, // 90% memory usage
            responseTime: 5000 // 5 seconds response time
        };
    }

    createLogger() {
        const logFormat = winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
        );

        return winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: logFormat,
            transports: [
                // Console transport for development
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                }),
                // File transports for production
                new winston.transports.File({
                    filename: path.join(__dirname, '../logs/error.log'),
                    level: 'error',
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                }),
                new winston.transports.File({
                    filename: path.join(__dirname, '../logs/combined.log'),
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                })
            ]
        });
    }

    // Track different types of errors
    trackError(error, context = {}) {
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            type: error.constructor.name,
            timestamp: new Date().toISOString(),
            context: {
                url: context.url,
                method: context.method,
                userAgent: context.userAgent,
                ip: context.ip,
                userId: context.userId,
                sessionId: context.sessionId,
                ...context
            }
        };

        // Log the error
        this.logger.error('Application Error', errorInfo);

        // Track error counts for alerting
        this.trackErrorCount(errorInfo.type);

        // Check for critical errors
        if (this.isCriticalError(error)) {
            this.handleCriticalError(errorInfo);
        }

        return errorInfo;
    }

    // Track API errors
    trackApiError(error, req, res) {
        const apiError = {
            message: error.message,
            stack: error.stack,
            type: 'API_ERROR',
            endpoint: req.path,
            method: req.method,
            statusCode: res.statusCode,
            timestamp: new Date().toISOString(),
            context: {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                body: req.body,
                query: req.query,
                params: req.params
            }
        };

        this.logger.error('API Error', apiError);
        this.trackErrorCount('API_ERROR');
    }

    // Track performance issues
    trackPerformanceIssue(metric, value, threshold) {
        const performanceIssue = {
            metric,
            value,
            threshold,
            severity: this.getPerformanceSeverity(metric, value, threshold),
            timestamp: new Date().toISOString()
        };

        this.logger.warn('Performance Issue', performanceIssue);

        if (performanceIssue.severity === 'critical') {
            this.handlePerformanceAlert(performanceIssue);
        }
    }

    // Track security events
    trackSecurityEvent(event, details = {}) {
        const securityEvent = {
            event,
            details,
            timestamp: new Date().toISOString(),
            severity: this.getSecuritySeverity(event)
        };

        this.logger.warn('Security Event', securityEvent);

        if (securityEvent.severity === 'high' || securityEvent.severity === 'critical') {
            this.handleSecurityAlert(securityEvent);
        }
    }

    // Track user behavior
    trackUserBehavior(action, userId, details = {}) {
        const behaviorEvent = {
            action,
            userId,
            details,
            timestamp: new Date().toISOString()
        };

        this.logger.info('User Behavior', behaviorEvent);
    }

    // Track business metrics
    trackBusinessMetric(metric, value, context = {}) {
        const businessMetric = {
            metric,
            value,
            context,
            timestamp: new Date().toISOString()
        };

        this.logger.info('Business Metric', businessMetric);
    }

    // Helper methods
    trackErrorCount(errorType) {
        const count = this.errorCounts.get(errorType) || 0;
        this.errorCounts.set(errorType, count + 1);
    }

    isCriticalError(error) {
        const criticalPatterns = [
            /database/i,
            /connection/i,
            /memory/i,
            /timeout/i,
            /authentication/i,
            /authorization/i
        ];

        return criticalPatterns.some(pattern => 
            pattern.test(error.message) || pattern.test(error.stack)
        );
    }

    getPerformanceSeverity(metric, value, threshold) {
        const ratio = value / threshold;
        if (ratio >= 2) return 'critical';
        if (ratio >= 1.5) return 'high';
        if (ratio >= 1.2) return 'medium';
        return 'low';
    }

    getSecuritySeverity(event) {
        const criticalEvents = ['brute_force', 'sql_injection', 'xss_attempt'];
        const highEvents = ['unauthorized_access', 'suspicious_activity'];
        
        if (criticalEvents.includes(event)) return 'critical';
        if (highEvents.includes(event)) return 'high';
        return 'medium';
    }

    // Alert handlers
    handleCriticalError(errorInfo) {
        this.logger.error('CRITICAL ERROR ALERT', errorInfo);
        // Here you would integrate with alerting services like:
        // - Slack notifications
        // - Email alerts
        // - PagerDuty
        // - Custom webhook
    }

    handlePerformanceAlert(performanceIssue) {
        this.logger.error('PERFORMANCE ALERT', performanceIssue);
        // Send performance alerts
    }

    handleSecurityAlert(securityEvent) {
        this.logger.error('SECURITY ALERT', securityEvent);
        // Send security alerts
    }

    // Get error statistics
    getErrorStats() {
        return {
            totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
            errorCounts: Object.fromEntries(this.errorCounts),
            timestamp: new Date().toISOString()
        };
    }

    // Health check
    getHealthStatus() {
        const stats = this.getErrorStats();
        const isHealthy = stats.totalErrors < this.alertThresholds.errorRate;
        
        return {
            status: isHealthy ? 'healthy' : 'unhealthy',
            stats,
            timestamp: new Date().toISOString()
        };
    }
}

// Create singleton instance
const errorTracker = new ErrorTracker();

module.exports = errorTracker;
