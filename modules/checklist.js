/**
 * Checklist Module - SOP Tool v1
 * 
 * This module handles the checklist view for executing SOPs:
 * - Display SOP steps in sequential order
 * - Checkbox completion tracking
 * - Progress persistence in local storage
 * - Session management (start, pause, resume, complete)
 * - AI placeholder for checklist preview/formatting
 * 
 * @module Checklist
 */

// ============================================================================
// STORAGE KEYS (Must match other modules)
// ============================================================================

/**
 * Local Storage Keys - shared across modules for data consistency
 * 
 * Data Flow:
 * 1. SOPs are created/stored by Dashboard or SOP Create module
 * 2. Checklist module reads SOPs and creates checklist sessions
 * 3. Progress is saved separately to preserve original SOP data
 * 4. Completed checklists are tracked for history/analytics
 */
const CHECKLIST_STORAGE_KEYS = {
    SOPS: 'sop_tool_sops',                           // Source SOP data (read-only here)
    FOLDERS: 'sop_tool_folders',                     // Folder data for display
    CHECKLIST_SESSIONS: 'sop_tool_checklist_sessions', // Active/paused sessions
    CHECKLIST_HISTORY: 'sop_tool_checklist_history',   // Completed checklists
    RECENT_CHECKLISTS: 'sop_tool_recent_checklists',   // Recently accessed
    SOP_USAGE: 'sop_tool_sop_usage'                    // Usage tracking
};

/**
 * Checklist Session Status Constants
 */
const SESSION_STATUS = {
    ACTIVE: 'active',       // Currently being worked on
    PAUSED: 'paused',       // Started but not complete
    COMPLETED: 'completed', // All steps checked
    ABANDONED: 'abandoned'  // Explicitly cancelled
};

// ============================================================================
// CHECKLIST MODULE CLASS
// ============================================================================

/**
 * Checklist Class
 * Manages the execution and tracking of SOP checklists
 */
class Checklist {
    /**
     * Initialize the Checklist module
     * @param {HTMLElement} containerElement - DOM element to render into
     * @param {Object} options - Configuration options
     */
    constructor(containerElement, options = {}) {
        // Container reference
        this.container = containerElement;
        
        // Configuration with defaults
        this.options = {
            enableAIFeatures: true,       // Show AI placeholder buttons
            autoSaveProgress: true,       // Auto-save on each check
            showProgressBar: true,        // Display progress indicator
            allowSkipSteps: false,        // Allow checking steps out of order
            showStepNotes: true,          // Display step notes if available
            confirmOnExit: true,          // Confirm before leaving incomplete
            ...options
        };
        
        // Current state
        this.state = {
            currentSOP: null,             // The SOP being executed
            currentSession: null,         // Active checklist session
            stepProgress: [],             // Array of {stepId, completed, completedAt}
            startedAt: null,              // Session start time
            lastSavedAt: null             // Last auto-save timestamp
        };
        
        // Cached data
        this.folders = [];
        this.recentChecklists = [];
        
        // Callbacks for integration
        this.callbacks = {
            onComplete: null,             // Called when checklist completed
            onBack: null,                 // Called when returning to dashboard
            onStepComplete: null,         // Called when a step is checked
            onSessionSave: null           // Called when session is saved
        };
        
        // Initialize
        this._init();
    }
    
    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    
    /**
     * Initialize the module
     * @private
     */
    _init() {
        this._loadCachedData();
        this._injectStyles();
    }
    
    /**
     * Load cached data from storage
     * @private
     */
    _loadCachedData() {
        // Load folders for display
        const storedFolders = localStorage.getItem(CHECKLIST_STORAGE_KEYS.FOLDERS);
        this.folders = storedFolders ? JSON.parse(storedFolders) : [];
        
        // Load recent checklists
        const storedRecent = localStorage.getItem(CHECKLIST_STORAGE_KEYS.RECENT_CHECKLISTS);
        this.recentChecklists = storedRecent ? JSON.parse(storedRecent) : [];
    }
    
    /**
     * Load all SOPs from storage
     * @private
     * @returns {Array} Array of SOPs
     */
    _loadSOPs() {
        const stored = localStorage.getItem(CHECKLIST_STORAGE_KEYS.SOPS);
        return stored ? JSON.parse(stored) : [];
    }
    
    /**
     * Load all checklist sessions from storage
     * @private
     * @returns {Array} Array of sessions
     */
    _loadSessions() {
        const stored = localStorage.getItem(CHECKLIST_STORAGE_KEYS.CHECKLIST_SESSIONS);
        return stored ? JSON.parse(stored) : [];
    }
    
    /**
     * Save sessions to storage
     * @private
     * @param {Array} sessions - Sessions array to save
     */
    _saveSessions(sessions) {
        localStorage.setItem(CHECKLIST_STORAGE_KEYS.CHECKLIST_SESSIONS, JSON.stringify(sessions));
    }
    
    /**
     * Load checklist history
     * @private
     * @returns {Array} Array of completed checklists
     */
    _loadHistory() {
        const stored = localStorage.getItem(CHECKLIST_STORAGE_KEYS.CHECKLIST_HISTORY);
        return stored ? JSON.parse(stored) : [];
    }
    
    /**
     * Save to checklist history
     * @private
     * @param {Object} completedChecklist - Completed checklist data
     */
    _saveToHistory(completedChecklist) {
        const history = this._loadHistory();
        history.unshift(completedChecklist); // Add to beginning
        
        // Keep only last 100 entries
        if (history.length > 100) {
            history.pop();
        }
        
        localStorage.setItem(CHECKLIST_STORAGE_KEYS.CHECKLIST_HISTORY, JSON.stringify(history));
    }
    
    /**
     * Update recent checklists list
     * @private
     * @param {string} sopId - SOP ID to add to recents
     */
    _updateRecentChecklists(sopId) {
        // Remove if already exists
        this.recentChecklists = this.recentChecklists.filter(id => id !== sopId);
        
        // Add to beginning
        this.recentChecklists.unshift(sopId);
        
        // Keep only last 10
        if (this.recentChecklists.length > 10) {
            this.recentChecklists.pop();
        }
        
        localStorage.setItem(
            CHECKLIST_STORAGE_KEYS.RECENT_CHECKLISTS, 
            JSON.stringify(this.recentChecklists)
        );
    }
    
