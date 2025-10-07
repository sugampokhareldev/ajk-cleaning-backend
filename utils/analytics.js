const { query } = require('../config/database');
const errorTracker = require('./errorTracker');

// Enhanced analytics and user behavior tracking
class Analytics {
    constructor() {
        this.events = [];
        this.sessionData = new Map();
        this.metrics = {
            pageViews: 0,
            uniqueVisitors: 0,
            bounceRate: 0,
            averageSessionDuration: 0,
            conversionRate: 0,
            topPages: [],
            userJourney: [],
            deviceStats: {},
            locationStats: {},
            referrerStats: {}
        };
    }

    // Track page view
    trackPageView(page, userAgent, ip, referrer = null) {
        const event = {
            type: 'page_view',
            page,
            userAgent,
            ip,
            referrer,
            timestamp: new Date().toISOString(),
            sessionId: this.getSessionId(ip, userAgent)
        };

        this.events.push(event);
        this.metrics.pageViews++;
        
        // Track unique visitors
        const visitorKey = this.getVisitorKey(ip, userAgent);
        if (!this.sessionData.has(visitorKey)) {
            this.metrics.uniqueVisitors++;
            this.sessionData.set(visitorKey, {
                firstVisit: new Date().toISOString(),
                pageViews: 0,
                sessionDuration: 0,
                pages: []
            });
        }

        // Update session data
        const session = this.sessionData.get(visitorKey);
        session.pageViews++;
        session.pages.push({
            page,
            timestamp: new Date().toISOString()
        });

        // Track device and location stats
        this.trackDeviceStats(userAgent);
        this.trackLocationStats(ip);
        this.trackReferrerStats(referrer);

        // Store in database
        this.storeEvent(event);
    }

    // Track user interaction
    trackInteraction(type, element, page, userAgent, ip) {
        const event = {
            type: 'interaction',
            interactionType: type,
            element,
            page,
            userAgent,
            ip,
            timestamp: new Date().toISOString(),
            sessionId: this.getSessionId(ip, userAgent)
        };

        this.events.push(event);
        this.storeEvent(event);
    }

    // Track conversion events
    trackConversion(type, value, page, userAgent, ip) {
        const event = {
            type: 'conversion',
            conversionType: type,
            value,
            page,
            userAgent,
            ip,
            timestamp: new Date().toISOString(),
            sessionId: this.getSessionId(ip, userAgent)
        };

        this.events.push(event);
        
        // Update conversion rate
        this.metrics.conversionRate = this.calculateConversionRate();
        
        this.storeEvent(event);
    }

    // Track form submissions
    trackFormSubmission(formType, success, page, userAgent, ip) {
        const event = {
            type: 'form_submission',
            formType,
            success,
            page,
            userAgent,
            ip,
            timestamp: new Date().toISOString(),
            sessionId: this.getSessionId(ip, userAgent)
        };

        this.events.push(event);
        this.storeEvent(event);
    }

    // Track booking events
    trackBookingEvent(eventType, bookingData, userAgent, ip) {
        const event = {
            type: 'booking_event',
            eventType,
            bookingData,
            userAgent,
            ip,
            timestamp: new Date().toISOString(),
            sessionId: this.getSessionId(ip, userAgent)
        };

        this.events.push(event);
        this.storeEvent(event);
    }

    // Track performance metrics
    trackPerformance(metric, value, page, userAgent, ip) {
        const event = {
            type: 'performance',
            metric,
            value,
            page,
            userAgent,
            ip,
            timestamp: new Date().toISOString(),
            sessionId: this.getSessionId(ip, userAgent)
        };

        this.events.push(event);
        this.storeEvent(event);
    }

    // Track user journey
    trackUserJourney(action, page, userAgent, ip) {
        const journeyEvent = {
            action,
            page,
            timestamp: new Date().toISOString(),
            sessionId: this.getSessionId(ip, userAgent)
        };

        this.metrics.userJourney.push(journeyEvent);
        
        // Keep only last 1000 journey events
        if (this.metrics.userJourney.length > 1000) {
            this.metrics.userJourney = this.metrics.userJourney.slice(-1000);
        }
    }

    // Helper methods
    getSessionId(ip, userAgent) {
        return `${ip}_${userAgent.substring(0, 50)}_${Math.floor(Date.now() / 3600000)}`;
    }

    getVisitorKey(ip, userAgent) {
        return `${ip}_${userAgent.substring(0, 50)}`;
    }

    trackDeviceStats(userAgent) {
        const device = this.parseUserAgent(userAgent);
        const deviceKey = `${device.browser}_${device.os}`;
        
        if (!this.metrics.deviceStats[deviceKey]) {
            this.metrics.deviceStats[deviceKey] = 0;
        }
        this.metrics.deviceStats[deviceKey]++;
    }

    trackLocationStats(ip) {
        // In a real implementation, you'd use a geolocation service
        const location = this.getLocationFromIP(ip);
        const locationKey = `${location.country}_${location.region}`;
        
        if (!this.metrics.locationStats[locationKey]) {
            this.metrics.locationStats[locationKey] = 0;
        }
        this.metrics.locationStats[locationKey]++;
    }

