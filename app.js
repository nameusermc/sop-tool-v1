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
    function showEditor(sop = null) {
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
            AppState.modules.editor.create();
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
        dashboard.on('onCreateSOP', () => {
            console.log('🆕 Create New SOP clicked');
            showEditor(null);  // null = create mode
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
            
            // Show success message (optional, editor already shows notification)
            console.log('Returning to Dashboard...');
            
            // Return to Dashboard and refresh to show new/updated SOP
            showDashboard();
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
    function initApp() {
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
        
        // Start with Dashboard view
        showDashboard();
        
        AppState.initialized = true;
        console.log('✅ SOP Tool Application initialized');
    }

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
        
        // State access (read-only)
        getState: () => ({ ...AppState }),
        getCurrentView: () => AppState.currentView,
        
        // Module access
        getDashboard: () => AppState.modules.dashboard,
        getEditor: () => AppState.modules.editor,
        getChecklist: () => AppState.modules.checklist,
        
        // Re-initialization
        reinit: initApp,
        
        // Version
        version: '2.1.0'
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
