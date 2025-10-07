const { sendEmailWithFallback } = require('./emailFallback');
const sendGridAdvanced = require('./sendgridAdvanced');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');

// Initialize database connection
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'db.json');
const adapter = new JSONFile(dbPath);
const db = new Low(adapter, { submissions: [], admin_users: [], offline_messages: {}, chats: {}, analytics_events: [], bookings: [], subscriptions: [] });

/**
 * Billing Reminder Service
 * Automatically sends payment reminders to clients on their billing day
 * Includes penalty calculation for overdue payments
 */

class BillingReminderService {
    constructor() {
        this.isRunning = false;
        
        // Penalty configuration
        this.penaltyConfig = {
            enabled: true,
            gracePeriod: 3, // Days before penalty starts
            dailyRate: 0.05, // 5% per day
            maxPenalty: 0.50, // Maximum 50% penalty
            minPenalty: 5.00, // Minimum €5 penalty
            maxDays: 30 // Maximum days to calculate penalty
        };
    }

    /**
     * Start the billing reminder service
     * Checks for due payments every day at 9:00 AM
     */
    start() {
        if (this.isRunning) {
            console.log('🔄 Billing reminder service is already running');
            return;
        }

        console.log('🚀 Starting billing reminder service...');
        this.isRunning = true;

        // Run immediately on startup
        this.checkAndSendReminders();

        // Schedule daily checks at 9:00 AM
        this.scheduleDailyChecks();
    }

    /**
     * Schedule daily checks at 9:00 AM
     */
    scheduleDailyChecks() {
        const now = new Date();
        const nextRun = new Date();
        nextRun.setHours(9, 0, 0, 0); // 9:00 AM

        // If it's already past 9:00 AM today, schedule for tomorrow
        if (now.getTime() > nextRun.getTime()) {
            nextRun.setDate(nextRun.getDate() + 1);
        }

        const timeUntilNext = nextRun.getTime() - now.getTime();
        
        console.log(`⏰ Next billing reminder check scheduled for: ${nextRun.toLocaleString()}`);
        
        setTimeout(() => {
            this.checkAndSendReminders();
            // Schedule the next day
            this.scheduleDailyChecks();
        }, timeUntilNext);
    }

    /**
     * Check for subscriptions that need payment reminders
     */
    async checkAndSendReminders() {
        try {
            console.log('🔍 Checking for subscriptions due for payment...');
            
            // Always read fresh data from database
            await db.read();
            const subscriptions = db.data.subscriptions || [];
            
            const activeSubscriptions = subscriptions.filter(sub => 
                sub.status === 'active' && 
                sub.nextBillingDate
            );

            console.log(`📊 Found ${activeSubscriptions.length} active subscriptions`);

            let remindersSent = 0;
            const today = new Date();
            const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format

            for (const subscription of activeSubscriptions) {
                try {
                    const billingDate = new Date(subscription.nextBillingDate);
                    const billingDateString = billingDate.toISOString().split('T')[0];
                    
                    // Check if today is the billing date OR if payment is overdue
                    const isDueToday = billingDateString === todayString;
                    const isOverdue = billingDate < today;
                    
                    if (isDueToday || isOverdue) {
                        const daysOverdue = isOverdue ? Math.ceil((today - billingDate) / (1000 * 60 * 60 * 24)) : 0;
                        console.log(`📧 Sending payment reminder for subscription: ${subscription.id}${isOverdue ? ` (${daysOverdue} days overdue)` : ' (due today)'}`);
                        await this.sendPaymentReminder(subscription, isOverdue, daysOverdue);
                        remindersSent++;
                    }
                } catch (error) {
                    console.error(`❌ Error processing subscription ${subscription.id}:`, error);
                }
            }

            console.log(`✅ Billing reminder check completed. Sent ${remindersSent} reminders.`);
            
        } catch (error) {
            console.error('❌ Error in billing reminder check:', error);
        }
    }

