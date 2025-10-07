const os = require('os');
const fs = require('fs');
const path = require('path');

// Uptime monitoring and health check system
class UptimeMonitor {
    constructor() {
        this.startTime = Date.now();
        this.healthChecks = new Map();
        this.metrics = {
            uptime: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            diskUsage: 0,
            responseTime: 0,
            errorRate: 0,
            requestCount: 0,
            lastHealthCheck: null
        };
        
        this.startMonitoring();
    }

    startMonitoring() {
        // Monitor system metrics every 30 seconds
        setInterval(() => {
            this.updateSystemMetrics();
        }, 30000);

        // Monitor application health every 60 seconds
        setInterval(() => {
            this.performHealthCheck();
        }, 60000);

        // Clean up old metrics every 5 minutes
        setInterval(() => {
            this.cleanupOldMetrics();
        }, 300000);
    }

    updateSystemMetrics() {
        try {
            // Memory usage
            const memUsage = process.memoryUsage();
            this.metrics.memoryUsage = {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
                percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
            };

            // CPU usage (simplified)
            const cpus = os.cpus();
            this.metrics.cpuUsage = {
                cores: cpus.length,
                loadAverage: os.loadavg(),
                uptime: os.uptime()
            };

            // Disk usage
            this.metrics.diskUsage = this.getDiskUsage();

            // Application uptime
            this.metrics.uptime = Date.now() - this.startTime;

        } catch (error) {
            console.error('Error updating system metrics:', error);
        }
    }

