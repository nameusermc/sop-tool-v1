/**
 * Paddle Billing Module - WithoutMe
 * 
 * Handles plan detection, Paddle checkout, and pricing UI.
 * Uses Paddle.js v2 (Billing) for checkout overlay.
 * 
 * SETUP:
 * 1. Replace PADDLE_CONFIG values with real Paddle credentials
 * 2. Set environment to 'production' when going live
 * 3. Include Paddle.js SDK before this script in index.html
 * 
 * @module PaddleBilling
 * @version 1.0.0
 */

(function(global) {
    'use strict';

    // ========================================================================
    // CONFIGURATION — REPLACE THESE WITH REAL VALUES
    // ========================================================================

    const PADDLE_CONFIG = {
        // Paddle seller/client token — replace with your real token
        clientToken: 'PLACEHOLDER_CLIENT_TOKEN',
        
        // Paddle price ID for Pro monthly ($39/mo) — replace with real price ID
        proPriceId: 'PLACEHOLDER_PRICE_ID',
        
        // Environment: 'sandbox' for testing, 'production' for live
        environment: 'production',
        
        // Customer portal URL — find in Paddle dashboard > Business account > Customer portal
        // Format: https://customer-portal.paddle.com/cpl_XXXXXXX
        customerPortalUrl: 'PLACEHOLDER_PORTAL_URL',
        
        // Price display (used in UI — update if you change the Paddle price)
        proPrice: '$39',
        proPeriod: '/mo'
    };

    // ========================================================================
    // PLAN STATE
    // ========================================================================

    const PLAN_KEY = 'withoutme_plan';           // 'free' | 'pro'
    const PLAN_DETAIL_KEY = 'withoutme_plan_detail'; // JSON: { subscriptionId, customerId, status, updatedAt }

    const PaddleBilling = {
        _initialized: false,
        _paddleReady: false,

        /**
         * Get current plan. Returns 'free' or 'pro'.
         */
        getPlan() {
            return localStorage.getItem(PLAN_KEY) || 'free';
        },

        /**
         * Check if user is on Pro plan.
         */
        isPro() {
            return this.getPlan() === 'pro';
        },

        /**
         * Set plan state (called after successful checkout or on login sync).
         */
        setPlan(plan, detail = null) {
            localStorage.setItem(PLAN_KEY, plan);
            if (detail) {
                localStorage.setItem(PLAN_DETAIL_KEY, JSON.stringify({
                    ...detail,
                    updatedAt: Date.now()
                }));
            }
            console.log(`[PaddleBilling] Plan set to: ${plan}`);
        },

        /**
         * Get plan detail (subscription info).
         */
        getPlanDetail() {
            try {
                return JSON.parse(localStorage.getItem(PLAN_DETAIL_KEY) || 'null');
            } catch (e) { return null; }
        },

        /**
         * Get the customer portal URL.
         */
        getCustomerPortalUrl() {
            if (PADDLE_CONFIG.customerPortalUrl === 'PLACEHOLDER_PORTAL_URL') {
                return null;
            }
            return PADDLE_CONFIG.customerPortalUrl;
        },

        /**
         * Sync plan state from server (Supabase subscription record).
         * Called on login to restore Pro status even if localStorage was cleared.
         * 
         * @param {string} email - User's email to check
         * @returns {string} - 'pro' or 'free'
         */
        async syncFromServer(email) {
            if (typeof SupabaseClient === 'undefined' || !SupabaseClient) {
                console.log('[PaddleBilling] No SupabaseClient — skipping server sync');
                return this.getPlan();
            }

            try {
                const sub = await SupabaseClient.checkSubscription(email);
                
                if (sub && sub.status === 'active') {
                    this.setPlan('pro', {
                        subscriptionId: sub.subscriptionId,
                        status: sub.status,
                        source: 'server_sync'
                    });
                    console.log('[PaddleBilling] Pro status restored from server');
                    
                    window.dispatchEvent(new CustomEvent('withoutme:plan-changed', { 
                        detail: { plan: 'pro' } 
                    }));
                    return 'pro';
                } else if (sub && ['canceled', 'past_due', 'paused'].includes(sub.status)) {
                    // Subscription exists but isn't active — downgrade
                    this.setPlan('free', {
                        subscriptionId: sub.subscriptionId,
                        status: sub.status,
                        source: 'server_sync'
                    });
                    console.log(`[PaddleBilling] Subscription ${sub.status} — set to free`);
                    
                    window.dispatchEvent(new CustomEvent('withoutme:plan-changed', { 
                        detail: { plan: 'free' } 
                    }));
                    return 'free';
                } else {
                    // No subscription record — leave current state
                    // (don't downgrade if they just bought and webhook hasn't landed yet)
                    console.log('[PaddleBilling] No server subscription found — keeping current state');
                    return this.getPlan();
                }
            } catch (e) {
                console.error('[PaddleBilling] Server sync failed:', e);
                return this.getPlan();
            }
        },

        // ====================================================================
        // PADDLE INITIALIZATION
        // ====================================================================

        /**
         * Initialize Paddle.js. Call once on app load.
         */
        init() {
            if (this._initialized) return;
            this._initialized = true;

            if (PADDLE_CONFIG.clientToken === 'PLACEHOLDER_CLIENT_TOKEN') {
                console.log('[PaddleBilling] Running with placeholder config — checkout will not work until real credentials are set');
                return;
            }

            if (typeof Paddle === 'undefined') {
                console.warn('[PaddleBilling] Paddle.js SDK not loaded');
                return;
            }

            try {
                if (PADDLE_CONFIG.environment === 'sandbox') {
                    Paddle.Environment.set('sandbox');
                }

                Paddle.Initialize({
                    token: PADDLE_CONFIG.clientToken,
                    eventCallback: (event) => this._handlePaddleEvent(event)
                });

                this._paddleReady = true;
                console.log(`[PaddleBilling] Paddle initialized (${PADDLE_CONFIG.environment})`);
            } catch (e) {
                console.error('[PaddleBilling] Paddle init failed:', e);
            }
        },

        // ====================================================================
        // CHECKOUT
        // ====================================================================

        /**
         * Open Paddle checkout for Pro plan.
         * @param {string} email - Pre-fill email if user is logged in
         */
        openCheckout(email = null) {
            if (PADDLE_CONFIG.clientToken === 'PLACEHOLDER_CLIENT_TOKEN') {
                console.log('[PaddleBilling] Checkout blocked — placeholder credentials');
                this._showPlaceholderCheckoutNotice();
                return;
            }

            if (!this._paddleReady) {
                console.warn('[PaddleBilling] Paddle not ready');
                return;
            }

            const checkoutConfig = {
                items: [{ priceId: PADDLE_CONFIG.proPriceId, quantity: 1 }]
            };

            if (email) {
                checkoutConfig.customer = { email };
            }

            try {
                Paddle.Checkout.open(checkoutConfig);
                console.log('[PaddleBilling] Checkout opened');
            } catch (e) {
                console.error('[PaddleBilling] Checkout failed:', e);
            }
        },

        /**
         * Handle Paddle events (checkout completed, closed, etc.)
         */
        _handlePaddleEvent(event) {
            console.log('[PaddleBilling] Paddle event:', event.name);

            if (event.name === 'checkout.completed') {
                const data = event.data;
                this.setPlan('pro', {
                    subscriptionId: data.subscription_id || null,
                    customerId: data.customer?.id || null,
                    status: 'active'
                });

                // Close modal if open
                this.closePricingModal();

                // Show success
                this._showUpgradeSuccess();

                // Dispatch event for other modules to react
                window.dispatchEvent(new CustomEvent('withoutme:plan-changed', { 
                    detail: { plan: 'pro' } 
                }));
            }
        },

        /**
         * Show a notice when checkout is attempted with placeholder credentials.
         */
        _showPlaceholderCheckoutNotice() {
            const existing = document.getElementById('paddle-placeholder-notice');
            if (existing) existing.remove();

            const notice = document.createElement('div');
            notice.id = 'paddle-placeholder-notice';
            notice.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;z-index:10000;max-width:400px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
            notice.textContent = 'Checkout not available yet — Paddle credentials need to be configured.';
            document.body.appendChild(notice);
            setTimeout(() => notice.remove(), 4000);
        },

        /**
         * Show upgrade success toast.
         */
        _showUpgradeSuccess() {
            const existing = document.getElementById('upgrade-success-toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.id = 'upgrade-success-toast';
            toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#065f46;color:#fff;padding:14px 24px;border-radius:8px;font-size:15px;font-weight:600;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
            toast.textContent = '✅ Welcome to Pro! Team access and cloud sync are now available.';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        },

        // ====================================================================
        // PRICING MODAL
        // ====================================================================

        /**
         * Show the pricing modal.
         */
        showPricingModal() {
            // Remove existing
            this.closePricingModal();

            this._injectPricingStyles();

            const modal = document.createElement('div');
            modal.id = 'pricing-modal';
            modal.className = 'pricing-modal-overlay';
            modal.innerHTML = `
                <div class="pricing-modal">
                    <button class="pricing-modal-close" id="pricing-modal-close" title="Close">✕</button>
                    
                    <h2 class="pricing-modal-title">Choose your plan</h2>
                    <p class="pricing-modal-subtitle">Start free. Upgrade when you're ready to share with your team.</p>
                    
                    <div class="pricing-cards">
                        <!-- FREE -->
                        <div class="pricing-card">
                            <div class="pricing-card-header">
                                <h3 class="pricing-plan-name">Free</h3>
                                <div class="pricing-plan-price">
                                    <span class="pricing-amount">$0</span>
                                </div>
                            </div>
                            <ul class="pricing-features">
                                <li class="pricing-feature">✅ Unlimited SOPs</li>
                                <li class="pricing-feature">✅ All templates</li>
                                <li class="pricing-feature">✅ PDF export</li>
                                <li class="pricing-feature">✅ Works offline</li>
                                <li class="pricing-feature dim">— Single device only</li>
                                <li class="pricing-feature dim">— No team sharing</li>
                            </ul>
                            <div class="pricing-card-action">
                                <button class="pricing-btn-free" id="pricing-btn-free">Current plan</button>
                            </div>
                        </div>

                        <!-- PRO -->
                        <div class="pricing-card pricing-card-pro">
                            <div class="pricing-card-badge">Recommended</div>
                            <div class="pricing-card-header">
                                <h3 class="pricing-plan-name">Pro</h3>
                                <div class="pricing-plan-price">
                                    <span class="pricing-amount">${PADDLE_CONFIG.proPrice}</span>
                                    <span class="pricing-period">${PADDLE_CONFIG.proPeriod}</span>
                                </div>
                            </div>
                            <ul class="pricing-features">
                                <li class="pricing-feature">✅ Everything in Free</li>
                                <li class="pricing-feature highlight">✅ AI builds your SOPs — just add a title</li>
                                <li class="pricing-feature highlight">✅ AI rewrites steps anyone can follow</li>
                                <li class="pricing-feature highlight">✅ Team access — share via link</li>
                                <li class="pricing-feature">✅ Cloud sync across all devices</li>
                                <li class="pricing-feature">✅ Unlimited team members — no per-seat fees</li>
                            </ul>
                            <div class="pricing-card-action">
                                <button class="pricing-btn-pro" id="pricing-btn-pro">Start Pro</button>
                            </div>
                        </div>
                    </div>

                    <p class="pricing-footer-note">Cancel anytime. Your SOPs stay yours even if you downgrade.</p>
                </div>
            `;

            document.body.appendChild(modal);

            // Event listeners
            modal.querySelector('#pricing-modal-close').addEventListener('click', () => this.closePricingModal());
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closePricingModal();
            });
            modal.querySelector('#pricing-btn-free')?.addEventListener('click', () => this.closePricingModal());
            modal.querySelector('#pricing-btn-pro')?.addEventListener('click', () => {
                // Get email if user is logged in
                const email = (typeof StorageAdapter !== 'undefined' && StorageAdapter.Auth?.getUser?.())
                    ? StorageAdapter.Auth.getUser().email
                    : null;
                this.openCheckout(email);
            });

            // Update button states based on current plan
            if (this.isPro()) {
                const freeBtn = modal.querySelector('#pricing-btn-free');
                const proBtn = modal.querySelector('#pricing-btn-pro');
                if (freeBtn) { freeBtn.textContent = 'Free'; freeBtn.disabled = false; }
                if (proBtn) { proBtn.textContent = 'Current plan'; proBtn.disabled = true; proBtn.classList.add('pricing-btn-current'); }
            }

            // Animate in
            requestAnimationFrame(() => modal.classList.add('pricing-modal-visible'));
        },

        /**
         * Close pricing modal.
         */
        closePricingModal() {
            const modal = document.getElementById('pricing-modal');
            if (modal) modal.remove();
        },

        // ====================================================================
        // FEATURE GATE UI
        // ====================================================================

        /**
         * Show an upgrade prompt for a gated feature.
         * @param {string} feature - Description of what they're trying to do
         * @param {HTMLElement} anchorEl - Element to position near (optional)
         */
        showUpgradePrompt(feature) {
            this.showPricingModal();
        },

        // ====================================================================
        // STYLES
        // ====================================================================

        _injectPricingStyles() {
            if (document.getElementById('pricing-modal-styles')) return;

            const style = document.createElement('style');
            style.id = 'pricing-modal-styles';
            style.textContent = `
                .pricing-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 1rem;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                .pricing-modal-visible {
                    opacity: 1;
                }
                .pricing-modal {
                    background: #fff;
                    border-radius: 14px;
                    padding: 2rem;
                    max-width: 640px;
                    width: 100%;
                    position: relative;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.15);
                    max-height: 90vh;
                    overflow-y: auto;
                }
                .pricing-modal-close {
                    position: absolute;
                    top: 12px;
                    right: 14px;
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: #9ca3af;
                    padding: 4px 8px;
                    border-radius: 4px;
                }
                .pricing-modal-close:hover { color: #374151; background: #f3f4f6; }
                .pricing-modal-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin: 0 0 0.25rem;
                    text-align: center;
                    color: #0f172a;
                }
                .pricing-modal-subtitle {
                    text-align: center;
                    color: #64748b;
                    font-size: 0.95rem;
                    margin: 0 0 1.75rem;
                }
                .pricing-cards {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }
                .pricing-card {
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                }
                .pricing-card-pro {
                    border-color: #4338ca;
                    border-width: 2px;
                    background: #fafafe;
                }
                .pricing-card-badge {
                    position: absolute;
                    top: -10px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #4338ca;
                    color: #fff;
                    font-size: 0.72rem;
                    font-weight: 600;
                    padding: 2px 12px;
                    border-radius: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .pricing-card-header {
                    margin-bottom: 1rem;
                }
                .pricing-plan-name {
                    font-size: 1.1rem;
                    font-weight: 600;
                    margin: 0 0 0.25rem;
                    color: #1e293b;
                }
                .pricing-plan-price {
                    display: flex;
                    align-items: baseline;
                    gap: 2px;
                }
                .pricing-amount {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #0f172a;
                }
                .pricing-period {
                    font-size: 0.95rem;
                    color: #64748b;
                }
                .pricing-features {
                    list-style: none;
                    padding: 0;
                    margin: 0 0 1.25rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.4rem;
                    flex: 1;
                }
                .pricing-feature {
                    font-size: 0.88rem;
                    color: #334155;
                    line-height: 1.4;
                }
                .pricing-feature.dim {
                    color: #94a3b8;
                }
                .pricing-feature.highlight {
                    font-weight: 500;
                }
                .pricing-card-action {
                    margin-top: auto;
                }
                .pricing-btn-free {
                    width: 100%;
                    padding: 0.6rem;
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #64748b;
                    background: #f1f5f9;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    cursor: default;
                }
                .pricing-btn-pro {
                    width: 100%;
                    padding: 0.7rem;
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: #fff;
                    background: #4338ca;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .pricing-btn-pro:hover { background: #3730a3; }
                .pricing-btn-pro:disabled, .pricing-btn-current {
                    background: #94a3b8;
                    cursor: default;
                }
                .pricing-footer-note {
                    text-align: center;
                    font-size: 0.82rem;
                    color: #94a3b8;
                    margin: 1.25rem 0 0;
                }
                @media (max-width: 540px) {
                    .pricing-cards {
                        grid-template-columns: 1fr;
                    }
                    .pricing-modal {
                        padding: 1.5rem 1.25rem;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    };

    // ========================================================================
    // EXPORT
    // ========================================================================

    global.PaddleBilling = PaddleBilling;

})(typeof window !== 'undefined' ? window : this);
