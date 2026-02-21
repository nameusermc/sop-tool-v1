/**
 * Landing Page Module - WithoutMe
 * 
 * Marketing page shown to first-time visitors before the app loads.
 * Explains what the tool does, who it's for, and lets them start immediately.
 * 
 * Core philosophy: No gates, no signup, no demo. Start now.
 * 
 * USAGE: Include before app.js in index.html:
 *   <script src="modules/landing.js"></script>
 * 
 * @module Landing
 * @version 1.0.0
 */

(function(global) {
    'use strict';

    // ========================================================================
    // TEMPLATE DATA
    // ========================================================================

    const TEMPLATE_PREVIEWS = [
        { id: 'tpl_onboarding', icon: '👋', title: 'New Employee Onboarding', desc: 'First day to first week' },
        { id: 'tpl_complaint', icon: '🤝', title: 'Customer Complaint Handling', desc: 'Receive, resolve, follow up' },
        { id: 'tpl_equipment', icon: '🔧', title: 'Equipment Maintenance', desc: 'Routine checks and logging' },
        { id: 'tpl_opening', icon: '🔓', title: 'Daily Opening Procedure', desc: 'Open up right, every day' },
        { id: 'tpl_closing', icon: '🔒', title: 'Daily Closing Procedure', desc: 'Shut down and secure' },
        { id: 'tpl_safety', icon: '⚠️', title: 'Safety Incident Report', desc: 'Respond, document, prevent' },
        { id: 'tpl_service_call', icon: '🚐', title: 'Service Call Walkthrough', desc: 'Arrival to close-out' },
        { id: 'tpl_inventory', icon: '📦', title: 'Inventory & Supply Restock', desc: 'Check, order, restock' },
        { id: 'tpl_vehicle', icon: '🚗', title: 'Vehicle Inspection', desc: 'Pre-trip safety check' },
        { id: 'tpl_followup', icon: '📞', title: 'Customer Follow-Up', desc: 'Check in after service' }
    ];

    // ========================================================================
    // LANDING PAGE CLASS
    // ========================================================================

    function Landing(container, options = {}) {
        this.container = container;
        this.options = options;
        this.callbacks = {
            onStart: null,
            onStartFromTemplate: null
        };
    }

    Landing.prototype.render = function() {
        this._injectStyles();
        this.container.innerHTML = this._buildHTML();
        this._attachEventListeners();
        
        // Trigger entrance animations
        requestAnimationFrame(() => {
            document.querySelector('.landing-page')?.classList.add('landing-visible');
        });
    };

    Landing.prototype.on = function(event, callback) {
        if (this.callbacks.hasOwnProperty(event)) {
            this.callbacks[event] = callback;
        }
        return this;
    };

    Landing.prototype.destroy = function() {
        const style = document.getElementById('landing-styles');
        if (style) style.remove();
    };

    // ========================================================================
    // HTML
    // ========================================================================

    Landing.prototype._buildHTML = function() {
        const templateCards = TEMPLATE_PREVIEWS.map(t => `
            <div class="landing-template-card" data-template-id="${t.id}">
                <span class="landing-template-icon">${t.icon}</span>
                <div class="landing-template-info">
                    <span class="landing-template-title">${t.title}</span>
                    <span class="landing-template-desc">${t.desc}</span>
                </div>
            </div>
        `).join('');

        return `
        <div class="landing-page">

            <!-- HERO -->
            <section class="landing-hero">
                <div class="landing-hero-content">
                    <p class="landing-eyebrow">WithoutMe — Free SOP tool for small teams</p>
                    <h1 class="landing-headline">Stop being the bottleneck.</h1>
                    <p class="landing-subheadline">Turn how you do work into clear steps your team can follow — without&nbsp;you.</p>
                    <div class="landing-hero-actions">
                        <button class="landing-cta-primary" data-action="start-now">Start building your first SOP</button>
                        <p class="landing-cta-note">No signup required. Free to start.</p>
                    </div>
                </div>

                <div class="landing-hero-visual">
                    <div class="landing-preview-card">
                        <div class="landing-preview-header">
                            <span class="landing-preview-status">Active</span>
                            <span class="landing-preview-title">New Hire Onboarding</span>
                        </div>
                        <div class="landing-preview-steps">
                            <div class="landing-preview-step done">
                                <span class="landing-step-check">✓</span>
                                <span>Send welcome email with start date and parking info</span>
                            </div>
                            <div class="landing-preview-step done">
                                <span class="landing-step-check">✓</span>
                                <span>Prepare workspace — desk, equipment, credentials</span>
                            </div>
                            <div class="landing-preview-step active">
                                <span class="landing-step-check"></span>
                                <span>Walk through daily tasks, tools, and who to ask</span>
                            </div>
                            <div class="landing-preview-step">
                                <span class="landing-step-check"></span>
                                <span>Schedule check-in at end of first week</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- PAIN POINTS -->
            <section class="landing-section landing-problems">
                <h2 class="landing-section-title">Sound familiar?</h2>
                <div class="landing-problem-grid">
                    <div class="landing-problem-card">
                        <span class="landing-problem-icon">🔁</span>
                        <p class="landing-problem-text">Your team keeps asking the same questions — and you're always the one answering.</p>
                    </div>
                    <div class="landing-problem-card">
                        <span class="landing-problem-icon">🧠</span>
                        <p class="landing-problem-text">The way things get done lives in your head. If you're not there, work stalls.</p>
                    </div>
                    <div class="landing-problem-card">
                        <span class="landing-problem-icon">🎲</span>
                        <p class="landing-problem-text">Every person does the job a little differently. Quality depends on who shows up.</p>
                    </div>
                    <div class="landing-problem-card">
                        <span class="landing-problem-icon">🐌</span>
                        <p class="landing-problem-text">New hires take forever to get up to speed because there's nothing written down.</p>
                    </div>
                </div>
            </section>

            <!-- HOW IT WORKS -->
            <section class="landing-section landing-how">
                <h2 class="landing-section-title">Write it once. Your team follows it every time.</h2>
                <div class="landing-steps-row">
                    <div class="landing-how-step">
                        <span class="landing-how-number">1</span>
                        <h3 class="landing-how-title">Write your process</h3>
                        <p class="landing-how-desc">Pick a task your business does every day. Break it into clear, numbered steps anyone can follow.</p>
                    </div>
                    <div class="landing-how-arrow">→</div>
                    <div class="landing-how-step">
                        <span class="landing-how-number">2</span>
                        <h3 class="landing-how-title">Share with your team</h3>
                        <p class="landing-how-desc">Send them a link. They click it and see your SOPs immediately — no signup, no app to install.</p>
                    </div>
                    <div class="landing-how-arrow">→</div>
                    <div class="landing-how-step">
                        <span class="landing-how-number">3</span>
                        <h3 class="landing-how-title">Work gets done right</h3>
                        <p class="landing-how-desc">Your team runs through each step as a checklist. Same process, same quality, every&nbsp;time.</p>
                    </div>
                </div>
            </section>

            <!-- TEMPLATES -->
            <section class="landing-section landing-templates">
                <h2 class="landing-section-title">Don't start from scratch</h2>
                <p class="landing-section-subtitle">Pick a template for common tasks. Customize it for your business in minutes.</p>
                <div class="landing-template-grid">
                    ${templateCards}
                </div>
            </section>

            <!-- DIFFERENTIATOR -->
            <section class="landing-section landing-diff">
                <div class="landing-diff-content">
                    <h2 class="landing-diff-title">Every other SOP tool makes you sign up before you see anything.</h2>
                    <p class="landing-diff-body">We don't. Click the button. You're building your first SOP in thirty seconds. Your work saves to your device automatically. Sign up later if you want cloud sync and team sharing — or don't. The tool works either way.</p>
                    <div class="landing-diff-compare">
                        <div class="landing-diff-them">
                            <span class="landing-diff-label">Other tools</span>
                            <span class="landing-diff-item">❌ Sign up first</span>
                            <span class="landing-diff-item">❌ Book a demo</span>
                            <span class="landing-diff-item">❌ $99–$249/mo to start</span>
                        </div>
                        <div class="landing-diff-us">
                            <span class="landing-diff-label">WithoutMe</span>
                            <span class="landing-diff-item">✅ Start immediately</span>
                            <span class="landing-diff-item">✅ No account needed</span>
                            <span class="landing-diff-item">✅ Free to use</span>
                        </div>
                    </div>
                </div>
            </section>

            <!-- AUDIENCE -->
            <section class="landing-section landing-audience">
                <h2 class="landing-section-title">Built for businesses that do real work</h2>
                <p class="landing-section-subtitle">HVAC, plumbing, cleaning, landscaping, electrical, pest control — if your team does the same tasks every day, this tool is for&nbsp;you.</p>
            </section>

            <!-- PRICING -->
            <section class="landing-section landing-pricing">
                <h2 class="landing-section-title">Simple pricing</h2>
                <p class="landing-section-subtitle">Start free. Upgrade when you're ready to share with your team.</p>
                <div class="landing-pricing-cards">
                    <div class="landing-price-card">
                        <h3 class="landing-price-name">Free</h3>
                        <div class="landing-price-amount">$0</div>
                        <ul class="landing-price-features">
                            <li>Unlimited SOPs</li>
                            <li>All templates</li>
                            <li>PDF export</li>
                            <li>Works offline</li>
                        </ul>
                        <button class="landing-cta-primary" data-action="start-now" style="background:#475569;">Start free</button>
                    </div>
                    <div class="landing-price-card landing-price-card-pro">
                        <div class="landing-price-badge">Most popular</div>
                        <h3 class="landing-price-name">Pro</h3>
                        <div class="landing-price-amount">$39<span class="landing-price-period">/mo</span></div>
                        <ul class="landing-price-features">
                            <li>Everything in Free</li>
                            <li><strong>Team access — share via link</strong></li>
                            <li><strong>Cloud sync — access anywhere</strong></li>
                            <li>Unlimited team members</li>
                        </ul>
                        <button class="landing-cta-primary" data-action="start-now">Start free, upgrade later</button>
                    </div>
                </div>
                <p class="landing-pricing-note">Cancel anytime. Your SOPs stay yours even if you downgrade.</p>
            </section>

            <!-- FINAL CTA -->
            <section class="landing-section landing-final-cta">
                <h2 class="landing-final-title">Ready to stop repeating yourself?</h2>
                <p class="landing-final-subtitle">Your first SOP takes about three minutes.</p>
                <button class="landing-cta-primary" data-action="start-now">Start now — it's free</button>
                <p class="landing-cta-note">No credit card. No signup. Just start.</p>
            </section>

            <!-- FOOTER -->
            <footer class="landing-footer">
                <div class="landing-footer-links">
                    <a href="/pricing">Pricing</a>
                    <a href="/terms">Terms</a>
                    <a href="/privacy">Privacy</a>
                    <a href="/refund">Refund Policy</a>
                </div>
                <p>© 2026 WithoutMe</p>
            </footer>

        </div>
        `;
    };

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    Landing.prototype._attachEventListeners = function() {
        // Start now buttons
        this.container.querySelectorAll('[data-action="start-now"]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.callbacks.onStart) {
                    this.callbacks.onStart();
                }
            });
        });

        // Template card clicks — start with that template
        this.container.querySelectorAll('.landing-template-card').forEach(card => {
            card.addEventListener('click', () => {
                const templateId = card.dataset.templateId;
                if (this.callbacks.onStartFromTemplate) {
                    this.callbacks.onStartFromTemplate(templateId);
                } else if (this.callbacks.onStart) {
                    this.callbacks.onStart();
                }
            });
        });
    };

    // ========================================================================
    // STYLES
    // ========================================================================

    Landing.prototype._injectStyles = function() {
        if (document.getElementById('landing-styles')) return;

        const style = document.createElement('style');
        style.id = 'landing-styles';
        style.textContent = `
            /* ============================================================
               LANDING PAGE STYLES
               ============================================================ */

            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');

            .landing-page {
                font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                color: #1a1a2e;
                line-height: 1.6;
                overflow-x: hidden;
                opacity: 0;
                transition: opacity 0.4s ease;
            }

            .landing-visible {
                opacity: 1;
            }

            /* ---- HERO ---- */

            .landing-hero {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 3rem;
                align-items: center;
                max-width: 1100px;
                margin: 0 auto;
                padding: 4rem 2rem 3rem;
                min-height: 70vh;
            }

            .landing-eyebrow {
                font-size: 0.85rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: #6366f1;
                margin: 0 0 1rem 0;
            }

            .landing-headline {
                font-size: clamp(2.2rem, 4.5vw, 3.2rem);
                font-weight: 700;
                line-height: 1.1;
                margin: 0 0 1rem 0;
                color: #0f172a;
            }

            .landing-subheadline {
                font-size: 1.2rem;
                color: #475569;
                margin: 0 0 2rem 0;
                max-width: 480px;
                line-height: 1.5;
            }

            .landing-hero-actions {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .landing-cta-primary {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0.9rem 2rem;
                font-size: 1.05rem;
                font-weight: 600;
                font-family: inherit;
                color: #fff;
                background: #4338ca;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                width: fit-content;
            }

            .landing-cta-primary:hover {
                background: #3730a3;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(67, 56, 202, 0.3);
            }

            .landing-cta-primary:active {
                transform: translateY(0);
            }

            .landing-cta-note {
                font-size: 0.82rem;
                color: #94a3b8;
                margin: 0;
            }

            /* ---- HERO VISUAL ---- */

            .landing-hero-visual {
                display: flex;
                justify-content: center;
            }

            .landing-preview-card {
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 1.5rem;
                width: 100%;
                max-width: 380px;
                box-shadow: 0 8px 30px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
            }

            .landing-preview-header {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-bottom: 1.25rem;
                padding-bottom: 1rem;
                border-bottom: 1px solid #f1f5f9;
            }

            .landing-preview-status {
                font-size: 0.7rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: #16a34a;
                background: #f0fdf4;
                padding: 0.2rem 0.6rem;
                border-radius: 4px;
            }

            .landing-preview-title {
                font-weight: 600;
                font-size: 1rem;
                color: #0f172a;
            }

            .landing-preview-steps {
                display: flex;
                flex-direction: column;
                gap: 0.6rem;
            }

            .landing-preview-step {
                display: flex;
                align-items: flex-start;
                gap: 0.6rem;
                font-size: 0.88rem;
                color: #64748b;
                line-height: 1.4;
            }

            .landing-preview-step.done {
                color: #94a3b8;
                text-decoration: line-through;
                text-decoration-color: #cbd5e1;
            }

            .landing-preview-step.active {
                color: #1e293b;
                font-weight: 500;
            }

            .landing-step-check {
                width: 20px;
                height: 20px;
                min-width: 20px;
                border-radius: 4px;
                border: 2px solid #e2e8f0;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.7rem;
                margin-top: 1px;
            }

            .landing-preview-step.done .landing-step-check {
                background: #4338ca;
                border-color: #4338ca;
                color: #fff;
            }

            .landing-preview-step.active .landing-step-check {
                border-color: #4338ca;
            }

            /* ---- SECTIONS ---- */

            .landing-section {
                max-width: 1100px;
                margin: 0 auto;
                padding: 4rem 2rem;
            }

            .landing-section-title {
                font-size: clamp(1.5rem, 3vw, 2rem);
                font-weight: 700;
                text-align: center;
                margin: 0 0 0.75rem 0;
                color: #0f172a;
            }

            .landing-section-subtitle {
                text-align: center;
                color: #64748b;
                font-size: 1.05rem;
                margin: 0 0 2.5rem 0;
                max-width: 560px;
                margin-left: auto;
                margin-right: auto;
            }

            /* ---- PROBLEMS ---- */

            .landing-problems {
                background: #f8fafc;
                max-width: none;
                padding: 4rem 2rem;
            }

            .landing-problem-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 1.25rem;
                max-width: 800px;
                margin: 2rem auto 0;
            }

            .landing-problem-card {
                display: flex;
                align-items: flex-start;
                gap: 0.75rem;
                padding: 1.25rem;
                background: #fff;
                border-radius: 10px;
                border: 1px solid #e2e8f0;
            }

            .landing-problem-icon {
                font-size: 1.3rem;
                flex-shrink: 0;
                margin-top: 2px;
            }

            .landing-problem-text {
                font-size: 0.95rem;
                color: #334155;
                margin: 0;
                line-height: 1.5;
            }

            /* ---- HOW IT WORKS ---- */

            .landing-steps-row {
                display: flex;
                align-items: flex-start;
                gap: 1rem;
                margin-top: 2.5rem;
            }

            .landing-how-step {
                flex: 1;
                text-align: center;
            }

            .landing-how-number {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: #4338ca;
                color: #fff;
                font-weight: 700;
                font-size: 1.1rem;
                margin-bottom: 0.75rem;
            }

            .landing-how-title {
                font-size: 1.1rem;
                font-weight: 600;
                margin: 0 0 0.5rem 0;
                color: #0f172a;
            }

            .landing-how-desc {
                font-size: 0.92rem;
                color: #64748b;
                margin: 0;
                line-height: 1.5;
                padding: 0 0.5rem;
            }

            .landing-how-arrow {
                font-size: 1.5rem;
                color: #cbd5e1;
                padding-top: 0.5rem;
                flex-shrink: 0;
            }

            /* ---- TEMPLATES ---- */

            .landing-templates {
                background: #f8fafc;
                max-width: none;
                padding: 4rem 2rem;
            }

            .landing-template-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 0.75rem;
                max-width: 700px;
                margin: 0 auto;
            }

            .landing-template-card {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.9rem 1rem;
                background: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .landing-template-card:hover {
                border-color: #a5b4fc;
                background: #fafafe;
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(99, 102, 241, 0.08);
            }

            .landing-template-icon {
                font-size: 1.3rem;
                flex-shrink: 0;
            }

            .landing-template-info {
                display: flex;
                flex-direction: column;
                gap: 0.1rem;
            }

            .landing-template-title {
                font-size: 0.88rem;
                font-weight: 600;
                color: #1e293b;
            }

            .landing-template-desc {
                font-size: 0.78rem;
                color: #94a3b8;
            }

            /* ---- DIFFERENTIATOR ---- */

            .landing-diff {
                padding: 4rem 2rem;
            }

            .landing-diff-content {
                max-width: 700px;
                margin: 0 auto;
                text-align: center;
            }

            .landing-diff-title {
                font-size: clamp(1.3rem, 2.5vw, 1.6rem);
                font-weight: 700;
                color: #0f172a;
                margin: 0 0 1rem 0;
                line-height: 1.3;
            }

            .landing-diff-body {
                font-size: 1rem;
                color: #475569;
                margin: 0 0 2rem 0;
                line-height: 1.6;
            }

            .landing-diff-compare {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1rem;
                max-width: 480px;
                margin: 0 auto;
            }

            .landing-diff-them, .landing-diff-us {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                padding: 1.25rem;
                border-radius: 10px;
                text-align: left;
            }

            .landing-diff-them {
                background: #fef2f2;
                border: 1px solid #fecaca;
            }

            .landing-diff-us {
                background: #f0fdf4;
                border: 1px solid #bbf7d0;
            }

            .landing-diff-label {
                font-size: 0.78rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                color: #64748b;
                margin-bottom: 0.25rem;
            }

            .landing-diff-item {
                font-size: 0.9rem;
                color: #334155;
            }

            /* ---- PRICING ---- */

            .landing-pricing {
                padding: 4rem 2rem;
            }

            .landing-pricing-cards {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1.25rem;
                max-width: 580px;
                margin: 0 auto;
            }

            .landing-price-card {
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 1.75rem 1.5rem;
                display: flex;
                flex-direction: column;
                background: #fff;
                position: relative;
            }

            .landing-price-card-pro {
                border-color: #4338ca;
                border-width: 2px;
            }

            .landing-price-badge {
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
                white-space: nowrap;
            }

            .landing-price-name {
                font-size: 1.1rem;
                font-weight: 600;
                margin: 0 0 0.25rem;
                color: #1e293b;
            }

            .landing-price-amount {
                font-size: 2.2rem;
                font-weight: 700;
                color: #0f172a;
                margin-bottom: 1rem;
            }

            .landing-price-period {
                font-size: 0.95rem;
                font-weight: 400;
                color: #64748b;
            }

            .landing-price-features {
                list-style: none;
                padding: 0;
                margin: 0 0 1.5rem;
                display: flex;
                flex-direction: column;
                gap: 0.4rem;
                flex: 1;
            }

            .landing-price-features li {
                font-size: 0.88rem;
                color: #334155;
                line-height: 1.4;
            }

            .landing-price-card .landing-cta-primary {
                width: 100%;
                padding: 0.7rem;
                font-size: 0.92rem;
            }

            .landing-pricing-note {
                text-align: center;
                font-size: 0.82rem;
                color: #94a3b8;
                margin: 1.25rem 0 0;
            }

            /* ---- AUDIENCE ---- */

            .landing-audience {
                background: #f8fafc;
                max-width: none;
                text-align: center;
                padding: 3rem 2rem;
            }

            .landing-audience .landing-section-subtitle {
                margin-bottom: 0;
            }

            /* ---- FINAL CTA ---- */

            .landing-final-cta {
                text-align: center;
                padding: 4rem 2rem 3rem;
            }

            .landing-final-title {
                font-size: clamp(1.5rem, 3vw, 2rem);
                font-weight: 700;
                margin: 0 0 0.5rem 0;
                color: #0f172a;
            }

            .landing-final-subtitle {
                font-size: 1.05rem;
                color: #64748b;
                margin: 0 0 1.5rem 0;
            }

            .landing-final-cta .landing-cta-primary {
                margin: 0 auto;
                padding: 1rem 2.5rem;
                font-size: 1.1rem;
            }

            .landing-final-cta .landing-cta-note {
                margin-top: 0.5rem;
            }

            /* ---- FOOTER ---- */

            .landing-footer {
                text-align: center;
                padding: 2rem;
                border-top: 1px solid #e2e8f0;
                color: #94a3b8;
                font-size: 0.85rem;
            }

            .landing-footer p { margin: 0.5rem 0 0; }

            .landing-footer-links {
                display: flex;
                justify-content: center;
                gap: 1.5rem;
                margin-bottom: 0.25rem;
            }

            .landing-footer-links a {
                color: #64748b;
                text-decoration: none;
                font-size: 0.82rem;
            }

            .landing-footer-links a:hover {
                color: #4338ca;
            }

            /* ============================================================
               MOBILE
               ============================================================ */

            @media (max-width: 768px) {
                .landing-hero {
                    grid-template-columns: 1fr;
                    padding: 2.5rem 1.5rem 2rem;
                    min-height: auto;
                    gap: 2rem;
                }

                .landing-hero-visual {
                    order: -1;
                }

                .landing-preview-card {
                    max-width: 340px;
                }

                .landing-section {
                    padding: 3rem 1.5rem;
                }

                .landing-problem-grid {
                    grid-template-columns: 1fr;
                }

                .landing-steps-row {
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                }

                .landing-how-arrow {
                    transform: rotate(90deg);
                    padding: 0;
                }

                .landing-how-step {
                    max-width: 320px;
                }

                .landing-template-grid {
                    grid-template-columns: 1fr;
                }

                .landing-pricing-cards {
                    grid-template-columns: 1fr;
                    max-width: 340px;
                }

                .landing-diff-compare {
                    grid-template-columns: 1fr;
                }

                .landing-cta-primary {
                    width: 100%;
                }
            }
        `;

        document.head.appendChild(style);
    };

    // ========================================================================
    // EXPORT
    // ========================================================================

    global.Landing = Landing;

})(typeof window !== 'undefined' ? window : this);
