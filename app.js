/**
 * SOP Tool - Main Application Controller
 * 
 * This file integrates all modules (Dashboard, SOPCreate, etc.) and handles:
 * - View switching between Dashboard and Editor
 * - Button click handlers
 * - Module instantiation and callbacks
 * - Navigation state management
 * 
 * Features:
 * - Folder management (create, edit, delete folders)
 * - Sorting and filtering SOPs
 * - Recently edited highlighting
 * - Collapsible folder sections
 * 
 * USAGE:
 * Include after all module scripts in index.html:
 *   <script src="modules/dashboard.js"></script>
 *   <script src="modules/sop-create.js"></script>
 *   <script src="app.js"></script>
 * 
 * @version 2.1.0
 */

(function() {
    'use strict';

    // ========================================================================
    // APPLICATION STATE
    // ========================================================================

    /**
     * Application state object
     * Tracks current view, module instances, and navigation history
     */
    const AppState = {
        currentView: 'dashboard',  // 'landing' | 'dashboard' | 'create' | 'edit' | 'checklist'
        previousView: null,
        
        // Module instances (lazy-loaded)
        modules: {
            dashboard: null,
            editor: null,
            checklist: null,
            folders: null
        },
        
        // Currently selected SOP for editing
        currentSOP: null,
        
        // Currently active checklist
        currentChecklistId: null,
        
        // App container element
        container: null,
        
        // Team state
        teamRole: null,  // { role: 'owner'|'member'|'solo', teamId, teamName, ownerId }
        activeInviteCode: null,  // For link-based team access refresh
        
        // Initialization status
        initialized: false
    };

    // ========================================================================
    // VIEW MANAGEMENT
    // ========================================================================

    /**
     * Show the Dashboard view
     * Creates Dashboard instance if not exists, then renders it
     */
    function showDashboard() {
        console.log('📊 Switching to Dashboard view');
        
        AppState.previousView = AppState.currentView;
        AppState.currentView = 'dashboard';
        AppState.currentSOP = null;
        
        // Check if Dashboard class exists
        if (typeof Dashboard !== 'function') {
            console.error('Dashboard module not loaded! Make sure dashboard.js is included before app.js');
            AppState.container.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: #dc2626;">
                    <h2>Error: Dashboard module not found</h2>
                    <p>Make sure <code>dashboard.js</code> is included before <code>app.js</code></p>
                </div>
            `;
            return;
        }
        
        // Create or refresh Dashboard
        if (!AppState.modules.dashboard) {
            console.log('Creating new Dashboard instance');
            AppState.modules.dashboard = new Dashboard(AppState.container, {
                showMostUsed: true,
                enableFolderManagement: true,
                enableSorting: true,
                enableFiltering: true,
                highlightRecentEdits: true,
                autoRender: true,
                teamRole: AppState.teamRole || null,
                teamSOPs: AppState.teamSOPs || null
            });
            
            // Register Dashboard callbacks
            setupDashboardCallbacks();
        } else {
            // Update team role in case it changed (e.g., after accepting invite)
            if (AppState.teamRole) {
                AppState.modules.dashboard.options.teamRole = AppState.teamRole;
            }
            console.log('Refreshing existing Dashboard');
            AppState.modules.dashboard.refresh();
        }
    }

    /**
     * Check if the user hasn't saved any SOPs yet (first-SOP experience).
     */
    function isFirstSOP() {
        try {
            const sops = JSON.parse(localStorage.getItem('sop_tool_sops') || '[]');
            return sops.length === 0;
        } catch (e) { return false; }
    }

    /**
     * Show the SOP Create/Edit view
     * @param {Object|null} sop - SOP to edit, or null for create mode
     */
    function showEditor(sop = null, createOptions = {}) {
        const mode = sop ? 'edit' : 'create';
        console.log(`📝 Switching to Editor view (mode: ${mode})`);
        
        // For first SOP creation, default status to Active (skip Draft concept)
        const firstSOP = !sop && isFirstSOP();
        if (firstSOP && !createOptions.status) {
            createOptions.status = 'active';
        }
        
        AppState.previousView = AppState.currentView;
        AppState.currentView = mode;
        AppState.currentSOP = sop;
        
        // Check if SOPCreate class exists
        if (typeof SOPCreate !== 'function') {
            console.error('SOPCreate module not loaded! Make sure sop-create.js is included before app.js');
            AppState.container.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: #dc2626;">
                    <h2>Error: SOPCreate module not found</h2>
                    <p>Make sure <code>sop-create.js</code> is included before <code>app.js</code></p>
                </div>
            `;
            return;
        }
        
        // Create Editor instance if not exists
        if (!AppState.modules.editor) {
            console.log('Creating new SOPCreate instance');
            AppState.modules.editor = new SOPCreate(AppState.container, {
                enableAIFeatures: true,
                autoSaveDrafts: true,
                autoRender: false  // We'll render manually after setting up callbacks
            });
            
            // Register Editor callbacks
            setupEditorCallbacks();
        }
        
        // Open in appropriate mode
        if (sop) {
            console.log('Opening editor in EDIT mode for SOP:', sop.id);
            AppState.modules.editor.edit(sop);
        } else {
            console.log('Opening editor in CREATE mode');
            AppState.modules.editor.create(createOptions);
        }
        
        // Inject first-SOP welcome hint (after editor renders)
        if (firstSOP) {
            injectFirstSOPHint();
        }
    }

    /**
     * Show the Checklist view
     * @param {Object|string} sopOrChecklistId - SOP object to start new checklist, or checklist ID to resume
     * @param {boolean} isResume - True if resuming an existing checklist
     */
    function showChecklist(sopOrChecklistId, isResume = false) {
        // Validate input
        if (!sopOrChecklistId) {
            console.error('showChecklist: Missing required parameter sopOrChecklistId');
            showDashboard();
            return;
        }
        
        // For new checklists, validate SOP object
        if (!isResume && (typeof sopOrChecklistId !== 'object' || !sopOrChecklistId.id)) {
            console.error('showChecklist: Invalid SOP object for new checklist:', sopOrChecklistId);
            showDashboard();
            return;
        }
        
        // For resume, validate checklist ID is a string
        if (isResume && typeof sopOrChecklistId !== 'string') {
            console.error('showChecklist: Invalid checklist ID for resume:', sopOrChecklistId);
            showDashboard();
            return;
        }
        
        console.log(`📋 Switching to Checklist view (${isResume ? 'resume' : 'new'})`);
        
        AppState.previousView = AppState.currentView;
        AppState.currentView = 'checklist';
        
        // Check if Checklist class exists
        if (typeof Checklist !== 'function') {
            console.error('Checklist module not loaded! Make sure checklist.js is included before app.js');
            AppState.container.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: #dc2626;">
                    <h2>Error: Checklist module not found</h2>
                    <p>Make sure <code>checklist.js</code> is included before <code>app.js</code></p>
                </div>
            `;
            return;
        }
        
        // Create Checklist instance if not exists
        if (!AppState.modules.checklist) {
            console.log('Creating new Checklist instance');
            AppState.modules.checklist = new Checklist(AppState.container, {
                autoSave: true,
                showNotes: true,
                showTimestamps: true
            });
            
            // Register Checklist callbacks
            setupChecklistCallbacks();
        }
        
        // Start or resume checklist
        if (isResume) {
            console.log('Resuming checklist:', sopOrChecklistId);
            AppState.currentChecklistId = sopOrChecklistId;
            AppState.modules.checklist.resumeChecklist(sopOrChecklistId);
        } else {
            console.log('Starting new checklist from SOP:', sopOrChecklistId.id, '(' + sopOrChecklistId.title + ')');
            AppState.modules.checklist.startFromSOP(sopOrChecklistId.id);
        }
    }

    /**
     * Show a completed checklist in read-only view mode
     * @param {string} checklistId - ID of the completed checklist to view
     */
    function showCompletedChecklist(checklistId) {
        // Validate input
        if (!checklistId || typeof checklistId !== 'string') {
            console.error('showCompletedChecklist: Invalid checklist ID:', checklistId);
            showDashboard();
            return;
        }
        
        console.log('👁️ Switching to Checklist view (read-only)');
        
        AppState.previousView = AppState.currentView;
        AppState.currentView = 'checklist';
        
        // Check if Checklist class exists
        if (typeof Checklist !== 'function') {
            console.error('Checklist module not loaded!');
            AppState.container.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: #dc2626;">
                    <h2>Error: Checklist module not found</h2>
                    <p>Make sure <code>checklist.js</code> is included before <code>app.js</code></p>
                </div>
            `;
            return;
        }
        
        // Create Checklist instance if not exists
        if (!AppState.modules.checklist) {
            console.log('Creating new Checklist instance');
            AppState.modules.checklist = new Checklist(AppState.container, {
                autoSave: true,
                showNotes: true,
                showTimestamps: true
            });
            
            // Register Checklist callbacks
            setupChecklistCallbacks();
        }
        
        // View completed checklist in read-only mode
        console.log('Viewing completed checklist:', checklistId);
        AppState.currentChecklistId = checklistId;
        AppState.modules.checklist.viewCompleted(checklistId);
    }

    // ========================================================================
    // CALLBACK SETUP
    // ========================================================================

    /**
     * Setup Dashboard callbacks for integration with other modules
     */
    function setupDashboardCallbacks() {
        const dashboard = AppState.modules.dashboard;
        
        if (!dashboard) {
            console.error('Cannot setup callbacks: Dashboard not initialized');
            return;
        }
        
        // Handle "Create New SOP" button click
        dashboard.on('onCreateSOP', (options = {}) => {
            console.log('🆕 Create New SOP clicked', options.folderId ? `(folder: ${options.folderId})` : '');
            showEditor(null, options);  // null = create mode, pass all options (folder, template data, etc.)
        });
        
        // Handle SOP edit
        dashboard.on('onEditSOP', (sop) => {
            console.log('✏️ Edit SOP clicked:', sop.title);
            showEditor(sop);
        });
        
        // Handle SOP delete
        dashboard.on('onDeleteSOP', (sop) => {
            console.log('🗑️ SOP deleted:', sop.title);
            // Delete from cloud if authenticated
            const isAuth = StorageAdapter?.Auth?.isAuthenticated?.() || false;
            if (isAuth && typeof SupabaseClient !== 'undefined') {
                SupabaseClient.deleteSOP(sop).then(result => {
                    if (result.success) {
                        console.log('🗑️ SOP deleted from cloud:', sop.title);
                    } else {
                        console.warn('🗑️ Cloud delete failed:', result.error);
                    }
                });
            }
        });
        
        // Handle Run Checklist button
        dashboard.on('onRunChecklist', (sop) => {
            console.log('✅ Run Checklist clicked for:', sop.title);
            showChecklist(sop, false);
        });
        
        // Handle Resume Checklist
        dashboard.on('onResumeChecklist', (checklistId) => {
            console.log('▶️ Resume Checklist clicked:', checklistId);
            showChecklist(checklistId, true);
        });
        
        // Handle View Completed Checklist
        dashboard.on('onViewCompletedChecklist', (checklistId) => {
            console.log('👁️ View Completed Checklist clicked:', checklistId);
            showCompletedChecklist(checklistId);
        });
        
        console.log('✅ Dashboard callbacks registered');
    }

    /**
     * Setup Checklist callbacks
     */
    function setupChecklistCallbacks() {
        const checklist = AppState.modules.checklist;
        
        if (!checklist) {
            console.error('Cannot setup callbacks: Checklist not initialized');
            return;
        }
        
        // Handle back navigation
        checklist.on('onBack', () => {
            console.log('← Returning to Dashboard from Checklist');
            showDashboard();
        });
        
        // Handle checklist completion
        checklist.on('onComplete', (completedChecklist) => {
            console.log('🎉 Checklist completed:', completedChecklist.sopTitle);
        });
        
        console.log('✅ Checklist callbacks registered');
    }

    /**
     * Setup SOPCreate/Editor callbacks
     */
    function setupEditorCallbacks() {
        const editor = AppState.modules.editor;
        
        if (!editor) {
            console.error('Cannot setup callbacks: Editor not initialized');
            return;
        }
        
        // Handle Save - return to Dashboard and refresh
        editor.on('onSave', (sop) => {
            console.log('💾 SOP saved:', sop.title, '(ID:', sop.id + ')');
            
            // Detect first SOP save (before persisting, check count)
            const wasFirstSOP = !localStorage.getItem('sop_tool_first_sop_saved');
            
            // CRITICAL: Ensure SOP is saved via StorageAdapter for cloud sync
            // This is a safety net in case the localStorage override isn't working
            console.log('[app.js] Ensuring SOP is persisted via StorageAdapter...');
            
            try {
                // Get current SOPs from StorageAdapter
                const currentSops = StorageAdapter.getSops();
                console.log('[app.js] Current SOPs from StorageAdapter:', currentSops.length);
                
                // Check if this SOP already exists (by ID)
                const existingIndex = currentSops.findIndex(s => s.id === sop.id);
                
                if (existingIndex !== -1) {
                    // Update existing
                    currentSops[existingIndex] = sop;
                    console.log('[app.js] Updated existing SOP at index:', existingIndex);
                } else {
                    // Add new
                    currentSops.push(sop);
                    console.log('[app.js] Added new SOP, total count:', currentSops.length);
                }
                
                // Save via StorageAdapter (this triggers cloud sync if authenticated)
                console.log('[app.js] Calling StorageAdapter.saveSops() with', currentSops.length, 'SOPs');
                StorageAdapter.saveSops(currentSops);
                console.log('[app.js] StorageAdapter.saveSops() call COMPLETE');
                
            } catch (e) {
                console.error('[app.js] Error saving via StorageAdapter:', e);
            }
            
            // Show success message (optional, editor already shows notification)
            console.log('Returning to Dashboard...');
            
            // First SOP: show celebration interstitial
            if (wasFirstSOP) {
                localStorage.setItem('sop_tool_first_sop_saved', '1');
                showFirstSOPCelebration(sop);
                return;
            }
            
            // Return to Dashboard and refresh to show new/updated SOP
            showDashboard();
            
            // After first SOP creation, gently suggest sign-in
            setTimeout(maybeShowSignInReminder, 300);
        });
        
        // Handle Cancel - return to Dashboard without saving
        editor.on('onCancel', () => {
            console.log('❌ Editor cancelled, returning to Dashboard');
            showDashboard();
        });
        
        // Handle Delete - return to Dashboard after deletion
        editor.on('onDelete', (sop) => {
            console.log('🗑️ SOP deleted from editor:', sop.title);
            showDashboard();
        });
        
        // Handle form changes (optional, for auto-save indicators, etc.)
        editor.on('onChange', (formData) => {
            // Could update a "unsaved changes" indicator here
            // console.log('Form changed:', formData.title);
        });
        
        console.log('✅ Editor callbacks registered');
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize the application
     * Called when DOM is ready
     */
    async function initApp() {
        console.log('🚀 Initializing SOP Tool Application');
        
        // Get the main container
        AppState.container = document.getElementById('app');
        
        if (!AppState.container) {
            console.error('App container not found! Make sure you have <div id="app"></div> in your HTML');
            return;
        }
        
        // Hide static fallback content (visible for crawlers, replaced by JS app)
        const staticFallback = document.getElementById('static-fallback');
        if (staticFallback) staticFallback.style.display = 'none';
        const staticFooter = document.getElementById('static-footer');
        if (staticFooter) staticFooter.style.display = 'none';
        
        // Check for invite code in URL (link-based team access — no auth required)
        const urlParams = new URLSearchParams(window.location.search);
        const inviteCode = urlParams.get('invite');
        
        if (inviteCode && typeof SupabaseClient !== 'undefined' && SupabaseClient) {
            console.log('🔗 Invite link detected — loading team view...');
            // Clean URL without reload
            window.history.replaceState({}, '', window.location.pathname);
            
            await initTeamLinkAccess(inviteCode);
            return;  // Team link view is self-contained, skip normal init
        }
        
        // Not a team link session — clear any stale invite code
        localStorage.removeItem('withoutme_team_invite_code');
        
        // Check for required modules
        const modulesLoaded = {
            Dashboard: typeof Dashboard === 'function',
            SOPCreate: typeof SOPCreate === 'function',
            Checklist: typeof Checklist === 'function'
        };
        
        console.log('Module status:', modulesLoaded);
        
        if (!modulesLoaded.Dashboard) {
            console.warn('⚠️ Dashboard module not loaded');
        }
        
        if (!modulesLoaded.SOPCreate) {
            console.warn('⚠️ SOPCreate module not loaded');
        }
        
        if (!modulesLoaded.Checklist) {
            console.warn('⚠️ Checklist module not loaded');
        }
        
        // Initialize auth state (check for existing session)
        if (typeof StorageAdapter !== 'undefined' && StorageAdapter.Auth) {
            console.log('🔐 Checking auth session...');
            await StorageAdapter.Auth.init();
            
            if (StorageAdapter.Auth.isAuthenticated()) {
                const user = StorageAdapter.Auth.getUser();
                console.log('✅ Logged in as:', user?.email);
                
                // Check team role for authenticated users
                await checkTeamRole();
                
                // Sync subscription state from server (restores Pro even if localStorage was cleared)
                if (typeof PaddleBilling !== 'undefined' && user?.email) {
                    await PaddleBilling.syncFromServer(user.email);
                }
                
                // Sync business type from Supabase → localStorage
                if (typeof SupabaseClient !== 'undefined' && SupabaseClient) {
                    try {
                        const bizType = await SupabaseClient.getBusinessType();
                        if (bizType) {
                            localStorage.setItem('withoutme_business_type', bizType);
                        }
                    } catch (e) { /* ignore */ }
                    
                    // Sync digest opt-out from Supabase → localStorage
                    try {
                        const digestOptOut = await SupabaseClient.getDigestOptOut();
                        if (digestOptOut) {
                            localStorage.setItem('withoutme_digest_optout', '1');
                        } else {
                            localStorage.removeItem('withoutme_digest_optout');
                        }
                    } catch (e) { /* ignore */ }

                    // Sync webhook URL from Supabase → localStorage (Phase 12G)
                    try {
                        const wUrl = await SupabaseClient.getWebhookUrl();
                        localStorage.setItem('withoutme_webhook_url', wUrl || '');
                    } catch (e) { /* ignore */ }
                }
            } else {
                console.log('👤 Running in local-only mode');
            }
        }
        
        // Initialize Paddle billing
        if (typeof PaddleBilling !== 'undefined') {
            PaddleBilling.init();
        }
        
        // Check if arriving from a template page with ?import= param
        const importParams = new URLSearchParams(window.location.search);
        const importData = importParams.get('import');
        if (importData) {
            try {
                const decoded = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(importData)))));
                console.log('📄 Importing template from URL:', decoded.title);
                
                // Clean URL immediately
                history.replaceState(null, '', '/');
                
                // Mark as onboarded so landing doesn't show next time
                localStorage.setItem('sop_tool_onboarded', '1');
                
                // Initialize dashboard (needed for editor callbacks)
                showDashboard();
                injectAuthUI();
                
                // Open editor with the imported template data
                showEditor(null, {
                    title: decoded.title || '',
                    description: decoded.description || '',
                    steps: (decoded.steps || []).map(s => ({ text: s.text || '', note: '' })),
                    folderId: 'general',
                    tags: decoded.tags || []
                });
                
                AppState.initialized = true;
                return;
            } catch (e) {
                console.warn('⚠️ Failed to decode import data:', e);
                // Fall through to normal init
            }
        }
        
        // Check if this is a new visitor who should see the landing page
        if (shouldShowLanding()) {
            console.log('🏠 New visitor — showing landing page');
            showLanding();
            AppState.initialized = true;
            return;
        }
        
        // Start with Dashboard view
        showDashboard();
        
        // Inject auth UI
        injectAuthUI();
        
        AppState.initialized = true;
        console.log('✅ SOP Tool Application initialized');
    }
    
    /**
     * Determine if the landing page should be shown.
     * Returns true for new visitors who haven't created SOPs or been onboarded.
     */
    function shouldShowLanding() {
        // Don't show landing if the module isn't loaded
        if (typeof Landing !== 'function') return false;
        
        // Always show if ?home param is present (returning visitor wants to see landing)
        const params = new URLSearchParams(window.location.search);
        if (params.has('home')) {
            // Clean URL so bookmarking doesn't force landing every time
            history.replaceState(null, '', window.location.pathname);
            return true;
        }
        
        // Don't show if user is logged in
        if (StorageAdapter?.Auth?.isAuthenticated?.()) return false;
        
        // Don't show if user has been onboarded before
        if (localStorage.getItem('sop_tool_onboarded')) return false;
        
        // Don't show if user already has SOPs
        try {
            const sops = JSON.parse(localStorage.getItem('sop_tool_sops') || '[]');
            if (sops.length > 0) return false;
        } catch (e) { /* empty = show landing */ }
        
        return true;
    }
    
    /**
     * Show the landing page for new visitors.
     */
    function showLanding() {
        AppState.currentView = 'landing';
        
        const landing = new Landing(AppState.container);
        
        landing.on('onStart', () => {
            // Mark as onboarded so landing doesn't show again
            localStorage.setItem('sop_tool_onboarded', '1');
            
            // Clean up landing
            landing.destroy();
            
            // Initialize the app normally
            showDashboard();
            injectAuthUI();
            
            console.log('✅ Transitioned from landing to app');
        });
        
        landing.on('onStartFromTemplate', (templateId) => {
            // Mark as onboarded so landing doesn't show again
            localStorage.setItem('sop_tool_onboarded', '1');
            
            // Clean up landing
            landing.destroy();
            
            // Initialize the dashboard (needed for template data + callbacks)
            showDashboard();
            injectAuthUI();
            
            // Trigger template selection on the dashboard
            // _selectTemplate finds the template, calls onCreateSOP → opens editor
            if (AppState.modules.dashboard && AppState.modules.dashboard._selectTemplate) {
                console.log('📄 Starting from template:', templateId);
                AppState.modules.dashboard._selectTemplate(templateId);
            }
        });
        
        landing.render();
    }

    /**
     * Inject a welcome hint into the editor for first-SOP creation.
     * Dismisses when the user focuses the title field.
     */
    function injectFirstSOPHint() {
        const main = document.querySelector('.sop-create-main');
        if (!main) return;
        
        const hint = document.createElement('div');
        hint.id = 'first-sop-hint';
        hint.className = 'first-sop-hint';
        hint.innerHTML = `
            <p><strong>You're creating your first SOP.</strong> Pick a task your team does regularly, add a few steps, and save. That's it — your team can follow this without you.</p>
        `;
        
        main.insertBefore(hint, main.firstChild);
        
        // Dismiss on title focus
        const titleInput = document.getElementById('sop-title');
        if (titleInput) {
            const dismiss = () => {
                hint.style.opacity = '0';
                hint.style.transform = 'translateY(-8px)';
                setTimeout(() => hint.remove(), 300);
                titleInput.removeEventListener('focus', dismiss);
            };
            titleInput.addEventListener('focus', dismiss);
        }
    }
    
    /**
     * Show a celebration interstitial after saving the first SOP.
     * Offers to run as checklist or go to dashboard.
     */
    function showFirstSOPCelebration(sop) {
        console.log('🎉 First SOP celebration for:', sop.title);
        
        AppState.currentView = 'celebration';
        
        AppState.container.innerHTML = `
            <div class="celebration-overlay">
                <div class="celebration-card">
                    <div class="celebration-icon">✅</div>
                    <h2 class="celebration-title">Your first SOP is ready.</h2>
                    <p class="celebration-subtitle">Your team can now follow <strong>"${sop.title.replace(/"/g, '&quot;')}"</strong> without you.</p>
                    <p class="celebration-body">Share it with your team or try running it yourself as a checklist to see what they'll experience.</p>
                    <div class="celebration-actions">
                        <button class="btn celebration-btn-primary" id="celebration-run-checklist">Run as checklist</button>
                        <button class="btn celebration-btn-secondary" id="celebration-to-dashboard">Go to dashboard</button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('celebration-run-checklist')?.addEventListener('click', () => {
            showChecklist(sop, false);
            // Show sign-in reminder after they return from checklist
        });
        
        document.getElementById('celebration-to-dashboard')?.addEventListener('click', () => {
            showDashboard();
            setTimeout(maybeShowSignInReminder, 300);
        });
    }
    
    /**
     * Initialize link-based team access (no auth required).
     * Team member clicks an invite link → sees owner's Active SOPs immediately.
     */
    async function initTeamLinkAccess(inviteCode) {
        // Show loading state
        AppState.container.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:60vh;color:#6b7280;">
                <p>Loading team SOPs...</p>
            </div>
        `;
        
        try {
            const result = await SupabaseClient.fetchSOPsByInviteCode(inviteCode);
            
            if (!result.success) {
                AppState.container.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;color:#6b7280;gap:12px;">
                        <p style="font-size:18px;font-weight:600;color:#1f2937;">Invalid or expired invite link</p>
                        <p>${result.error || 'This link may have been revoked by the team owner.'}</p>
                        <a href="${window.location.pathname}" style="color:#6366f1;text-decoration:underline;margin-top:8px;">Go to WithoutMe →</a>
                    </div>
                `;
                return;
            }
            
            console.log(`✅ Team link access: ${result.teamName} — ${result.sops.length} SOPs`);
            
            // Store invite code for potential refresh
            AppState.activeInviteCode = inviteCode;
            
            // Phase 9: Store invite code in localStorage so checklist module
            // can use it for completion write-back (fire-and-forget to Supabase)
            localStorage.setItem('withoutme_team_invite_code', inviteCode);
            
            // Write team SOPs to localStorage so checklist module can find them
            // (checklist._getSOP reads from localStorage)
            localStorage.setItem('sop_tool_sops', JSON.stringify(result.sops));
            
            // Set team role for dashboard rendering
            AppState.teamRole = {
                role: 'member',
                teamId: result.teamId,
                teamName: result.teamName,
                ownerId: null
            };
            
            // Create dashboard in team member mode with the fetched SOPs
            AppState.currentView = 'dashboard';
            AppState.modules.dashboard = new Dashboard(AppState.container, {
                showMostUsed: true,
                enableFolderManagement: false,
                enableSorting: true,
                enableFiltering: true,
                highlightRecentEdits: false,
                autoRender: true,
                teamRole: AppState.teamRole,
                teamSOPs: result.sops
            });
            
            // Set up callbacks for team member actions (checklist + print)
            setupDashboardCallbacks();
            
            // Phase 12F: Load assignments for this team member
            loadTeamMemberAssignments(inviteCode);
            
            AppState.initialized = true;
            console.log('✅ Team link view initialized');
            
        } catch (e) {
            console.error('Team link access failed:', e);
            AppState.container.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;color:#6b7280;gap:12px;">
                    <p style="font-size:18px;font-weight:600;color:#1f2937;">Something went wrong</p>
                    <p>Could not load team SOPs. Please try again.</p>
                    <a href="${window.location.pathname}" style="color:#6366f1;text-decoration:underline;margin-top:8px;">Go to WithoutMe →</a>
                </div>
            `;
        }
    }
    
    /**
     * Phase 12F: Load and render assignments for team member view.
     */
    async function loadTeamMemberAssignments(inviteCode) {
        if (!SupabaseClient) return;
        try {
            const result = await SupabaseClient.fetchAssignmentsByInviteCode(inviteCode);
            if (!result?.success || !result.assignments?.length) return;

            const assignments = result.assignments;
            const today = new Date().toISOString().split('T')[0];
            const section = document.getElementById('team-assignments-section');
            if (!section) return;

            // Store assignments globally so checklist can reference them
            AppState.teamAssignments = assignments;
            window._teamAssignments = assignments;

            let html = `<section class="team-assignments-banner">
                <div class="section-header"><h3>📌 Assigned to You</h3></div>
                <div class="team-assignments-list">`;

            assignments.forEach(a => {
                const isOverdue = a.due_date < today;
                const due = new Date(a.due_date + 'T00:00:00');
                const diffDays = Math.round((due - new Date(today + 'T00:00:00')) / 86400000);
                let dueLabel = '';
                if (diffDays === 0) dueLabel = 'Due today';
                else if (diffDays === 1) dueLabel = 'Due tomorrow';
                else if (diffDays === -1) dueLabel = '1 day overdue';
                else if (diffDays < -1) dueLabel = `${Math.abs(diffDays)} days overdue`;
                else if (diffDays <= 7) dueLabel = `Due in ${diffDays} days`;
                else dueLabel = `Due ${due.toLocaleDateString()}`;

                html += `<div class="team-assign-card ${isOverdue ? 'overdue' : ''}" data-sop-id="${a.sop_id}" data-assignment-id="${a.id}">
                    <div class="team-assign-title">${escapeHtml(a.sop_title)}</div>
                    <div class="team-assign-due ${isOverdue ? 'due-overdue' : ''}">${isOverdue ? '⚠️' : '📅'} ${dueLabel}</div>
                </div>`;
            });

            html += '</div></section>';
            section.innerHTML = html;
            section.style.display = 'block';

            // Click to scroll to SOP or run checklist
            section.querySelectorAll('.team-assign-card').forEach(card => {
                card.style.cursor = 'pointer';
                card.addEventListener('click', () => {
                    const sopId = card.dataset.sopId;
                    const sopCard = document.querySelector(`.sop-card[data-sop-id="${sopId}"]`);
                    if (sopCard) {
                        sopCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        sopCard.style.outline = '2px solid #6366f1';
                        setTimeout(() => { sopCard.style.outline = ''; }, 2000);
                    }
                });
            });
        } catch (e) {
            console.error('[App] loadTeamMemberAssignments error:', e);
        }
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    /**
     * Check the current user's team role and update AppState.
     * Used for authenticated users (owner/manager tier — future expansion).
     */
    async function checkTeamRole() {
        if (!SupabaseClient) return;
        
        try {
            const role = await SupabaseClient.getUserRole();
            AppState.teamRole = role;
            console.log('👥 Team role:', role.role, role.teamName ? `(${role.teamName})` : '');
            
            // Pre-fetch team SOPs for authenticated members (future manager role)
            if (role.role === 'member') {
                console.log('📥 Fetching team SOPs...');
                AppState.teamSOPs = await SupabaseClient.fetchTeamSOPs();
                console.log(`📥 Loaded ${AppState.teamSOPs.length} team SOPs`);
            }
        } catch (e) {
            console.warn('Could not check team role:', e);
            AppState.teamRole = { role: 'solo', teamId: null, teamName: null, ownerId: null };
        }
    }


    // ========================================================================
    // AUTH UI
    // ========================================================================

    /**
     * Inject auth UI elements (login button, user indicator, auth modal)
     */
    function injectAuthUI() {
        // Add styles for auth UI
        if (!document.getElementById('auth-ui-styles')) {
            const style = document.createElement('style');
            style.id = 'auth-ui-styles';
            style.textContent = `
                .account-btn {
                    position: fixed;
                    top: 12px;
                    right: 16px;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border: 1px solid #d1d5db;
                    background: #fff;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    z-index: 1000;
                    transition: border-color 0.15s, box-shadow 0.15s;
                    color: #6b7280;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                }
                .account-btn:hover {
                    border-color: #4338ca;
                    color: #4338ca;
                }
                .help-btn {
                    position: fixed;
                    top: 12px;
                    right: 60px;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border: 1px solid #d1d5db;
                    background: #fff;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    font-weight: 600;
                    z-index: 1000;
                    transition: border-color 0.15s, box-shadow 0.15s;
                    color: #6b7280;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                }
                .help-btn:hover {
                    border-color: #4338ca;
                    color: #4338ca;
                }
                .help-panel-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.2);
                    z-index: 1100;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .help-panel-overlay.visible {
                    opacity: 1;
                }
                .help-panel {
                    position: fixed;
                    top: 0;
                    right: -420px;
                    width: 400px;
                    max-width: 90vw;
                    height: 100vh;
                    background: #fff;
                    z-index: 1101;
                    box-shadow: -4px 0 20px rgba(0,0,0,0.1);
                    transition: right 0.25s ease;
                    display: flex;
                    flex-direction: column;
                    overflow-y: auto;
                }
                .help-panel.open {
                    right: 0;
                }
                .help-panel-header {
                    padding: 20px 20px 16px;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                }
                .help-panel-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #1f2937;
                }
                .help-panel-body {
                    padding: 16px 20px 32px;
                    flex: 1;
                    overflow-y: auto;
                }
                .help-section {
                    margin-bottom: 8px;
                }
                .help-section-title {
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: #1f2937;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 0;
                    padding-bottom: 0;
                }
                .help-item {
                    margin-bottom: 10px;
                }
                .help-item-title {
                    font-size: 0.88rem;
                    font-weight: 600;
                    color: #1f2937;
                    margin-bottom: 2px;
                }
                .help-item-desc {
                    font-size: 0.78rem;
                    color: #6b7280;
                    line-height: 1.4;
                }
                .help-pro-badge {
                    font-size: 0.65rem;
                    font-weight: 600;
                    color: #4338ca;
                    background: #ede9fe;
                    padding: 1px 6px;
                    border-radius: 4px;
                    margin-left: 6px;
                    vertical-align: middle;
                }
                .help-panel-footer {
                    padding: 12px 20px;
                    border-top: 1px solid #e5e7eb;
                    text-align: center;
                    font-size: 0.75rem;
                    color: #9ca3af;
                    flex-shrink: 0;
                }
                .help-section-toggle {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                    padding: 8px 0;
                    user-select: none;
                    border-bottom: 1px solid #f3f4f6;
                }
                .help-section-toggle:hover .help-section-title {
                    color: #4338ca;
                }
                .help-section-arrow {
                    font-size: 0.85rem;
                    color: #9ca3af;
                    transition: transform 0.15s;
                }
                .help-section-content {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.25s ease;
                }
                .help-section-content.open {
                    max-height: 600px;
                }
                .help-footer-line {
                    text-align: center;
                    font-size: 0.8rem;
                    color: #6b7280;
                    padding: 16px 0 4px;
                    border-top: 1px solid #f3f4f6;
                    margin-top: 12px;
                }
                .account-btn.signed-in {
                    border-color: #4338ca;
                    background: #f5f3ff;
                    color: #4338ca;
                }
                .account-panel-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.3);
                    z-index: 9998;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                .account-panel-overlay.visible {
                    opacity: 1;
                }
                .account-panel {
                    position: fixed;
                    top: 0;
                    right: -340px;
                    width: 320px;
                    max-width: 90vw;
                    height: 100vh;
                    background: #fff;
                    box-shadow: -4px 0 20px rgba(0,0,0,0.1);
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    transition: right 0.25s ease;
                    overflow-y: auto;
                }
                .account-panel.open {
                    right: 0;
                }
                .account-panel-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1.25rem 1.25rem 1rem;
                    border-bottom: 1px solid #f3f4f6;
                }
                .account-panel-header h3 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 600;
                    color: #0f172a;
                }
                .account-panel-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: #9ca3af;
                    padding: 4px 8px;
                    border-radius: 4px;
                }
                .account-panel-close:hover {
                    color: #374151;
                    background: #f3f4f6;
                }
                .account-panel-body {
                    padding: 1.25rem;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }
                .account-section {
                    display: flex;
                    flex-direction: column;
                    gap: 0.4rem;
                }
                .account-label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: #94a3b8;
                }
                .account-value {
                    font-size: 0.92rem;
                    color: #1e293b;
                    word-break: break-all;
                }
                .account-value-muted {
                    font-size: 0.85rem;
                    color: #94a3b8;
                }
                .account-plan-row {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .account-plan-badge {
                    display: inline-block;
                    font-size: 0.78rem;
                    font-weight: 600;
                    padding: 2px 10px;
                    border-radius: 4px;
                }
                .account-plan-badge.free {
                    background: #f1f5f9;
                    color: #6366f1;
                }
                .account-plan-badge.pro {
                    background: #4338ca;
                    color: #fff;
                }
                .account-divider {
                    border: none;
                    border-top: 1px solid #f3f4f6;
                    margin: 0;
                }
                .account-input {
                    width: 100%;
                    padding: 0.45rem 0.6rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    color: #1e293b;
                    background: #fff;
                    font-family: inherit;
                }
                .account-input:focus {
                    outline: none;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 2px rgba(99,102,241,0.1);
                }
                .account-save-btn {
                    padding: 0.45rem 0.75rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    background: #f8fafc;
                    color: #475569;
                    font-size: 0.82rem;
                    font-weight: 500;
                    cursor: pointer;
                    white-space: nowrap;
                }
                .account-save-btn:hover {
                    background: #e2e8f0;
                    color: #1e293b;
                }
                .account-link {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.6rem 0;
                    font-size: 0.9rem;
                    color: #374151;
                    cursor: pointer;
                    border: none;
                    background: none;
                    width: 100%;
                    text-align: left;
                    border-radius: 6px;
                    transition: color 0.15s;
                }
                .account-link:hover {
                    color: #4338ca;
                }
                .account-link-icon {
                    font-size: 1rem;
                    width: 20px;
                    text-align: center;
                }
                .account-upgrade-btn {
                    display: block;
                    width: 100%;
                    padding: 0.65rem;
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #fff;
                    background: #4338ca;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    text-align: center;
                    transition: background 0.15s;
                }
                .account-upgrade-btn:hover {
                    background: #3730a3;
                }
                .account-signin-btn {
                    display: block;
                    width: 100%;
                    padding: 0.65rem;
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #fff;
                    background: #4f46e5;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    text-align: center;
                    transition: background 0.15s;
                }
                .account-signin-btn:hover {
                    background: #4338ca;
                }
                .account-toggle {
                    position: relative;
                    display: inline-block;
                    width: 40px;
                    height: 22px;
                    flex-shrink: 0;
                    cursor: pointer;
                }
                .account-toggle input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .account-toggle-slider {
                    position: absolute;
                    inset: 0;
                    background: #d1d5db;
                    border-radius: 22px;
                    transition: background 0.2s;
                }
                .account-toggle-slider::before {
                    content: '';
                    position: absolute;
                    width: 16px;
                    height: 16px;
                    left: 3px;
                    bottom: 3px;
                    background: #fff;
                    border-radius: 50%;
                    transition: transform 0.2s;
                }
                .account-toggle input:checked + .account-toggle-slider {
                    background: #4f46e5;
                }
                .account-toggle input:checked + .account-toggle-slider::before {
                    transform: translateX(18px);
                }
                .account-panel-footer {
                    padding: 1rem 1.25rem;
                    border-top: 1px solid #f3f4f6;
                    font-size: 0.78rem;
                    color: #94a3b8;
                    text-align: center;
                }
                .auth-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                }
                .auth-modal {
                    background: #fff;
                    border-radius: 12px;
                    padding: 24px;
                    width: 100%;
                    max-width: 360px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                }
                .auth-modal h2 {
                    margin: 0 0 20px 0;
                    font-size: 1.25rem;
                }
                .auth-modal .tabs {
                    display: flex;
                    gap: 4px;
                    margin-bottom: 20px;
                }
                .auth-modal .tab {
                    flex: 1;
                    padding: 8px;
                    border: none;
                    background: #f3f4f6;
                    cursor: pointer;
                    border-radius: 6px;
                    font-weight: 500;
                }
                .auth-modal .tab.active {
                    background: #4f46e5;
                    color: #fff;
                }
                .auth-modal input {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    margin-bottom: 12px;
                    font-size: 14px;
                }
                .auth-modal input:focus {
                    outline: none;
                    border-color: #4f46e5;
                }
                .auth-modal .btn-primary {
                    width: 100%;
                    padding: 10px;
                    background: #4f46e5;
                    color: #fff;
                    border: none;
                    border-radius: 6px;
                    font-weight: 500;
                    cursor: pointer;
                }
                .auth-modal .btn-primary:hover {
                    background: #4338ca;
                }
                .auth-modal .btn-primary:disabled {
                    background: #9ca3af;
                    cursor: not-allowed;
                }
                .auth-modal .error {
                    color: #dc2626;
                    font-size: 13px;
                    margin-bottom: 12px;
                }
                .auth-modal .close-btn {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: #6b7280;
                }
                .sync-status {
                    position: fixed;
                    bottom: 12px;
                    left: 16px;
                    padding: 6px 12px;
                    background: #1f2937;
                    color: #fff;
                    border-radius: 6px;
                    font-size: 12px;
                    z-index: 1000;
                    display: none;
                }
                .app-footer {
                    text-align: center;
                    padding: 1rem 1.5rem;
                    border-top: 1px solid #f3f4f6;
                    font-size: 0.78rem;
                    color: #94a3b8;
                    background: #f9fafb;
                }
                .app-footer a {
                    color: #64748b;
                    text-decoration: none;
                    margin: 0 0.4rem;
                }
                .app-footer a:hover {
                    color: #4338ca;
                }
                .app-footer-sep {
                    margin: 0 0.25rem;
                    color: #d1d5db;
                }
                .signin-reminder {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 14px 16px;
                    background: #f0f9ff;
                    border: 1px solid #bae6fd;
                    border-radius: 10px;
                    margin-bottom: 1.25rem;
                    animation: reminderFadeIn 0.3s ease;
                }
                @keyframes reminderFadeIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .signin-reminder-content {
                    flex: 1;
                }
                .signin-reminder-content p {
                    margin: 0 0 10px;
                    font-size: 13px;
                    color: #374151;
                    line-height: 1.5;
                }
                .signin-reminder-content p strong {
                    display: block;
                    margin-bottom: 2px;
                    font-size: 13px;
                    color: #1e3a5f;
                }
                .signin-reminder-actions {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                .signin-reminder-btn {
                    padding: 6px 14px;
                    background: #4f46e5;
                    color: #fff;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                }
                .signin-reminder-btn:hover {
                    background: #4338ca;
                }
                .signin-reminder-dismiss {
                    padding: 6px 10px;
                    background: none;
                    border: none;
                    color: #6b7280;
                    font-size: 13px;
                    cursor: pointer;
                }
                .signin-reminder-dismiss:hover {
                    color: #374151;
                }
                .signin-reminder-close {
                    background: none;
                    border: none;
                    color: #9ca3af;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 2px 4px;
                    line-height: 1;
                    flex-shrink: 0;
                }
                .signin-reminder-close:hover {
                    color: #6b7280;
                }
                @media (max-width: 768px) {
                    .account-btn {
                        top: 10px;
                        right: 12px;
                    }
                    .help-btn {
                        top: 10px;
                        right: 54px;
                    }
                    .signin-reminder {
                        margin: 0 0.75rem 1rem;
                    }
                }
                @media (max-height: 500px) and (orientation: landscape) {
                    .account-btn {
                        top: 8px;
                        right: 10px;
                    }
                    .help-btn {
                        top: 8px;
                        right: 52px;
                    }
                }

                /* ---- FIRST-SOP ONBOARDING ---- */

                .first-sop-hint {
                    background: #eff6ff;
                    border: 1px solid #bfdbfe;
                    border-radius: 8px;
                    padding: 12px 16px;
                    margin-bottom: 16px;
                    transition: opacity 0.3s ease, transform 0.3s ease;
                }
                .first-sop-hint p {
                    margin: 0;
                    font-size: 0.9rem;
                    color: #1e40af;
                    line-height: 1.5;
                }

                .celebration-overlay {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 80vh;
                    padding: 2rem;
                }
                .celebration-card {
                    text-align: center;
                    max-width: 440px;
                    width: 100%;
                    background: #fff;
                    border-radius: 12px;
                    padding: 3rem 2rem;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
                }
                .celebration-icon {
                    font-size: 3rem;
                    margin-bottom: 0.75rem;
                }
                .celebration-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin: 0 0 0.5rem;
                    color: #0f172a;
                }
                .celebration-subtitle {
                    font-size: 1rem;
                    color: #475569;
                    margin: 0 0 0.75rem;
                    line-height: 1.5;
                }
                .celebration-body {
                    font-size: 0.92rem;
                    color: #64748b;
                    margin: 0 0 1.75rem;
                    line-height: 1.5;
                }
                .celebration-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    align-items: center;
                }
                .celebration-btn-primary {
                    padding: 0.75rem 2rem;
                    font-size: 1rem;
                    font-weight: 600;
                    color: #fff;
                    background: #4338ca;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.15s;
                    width: 100%;
                    max-width: 280px;
                }
                .celebration-btn-primary:hover {
                    background: #3730a3;
                }
                .celebration-btn-secondary {
                    padding: 0.6rem 1.5rem;
                    font-size: 0.9rem;
                    color: #64748b;
                    background: none;
                    border: none;
                    cursor: pointer;
                    transition: color 0.15s;
                }
                .celebration-btn-secondary:hover {
                    color: #1e293b;
                }
            `;
            document.head.appendChild(style);
        }

        // Create account button (replaces old auth-indicator)
        const accountBtn = document.createElement('button');
        accountBtn.className = 'account-btn';
        accountBtn.id = 'account-btn';
        accountBtn.title = 'Account';
        accountBtn.innerHTML = '👤';
        accountBtn.addEventListener('click', () => toggleAccountPanel());
        updateAccountButton(accountBtn);
        document.body.appendChild(accountBtn);

        // Create help button (Phase 13B)
        const helpBtn = document.createElement('button');
        helpBtn.className = 'help-btn';
        helpBtn.id = 'help-btn';
        helpBtn.title = 'Help & Features';
        helpBtn.textContent = '?';
        helpBtn.addEventListener('click', () => toggleHelpPanel());
        document.body.appendChild(helpBtn);

        // Create sync status indicator
        const syncStatus = document.createElement('div');
        syncStatus.className = 'sync-status';
        syncStatus.id = 'sync-status';
        document.body.appendChild(syncStatus);

        // Listen for auth changes (backup listener for edge cases)
        if (StorageAdapter?.Auth?.onAuthStateChange) {
            StorageAdapter.Auth.onAuthStateChange((isAuth, user) => {
                console.log('[app.js] Auth state change detected:', isAuth ? 'logged in' : 'logged out');
                updateAccountButton(document.getElementById('account-btn'));
                updateAccountPanelContent();
                
                // Only refresh dashboard if we're actually on the dashboard view
                if (AppState.currentView === 'dashboard' && AppState.modules.dashboard) {
                    console.log('[app.js] Refreshing dashboard due to auth state change');
                    AppState.modules.dashboard.refresh();
                }
            });
        }
        
        // Listen for plan changes (after Paddle checkout)
        window.addEventListener('withoutme:plan-changed', () => {
            updateAccountButton(document.getElementById('account-btn'));
            updateAccountPanelContent();
            if (AppState.currentView === 'dashboard' && AppState.modules.dashboard) {
                AppState.modules.dashboard.refresh();
            }
        });
        
        // Inject persistent app footer (policy links — visible on all views)
        injectAppFooter();
    }

    /**
     * Inject a persistent footer with policy links.
     * Visible on all app views (dashboard, editor, checklist).
     * Required for Paddle domain approval.
     */
    function injectAppFooter() {
        if (document.getElementById('app-footer')) return;
        
        const footer = document.createElement('footer');
        footer.id = 'app-footer';
        footer.className = 'app-footer';
        footer.innerHTML = `
            <a href="/?home">Home</a>
            <a href="/sop-templates/">Templates</a>
            <a href="/pricing">Pricing</a>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/refund">Refund Policy</a>
            <span class="app-footer-sep">·</span>
            <span>© 2026 WithoutMe</span>
        `;
        document.body.appendChild(footer);
    }

    /**
     * Show a gentle sign-in reminder after first SOP creation
     * Only shows once, only if not signed in, only after first SOP
     */
    function maybeShowSignInReminder() {
        // Don't show if already dismissed
        if (localStorage.getItem('sop_tool_signin_reminder_dismissed')) return;

        // Don't show if signed in
        const isAuth = StorageAdapter?.Auth?.isAuthenticated?.() || false;
        if (isAuth) return;

        // Only show if exactly 1 SOP exists (just created their first)
        const sops = StorageAdapter?.getSops?.() || JSON.parse(localStorage.getItem('sop_tool_sops') || '[]');
        if (sops.length !== 1) return;

        // Don't show if banner already exists
        if (document.getElementById('signin-reminder-banner')) return;

        // Find injection point — after dashboard header
        const header = document.querySelector('.dashboard-header');
        if (!header) return;

        const banner = document.createElement('div');
        banner.id = 'signin-reminder-banner';
        banner.className = 'signin-reminder';
        banner.innerHTML = `
            <div class="signin-reminder-content">
                <p><strong>Want to access this from another device?</strong>
                Your SOPs are saved on this computer. Sign in to access them anywhere.</p>
                <div class="signin-reminder-actions">
                    <button class="signin-reminder-btn" id="reminder-sign-in">Sign in</button>
                    <button class="signin-reminder-dismiss" id="reminder-dismiss">Not now</button>
                </div>
            </div>
            <button class="signin-reminder-close" id="reminder-close" title="Dismiss">✕</button>
        `;

        header.insertAdjacentElement('afterend', banner);

        // Sign in action
        banner.querySelector('#reminder-sign-in')?.addEventListener('click', () => {
            banner.remove();
            localStorage.setItem('sop_tool_signin_reminder_dismissed', '1');
            if (typeof showAuthModal === 'function') showAuthModal();
        });

        // Dismiss actions
        const dismiss = () => {
            banner.remove();
            localStorage.setItem('sop_tool_signin_reminder_dismissed', '1');
        };
        banner.querySelector('#reminder-dismiss')?.addEventListener('click', dismiss);
        banner.querySelector('#reminder-close')?.addEventListener('click', dismiss);
    }

    /**
     * Update account button appearance based on auth state
     */
    function updateAccountButton(btn) {
        if (!btn) return;
        const isAuth = StorageAdapter?.Auth?.isAuthenticated?.() || false;
        if (isAuth) {
            btn.classList.add('signed-in');
            btn.innerHTML = '☁️';
            btn.title = 'Account';
        } else {
            btn.classList.remove('signed-in');
            btn.innerHTML = '👤';
            btn.title = 'Sign in / Account';
        }
    }

    /**
     * Toggle the account panel open/closed
     */
    function toggleAccountPanel() {
        const existing = document.getElementById('account-panel');
        if (existing) {
            closeAccountPanel();
        } else {
            openAccountPanel();
        }
    }

    /**
     * Open the account slide-out panel
     */
    function openAccountPanel() {
        if (document.getElementById('account-panel')) return;

        // Overlay
        const overlay = document.createElement('div');
        overlay.id = 'account-panel-overlay';
        overlay.className = 'account-panel-overlay';
        overlay.addEventListener('click', closeAccountPanel);
        document.body.appendChild(overlay);

        // Panel
        const panel = document.createElement('div');
        panel.id = 'account-panel';
        panel.className = 'account-panel';
        panel.innerHTML = `
            <div class="account-panel-header">
                <h3>Account</h3>
                <button class="account-panel-close" id="account-panel-close-btn" title="Close">✕</button>
            </div>
            <div class="account-panel-body" id="account-panel-body"></div>
            <div class="account-panel-footer">WithoutMe</div>
        `;
        document.body.appendChild(panel);

        panel.querySelector('#account-panel-close-btn').addEventListener('click', closeAccountPanel);

        // Populate content
        updateAccountPanelContent();

        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
            panel.classList.add('open');
        });
    }

    /**
     * Close the account panel
     */
    function closeAccountPanel() {
        const panel = document.getElementById('account-panel');
        const overlay = document.getElementById('account-panel-overlay');
        if (panel) {
            panel.classList.remove('open');
            setTimeout(() => panel.remove(), 250);
        }
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 200);
        }
    }

    // ================================================================
    // HELP PANEL (Phase 13B)
    // ================================================================

    function toggleHelpPanel() {
        const existing = document.getElementById('help-panel');
        if (existing) {
            closeHelpPanel();
        } else {
            openHelpPanel();
        }
    }

    function openHelpPanel() {
        if (document.getElementById('help-panel')) return;

        const overlay = document.createElement('div');
        overlay.id = 'help-panel-overlay';
        overlay.className = 'help-panel-overlay';
        overlay.addEventListener('click', closeHelpPanel);
        document.body.appendChild(overlay);

        const panel = document.createElement('div');
        panel.id = 'help-panel';
        panel.className = 'help-panel';
        panel.innerHTML = `
            <div class="help-panel-header">
                <h3>Help & Features</h3>
                <button class="account-panel-close" id="help-panel-close-btn" title="Close">✕</button>
            </div>
            <div class="help-panel-body">
                ${getHelpPanelContent()}
            </div>
            <div class="help-panel-footer">support@withoutme.app</div>
        `;
        document.body.appendChild(panel);

        panel.querySelector('#help-panel-close-btn').addEventListener('click', closeHelpPanel);

        // Accordion: toggle sections, only one open at a time
        panel.querySelectorAll('.help-section-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const target = toggle.dataset.target;
                const content = document.getElementById('help-content-' + target);
                const arrow = toggle.querySelector('.help-section-arrow');
                const isOpen = content.classList.contains('open');

                // Close all sections
                panel.querySelectorAll('.help-section-content').forEach(c => c.classList.remove('open'));
                panel.querySelectorAll('.help-section-arrow').forEach(a => a.textContent = '▸');

                // Open clicked section (if it wasn't already open)
                if (!isOpen) {
                    content.classList.add('open');
                    arrow.textContent = '▾';
                }
            });
        });

        requestAnimationFrame(() => {
            overlay.classList.add('visible');
            panel.classList.add('open');
        });
    }

    function closeHelpPanel(){
        const panel = document.getElementById('help-panel');
        const overlay = document.getElementById('help-panel-overlay');
        if (panel) {
            panel.classList.remove('open');
            setTimeout(() => panel.remove(), 250);
        }
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 200);
        }
    }

    function getHelpPanelContent() {
        return `
            <div class="help-section" data-section="getting-started">
                <div class="help-section-toggle" data-target="getting-started">
                    <span class="help-section-title">Getting Started</span>
                    <span class="help-section-arrow">▾</span>
                </div>
                <div class="help-section-content open" id="help-content-getting-started">
                    <div class="help-item">
                        <div class="help-item-title">Create an SOP</div>
                        <div class="help-item-desc">Click + New SOP on the dashboard. Add a title, steps, and save.</div>
                    </div>
                    <div class="help-item">
                        <div class="help-item-title">Templates</div>
                        <div class="help-item-desc">Start from one of 18 industry-specific templates instead of a blank page.</div>
                    </div>
                    <div class="help-item">
                        <div class="help-item-title">Checklists</div>
                        <div class="help-item-desc">Click Use on any SOP to run it as a checklist. Check off steps, add notes as you go.</div>
                    </div>
                    <div class="help-item">
                        <div class="help-item-title">Print / PDF</div>
                        <div class="help-item-desc">Export any SOP for offline use or to post in your workspace.</div>
                    </div>
                </div>
            </div>

            <div class="help-section" data-section="editor-tools">
                <div class="help-section-toggle" data-target="editor-tools">
                    <span class="help-section-title">📷 Editor Tools</span>
                    <span class="help-section-arrow">▸</span>
                </div>
                <div class="help-section-content" id="help-content-editor-tools">
                    <div class="help-item">
                        <div class="help-item-title">Images in steps</div>
                        <div class="help-item-desc">Add photos or diagrams to any step. Shows in checklists and print exports too.</div>
                    </div>
                    <div class="help-item">
                        <div class="help-item-title">Version history</div>
                        <div class="help-item-desc">View and restore previous versions of any SOP. Click the 🕐 button when editing.</div>
                    </div>
                    <div class="help-item">
                        <div class="help-item-title">Tags</div>
                        <div class="help-item-desc">Add tags to organize SOPs. Click any tag badge on the dashboard to filter.</div>
                    </div>
                </div>
            </div>

            <div class="help-section" data-section="team-features">
                <div class="help-section-toggle" data-target="team-features">
                    <span class="help-section-title">👥 Team Features <span class="help-pro-badge">Pro</span></span>
                    <span class="help-section-arrow">▸</span>
                </div>
                <div class="help-section-content" id="help-content-team-features">
                    <div class="help-item">
                        <div class="help-item-title">Invite links</div>
                        <div class="help-item-desc">Share a link — your team sees SOPs instantly. No signup or download needed on their end.</div>
                    </div>
                    <div class="help-item">
                        <div class="help-item-title">Task assignments</div>
                        <div class="help-item-desc">Assign specific SOPs to team members with due dates. Click 📌 on any SOP card.</div>
                    </div>
                    <div class="help-item">
                        <div class="help-item-title">Team feedback</div>
                        <div class="help-item-desc">Team members flag issues while running checklists. Flagged items appear in your dashboard with unread badges.</div>
                    </div>
                    <div class="help-item">
                        <div class="help-item-title">Completion tracking</div>
                        <div class="help-item-desc">See who completed which checklist, when they finished, and how long it took.</div>
                    </div>
                    <div class="help-item">
                        <div class="help-item-title">Activity dashboard</div>
                        <div class="help-item-desc">Filter team completions by date range or employee. Export to CSV anytime.</div>
                    </div>
                </div>
            </div>

            <div class="help-section" data-section="automation">
                <div class="help-section-toggle" data-target="automation">
                    <span class="help-section-title">⚡ Automation <span class="help-pro-badge">Pro</span></span>
                    <span class="help-section-arrow">▸</span>
                </div>
                <div class="help-section-content" id="help-content-automation">
                    <div class="help-item">
                        <div class="help-item-title">AI-powered steps</div>
                        <div class="help-item-desc">Describe the task, AI writes the steps. Tailored to your business type if set in Account.</div>
                    </div>
                    <div class="help-item">
                        <div class="help-item-title">AI clarity</div>
                        <div class="help-item-desc">Already have steps? AI rewrites them so a first-day employee could follow along.</div>
                    </div>
                    <div class="help-item">
                        <div class="help-item-title">Daily digest</div>
                        <div class="help-item-desc">Morning email with yesterday's completions, grouped by employee. Toggle on/off in Account.</div>
                    </div>
                    <div class="help-item">
                        <div class="help-item-title">Webhooks</div>
                        <div class="help-item-desc">Send completion data to Zapier, Make, or Slack. Set your URL in Account.</div>
                    </div>
                </div>
            </div>

            <div class="help-footer-line">Works offline · Sign in for cloud sync</div>
        `;
    }

    /**
     * Update the account panel body content based on current state
     */
    function updateAccountPanelContent() {
        const body = document.getElementById('account-panel-body');
        if (!body) return;

        const isAuth = StorageAdapter?.Auth?.isAuthenticated?.() || false;
        const user = StorageAdapter?.Auth?.getUser?.();
        const hasPaddle = typeof PaddleBilling !== 'undefined';
        const isPro = hasPaddle && PaddleBilling.isPro();

        if (isAuth && user) {
            // Signed in view
            body.innerHTML = `
                <div class="account-section">
                    <span class="account-label">Email</span>
                    <span class="account-value">${user.email}</span>
                </div>

                <div class="account-section">
                    <span class="account-label">Plan</span>
                    <div class="account-plan-row">
                        <span class="account-plan-badge ${isPro ? 'pro' : 'free'}">${isPro ? 'Pro' : 'Free'}</span>
                        ${isPro ? '<span style="font-size:0.82rem;color:#64748b;">$39/mo</span>' : ''}
                    </div>
                </div>

                ${isPro ? `
                    <button class="account-link" id="account-manage-billing">
                        <span class="account-link-icon">💳</span>
                        Manage billing
                    </button>
                ` : `
                    <button class="account-upgrade-btn" id="account-upgrade">
                        Upgrade to Pro — $39/mo
                    </button>
                    <p style="font-size:0.78rem;color:#94a3b8;margin:0;text-align:center;">
                        AI-powered SOPs, team sharing with completion tracking, task assignments, daily digest, cloud sync
                    </p>
                `}

                <hr class="account-divider">

                ${isPro ? `
                <div class="account-section">
                    <label class="account-label" for="account-business-type">Business type</label>
                    <div style="display:flex;gap:0.4rem;align-items:center;">
                        <input type="text" id="account-business-type" class="account-input" style="flex:1;"
                            placeholder="e.g. auto repair shop, plumbing company"
                            value="${(function(){ try { return localStorage.getItem('withoutme_business_type') || ''; } catch(e) { return ''; } })()}"
                            maxlength="100" />
                        <button id="account-save-biz-type" class="account-save-btn">Save</button>
                    </div>
                    <span id="account-biz-type-hint" style="font-size:0.72rem;color:${(function(){ try { return localStorage.getItem('withoutme_business_type') ? '#059669' : '#94a3b8'; } catch(e) { return '#94a3b8'; } })()};">${(function(){ try { const v = localStorage.getItem('withoutme_business_type'); return v ? '✓ Saved — AI will tailor suggestions for "' + v + '"' : 'Used by AI to tailor step suggestions to your business.'; } catch(e) { return 'Used by AI to tailor step suggestions to your business.'; } })()}</span>
                </div>

                <hr class="account-divider">
                ` : ''}

                ${isPro ? `
                <div class="account-section">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
                        <div>
                            <span class="account-label" style="margin-bottom:2px;">Daily team digest</span>
                            <span style="font-size:0.72rem;color:#94a3b8;display:block;">Morning email with yesterday's team activity</span>
                        </div>
                        <label class="account-toggle" for="account-digest-toggle">
                            <input type="checkbox" id="account-digest-toggle" ${(function(){ try { return localStorage.getItem('withoutme_digest_optout') === '1' ? '' : 'checked'; } catch(e) { return 'checked'; } })()} />
                            <span class="account-toggle-slider"></span>
                        </label>
                    </div>
                </div>

                <hr class="account-divider">
                ` : ''}

                ${isPro ? `
                <div class="account-section">
                    <label class="account-label" for="account-webhook-url">Webhook URL <span style="font-size:0.7rem;color:#94a3b8;font-weight:400;">(optional)</span></label>
                    <div style="display:flex;gap:0.4rem;align-items:center;">
                        <input type="url" id="account-webhook-url" class="account-input" style="flex:1;"
                            placeholder="https://hooks.zapier.com/..."
                            value="${(function(){ try { return localStorage.getItem('withoutme_webhook_url') || ''; } catch(e) { return ''; } })()}"
                            maxlength="500" />
                        <button id="account-save-webhook" class="account-save-btn">Save</button>
                    </div>
                    <span id="account-webhook-hint" style="font-size:0.72rem;color:${(function(){ try { return localStorage.getItem('withoutme_webhook_url') ? '#059669' : '#94a3b8'; } catch(e) { return '#94a3b8'; } })()};">${(function(){ try { const v = localStorage.getItem('withoutme_webhook_url'); return v ? '✓ Active — completions will POST to this URL' : 'Get notified in Zapier, Make, or any webhook endpoint when checklists are completed.'; } catch(e) { return 'Get notified in Zapier, Make, or any webhook endpoint when checklists are completed.'; } })()}</span>
                </div>

                <hr class="account-divider">
                ` : ''}

                <button class="account-link" id="account-change-password">
                    <span class="account-link-icon">🔒</span>
                    Change password
                </button>

                <button class="account-link" id="account-sign-out" style="color:#dc2626;">
                    <span class="account-link-icon">↩</span>
                    Sign out
                </button>
            `;

            // Wire up actions
            body.querySelector('#account-manage-billing')?.addEventListener('click', () => {
                const portalUrl = hasPaddle ? PaddleBilling.getCustomerPortalUrl() : null;
                if (portalUrl) {
                    window.open(portalUrl, '_blank');
                } else {
                    // Fallback: generic portal where customer enters email
                    window.open('https://customer-portal.paddle.com/', '_blank');
                }
            });

            body.querySelector('#account-upgrade')?.addEventListener('click', () => {
                closeAccountPanel();
                if (hasPaddle) PaddleBilling.showPricingModal();
            });

            body.querySelector('#account-change-password')?.addEventListener('click', () => {
                closeAccountPanel();
                showChangePasswordModal();
            });

            body.querySelector('#account-sign-out')?.addEventListener('click', () => {
                closeAccountPanel();
                if (confirm('Sign out? Your data will remain on this device.')) {
                    signOut();
                }
            });

            // Business type — save on button click
            body.querySelector('#account-save-biz-type')?.addEventListener('click', async () => {
                const input = document.getElementById('account-business-type');
                const hint = document.getElementById('account-biz-type-hint');
                const saveBtn = document.getElementById('account-save-biz-type');
                const val = input?.value?.trim() || '';
                
                try {
                    // Save to localStorage
                    if (val) {
                        localStorage.setItem('withoutme_business_type', val);
                    } else {
                        localStorage.removeItem('withoutme_business_type');
                    }
                    
                    // Save to Supabase (persists across devices)
                    if (typeof SupabaseClient !== 'undefined' && SupabaseClient) {
                        if (saveBtn) { saveBtn.textContent = '...'; saveBtn.disabled = true; }
                        await SupabaseClient.setBusinessType(val);
                    }
                    
                    // Show permanent confirmation
                    if (hint) {
                        hint.textContent = val ? `✓ Saved — AI will tailor suggestions for "${val}"` : 'Cleared — AI will use generic suggestions.';
                        hint.style.color = '#059669';
                    }
                } catch (err) {
                    if (hint) {
                        hint.textContent = 'Saved locally. Cloud sync failed — will retry on next login.';
                        hint.style.color = '#d97706';
                    }
                } finally {
                    if (saveBtn) { saveBtn.textContent = 'Save'; saveBtn.disabled = false; }
                }
            });

            // Daily digest toggle — save opt-out to localStorage + Supabase
            body.querySelector('#account-digest-toggle')?.addEventListener('change', async (e) => {
                const enabled = e.target.checked;  // checked = ON (receives emails)
                const optedOut = !enabled;
                
                // Save to localStorage for immediate UI state
                if (optedOut) {
                    localStorage.setItem('withoutme_digest_optout', '1');
                } else {
                    localStorage.removeItem('withoutme_digest_optout');
                }
                
                // Save to Supabase user_metadata (read by server-side digest query)
                if (typeof SupabaseClient !== 'undefined' && SupabaseClient) {
                    await SupabaseClient.setDigestOptOut(optedOut);
                }
            });

            // Webhook URL — save on button click (Phase 12G)
            body.querySelector('#account-save-webhook')?.addEventListener('click', async () => {
                const input = document.getElementById('account-webhook-url');
                const hint = document.getElementById('account-webhook-hint');
                const saveBtn = document.getElementById('account-save-webhook');
                const val = input?.value?.trim() || '';

                if (val && !val.startsWith('https://')) {
                    if (hint) { hint.textContent = '⚠ URL must start with https://'; hint.style.color = '#dc2626'; }
                    return;
                }

                try {
                    if (saveBtn) { saveBtn.textContent = '...'; saveBtn.disabled = true; }
                    localStorage.setItem('withoutme_webhook_url', val);
                    if (typeof SupabaseClient !== 'undefined' && SupabaseClient) {
                        await SupabaseClient.setWebhookUrl(val);
                    }
                    if (hint) {
                        hint.textContent = val ? '✓ Active — completions will POST to this URL' : 'Webhook removed.';
                        hint.style.color = val ? '#059669' : '#94a3b8';
                    }
                } finally {
                    if (saveBtn) { saveBtn.textContent = 'Save'; saveBtn.disabled = false; }
                }
            });

        } else {
            // Not signed in view
            body.innerHTML = `
                <div class="account-section">
                    <span class="account-value-muted">Your SOPs are saved on this device only.</span>
                </div>

                <button class="account-signin-btn" id="account-sign-in">
                    Sign in or create account
                </button>

                <p style="font-size:0.82rem;color:#94a3b8;margin:0;line-height:1.5;">
                    Sign in to access your SOPs from any device. Your local data is never deleted.
                </p>

                <hr class="account-divider">

                <div class="account-section">
                    <span class="account-label">Plan</span>
                    <div class="account-plan-row">
                        <span class="account-plan-badge free">Free</span>
                    </div>
                </div>

                <button class="account-upgrade-btn" id="account-upgrade-guest" style="background:#475569;">
                    View pricing
                </button>
            `;

            body.querySelector('#account-sign-in')?.addEventListener('click', () => {
                closeAccountPanel();
                showAuthModal();
            });

            body.querySelector('#account-upgrade-guest')?.addEventListener('click', () => {
                closeAccountPanel();
                if (hasPaddle) PaddleBilling.showPricingModal();
            });
        }
    }

    /**
     * Show change password modal
     */
    function showChangePasswordModal() {
        const existing = document.getElementById('change-password-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'auth-modal-overlay';
        overlay.id = 'change-password-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        overlay.innerHTML = `
            <div class="auth-modal" style="position:relative;">
                <button class="close-btn" onclick="document.getElementById('change-password-overlay').remove()">×</button>
                <h2>Change Password</h2>
                <div id="change-pw-error" class="error" style="display:none;"></div>
                <div id="change-pw-success" style="display:none;color:#059669;font-size:13px;margin-bottom:12px;"></div>
                <form id="change-pw-form">
                    <input type="password" id="change-pw-new" placeholder="New password" required minlength="6" autocomplete="new-password" />
                    <input type="password" id="change-pw-confirm" placeholder="Confirm new password" required minlength="6" autocomplete="new-password" />
                    <button type="submit" class="btn-primary" id="change-pw-submit">Update Password</button>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('change-pw-form').onsubmit = async (e) => {
            e.preventDefault();
            const newPw = document.getElementById('change-pw-new').value;
            const confirmPw = document.getElementById('change-pw-confirm').value;
            const errorEl = document.getElementById('change-pw-error');
            const successEl = document.getElementById('change-pw-success');
            const submitBtn = document.getElementById('change-pw-submit');

            errorEl.style.display = 'none';
            successEl.style.display = 'none';

            if (newPw !== confirmPw) {
                errorEl.textContent = 'Passwords do not match';
                errorEl.style.display = 'block';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Updating...';

            try {
                const result = await SupabaseClient.updatePassword(newPw);
                if (!result.success) throw new Error(result.error);
                successEl.textContent = 'Password updated successfully.';
                successEl.style.display = 'block';
                document.getElementById('change-pw-form').reset();
                setTimeout(() => overlay.remove(), 2000);
            } catch (err) {
                errorEl.textContent = err.message || 'Failed to update password';
                errorEl.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Update Password';
            }
        };
    }

    /**
     * Show the auth modal
     */
    function showAuthModal() {
        // Remove existing modal if any
        const existing = document.getElementById('auth-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'auth-modal-overlay';
        overlay.id = 'auth-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        overlay.innerHTML = `
            <div class="auth-modal" style="position:relative;">
                <button class="close-btn" onclick="document.getElementById('auth-modal-overlay').remove()">×</button>
                <h2>Sign In</h2>
                <p style="color:#6b7280;font-size:13px;margin-bottom:16px;">
                    Sign in to access your SOPs from any device.
                </p>
                <div class="tabs">
                    <button class="tab active" data-tab="signin">Sign In</button>
                    <button class="tab" data-tab="signup">Sign Up</button>
                </div>
                <div id="auth-error" class="error" style="display:none;"></div>
                <form id="auth-form">
                    <input type="text" id="auth-email" placeholder="Email" required autocomplete="email" />
                    <input type="password" id="auth-password" placeholder="Password" required minlength="6" />
                    <button type="submit" class="btn-primary" id="auth-submit">Sign In</button>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);

        // Tab switching
        let currentTab = 'signin';
        overlay.querySelectorAll('.tab').forEach(tab => {
            tab.onclick = () => {
                overlay.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentTab = tab.dataset.tab;
                document.getElementById('auth-submit').textContent = 
                    currentTab === 'signin' ? 'Sign In' : 'Sign Up';
                document.getElementById('auth-error').style.display = 'none';
            };
        });

        // Form submission
        document.getElementById('auth-form').onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const submitBtn = document.getElementById('auth-submit');
            const errorDiv = document.getElementById('auth-error');

            submitBtn.disabled = true;
            submitBtn.textContent = currentTab === 'signin' ? 'Signing in...' : 'Creating account...';
            errorDiv.style.display = 'none';

            try {
                if (currentTab === 'signin') {
                    await StorageAdapter.Auth.signIn(email, password);
                } else {
                    await StorageAdapter.Auth.signUp(email, password);
                }
                overlay.remove();
                
                // Update account button immediately
                updateAccountButton(document.getElementById('account-btn'));
                
                // Show sync status briefly
                const syncStatus = document.getElementById('sync-status');
                if (syncStatus) {
                    syncStatus.textContent = '✓ Synced';
                    syncStatus.style.display = 'block';
                    setTimeout(() => { syncStatus.style.display = 'none'; }, 3000);
                }
                
                // Check team role (owner, member, or solo)
                await checkTeamRole();
                
                // Sync subscription state from server (restores Pro if they have an active subscription)
                if (typeof PaddleBilling !== 'undefined') {
                    await PaddleBilling.syncFromServer(email);
                }
                
                // Sync business type from Supabase → localStorage
                if (typeof SupabaseClient !== 'undefined' && SupabaseClient) {
                    try {
                        const bizType = await SupabaseClient.getBusinessType();
                        if (bizType) {
                            localStorage.setItem('withoutme_business_type', bizType);
                        }
                    } catch (e) { /* ignore */ }
                    
                    // Sync digest opt-out from Supabase → localStorage
                    try {
                        const digestOptOut = await SupabaseClient.getDigestOptOut();
                        if (digestOptOut) {
                            localStorage.setItem('withoutme_digest_optout', '1');
                        } else {
                            localStorage.removeItem('withoutme_digest_optout');
                        }
                    } catch (e) { /* ignore */ }

                    // Sync webhook URL from Supabase → localStorage (Phase 12G)
                    try {
                        const wUrl = await SupabaseClient.getWebhookUrl();
                        localStorage.setItem('withoutme_webhook_url', wUrl || '');
                    } catch (e) { /* ignore */ }
                }
                
                // Force dashboard recreation so team mode takes effect
                AppState.modules.dashboard = null;
                
                // CRITICAL: Refresh dashboard to show synced data
                console.log('[app.js] Auth success - refreshing dashboard');
                showDashboard();
            } catch (err) {
                errorDiv.textContent = err.message || 'Authentication failed';
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = currentTab === 'signin' ? 'Sign In' : 'Sign Up';
            }
        };

        // Focus email input
        document.getElementById('auth-email').focus();
    }

    /**
     * Sign out the current user
     */
    async function signOut() {
        if (confirm('Sign out? Your data will remain on this device.')) {
            await StorageAdapter.Auth.signOut();
            
            // Reset team state
            AppState.teamRole = null;
            AppState.modules.dashboard = null;  // Force recreation without team mode
            
            // Reset plan state (will be restored from server on next login)
            if (typeof PaddleBilling !== 'undefined') {
                PaddleBilling.setPlan('free');
            }
            
            // Update account button immediately
            updateAccountButton(document.getElementById('account-btn'));
            
            // CRITICAL: Refresh dashboard to show local-only state
            console.log('[app.js] Sign out success - refreshing dashboard');
            showDashboard();
        }
    }

    // ========================================================================
    // DEBUG: OVERFLOW DETECTOR (enable: localStorage.setItem('debugOverflow','1'))
    // ========================================================================

    (function initOverflowDetector() {
        if (localStorage.getItem('debugOverflow') !== '1') return;

        function bestSelector(el) {
            if (el.id) return '#' + el.id;
            if (el.className && typeof el.className === 'string') {
                return el.tagName.toLowerCase() + '.' + el.className.trim().split(/\s+/).join('.');
            }
            return el.tagName.toLowerCase();
        }

        function detectOverflow() {
            const vw = document.documentElement.clientWidth;
            const all = document.querySelectorAll('*');
            const offenders = [];

            all.forEach(el => {
                const rect = el.getBoundingClientRect();
                // Check right overflow
                if (rect.right > vw + 1) {
                    offenders.push({
                        el,
                        selector: bestSelector(el),
                        right: Math.round(rect.right),
                        width: Math.round(rect.width),
                        overflow: Math.round(rect.right - vw),
                        text: (el.textContent || '').slice(0, 80).replace(/\s+/g, ' ').trim()
                    });
                }
                // Check left overflow
                if (rect.left < -1) {
                    offenders.push({
                        el,
                        selector: bestSelector(el),
                        right: Math.round(rect.right),
                        width: Math.round(rect.width),
                        overflow: Math.round(-rect.left),
                        text: (el.textContent || '').slice(0, 80).replace(/\s+/g, ' ').trim()
                    });
                }
            });

            // Sort by overflow amount, show top 5
            offenders.sort((a, b) => b.overflow - a.overflow);
            const top = offenders.slice(0, 5);

            if (top.length > 0) {
                console.warn(`🔴 OVERFLOW DETECTED — viewport: ${vw}px, ${offenders.length} offender(s)`);
                top.forEach((o, i) => {
                    console.warn(`  ${i + 1}. ${o.selector} — right:${o.right}px, width:${o.width}px, overflow:${o.overflow}px\n     text: "${o.text}"`);
                    o.el.style.outline = '2px solid red';
                    o.el.style.outlineOffset = '-2px';
                });
            } else {
                console.log(`✅ No overflow — viewport: ${vw}px`);
            }
        }

        // Run after each major DOM change (debounced)
        let timer = null;
        const observer = new MutationObserver(() => {
            clearTimeout(timer);
            timer = setTimeout(detectOverflow, 500);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Also run on resize
        window.addEventListener('resize', () => {
            clearTimeout(timer);
            timer = setTimeout(detectOverflow, 500);
        });

        // Initial run
        setTimeout(detectOverflow, 1500);
        console.log('🔍 Overflow detector ACTIVE (disable: localStorage.removeItem("debugOverflow"))');
    })();

    // ========================================================================
    // GLOBAL API (for debugging and external access)
    // ========================================================================

    /**
     * Expose app functions globally for debugging and potential external use
     */
    window.SOPToolApp = {
        // View navigation
        showDashboard: showDashboard,
        showEditor: showEditor,
        showChecklist: showChecklist,
        showCompletedChecklist: showCompletedChecklist,
        
        // Auth
        showAuthModal: showAuthModal,
        signOut: signOut,
        
        // State access (read-only)
        getState: () => ({ ...AppState }),
        getCurrentView: () => AppState.currentView,
        isAuthenticated: () => StorageAdapter?.Auth?.isAuthenticated?.() || false,
        
        // Module access
        getDashboard: () => AppState.modules.dashboard,
        getEditor: () => AppState.modules.editor,
        getChecklist: () => AppState.modules.checklist,
        
        // Re-initialization
        reinit: initApp,
        
        // Version
        version: '3.0.0'
    };

    // ========================================================================
    // DOM READY - START APPLICATION
    // ========================================================================

    /**
     * Wait for DOM to be ready, then initialize
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        // DOM already loaded
        initApp();
    }

})();
