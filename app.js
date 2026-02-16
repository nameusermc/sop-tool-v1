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
        currentView: 'dashboard',  // 'dashboard' | 'create' | 'edit' | 'checklist'
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
                autoRender: true
            });
            
            // Register Dashboard callbacks
            setupDashboardCallbacks();
        } else {
            console.log('Refreshing existing Dashboard');
            AppState.modules.dashboard.refresh();
        }
    }

    /**
     * Show the SOP Create/Edit view
     * @param {Object|null} sop - SOP to edit, or null for create mode
     */
    function showEditor(sop = null, createOptions = {}) {
        const mode = sop ? 'edit' : 'create';
        console.log(`📝 Switching to Editor view (mode: ${mode})`);
        
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
        dashboard.on('onCreateSOP', ({ folderId } = {}) => {
            console.log('🆕 Create New SOP clicked', folderId ? `(folder: ${folderId})` : '');
            showEditor(null, { folderId });  // null = create mode, pass folder context
        });
        
        // Handle SOP edit
        dashboard.on('onEditSOP', (sop) => {
            console.log('✏️ Edit SOP clicked:', sop.title);
            showEditor(sop);
        });
        
        // Handle SOP delete
        dashboard.on('onDeleteSOP', (sop) => {
            console.log('🗑️ SOP deleted:', sop.title);
            // Dashboard already handles the deletion, just log it
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
            } else {
                console.log('👤 Running in local-only mode');
            }
        }
        
        // Start with Dashboard view
        showDashboard();
        
        // Inject auth UI
        injectAuthUI();
        
        AppState.initialized = true;
        console.log('✅ SOP Tool Application initialized');
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
                .auth-indicator {
                    position: fixed;
                    top: 12px;
                    right: 16px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    z-index: 1000;
                }
                .auth-indicator button {
                    padding: 6px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    background: #fff;
                    cursor: pointer;
                    font-size: 13px;
                }
                .auth-indicator button:hover {
                    background: #f3f4f6;
                }
                .auth-indicator .user-email {
                    color: #6b7280;
                    max-width: 150px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .auth-hint-toggle {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #e5e7eb;
                    color: #6b7280;
                    font-size: 11px;
                    font-weight: 600;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    line-height: 1;
                }
                .auth-hint-toggle:hover {
                    background: #d1d5db;
                }
                .auth-hint {
                    display: none;
                    position: absolute;
                    right: 0;
                    top: calc(100% + 8px);
                    width: 260px;
                    padding: 10px 12px;
                    background: #fff;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                    font-size: 12px;
                    color: #6b7280;
                    line-height: 1.5;
                    margin: 0;
                }
                .auth-indicator:hover .auth-hint,
                .auth-indicator:focus-within .auth-hint {
                    display: block;
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
                    body {
                        padding-top: 40px;
                    }
                    .auth-indicator {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        justify-content: flex-end;
                        padding: 8px 12px;
                        background: #fff;
                        border-bottom: 1px solid #f3f4f6;
                        z-index: 1000;
                    }
                    .auth-hint {
                        right: 0;
                    }
                    .signin-reminder {
                        margin: 0 0.75rem 1rem;
                    }
                }
                @media (max-height: 500px) and (orientation: landscape) {
                    body {
                        padding-top: 40px;
                    }
                    .auth-indicator {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        justify-content: flex-end;
                        padding: 8px 12px;
                        background: #fff;
                        border-bottom: 1px solid #f3f4f6;
                        z-index: 1000;
                    }
                    .auth-hint {
                        right: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Create auth indicator container
        const indicator = document.createElement('div');
        indicator.className = 'auth-indicator';
        indicator.id = 'auth-indicator';
        updateAuthIndicator(indicator);
        document.body.appendChild(indicator);

        // Create sync status indicator
        const syncStatus = document.createElement('div');
        syncStatus.className = 'sync-status';
        syncStatus.id = 'sync-status';
        document.body.appendChild(syncStatus);

        // Listen for auth changes (backup listener for edge cases)
        if (StorageAdapter?.Auth?.onAuthStateChange) {
            StorageAdapter.Auth.onAuthStateChange((isAuth, user) => {
                console.log('[app.js] Auth state change detected:', isAuth ? 'logged in' : 'logged out');
                updateAuthIndicator(document.getElementById('auth-indicator'));
                
                // Only refresh dashboard if we're actually on the dashboard view
                // Supabase fires TOKEN_REFRESHED on window focus — refreshing here
                // would overwrite the editor/checklist container with dashboard HTML
                if (AppState.currentView === 'dashboard' && AppState.modules.dashboard) {
                    console.log('[app.js] Refreshing dashboard due to auth state change');
                    AppState.modules.dashboard.refresh();
                }
            });
        }
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
     * Update the auth indicator based on current state
     */
    function updateAuthIndicator(container) {
        if (!container) return;

        const isAuth = StorageAdapter?.Auth?.isAuthenticated?.() || false;
        const user = StorageAdapter?.Auth?.getUser?.();
        const hasSupabase = StorageAdapter?.hasSupabase?.() || false;

        if (!hasSupabase) {
            // No Supabase config - show nothing or "local mode"
            container.innerHTML = `<span style="color:#9ca3af;font-size:12px;">Saved on this device</span>`;
            return;
        }

        if (isAuth && user) {
            container.innerHTML = `
                <span class="user-email">☁️ ${user.email}</span>
                <button onclick="SOPToolApp.signOut()">Sign Out</button>
            `;
        } else {
            container.innerHTML = `
                <button onclick="SOPToolApp.showAuthModal()">Sign In</button>
                <span class="auth-hint-toggle" tabindex="0" title="Learn more">?</span>
                <p class="auth-hint">Sign in to access your SOPs on another device.
                If you don't sign in, everything stays saved on this computer.
                Signing out will not delete your local SOPs.</p>
            `;
        }
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
                
                // Update auth indicator immediately
                updateAuthIndicator(document.getElementById('auth-indicator'));
                
                // Show sync status briefly
                const syncStatus = document.getElementById('sync-status');
                if (syncStatus) {
                    syncStatus.textContent = '✓ Synced';
                    syncStatus.style.display = 'block';
                    setTimeout(() => { syncStatus.style.display = 'none'; }, 3000);
                }
                
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
            
            // Update auth indicator immediately
            updateAuthIndicator(document.getElementById('auth-indicator'));
            
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