    trackReferrerStats(referrer) {
        if (!referrer) {
            this.metrics.referrerStats['direct'] = (this.metrics.referrerStats['direct'] || 0) + 1;
            return;
        }

        const domain = this.extractDomain(referrer);
        this.metrics.referrerStats[domain] = (this.metrics.referrerStats[domain] || 0) + 1;
    }

    parseUserAgent(userAgent) {
        // Simplified user agent parsing
        const browser = userAgent.includes('Chrome') ? 'Chrome' : 
                       userAgent.includes('Firefox') ? 'Firefox' : 
                       userAgent.includes('Safari') ? 'Safari' : 'Other';
        
        const os = userAgent.includes('Windows') ? 'Windows' : 
                  userAgent.includes('Mac') ? 'Mac' : 
                  userAgent.includes('Linux') ? 'Linux' : 
                  userAgent.includes('Android') ? 'Android' : 
                  userAgent.includes('iOS') ? 'iOS' : 'Other';

        return { browser, os };
    }

    getLocationFromIP(ip) {
        // Simplified location detection
        // In production, use a proper geolocation service
        return {
            country: 'Unknown',
            region: 'Unknown',
            city: 'Unknown'
        };
    }

    extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return 'unknown';
        }
    }

    calculateConversionRate() {
        const conversions = this.events.filter(e => e.type === 'conversion').length;
        const totalSessions = this.metrics.uniqueVisitors;
        return totalSessions > 0 ? (conversions / totalSessions) * 100 : 0;
    }

    // Store event in database
    async storeEvent(event) {
        try {
            // Store in PostgreSQL if available, otherwise log
            if (typeof query === 'function') {
                await query(`
                    INSERT INTO analytics_events (type, data, created_at)
                    VALUES ($1, $2, $3)
                `, [event.type, JSON.stringify(event), event.timestamp]);
            }
        } catch (error) {
            errorTracker.trackError(error, { context: 'analytics_storage' });
        }
    }

    // Get analytics dashboard data
    getDashboardData() {
        return {
            overview: {
                pageViews: this.metrics.pageViews,
                uniqueVisitors: this.metrics.uniqueVisitors,
                bounceRate: this.metrics.bounceRate,
                averageSessionDuration: this.metrics.averageSessionDuration,
                conversionRate: this.metrics.conversionRate
            },
            topPages: this.getTopPages(),
            deviceStats: this.metrics.deviceStats,
            locationStats: this.metrics.locationStats,
            referrerStats: this.metrics.referrerStats,
            userJourney: this.metrics.userJourney.slice(-50), // Last 50 events
            timestamp: new Date().toISOString()
        };
    }

    getTopPages() {
        const pageCounts = {};
        this.events
            .filter(e => e.type === 'page_view')
            .forEach(event => {
                pageCounts[event.page] = (pageCounts[event.page] || 0) + 1;
            });

        return Object.entries(pageCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([page, count]) => ({ page, views: count }));
    }

    // Get real-time analytics
    getRealTimeAnalytics() {
        const now = new Date();
        const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
        
        const recentEvents = this.events.filter(event => 
            new Date(event.timestamp) > lastHour
        );

        return {
            activeUsers: this.getActiveUsers(),
            recentEvents: recentEvents.slice(-20),
            hourlyStats: this.getHourlyStats(),
            timestamp: new Date().toISOString()
        };
    }

    getActiveUsers() {
        const now = Date.now();
        const activeThreshold = 30 * 60 * 1000; // 30 minutes
        
        let activeCount = 0;
        for (const [key, session] of this.sessionData) {
            const lastActivity = new Date(session.pages[session.pages.length - 1]?.timestamp || 0).getTime();
            if (now - lastActivity < activeThreshold) {
                activeCount++;
            }
        }
        
        return activeCount;
    }

    getHourlyStats() {
        const hourlyData = {};
        const now = new Date();
        
        for (let i = 0; i < 24; i++) {
            const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
            const hourKey = hour.getHours();
            hourlyData[hourKey] = this.events.filter(event => {
                const eventHour = new Date(event.timestamp).getHours();
                return eventHour === hourKey;
            }).length;
        }
        
        return hourlyData;
    }

    // Export analytics data
    exportAnalytics(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const filteredEvents = this.events.filter(event => {
            const eventDate = new Date(event.timestamp);
            return eventDate >= start && eventDate <= end;
        });

        return {
            period: { start: startDate, end: endDate },
            events: filteredEvents,
            summary: {
                totalEvents: filteredEvents.length,
                pageViews: filteredEvents.filter(e => e.type === 'page_view').length,
                conversions: filteredEvents.filter(e => e.type === 'conversion').length,
                formSubmissions: filteredEvents.filter(e => e.type === 'form_submission').length
            }
        };
    }
}

// Create singleton instance
const analytics = new Analytics();

module.exports = analytics;
