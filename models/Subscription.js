const { DataTypes } = require('sequelize');

/**
 * Subscription Model for Recurring Payment Management
 * Handles all subscription-related data and operations
 */
class Subscription {
    constructor(db) {
        this.db = db;
        this.subscriptions = db.data.subscriptions || [];
    }

    /**
     * Create a new subscription
     * @param {Object} subscriptionData - Subscription details
     * @returns {Object} Created subscription
     */
    async create(subscriptionData) {
        const subscription = {
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            customerId: subscriptionData.customerId,
            customerEmail: subscriptionData.customerEmail,
            customerName: subscriptionData.customerName,
            customerPhone: subscriptionData.customerPhone,
            stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
            stripeCustomerId: subscriptionData.stripeCustomerId,
            planId: subscriptionData.planId,
            planName: subscriptionData.planName,
            price: subscriptionData.price,
            currency: subscriptionData.currency || 'eur',
            billingCycle: subscriptionData.billingCycle || 'monthly', // monthly, weekly, yearly
            status: 'active', // active, paused, cancelled, past_due, unpaid
            startDate: new Date().toISOString(),
            nextBillingDate: subscriptionData.nextBillingDate,
            lastPaymentDate: null,
            lastPaymentAmount: null,
            totalPaid: 0,
            failedPayments: 0,
            maxFailedPayments: 3,
            autoRetry: true,
            pauseReason: null,
            cancellationReason: null,
            cancelledAt: null,
            notes: subscriptionData.notes || '',
            serviceAddress: subscriptionData.serviceAddress,
            serviceFrequency: subscriptionData.serviceFrequency, // weekly, bi-weekly, monthly
            specialInstructions: subscriptionData.specialInstructions || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.subscriptions.push(subscription);
        await this.db.write();
        
        console.log(`[SUBSCRIPTION] ✅ Created subscription ${subscription.id} for customer ${subscription.customerEmail}`);
        return subscription;
    }

    /**
     * Get subscription by ID
     * @param {string} id - Subscription ID
     * @returns {Object|null} - Subscription or null
     */
    async getById(id) {
        return this.subscriptions.find(sub => sub.id === id);
    }

    /**
     * Get subscription by Stripe subscription ID
     * @param {string} stripeSubscriptionId - Stripe subscription ID
     * @returns {Object|null} - Subscription or null
     */
    async getByStripeId(stripeSubscriptionId) {
        return this.subscriptions.find(sub => sub.stripeSubscriptionId === stripeSubscriptionId);
    }

    /**
     * Get subscriptions by customer email
     * @param {string} email - Customer email
     * @returns {Array} - Array of subscriptions
     */
    async getByCustomerEmail(email) {
        return this.subscriptions.filter(sub => sub.customerEmail === email);
    }

    /**
     * Get all subscriptions with optional filters
     * @param {Object} filters - Filter options
     * @returns {Array} - Array of subscriptions
     */
    async getAll(filters = {}) {
        let results = [...this.subscriptions];

        if (filters.status) {
            results = results.filter(sub => sub.status === filters.status);
        }

        if (filters.planId) {
            results = results.filter(sub => sub.planId === filters.planId);
        }

        if (filters.dateFrom) {
            results = results.filter(sub => new Date(sub.createdAt) >= new Date(filters.dateFrom));
        }

        if (filters.dateTo) {
            results = results.filter(sub => new Date(sub.createdAt) <= new Date(filters.dateTo));
        }

        return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Update subscription
     * @param {string} id - Subscription ID
     * @param {Object} updates - Updates to apply
     * @returns {Object|null} - Updated subscription or null
     */
    async update(id, updates) {
        const subscription = await this.getById(id);
        if (!subscription) return null;

        Object.assign(subscription, updates, {
            updatedAt: new Date().toISOString()
        });

        await this.db.write();
        console.log(`[SUBSCRIPTION] ✅ Updated subscription ${id}`);
        return subscription;
    }

    /**
     * Update subscription status
     * @param {string} id - Subscription ID
     * @param {string} status - New status
     * @param {string} reason - Reason for status change
     * @returns {Object|null} - Updated subscription or null
     */
    async updateStatus(id, status, reason = null) {
        const updates = { status };
        
        if (reason) {
            if (status === 'paused') {
                updates.pauseReason = reason;
            } else if (status === 'cancelled') {
                updates.cancellationReason = reason;
                updates.cancelledAt = new Date().toISOString();
            }
        }

        return await this.update(id, updates);
    }

    /**
     * Record payment
     * @param {string} id - Subscription ID
     * @param {number} amount - Payment amount
     * @param {string} paymentIntentId - Stripe payment intent ID
     * @returns {Object|null} - Updated subscription or null
     */
    async recordPayment(id, amount, paymentIntentId) {
        const subscription = await this.getById(id);
        if (!subscription) return null;

        const updates = {
            lastPaymentDate: new Date().toISOString(),
            lastPaymentAmount: amount,
            totalPaid: (subscription.totalPaid || 0) + amount,
            failedPayments: 0, // Reset failed payments on successful payment
            status: 'active'
        };

        // Calculate next billing date
        const nextBilling = new Date();
        if (subscription.billingCycle === 'weekly') {
            nextBilling.setDate(nextBilling.getDate() + 7);
        } else if (subscription.billingCycle === 'monthly') {
            nextBilling.setMonth(nextBilling.getMonth() + 1);
        } else if (subscription.billingCycle === 'yearly') {
            nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        }
        updates.nextBillingDate = nextBilling.toISOString();

        return await this.update(id, updates);
    }

    /**
     * Record failed payment
     * @param {string} id - Subscription ID
     * @param {string} reason - Failure reason
     * @returns {Object|null} - Updated subscription or null
     */
    async recordFailedPayment(id, reason) {
        const subscription = await this.getById(id);
        if (!subscription) return null;

        const failedPayments = (subscription.failedPayments || 0) + 1;
        const updates = {
            failedPayments,
            status: failedPayments >= subscription.maxFailedPayments ? 'cancelled' : 'past_due'
        };

        if (failedPayments >= subscription.maxFailedPayments) {
            updates.cancellationReason = `Payment failed ${failedPayments} times: ${reason}`;
            updates.cancelledAt = new Date().toISOString();
        }

        return await this.update(id, updates);
    }

    /**
     * Get subscriptions due for billing
     * @param {number} daysAhead - Days ahead to check (default: 7)
     * @returns {Array} - Array of subscriptions due for billing
     */
    async getDueForBilling(daysAhead = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

        return this.subscriptions.filter(sub => {
            if (sub.status !== 'active') return false;
            if (!sub.nextBillingDate) return false;
            return new Date(sub.nextBillingDate) <= cutoffDate;
        });
    }

    /**
     * Get subscriptions with failed payments
     * @returns {Array} - Array of subscriptions with failed payments
     */
    async getWithFailedPayments() {
        return this.subscriptions.filter(sub => 
            sub.status === 'past_due' || sub.status === 'unpaid'
        );
    }

    /**
     * Get subscription statistics
     * @returns {Object} - Statistics object
     */
    async getStatistics() {
        const total = this.subscriptions.length;
        const active = this.subscriptions.filter(sub => sub.status === 'active').length;
        const paused = this.subscriptions.filter(sub => sub.status === 'paused').length;
        const cancelled = this.subscriptions.filter(sub => sub.status === 'cancelled').length;
        const pastDue = this.subscriptions.filter(sub => sub.status === 'past_due').length;
        
        const totalRevenue = this.subscriptions.reduce((sum, sub) => sum + (sub.totalPaid || 0), 0);
        const monthlyRevenue = this.subscriptions
            .filter(sub => sub.status === 'active' && sub.billingCycle === 'monthly')
            .reduce((sum, sub) => sum + sub.price, 0);

        return {
            total,
            active,
            paused,
            cancelled,
            pastDue,
            totalRevenue,
            monthlyRevenue,
            averageRevenue: total > 0 ? totalRevenue / total : 0
        };
    }

    /**
     * Delete subscription
     * @param {string} id - Subscription ID
     * @returns {boolean} - Success status
     */
    async delete(id) {
        const index = this.subscriptions.findIndex(sub => sub.id === id);
        if (index === -1) return false;

        this.subscriptions.splice(index, 1);
        await this.db.write();
        console.log(`[SUBSCRIPTION] ✅ Deleted subscription ${id}`);
        return true;
    }
}

module.exports = Subscription;