    getDiskUsage() {
        try {
            const stats = fs.statSync(process.cwd());
            return {
                available: true,
                path: process.cwd(),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                available: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Register health checks
    registerHealthCheck(name, checkFunction, interval = 60000) {
        this.healthChecks.set(name, {
            function: checkFunction,
            interval,
            lastCheck: null,
            status: 'unknown',
            error: null
        });
    }

    // Perform all health checks
    async performHealthCheck() {
        const results = {};
        
        for (const [name, check] of this.healthChecks) {
            try {
                const startTime = Date.now();
                const result = await check.function();
                const duration = Date.now() - startTime;
                
                check.lastCheck = new Date().toISOString();
                check.status = result.status || 'healthy';
                check.error = null;
                
                results[name] = {
                    status: check.status,
                    duration,
                    timestamp: check.lastCheck,
                    details: result
                };
                
            } catch (error) {
                check.lastCheck = new Date().toISOString();
                check.status = 'unhealthy';
                check.error = error.message;
                
                results[name] = {
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: check.lastCheck
                };
            }
        }
        
        this.metrics.lastHealthCheck = new Date().toISOString();
        return results;
    }

    // Database health check
    async checkDatabaseHealth() {
        try {
            const { healthCheck } = require('../config/database');
            const result = await healthCheck();
            return {
                status: result.status,
                details: result
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    // API health check
    async checkApiHealth() {
        try {
            // Check if main endpoints are responding
            const endpoints = ['/api/health', '/api/submissions'];
            const results = {};
            
            for (const endpoint of endpoints) {
                try {
                    const startTime = Date.now();
                    // Simulate endpoint check (in real implementation, you'd make actual requests)
                    const responseTime = Date.now() - startTime;
                    results[endpoint] = {
                        status: 'healthy',
                        responseTime
                    };
                } catch (error) {
                    results[endpoint] = {
                        status: 'unhealthy',
                        error: error.message
                    };
                }
            }
            
            return {
                status: 'healthy',
                endpoints: results
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    // External service health check
    async checkExternalServices() {
        const services = [
            { name: 'Stripe', url: 'https://api.stripe.com' },
            { name: 'Email Service', url: process.env.SMTP_HOST || 'smtp.gmail.com' }
        ];
        
        const results = {};
        
        for (const service of services) {
            try {
                // In a real implementation, you'd ping these services
                results[service.name] = {
                    status: 'healthy',
                    responseTime: Math.random() * 100 // Simulated
                };
            } catch (error) {
                results[service.name] = {
                    status: 'unhealthy',
                    error: error.message
                };
            }
        }
        
        return {
            status: 'healthy',
            services: results
        };
    }

    // Track request metrics
    trackRequest(method, path, statusCode, responseTime) {
        this.metrics.requestCount++;
        
        // Update response time average
        if (this.metrics.responseTime === 0) {
            this.metrics.responseTime = responseTime;
        } else {
            this.metrics.responseTime = (this.metrics.responseTime + responseTime) / 2;
        }
        
        // Track error rate
        if (statusCode >= 400) {
            this.metrics.errorRate = (this.metrics.errorRate + 1) / this.metrics.requestCount;
        }
    }

    // Get comprehensive health status
    async getHealthStatus() {
        const healthChecks = await this.performHealthCheck();
        const systemMetrics = this.metrics;
        
        // Determine overall health
        const allHealthy = Object.values(healthChecks).every(check => check.status === 'healthy');
        const memoryHealthy = systemMetrics.memoryUsage.percentage < 90;
        const responseTimeHealthy = systemMetrics.responseTime < 5000;
        
        const overallStatus = allHealthy && memoryHealthy && responseTimeHealthy ? 'healthy' : 'unhealthy';
        
        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: systemMetrics.uptime,
            system: {
                memory: systemMetrics.memoryUsage,
                cpu: systemMetrics.cpuUsage,
                disk: systemMetrics.diskUsage
            },
            application: {
                requestCount: systemMetrics.requestCount,
                responseTime: systemMetrics.responseTime,
                errorRate: systemMetrics.errorRate
            },
            healthChecks,
            alerts: this.generateAlerts(systemMetrics, healthChecks)
        };
    }

    // Generate alerts based on metrics
    generateAlerts(systemMetrics, healthChecks) {
        const alerts = [];
        
        // Memory alert
        if (systemMetrics.memoryUsage.percentage > 90) {
            alerts.push({
                type: 'memory',
                severity: 'high',
                message: `High memory usage: ${systemMetrics.memoryUsage.percentage.toFixed(2)}%`
            });
        }
        
        // Response time alert
        if (systemMetrics.responseTime > 5000) {
            alerts.push({
                type: 'performance',
                severity: 'medium',
                message: `High response time: ${systemMetrics.responseTime}ms`
            });
        }
        
        // Error rate alert
        if (systemMetrics.errorRate > 0.1) {
            alerts.push({
                type: 'errors',
                severity: 'high',
                message: `High error rate: ${(systemMetrics.errorRate * 100).toFixed(2)}%`
            });
        }
        
        // Health check alerts
        Object.entries(healthChecks).forEach(([name, check]) => {
            if (check.status === 'unhealthy') {
                alerts.push({
                    type: 'health_check',
                    severity: 'high',
                    message: `Health check failed: ${name}`,
                    details: check.error
                });
            }
        });
        
        return alerts;
    }

    // Clean up old metrics
    cleanupOldMetrics() {
        // In a real implementation, you'd clean up old log files, metrics, etc.
        console.log('Cleaning up old metrics...');
    }

    // Get uptime statistics
    getUptimeStats() {
        return {
            startTime: new Date(this.startTime).toISOString(),
            uptime: this.metrics.uptime,
            uptimeFormatted: this.formatUptime(this.metrics.uptime),
            metrics: this.metrics,
            timestamp: new Date().toISOString()
        };
    }

    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
    }
}

// Create singleton instance
const uptimeMonitor = new UptimeMonitor();

// Register default health checks
uptimeMonitor.registerHealthCheck('database', () => uptimeMonitor.checkDatabaseHealth());
uptimeMonitor.registerHealthCheck('api', () => uptimeMonitor.checkApiHealth());
uptimeMonitor.registerHealthCheck('external_services', () => uptimeMonitor.checkExternalServices());

module.exports = uptimeMonitor;