    /**
     * Calculate penalty for overdue payment
     */
    calculatePenalty(subscription, daysOverdue) {
        if (!this.penaltyConfig.enabled || daysOverdue <= this.penaltyConfig.gracePeriod) {
            return {
                penalty: 0,
                totalAmount: subscription.price / 100,
                penaltyRate: 0,
                daysOverdue: daysOverdue
            };
        }

        const baseAmount = subscription.price / 100;
        const penaltyDays = Math.min(daysOverdue - this.penaltyConfig.gracePeriod, this.penaltyConfig.maxDays);
        const penaltyRate = Math.min(penaltyDays * this.penaltyConfig.dailyRate, this.penaltyConfig.maxPenalty);
        const penaltyAmount = Math.max(baseAmount * penaltyRate, this.penaltyConfig.minPenalty);
        const totalAmount = baseAmount + penaltyAmount;

        return {
            penalty: penaltyAmount,
            totalAmount: totalAmount,
            penaltyRate: penaltyRate,
            daysOverdue: daysOverdue,
            gracePeriod: this.penaltyConfig.gracePeriod
        };
    }

    /**
     * Send payment reminder email to a specific subscription
     */
    async sendPaymentReminder(subscription, isOverdue = false, daysOverdue = 0) {
        try {
            const dueDate = new Date(subscription.nextBillingDate);
            const paymentDeadline = new Date(dueDate);
            paymentDeadline.setDate(paymentDeadline.getDate() + 14); // 14 days from billing date

            // Calculate penalty if overdue
            const penaltyInfo = this.calculatePenalty(subscription, daysOverdue);
            const hasPenalty = penaltyInfo.penalty > 0;

            // Determine email subject and urgency based on payment status
            const subject = isOverdue 
                ? `⚠️ Payment Overdue${hasPenalty ? ' + Penalty' : ''} - ${subscription.planName} | AJK Cleaning Services`
                : `💰 Payment Due - ${subscription.planName} | AJK Cleaning Services`;
            
            const emailData = {
                to: subscription.customerEmail,
                subject: subject,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Payment Reminder</title>
                    </head>
                    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                            <!-- Header -->
                            <div style="background: linear-gradient(135deg, ${isOverdue ? '#dc2626 0%, #b91c1c 100%' : '#f59e0b 0%, #d97706 100%'}); padding: 30px; text-align: center; color: white;">
                                <h1 style="margin: 0; font-size: 28px; font-weight: 700;">
                                    ${isOverdue ? '⚠️ Payment Overdue' : '💰 Payment Reminder'}
                                </h1>
                                <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
                                    ${isOverdue ? `Your payment is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue` : 'Your subscription payment is due today'}
                                </p>
                            </div>
                            
                            <!-- Content -->
                            <div style="padding: 40px 30px;">
                                <div style="margin-bottom: 30px;">
                                    <h2 style="color: #2d3748; font-size: 24px; margin: 0 0 15px 0; font-weight: 600;">
                                        Hello ${subscription.customerName}! 👋
                                    </h2>
                                    <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                        ${isOverdue 
                                            ? `Your subscription payment was due ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago. Please complete your payment immediately to avoid service interruption.`
                                            : 'This is a friendly reminder that your subscription payment is due today. Please complete your payment to continue enjoying our cleaning services.'
                                        }
                                    </p>
                                </div>
                                
                                <!-- Payment Details Card -->
                                <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #f59e0b; border-radius: 12px; padding: 25px; margin: 25px 0;">
                                    <h3 style="color: #92400e; font-size: 20px; margin: 0 0 20px 0; font-weight: 600; display: flex; align-items: center;">
                                        💳 Payment Details
                                    </h3>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                                            <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 500;">SERVICE</p>
                                            <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 16px; font-weight: 600;">${subscription.planName}</p>
                                        </div>
                                <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #d97706;">
                                    <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 500;">AMOUNT DUE</p>
                                    <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 18px; font-weight: 700;">€${penaltyInfo.totalAmount.toFixed(2)}</p>
                                    ${hasPenalty ? `<p style="margin: 2px 0 0 0; color: #dc2626; font-size: 12px; font-weight: 600;">+ €${penaltyInfo.penalty.toFixed(2)} penalty</p>` : ''}
                                </div>
                                        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #fbbf24;">
                                            <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 500;">DUE DATE</p>
                                            <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 16px; font-weight: 600;">${dueDate.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                        </div>
                                        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                                            <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 500;">PAYMENT DEADLINE</p>
                                            <p style="margin: 5px 0 0 0; color: #dc2626; font-size: 16px; font-weight: 600;">${paymentDeadline.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                        </div>
                                    </div>
                                </div>
                                
                        <!-- Payment Button -->
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.BASE_URL || 'http://localhost:3000'}/subscription-payment/${subscription.id}" 
                               style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                                💳 Pay Now - €${penaltyInfo.totalAmount.toFixed(2)}${hasPenalty ? ' (includes penalty)' : ''}
                            </a>
                        </div>
                                
                                <!-- Important Notice -->
                                <div style="background: ${isOverdue ? '#fef2f2' : '#fef2f2'}; border: 1px solid ${isOverdue ? '#fca5a5' : '#fecaca'}; border-radius: 8px; padding: 20px; margin: 25px 0;">
                                    <h4 style="color: #dc2626; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">⚠️ Important Notice</h4>
                                    <ul style="color: #7f1d1d; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                                        ${isOverdue 
                                            ? `<li><strong>URGENT:</strong> Your payment is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue</li>
                                               ${hasPenalty ? `<li><strong>PENALTY APPLIED:</strong> €${penaltyInfo.penalty.toFixed(2)} penalty (${(penaltyInfo.penaltyRate * 100).toFixed(1)}% of original amount)</li>` : ''}
                                               <li>Payment must be completed within <strong>14 days</strong> of the original due date</li>
                                               <li>Service may be suspended if payment is not received soon</li>
                                               <li>Contact us immediately if you need assistance</li>`
                                            : `<li>Payment must be completed within <strong>14 days</strong> of the due date</li>
                                               <li>Late payments may result in service suspension and penalty fees</li>
                                               <li>If you have any questions, please contact us immediately</li>`
                                        }
                                    </ul>
                                </div>
                                
                                ${hasPenalty ? `
                                <!-- Penalty Breakdown -->
                                <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 1px solid #fca5a5; border-radius: 12px; padding: 25px; margin: 25px 0;">
                                    <h3 style="color: #dc2626; font-size: 18px; margin: 0 0 20px 0; font-weight: 600; display: flex; align-items: center;">
                                        💸 Penalty Breakdown
                                    </h3>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #dc2626;">
                                            <p style="margin: 0; color: #dc2626; font-size: 14px; font-weight: 500;">ORIGINAL AMOUNT</p>
                                            <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 16px; font-weight: 600;">€${(subscription.price / 100).toFixed(2)}</p>
                                        </div>
                                        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #b91c1c;">
                                            <p style="margin: 0; color: #dc2626; font-size: 14px; font-weight: 500;">PENALTY AMOUNT</p>
                                            <p style="margin: 5px 0 0 0; color: #dc2626; font-size: 16px; font-weight: 700;">€${penaltyInfo.penalty.toFixed(2)}</p>
                                        </div>
                                        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #991b1b;">
                                            <p style="margin: 0; color: #dc2626; font-size: 14px; font-weight: 500;">PENALTY RATE</p>
                                            <p style="margin: 5px 0 0 0; color: #dc2626; font-size: 16px; font-weight: 600;">${(penaltyInfo.penaltyRate * 100).toFixed(1)}%</p>
                                        </div>
                                        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #7f1d1d;">
                                            <p style="margin: 0; color: #dc2626; font-size: 14px; font-weight: 500;">TOTAL AMOUNT</p>
                                            <p style="margin: 5px 0 0 0; color: #dc2626; font-size: 18px; font-weight: 700;">€${penaltyInfo.totalAmount.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <div style="margin-top: 15px; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid #f59e0b;">
                                        <p style="margin: 0; color: #92400e; font-size: 12px; font-weight: 500;">PENALTY CALCULATION</p>
                                        <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 14px; line-height: 1.4;">
                                            ${penaltyInfo.daysOverdue} days overdue - ${penaltyInfo.gracePeriod} day grace period = ${penaltyInfo.daysOverdue - penaltyInfo.gracePeriod} penalty days × ${(this.penaltyConfig.dailyRate * 100).toFixed(1)}% daily rate
                                        </p>
                                    </div>
                                </div>
                                ` : ''}
                                
                                <!-- Service Information -->
                                <div style="background: #f7fafc; border-radius: 8px; padding: 20px; margin: 25px 0;">
                                    <h4 style="color: #2d3748; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">🧹 Your Cleaning Service</h4>
                                    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                                        <div style="flex: 1; min-width: 150px;">
                                            <p style="margin: 0; color: #718096; font-size: 12px; font-weight: 500;">SERVICE TYPE</p>
                                            <p style="margin: 2px 0 0 0; color: #2d3748; font-size: 14px; font-weight: 600;">${subscription.planName}</p>
                                        </div>
                                        <div style="flex: 1; min-width: 150px;">
                                            <p style="margin: 0; color: #718096; font-size: 12px; font-weight: 500;">FREQUENCY</p>
                                            <p style="margin: 2px 0 0 0; color: #2d3748; font-size: 14px; font-weight: 600; text-transform: capitalize;">${subscription.billingCycle}</p>
                                        </div>
                                        <div style="flex: 1; min-width: 150px;">
                                            <p style="margin: 0; color: #718096; font-size: 12px; font-weight: 500;">STATUS</p>
                                            <p style="margin: 2px 0 0 0; color: #10b981; font-size: 14px; font-weight: 600;">✅ Active</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Contact Information -->
                                <div style="border-top: 1px solid #e2e8f0; padding-top: 25px; margin-top: 30px;">
                                    <h4 style="color: #2d3748; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">📞 Need Help?</h4>
                                    <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                                        If you have any questions about your payment or need assistance, please contact us:
                                    </p>
                                    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                                        <div style="flex: 1; min-width: 150px;">
                                            <p style="margin: 0; color: #718096; font-size: 12px; font-weight: 500;">EMAIL</p>
                                            <p style="margin: 2px 0 0 0; color: #2d3748; font-size: 14px; font-weight: 600;">info@ajkcleaning.com</p>
                                        </div>
                                        <div style="flex: 1; min-width: 150px;">
                                            <p style="margin: 0; color: #718096; font-size: 12px; font-weight: 500;">PHONE</p>
                                            <p style="margin: 2px 0 0 0; color: #2d3748; font-size: 14px; font-weight: 600;">+49 123 456 7890</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Footer -->
                            <div style="background: #f7fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                                <p style="color: #718096; font-size: 14px; margin: 0 0 10px 0;">
                                    Thank you for choosing <strong>AJK Cleaning Services</strong>
                                </p>
                                <p style="color: #a0aec0; font-size: 12px; margin: 0;">
                                    This is an automated payment reminder. Please do not reply to this email.
                                </p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            // Try SendGrid first, then fallback to SMTP
            let emailSent = false;
            let result;
            
            try {
                if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your_sendgrid_api_key_here') {
                    console.log('🚀 [BILLING REMINDER] Attempting to send email via SendGrid...');
                    console.log(`📧 [BILLING REMINDER] Sending to: ${subscription.customerEmail}`);
                    console.log(`📧 [BILLING REMINDER] Subject: ${emailData.subject}`);
                    
                    result = await sendGridAdvanced.sendEmail(subscription.customerEmail, emailData.subject, emailData.html);
                    
                    if (result && result.success) {
                        console.log('✅ [BILLING REMINDER] SendGrid email sent successfully');
                        emailSent = true;
                    } else {
                        console.log('❌ [BILLING REMINDER] SendGrid returned failure result:', result);
                    }
                } else {
                    console.log('⚠️  [BILLING REMINDER] SENDGRID_API_KEY not found or not configured, using SMTP fallback...');
                }
            } catch (sendGridError) {
                console.log('🔄 [BILLING REMINDER] SendGrid failed, trying SMTP fallback...', sendGridError.message);
            }
            
            // Try SMTP fallback if SendGrid failed
            if (!emailSent) {
                try {
                    console.log('🔄 [BILLING REMINDER] Attempting SMTP fallback...');
                    result = await sendEmailWithFallback(emailData);
                    
                    if (result && (result.success || result === true)) {
                        console.log('✅ [BILLING REMINDER] SMTP email sent successfully');
                        emailSent = true;
                    } else {
                        console.log('❌ [BILLING REMINDER] SMTP fallback failed:', result);
                    }
                } catch (smtpError) {
                    console.error('❌ [BILLING REMINDER] SMTP fallback failed:', smtpError.message);
                }
            }
            
            if (emailSent) {
                console.log(`✅ Payment reminder sent to ${subscription.customerEmail} for subscription ${subscription.id}`);
            } else {
                console.error(`❌ Failed to send payment reminder to ${subscription.customerEmail}`);
                console.error(`❌ SendGrid result:`, result);
            }
            
        } catch (error) {
            console.error(`❌ Failed to send payment reminder for subscription ${subscription.id}:`, error);
        }
    }

    /**
     * Stop the billing reminder service
     */
    stop() {
        this.isRunning = false;
        console.log('🛑 Billing reminder service stopped');
    }
}

module.exports = new BillingReminderService();