    /**
     * Track SOP usage for analytics
     * @private
     * @param {string} sopId - SOP ID
     */
    _trackUsage(sopId) {
        const stored = localStorage.getItem(CHECKLIST_STORAGE_KEYS.SOP_USAGE);
        const usage = stored ? JSON.parse(stored) : {};
        
        usage[sopId] = (usage[sopId] || 0) + 1;
        
        localStorage.setItem(CHECKLIST_STORAGE_KEYS.SOP_USAGE, JSON.stringify(usage));
    }
    
    // ========================================================================
    // RENDERING
    // ========================================================================
    
    /**
     * Main render function - displays checklist view
     * @private
     */
    _render() {
        this.container.innerHTML = '';
        this.container.className = 'checklist-container';
        
        if (!this.state.currentSOP) {
            this._renderNoSOP();
            return;
        }
        
        const sop = this.state.currentSOP;
        const folder = this.folders.find(f => f.id === sop.folderId);
        const progress = this._calculateProgress();
        
        this.container.innerHTML = `
            <div class="checklist-layout">
                <!-- Header -->
                <header class="checklist-header">
                    <div class="header-left">
                        <button class="btn-back" id="btn-back" title="Back to Dashboard">
                            ← Back
                        </button>
                        <div class="header-info">
                            <span class="folder-badge" style="background: ${folder?.color || '#666'}20; color: ${folder?.color || '#666'}">
                                ${folder?.icon || '📁'} ${folder?.name || 'Uncategorized'}
                            </span>
                            <h1 class="checklist-title">${this._escapeHtml(sop.title)}</h1>
                            ${sop.description ? `
                                <p class="checklist-description">${this._escapeHtml(sop.description)}</p>
                            ` : ''}
                        </div>
                    </div>
                    <div class="header-right">
                        <div class="session-info">
                            <span class="session-status status-${this.state.currentSession?.status || 'active'}">
                                ${this.state.currentSession?.status || 'active'}
                            </span>
                            <span class="session-time" id="session-time">
                                Started: ${this._formatTime(this.state.startedAt)}
                            </span>
                        </div>
                        
                        <!-- AI Touchpoint: Format as Printable Checklist -->
                        ${this.options.enableAIFeatures ? `
                        <button class="ai-btn" id="btn-ai-preview" data-ai-action="format-preview">
                            ✨ AI: Printable Preview
                        </button>
                        ` : ''}
                    </div>
                </header>
                
                <!-- Progress Bar -->
                ${this.options.showProgressBar ? `
                <div class="progress-section">
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="progress-bar" style="width: ${progress.percentage}%"></div>
                    </div>
                    <div class="progress-text">
                        <span id="progress-count">${progress.completed} of ${progress.total} steps completed</span>
                        <span id="progress-percentage">${progress.percentage}%</span>
                    </div>
                </div>
                ` : ''}
                
                <!-- Steps List -->
                <main class="checklist-main">
                    <div class="steps-checklist" id="steps-checklist">
                        ${this._renderSteps()}
                    </div>
                </main>
                
                <!-- Footer Actions -->
                <footer class="checklist-footer">
                    <div class="footer-left">
                        <button class="btn btn-secondary" id="btn-reset">
                            🔄 Reset Progress
                        </button>
                        ${this.state.currentSession?.status !== SESSION_STATUS.COMPLETED ? `
                        <button class="btn btn-secondary" id="btn-pause">
                            ⏸️ Save & Pause
                        </button>
                        ` : ''}
                    </div>
                    <div class="footer-right">
                        ${progress.percentage === 100 ? `
                        <button class="btn btn-success" id="btn-complete">
                            ✅ Mark Complete & Return
                        </button>
                        ` : `
                        <span class="completion-hint">
                            Complete all steps to finish
                        </span>
                        `}
                    </div>
                </footer>
                
                <!-- AI Preview Modal -->
                <div class="preview-modal" id="preview-modal" style="display: none;">
                    <div class="preview-content">
                        <div class="preview-header">
                            <h3>📄 Printable Checklist Preview</h3>
                            <button class="btn-close" id="btn-close-preview">✕</button>
                        </div>
                        <div class="preview-body" id="preview-body">
                            <!-- AI-formatted content here -->
                        </div>
                        <div class="preview-footer">
                            <button class="btn btn-secondary" id="btn-copy-preview">
                                📋 Copy to Clipboard
                            </button>
                            <button class="btn btn-primary" id="btn-print-preview">
                                🖨️ Print
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Notification Toast -->
                <div class="notification-toast" id="notification-toast" style="display: none;">
                    <span class="notification-message"></span>
                </div>
            </div>
        `;
        
        this._attachEventListeners();
    }
    
    /**
     * Render when no SOP is loaded
     * @private
     */
    _renderNoSOP() {
        this.container.innerHTML = `
            <div class="checklist-layout">
                <div class="no-sop-state">
                    <div class="no-sop-icon">📋</div>
                    <h2>No Checklist Selected</h2>
                    <p>Select an SOP from the dashboard to run as a checklist</p>
                    <button class="btn btn-primary" id="btn-go-dashboard">
                        ← Go to Dashboard
                    </button>
                    
                    ${this._renderRecentChecklists()}
                    ${this._renderPausedSessions()}
                </div>
            </div>
        `;
        
        // Attach basic listeners
        document.getElementById('btn-go-dashboard')?.addEventListener('click', () => {
            if (this.callbacks.onBack) {
                this.callbacks.onBack();
            }
        });
        
        // Resume session listeners
        document.querySelectorAll('[data-resume-session]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sessionId = e.target.dataset.resumeSession;
                this.resumeSession(sessionId);
            });
        });
        
        // Recent checklist listeners
        document.querySelectorAll('[data-start-sop]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sopId = e.target.dataset.startSop;
                this.startChecklist(sopId);
            });
        });
    }
    
    /**
     * Render recent checklists section
     * @private
     * @returns {string} HTML string
     */
    _renderRecentChecklists() {
        if (this.recentChecklists.length === 0) return '';
        
        const sops = this._loadSOPs();
        const recentSOPs = this.recentChecklists
            .map(id => sops.find(s => s.id === id))
            .filter(Boolean)
            .slice(0, 5);
        
        if (recentSOPs.length === 0) return '';
        
        return `
            <div class="recent-section">
                <h3>🕐 Recent Checklists</h3>
                <div class="recent-list">
                    ${recentSOPs.map(sop => {
                        const folder = this.folders.find(f => f.id === sop.folderId);
                        return `
                            <div class="recent-item">
                                <span class="recent-icon">${folder?.icon || '📄'}</span>
                                <span class="recent-title">${this._escapeHtml(sop.title)}</span>
                                <button class="btn btn-small" data-start-sop="${sop.id}">
                                    Start
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * Render paused sessions section
     * @private
     * @returns {string} HTML string
     */
    _renderPausedSessions() {
        const sessions = this._loadSessions()
            .filter(s => s.status === SESSION_STATUS.PAUSED)
            .slice(0, 5);
        
        if (sessions.length === 0) return '';
        
        const sops = this._loadSOPs();
        
        return `
            <div class="paused-section">
                <h3>⏸️ Paused Sessions</h3>
                <div class="paused-list">
                    ${sessions.map(session => {
                        const sop = sops.find(s => s.id === session.sopId);
                        if (!sop) return '';
                        
                        const progress = this._calculateSessionProgress(session);
                        return `
                            <div class="paused-item">
                                <div class="paused-info">
                                    <span class="paused-title">${this._escapeHtml(sop.title)}</span>
                                    <span class="paused-progress">${progress.completed}/${progress.total} steps</span>
                                </div>
                                <button class="btn btn-small btn-primary" data-resume-session="${session.id}">
                                    Resume
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * Render the checklist steps
     * @private
     * @returns {string} HTML string for steps
     */
    _renderSteps() {
        const steps = this.state.currentSOP.steps || [];
        
        if (steps.length === 0) {
            return `
                <div class="no-steps">
                    <p>This SOP has no steps defined.</p>
                </div>
            `;
        }
        
        return steps.map((step, index) => {
            const progressItem = this.state.stepProgress.find(p => p.stepId === step.id);
            const isCompleted = progressItem?.completed || false;
            const completedAt = progressItem?.completedAt;
            
            // Check if step should be disabled (sequential mode)
            const previousStepComplete = index === 0 || 
                this.options.allowSkipSteps ||
                this.state.stepProgress.find(p => 
                    p.stepId === steps[index - 1].id
                )?.completed;
            
            const isDisabled = !this.options.allowSkipSteps && !previousStepComplete && !isCompleted;
            
            return `
                <div class="step-item ${isCompleted ? 'completed' : ''} ${isDisabled ? 'disabled' : ''}" 
                     data-step-id="${step.id}"
                     data-step-index="${index}">
                    
                    <!-- Checkbox -->
                    <label class="step-checkbox-wrapper">
                        <input 
                            type="checkbox" 
                            class="step-checkbox"
                            data-step-id="${step.id}"
                            ${isCompleted ? 'checked' : ''}
                            ${isDisabled ? 'disabled' : ''}
                        />
                        <span class="checkbox-custom"></span>
                    </label>
                    
                    <!-- Step Number -->
                    <div class="step-number ${isCompleted ? 'completed' : ''}">
                        ${isCompleted ? '✓' : index + 1}
                    </div>
                    
                    <!-- Step Content -->
                    <div class="step-content">
                        <p class="step-text ${isCompleted ? 'completed' : ''}">
                            ${this._escapeHtml(step.text)}
                        </p>
                        
                        ${this.options.showStepNotes && step.note ? `
                        <p class="step-note">
                            💡 ${this._escapeHtml(step.note)}
                        </p>
                        ` : ''}
                        
                        ${isCompleted && completedAt ? `
                        <span class="step-completed-time">
                            Completed at ${this._formatTime(completedAt)}
                        </span>
                        ` : ''}
                    </div>
                    
                    <!-- AI Touchpoint: Step Help -->
                    ${this.options.enableAIFeatures && !isCompleted ? `
                    <button class="ai-step-btn" 
                            data-ai-action="step-help" 
                            data-step-index="${index}"
                            title="AI: Get help with this step">
                        ❓
                    </button>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
    
    /**
     * Inject CSS styles
     * @private
     */
    _injectStyles() {
        if (document.getElementById('checklist-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'checklist-styles';
        styles.textContent = `
            /* ============================================
               Checklist Module - Minimal CSS
               ============================================ */
            
            .checklist-container {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #1f2937;
                background: #f9fafb;
                min-height: 100vh;
            }
            
            .checklist-layout {
                max-width: 800px;
                margin: 0 auto;
                padding: 2rem;
                display: flex;
                flex-direction: column;
                min-height: 100vh;
            }
            
            /* Header */
            .checklist-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 1.5rem;
                margin-bottom: 1.5rem;
                padding-bottom: 1.5rem;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .header-left {
                display: flex;
                align-items: flex-start;
                gap: 1rem;
            }
            
            .btn-back {
                padding: 0.5rem 1rem;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9rem;
                transition: all 0.15s;
                white-space: nowrap;
            }
            
            .btn-back:hover {
                background: #f3f4f6;
            }
            
            .header-info {
                flex: 1;
            }
            
            .folder-badge {
                display: inline-block;
                padding: 0.25rem 0.75rem;
                border-radius: 6px;
                font-size: 0.8rem;
                font-weight: 500;
                margin-bottom: 0.5rem;
            }
            
            .checklist-title {
                margin: 0 0 0.5rem;
                font-size: 1.5rem;
                font-weight: 600;
            }
            
            .checklist-description {
                margin: 0;
                color: #6b7280;
                font-size: 0.95rem;
            }
            
            .header-right {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 0.75rem;
            }
            
            .session-info {
                text-align: right;
            }
            
            .session-status {
                display: inline-block;
                padding: 0.25rem 0.75rem;
                border-radius: 999px;
                font-size: 0.75rem;
                font-weight: 500;
                text-transform: uppercase;
                margin-bottom: 0.25rem;
            }
            
            .status-active { background: #dbeafe; color: #1d4ed8; }
            .status-paused { background: #fef3c7; color: #92400e; }
            .status-completed { background: #d1fae5; color: #065f46; }
            
            .session-time {
                display: block;
                font-size: 0.8rem;
                color: #6b7280;
            }
            
            /* Progress Bar */
            .progress-section {
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                padding: 1rem 1.25rem;
                margin-bottom: 1.5rem;
            }
            
            .progress-bar-container {
                height: 12px;
                background: #e5e7eb;
                border-radius: 999px;
                overflow: hidden;
                margin-bottom: 0.5rem;
            }
            
            .progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #6366f1, #8b5cf6);
                border-radius: 999px;
                transition: width 0.3s ease;
            }
            
            .progress-text {
                display: flex;
                justify-content: space-between;
                font-size: 0.85rem;
                color: #6b7280;
            }
            
            #progress-percentage {
                font-weight: 600;
                color: #6366f1;
            }
            
            /* Steps List */
            .checklist-main {
                flex: 1;
            }
            
            .steps-checklist {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
            
            .step-item {
                display: flex;
                align-items: flex-start;
                gap: 1rem;
                padding: 1.25rem;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                transition: all 0.2s;
            }
            
            .step-item:hover:not(.disabled) {
                border-color: #c7d2fe;
                box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
            }
            
            .step-item.completed {
                background: #f0fdf4;
                border-color: #bbf7d0;
            }
            
            .step-item.disabled {
                opacity: 0.6;
                background: #f9fafb;
            }
            
            /* Checkbox Styling */
            .step-checkbox-wrapper {
                position: relative;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .step-checkbox {
                position: absolute;
                opacity: 0;
                cursor: pointer;
                width: 24px;
                height: 24px;
            }
            
            .checkbox-custom {
                width: 24px;
                height: 24px;
                border: 2px solid #d1d5db;
                border-radius: 6px;
                transition: all 0.15s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .step-checkbox:checked + .checkbox-custom {
                background: #22c55e;
                border-color: #22c55e;
            }
            
            .step-checkbox:checked + .checkbox-custom::after {
                content: '✓';
                color: white;
                font-size: 14px;
                font-weight: bold;
            }
            
            .step-checkbox:disabled + .checkbox-custom {
                background: #f3f4f6;
                border-color: #e5e7eb;
                cursor: not-allowed;
            }
            
            .step-checkbox:not(:disabled):hover + .checkbox-custom {
                border-color: #6366f1;
            }
            
            /* Step Number */
            .step-number {
                min-width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #6366f1;
                color: white;
                border-radius: 50%;
                font-size: 0.85rem;
                font-weight: 600;
            }
            
            .step-number.completed {
                background: #22c55e;
            }
            
            /* Step Content */
            .step-content {
                flex: 1;
            }
            
            .step-text {
                margin: 0;
                font-size: 1rem;
                line-height: 1.5;
            }
            
            .step-text.completed {
                text-decoration: line-through;
                color: #6b7280;
            }
            
            .step-note {
                margin: 0.5rem 0 0;
                padding: 0.5rem 0.75rem;
                background: #fef3c7;
                border-radius: 6px;
                font-size: 0.85rem;
                color: #92400e;
            }
            
            .step-completed-time {
                display: block;
                margin-top: 0.5rem;
                font-size: 0.75rem;
                color: #22c55e;
            }
            
            .ai-step-btn {
                width: 32px;
                height: 32px;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                background: white;
                cursor: pointer;
                font-size: 0.9rem;
                transition: all 0.15s;
            }
            
            .ai-step-btn:hover {
                background: #f0fdf4;
                border-color: #a7f3d0;
            }
            
            /* Footer */
            .checklist-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 2rem;
                padding-top: 1.5rem;
                border-top: 1px solid #e5e7eb;
            }
            
            .footer-left,
            .footer-right {
                display: flex;
                gap: 0.75rem;
                align-items: center;
            }
            
            .completion-hint {
                color: #6b7280;
                font-size: 0.9rem;
            }
            
            /* Buttons */
            .btn {
                padding: 0.75rem 1.25rem;
                border: none;
                border-radius: 8px;
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s;
            }
            
            .btn-small {
                padding: 0.5rem 1rem;
                font-size: 0.85rem;
            }
            
            .btn-primary {
                background: #6366f1;
                color: white;
            }
            
            .btn-primary:hover {
                background: #4f46e5;
            }
            
            .btn-secondary {
                background: #e5e7eb;
                color: #374151;
            }
            
            .btn-secondary:hover {
                background: #d1d5db;
            }
            
            .btn-success {
                background: #22c55e;
                color: white;
            }
            
            .btn-success:hover {
                background: #16a34a;
            }
            
            .ai-btn {
                padding: 0.625rem 1rem;
                background: linear-gradient(135deg, #f0fdf4, #ecfeff);
                border: 1px solid #a7f3d0;
                border-radius: 8px;
                color: #065f46;
                font-size: 0.85rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s;
            }
            
            .ai-btn:hover {
                background: linear-gradient(135deg, #dcfce7, #cffafe);
            }
            
            /* No SOP State */
            .no-sop-state {
                text-align: center;
                padding: 4rem 2rem;
            }
            
            .no-sop-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
            }
            
            .no-sop-state h2 {
                margin: 0 0 0.5rem;
            }
            
            .no-sop-state > p {
                color: #6b7280;
                margin-bottom: 1.5rem;
            }
            
            .recent-section,
            .paused-section {
                margin-top: 2rem;
                text-align: left;
                max-width: 400px;
                margin-left: auto;
                margin-right: auto;
            }
            
            .recent-section h3,
            .paused-section h3 {
                font-size: 1rem;
                margin-bottom: 0.75rem;
                color: #374151;
            }
            
            .recent-list,
            .paused-list {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .recent-item,
            .paused-item {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 1rem;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
            }
            
            .recent-icon {
                font-size: 1.25rem;
            }
            
            .recent-title,
            .paused-title {
                flex: 1;
                font-size: 0.9rem;
            }
            
            .paused-info {
                flex: 1;
            }
            
            .paused-progress {
                display: block;
                font-size: 0.75rem;
                color: #6b7280;
            }
            
            .no-steps {
                text-align: center;
                padding: 3rem;
                background: white;
                border: 2px dashed #e5e7eb;
                border-radius: 10px;
                color: #6b7280;
            }
            
            /* Preview Modal */
            .preview-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }
            
            .preview-content {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
            }
            
            .preview-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem 1.5rem;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .preview-header h3 {
                margin: 0;
            }
            
            .btn-close {
                width: 32px;
                height: 32px;
                border: none;
                background: #f3f4f6;
                border-radius: 6px;
                cursor: pointer;
                font-size: 1rem;
            }
            
            .btn-close:hover {
                background: #e5e7eb;
            }
            
            .preview-body {
                padding: 1.5rem;
                overflow-y: auto;
                flex: 1;
            }
            
            .preview-footer {
                display: flex;
                justify-content: flex-end;
                gap: 0.75rem;
                padding: 1rem 1.5rem;
                border-top: 1px solid #e5e7eb;
            }
            
            /* Printable Preview Styles */
            .printable-checklist {
                font-family: Georgia, serif;
            }
            
            .printable-checklist h1 {
                font-size: 1.5rem;
                border-bottom: 2px solid #000;
                padding-bottom: 0.5rem;
            }
            
            .printable-checklist .meta {
                font-size: 0.9rem;
                color: #666;
                margin-bottom: 1rem;
            }
            
            .printable-checklist ol {
                padding-left: 1.5rem;
            }
            
            .printable-checklist li {
                margin-bottom: 1rem;
                line-height: 1.6;
            }
            
            .printable-checklist .checkbox-line {
                display: flex;
                align-items: flex-start;
                gap: 0.75rem;
            }
            
            .printable-checklist .print-checkbox {
                width: 18px;
                height: 18px;
                border: 2px solid #000;
                border-radius: 3px;
                flex-shrink: 0;
                margin-top: 3px;
            }
            
            /* Notification Toast */
            .notification-toast {
                position: fixed;
                bottom: 2rem;
                right: 2rem;
                padding: 1rem 1.5rem;
                background: #1f2937;
                color: white;
                border-radius: 8px;
                font-size: 0.9rem;
                z-index: 1001;
                animation: slideIn 0.3s ease;
            }
            
            .notification-toast.success { background: #059669; }
            .notification-toast.error { background: #dc2626; }
            .notification-toast.info { background: #2563eb; }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            /* Print Styles */
            @media print {
                .checklist-header,
                .checklist-footer,
                .ai-step-btn,
                .ai-btn,
                .notification-toast {
                    display: none !important;
                }
                
                .checklist-layout {
                    padding: 0;
                }
                
                .step-item {
                    break-inside: avoid;
                }
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .checklist-layout {
                    padding: 1rem;
                }
                
                .checklist-header {
                    flex-direction: column;
                }
                
                .header-right {
                    align-items: flex-start;
                    width: 100%;
                }
                
                .checklist-footer {
                    flex-direction: column;
                    gap: 1rem;
                }
                
                .footer-left,
                .footer-right {
                    width: 100%;
                    justify-content: center;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    // ========================================================================
    // EVENT HANDLING
    // ========================================================================
    
    /**
     * Attach all event listeners
     * @private
     */
    _attachEventListeners() {
        // Back button
        document.getElementById('btn-back')?.addEventListener('click', () => {
            this._handleBack();
        });
        
        // Step checkboxes
        document.querySelectorAll('.step-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const stepId = e.target.dataset.stepId;
                const isChecked = e.target.checked;
                this._handleStepToggle(stepId, isChecked);
            });
        });
        
        // Reset progress
        document.getElementById('btn-reset')?.addEventListener('click', () => {
            this._handleReset();
        });
        
        // Pause session
        document.getElementById('btn-pause')?.addEventListener('click', () => {
            this._handlePause();
        });
        
        // Complete checklist
        document.getElementById('btn-complete')?.addEventListener('click', () => {
            this._handleComplete();
        });
        
        // AI Preview button
        document.getElementById('btn-ai-preview')?.addEventListener('click', () => {
            this._handleAIAction('format-preview');
        });
        
        // AI step help buttons
        document.querySelectorAll('[data-ai-action="step-help"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const stepIndex = e.target.dataset.stepIndex;
                this._handleAIAction('step-help', stepIndex);
            });
        });
        
        // Preview modal controls
        document.getElementById('btn-close-preview')?.addEventListener('click', () => {
            this._hidePreview();
        });
        
        document.getElementById('preview-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'preview-modal') {
                this._hidePreview();
            }
        });
        
        document.getElementById('btn-copy-preview')?.addEventListener('click', () => {
            this._copyPreviewToClipboard();
        });
        
        document.getElementById('btn-print-preview')?.addEventListener('click', () => {
            this._printPreview();
        });
    }
    
    /**
     * Handle step checkbox toggle
     * @private
     * @param {string} stepId - Step ID
     * @param {boolean} isChecked - New checked state
     */
    _handleStepToggle(stepId, isChecked) {
        // Find or create progress entry for this step
        let progressItem = this.state.stepProgress.find(p => p.stepId === stepId);
        
        if (!progressItem) {
            progressItem = { stepId, completed: false, completedAt: null };
            this.state.stepProgress.push(progressItem);
        }
        
        // Update completion status
        progressItem.completed = isChecked;
        progressItem.completedAt = isChecked ? Date.now() : null;
        
        // Auto-save if enabled
        if (this.options.autoSaveProgress) {
            this._saveCurrentSession();
        }
        
        // Update UI
        this._updateProgressDisplay();
        this._updateStepUI(stepId, isChecked);
        
        // Trigger callback
        if (this.callbacks.onStepComplete) {
            const step = this.state.currentSOP.steps.find(s => s.id === stepId);
            this.callbacks.onStepComplete(step, isChecked, this._calculateProgress());
        }
        
        // Check if all steps complete
        const progress = this._calculateProgress();
        if (progress.percentage === 100) {
            this._showNotification('🎉 All steps completed!', 'success');
            this._updateFooterUI();
        }
    }
    
    /**
     * Update progress display
     * @private
     */
    _updateProgressDisplay() {
        const progress = this._calculateProgress();
        
        const progressBar = document.getElementById('progress-bar');
        const progressCount = document.getElementById('progress-count');
        const progressPercentage = document.getElementById('progress-percentage');
        
        if (progressBar) {
            progressBar.style.width = `${progress.percentage}%`;
        }
        
        if (progressCount) {
            progressCount.textContent = `${progress.completed} of ${progress.total} steps completed`;
        }
        
        if (progressPercentage) {
            progressPercentage.textContent = `${progress.percentage}%`;
        }
    }
    
    /**
     * Update single step UI after toggle
     * @private
     * @param {string} stepId - Step ID
     * @param {boolean} isChecked - Checked state
     */
    _updateStepUI(stepId, isChecked) {
        const stepItem = document.querySelector(`[data-step-id="${stepId}"]`);
        if (!stepItem) return;
        
        if (isChecked) {
            stepItem.classList.add('completed');
        } else {
            stepItem.classList.remove('completed');
        }
        
        // Update step number
        const stepNumber = stepItem.querySelector('.step-number');
        if (stepNumber) {
            if (isChecked) {
                stepNumber.classList.add('completed');
                stepNumber.textContent = '✓';
            } else {
                stepNumber.classList.remove('completed');
                const index = parseInt(stepItem.dataset.stepIndex);
                stepNumber.textContent = index + 1;
            }
        }
        
        // Update step text
        const stepText = stepItem.querySelector('.step-text');
        if (stepText) {
            if (isChecked) {
                stepText.classList.add('completed');
            } else {
                stepText.classList.remove('completed');
            }
        }
        
        // Enable next step if sequential mode
        if (!this.options.allowSkipSteps && isChecked) {
            const nextStepItem = stepItem.nextElementSibling;
            if (nextStepItem && nextStepItem.classList.contains('disabled')) {
                nextStepItem.classList.remove('disabled');
                const nextCheckbox = nextStepItem.querySelector('.step-checkbox');
                if (nextCheckbox) {
                    nextCheckbox.disabled = false;
                }
            }
        }
    }
    
    /**
     * Update footer UI (show/hide complete button)
     * @private
     */
    _updateFooterUI() {
        const progress = this._calculateProgress();
        const footerRight = document.querySelector('.footer-right');
        
        if (footerRight) {
            if (progress.percentage === 100) {
                footerRight.innerHTML = `
                    <button class="btn btn-success" id="btn-complete">
                        ✅ Mark Complete & Return
                    </button>
                `;
                document.getElementById('btn-complete')?.addEventListener('click', () => {
                    this._handleComplete();
                });
            } else {
                footerRight.innerHTML = `
                    <span class="completion-hint">
                        Complete all steps to finish
                    </span>
                `;
            }
        }
    }
    
    /**
     * Handle back button
     * @private
     */
    _handleBack() {
        const progress = this._calculateProgress();
        
        if (this.options.confirmOnExit && progress.completed > 0 && progress.percentage < 100) {
            if (confirm('You have incomplete progress. Would you like to save and pause this checklist?')) {
                this._handlePause();
            }
        }
        
        if (this.callbacks.onBack) {
            this.callbacks.onBack();
        }
    }
    
    /**
     * Handle reset progress
     * @private
     */
    _handleReset() {
        if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
            this.state.stepProgress = [];
            this.state.startedAt = Date.now();
            this._saveCurrentSession();
            this._render();
            this._showNotification('Progress reset', 'info');
        }
    }
    
    /**
     * Handle pause session
     * @private
     */
    _handlePause() {
        if (!this.state.currentSession) return;
        
        this.state.currentSession.status = SESSION_STATUS.PAUSED;
        this._saveCurrentSession();
        
        this._showNotification('Session saved and paused', 'success');
        
        // Return to dashboard after brief delay
        setTimeout(() => {
            if (this.callbacks.onBack) {
                this.callbacks.onBack();
            }
        }, 1000);
    }
    
    /**
     * Handle complete checklist
     * @private
     */
    _handleComplete() {
        const progress = this._calculateProgress();
        
        if (progress.percentage < 100) {
            this._showNotification('Please complete all steps first', 'error');
            return;
        }
        
        // Update session status
        this.state.currentSession.status = SESSION_STATUS.COMPLETED;
        this.state.currentSession.completedAt = Date.now();
        
        // Remove from active sessions
        const sessions = this._loadSessions();
        const filteredSessions = sessions.filter(s => s.id !== this.state.currentSession.id);
        this._saveSessions(filteredSessions);
        
        // Add to history
        this._saveToHistory({
            ...this.state.currentSession,
            sopTitle: this.state.currentSOP.title,
            duration: Date.now() - this.state.startedAt
        });
        
        // Track usage
        this._trackUsage(this.state.currentSOP.id);
        
        this._showNotification('🎉 Checklist completed!', 'success');
        
        // Trigger callback
        if (this.callbacks.onComplete) {
            this.callbacks.onComplete(this.state.currentSOP, this.state.currentSession);
        }
        
        // Return to dashboard
        setTimeout(() => {
            if (this.callbacks.onBack) {
                this.callbacks.onBack();
            }
        }, 1500);
    }
    
    // ========================================================================
    // AI TOUCHPOINT HANDLERS
    // ========================================================================
    
    /**
     * Handle AI actions
     * @private
     * @param {string} action - AI action type
     * @param {number|string} stepIndex - Optional step index
     */
    _handleAIAction(action, stepIndex = null) {
        switch (action) {
            case 'format-preview':
                /**
                 * AI Touchpoint: Format as Printable Checklist
                 * 
                 * Purpose: Generate a nicely formatted, printable version
                 * Input: SOP data, current progress
                 * Output: Formatted HTML/text suitable for printing
                 * 
                 * Example prompt: "Format this checklist for printing with
                 * clear checkboxes, proper spacing, and professional layout..."
                 */
                console.log('🤖 AI Action: Format Printable Preview');
                console.log('Input:', {
                    sop: this.state.currentSOP,
                    progress: this.state.stepProgress
                });
                
                this._showPrintablePreview();
                break;
                
            case 'step-help':
                /**
                 * AI Touchpoint: Get Help with Step
                 * 
                 * Purpose: Provide additional context or guidance for a step
                 * Input: Step text, SOP context
                 * Output: Helpful tips, clarifications, or examples
                 * 
                 * Example prompt: "Provide helpful guidance for completing
                 * this step: [step text]. Include tips and common mistakes..."
                 */
                const step = this.state.currentSOP.steps[parseInt(stepIndex)];
                console.log('🤖 AI Action: Step Help', stepIndex);
                console.log('Input:', {
                    step: step,
                    sopContext: this.state.currentSOP
                });
                
                this._showAIPlaceholder(
                    `Getting help for: "${step.text.substring(0, 50)}..."`,
                    'step-help'
                );
                break;
                
            default:
                console.log('Unknown AI action:', action);
        }
    }
    
    /**
     * Show printable preview
     * @private
     */
    _showPrintablePreview() {
        const sop = this.state.currentSOP;
        const folder = this.folders.find(f => f.id === sop.folderId);
        const now = new Date().toLocaleDateString();
        
        /**
         * In production, this could be enhanced by AI to:
         * - Optimize layout for specific paper sizes
         * - Add company branding
         * - Include QR codes for digital tracking
         * - Generate PDF directly
         */
        
        const previewHTML = `
            <div class="printable-checklist">
                <h1>${this._escapeHtml(sop.title)}</h1>
                <div class="meta">
                    <p><strong>Category:</strong> ${folder?.name || 'General'}</p>
                    <p><strong>Date:</strong> ${now}</p>
                    <p><strong>Prepared by:</strong> _______________</p>
                </div>
                
                ${sop.description ? `<p><em>${this._escapeHtml(sop.description)}</em></p>` : ''}
                
                <hr style="margin: 1rem 0;" />
                
                <ol>
                    ${sop.steps.map((step, i) => `
                        <li>
                            <div class="checkbox-line">
                                <div class="print-checkbox"></div>
                                <span>${this._escapeHtml(step.text)}</span>
                            </div>
                            ${step.note ? `<p style="margin-left: 2rem; font-size: 0.85rem; color: #666;">Note: ${this._escapeHtml(step.note)}</p>` : ''}
                        </li>
                    `).join('')}
                </ol>
                
                <hr style="margin: 1.5rem 0;" />
                
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                    <p><strong>Completed by:</strong> _______________</p>
                    <p><strong>Date:</strong> _______________</p>
                    <p><strong>Signature:</strong> _______________</p>
                </div>
            </div>
        `;
        
        const previewBody = document.getElementById('preview-body');
        const previewModal = document.getElementById('preview-modal');
        
        if (previewBody) {
            previewBody.innerHTML = previewHTML;
        }
        
        if (previewModal) {
            previewModal.style.display = 'flex';
        }
    }
    
    /**
     * Hide preview modal
     * @private
     */
    _hidePreview() {
        const modal = document.getElementById('preview-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    /**
     * Copy preview to clipboard
     * @private
     */
    _copyPreviewToClipboard() {
        const previewBody = document.getElementById('preview-body');
        if (!previewBody) return;
        
        // Get text content
        const text = previewBody.innerText;
        
        navigator.clipboard.writeText(text).then(() => {
            this._showNotification('Copied to clipboard!', 'success');
        }).catch(() => {
            this._showNotification('Failed to copy', 'error');
        });
    }
    
    /**
     * Print preview
     * @private
     */
    _printPreview() {
        const previewBody = document.getElementById('preview-body');
        if (!previewBody) return;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Print Checklist</title>
                <style>
                    body { font-family: Georgia, serif; padding: 2rem; }
                    h1 { font-size: 1.5rem; border-bottom: 2px solid #000; padding-bottom: 0.5rem; }
                    .meta { font-size: 0.9rem; color: #666; margin-bottom: 1rem; }
                    ol { padding-left: 1.5rem; }
                    li { margin-bottom: 1rem; line-height: 1.6; }
                    .checkbox-line { display: flex; align-items: flex-start; gap: 0.75rem; }
                    .print-checkbox { width: 18px; height: 18px; border: 2px solid #000; border-radius: 3px; flex-shrink: 0; margin-top: 3px; }
                </style>
            </head>
            <body>
                ${previewBody.innerHTML}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }
    
    /**
     * Show AI placeholder message
     * @private
     * @param {string} message - Message to display
     * @param {string} action - Action identifier
     */
    _showAIPlaceholder(message, action) {
        this._showNotification(message, 'info');
        
        setTimeout(() => {
            alert(`✨ AI Feature Placeholder\n\nAction: ${action}\n\nIn production, this would provide AI-generated assistance.`);
        }, 500);
    }
    
    // ========================================================================
    // SESSION MANAGEMENT
    // ========================================================================
    
    /**
     * Save current session to storage
     * @private
     */
    _saveCurrentSession() {
        if (!this.state.currentSession) return;
        
        // Update session data
        this.state.currentSession.stepProgress = [...this.state.stepProgress];
        this.state.currentSession.lastUpdatedAt = Date.now();
        
        // Load existing sessions
        const sessions = this._loadSessions();
        
        // Find and update or add
        const index = sessions.findIndex(s => s.id === this.state.currentSession.id);
        if (index !== -1) {
            sessions[index] = this.state.currentSession;
        } else {
            sessions.push(this.state.currentSession);
        }
        
        this._saveSessions(sessions);
        this.state.lastSavedAt = Date.now();
        
        // Trigger callback
        if (this.callbacks.onSessionSave) {
            this.callbacks.onSessionSave(this.state.currentSession);
        }
    }
    
    /**
     * Calculate progress from step progress array
     * @private
     * @returns {Object} { completed, total, percentage }
     */
    _calculateProgress() {
        const total = this.state.currentSOP?.steps?.length || 0;
        const completed = this.state.stepProgress.filter(p => p.completed).length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        return { completed, total, percentage };
    }
    
    /**
     * Calculate progress for a session object
     * @private
     * @param {Object} session - Session object
     * @returns {Object} { completed, total }
     */
    _calculateSessionProgress(session) {
        const sops = this._loadSOPs();
        const sop = sops.find(s => s.id === session.sopId);
        const total = sop?.steps?.length || 0;
        const completed = session.stepProgress?.filter(p => p.completed).length || 0;
        
        return { completed, total };
    }
    
    // ========================================================================
    // PUBLIC API
    // ========================================================================
    
    /**
     * Start a new checklist for an SOP
     * @public
     * @param {string|Object} sopOrId - SOP object or ID
     */
    startChecklist(sopOrId) {
        // Load SOP if ID provided
        let sop = sopOrId;
        if (typeof sopOrId === 'string') {
            const sops = this._loadSOPs();
            sop = sops.find(s => s.id === sopOrId);
        }
        
        if (!sop) {
            this._showNotification('SOP not found', 'error');
            return;
        }
        
        // Check for existing paused session
        const sessions = this._loadSessions();
        const existingSession = sessions.find(
            s => s.sopId === sop.id && s.status === SESSION_STATUS.PAUSED
        );
        
        if (existingSession) {
            if (confirm('You have a paused session for this SOP. Would you like to resume it?')) {
                this.resumeSession(existingSession.id);
                return;
            }
        }
        
        // Create new session
        const newSession = {
            id: `session_${Date.now()}`,
            sopId: sop.id,
            status: SESSION_STATUS.ACTIVE,
            stepProgress: [],
            startedAt: Date.now(),
            lastUpdatedAt: Date.now()
        };
        
        // Set state
        this.state.currentSOP = sop;
        this.state.currentSession = newSession;
        this.state.stepProgress = [];
        this.state.startedAt = Date.now();
        
        // Save session
        this._saveCurrentSession();
        
        // Update recents
        this._updateRecentChecklists(sop.id);
        
        // Render
        this._render();
    }
    
    /**
     * Resume a paused session
     * @public
     * @param {string} sessionId - Session ID to resume
     */
    resumeSession(sessionId) {
        const sessions = this._loadSessions();
        const session = sessions.find(s => s.id === sessionId);
        
        if (!session) {
            this._showNotification('Session not found', 'error');
            return;
        }
        
        // Load the SOP
        const sops = this._loadSOPs();
        const sop = sops.find(s => s.id === session.sopId);
        
        if (!sop) {
            this._showNotification('SOP not found', 'error');
            return;
        }
        
        // Restore state
        this.state.currentSOP = sop;
        this.state.currentSession = session;
        this.state.stepProgress = session.stepProgress || [];
        this.state.startedAt = session.startedAt;
        
        // Update session status
        this.state.currentSession.status = SESSION_STATUS.ACTIVE;
        this._saveCurrentSession();
        
        // Update recents
        this._updateRecentChecklists(sop.id);
        
        // Render
        this._render();
        
        this._showNotification('Session resumed', 'success');
    }
    
    /**
     * Get all paused sessions
     * @public
     * @returns {Array} Array of paused sessions
     */
    getPausedSessions() {
        return this._loadSessions().filter(s => s.status === SESSION_STATUS.PAUSED);
    }
    
    /**
     * Get checklist history
     * @public
     * @param {number} limit - Max items to return
     * @returns {Array} Array of completed checklists
     */
    getHistory(limit = 20) {
        return this._loadHistory().slice(0, limit);
    }
    
    /**
     * Get recent checklists
     * @public
     * @returns {Array} Array of recent SOP IDs
     */
    getRecentChecklists() {
        return [...this.recentChecklists];
    }
    
    /**
     * Register callback functions
     * @public
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        const validEvents = ['onComplete', 'onBack', 'onStepComplete', 'onSessionSave'];
        
        if (validEvents.includes(event)) {
            this.callbacks[event] = callback;
        } else {
            console.warn(`Unknown event: ${event}. Valid: ${validEvents.join(', ')}`);
        }
    }
    
    /**
     * Show the checklist selector (no SOP state)
     * @public
     */
    showSelector() {
        this.state.currentSOP = null;
        this.state.currentSession = null;
        this._loadCachedData();
        this._render();
    }
    
    /**
     * Refresh the view
     * @public
     */
    refresh() {
        this._loadCachedData();
        this._render();
    }
    
    /**
     * Destroy and clean up
     * @public
     */
    destroy() {
        this.container.innerHTML = '';
        
        const styles = document.getElementById('checklist-styles');
        if (styles) {
            styles.remove();
        }
    }
    
    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================
    
    /**
     * Escape HTML to prevent XSS
     * @private
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
    
    /**
     * Format timestamp to readable time
     * @private
     * @param {number} timestamp - Unix timestamp
     * @returns {string} Formatted time string
     */
    _formatTime(timestamp) {
        if (!timestamp) return 'Unknown';
        return new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    /**
     * Show notification toast
     * @private
     * @param {string} message - Message to display
     * @param {string} type - 'success', 'error', or 'info'
     */
    _showNotification(message, type = 'info') {
        const toast = document.getElementById('notification-toast');
        if (!toast) return;
        
        toast.className = `notification-toast ${type}`;
        toast.querySelector('.notification-message').textContent = message;
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

/**
 * Factory function to create Checklist instance
 * @param {HTMLElement|string} container - Container element or selector
 * @param {Object} options - Configuration options
 * @returns {Checklist} Checklist instance
 */
function createChecklist(container, options = {}) {
    const containerEl = typeof container === 'string'
        ? document.querySelector(container)
        : container;
    
    if (!containerEl) {
        throw new Error('Checklist container element not found');
    }
    
    return new Checklist(containerEl, options);
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Checklist, createChecklist, CHECKLIST_STORAGE_KEYS, SESSION_STATUS };
} else if (typeof window !== 'undefined') {
    window.Checklist = Checklist;
    window.createChecklist = createChecklist;
    window.CHECKLIST_STORAGE_KEYS = CHECKLIST_STORAGE_KEYS;
    window.SESSION_STATUS = SESSION_STATUS;
}

// ES6 module export
export { Checklist, createChecklist, CHECKLIST_STORAGE_KEYS, SESSION_STATUS };
