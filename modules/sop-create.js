/**
 * SOP Create/Edit Module - SOP Tool v1
 * 
 * This module handles creating and editing Standard Operating Procedures:
 * - Form for title and description
 * - Step editor with add, edit, remove, reorder functionality
 * - Folder/category assignment
 * - AI-powered step generation placeholders
 * - Local storage persistence
 * 
 * @module SOPCreate
 */

// ============================================================================
// STORAGE KEYS (Must match Dashboard module)
// ============================================================================

/**
 * Local Storage Keys - shared with Dashboard module for data consistency
 */
const SOP_STORAGE_KEYS = {
    SOPS: 'sop_tool_sops',
    FOLDERS: 'sop_tool_folders',
    SOP_USAGE: 'sop_tool_sop_usage',
    DRAFTS: 'sop_tool_drafts'  // Auto-save drafts
};

/**
 * Default folders (fallback if Dashboard hasn't initialized them)
 */
const DEFAULT_FOLDERS = [
    { id: 'general', name: 'General', color: '#6366f1', icon: '📁' },
    { id: 'onboarding', name: 'Onboarding', color: '#22c55e', icon: '👋' },
    { id: 'operations', name: 'Operations', color: '#f59e0b', icon: '⚙️' },
    { id: 'safety', name: 'Safety', color: '#ef4444', icon: '🛡️' },
    { id: 'hr', name: 'HR & Compliance', color: '#8b5cf6', icon: '📋' }
];

// ============================================================================
// SOP CREATE/EDIT MODULE CLASS
// ============================================================================

/**
 * SOPCreate Class
 * Handles the creation and editing of SOPs with a rich step editor
 */
class SOPCreate {
    /**
     * Initialize the SOP Create/Edit module
     * @param {HTMLElement} containerElement - DOM element to render into
     * @param {Object} options - Configuration options
     */
    constructor(containerElement, options = {}) {
        // Container reference
        this.container = containerElement;
        
        // Configuration with defaults
        this.options = {
            mode: 'create',              // 'create' or 'edit'
            enableAIFeatures: true,      // Show AI placeholder buttons
            autoSaveDrafts: true,        // Auto-save drafts to localStorage
            autoSaveInterval: 30000,     // Auto-save every 30 seconds
            maxSteps: 50,                // Maximum steps allowed
            ...options
        };
        
        // Current SOP being edited (null for new SOP)
        this.currentSOP = null;
        
        // Form state
        this.formState = {
            title: '',
            description: '',
            folderId: 'general',
            steps: [],
            tags: [],
            status: 'draft'
        };
        
        // Available folders (loaded from storage)
        this.folders = [];
        
        // Drag and drop state for step reordering
        this.dragState = {
            dragging: false,
            draggedIndex: null,
            dragOverIndex: null
        };
        
        // Auto-save timer reference
        this.autoSaveTimer = null;
        
        // Callbacks for integration with other modules
        this.callbacks = {
            onSave: null,          // Called when SOP is saved
            onCancel: null,        // Called when editing is cancelled
            onDelete: null,        // Called when SOP is deleted (edit mode)
            onChange: null         // Called when form data changes
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
        this._loadFolders();
        this._injectStyles();
        this._render();
        this._attachEventListeners();
        this._setupAutoSave();
    }
    
    /**
     * Load folders from local storage
     * @private
     */
    _loadFolders() {
        const stored = localStorage.getItem(SOP_STORAGE_KEYS.FOLDERS);
        this.folders = stored ? JSON.parse(stored) : [...DEFAULT_FOLDERS];
    }
    
    /**
     * Load all SOPs from storage (for edit mode)
     * @private
     * @returns {Array} Array of SOPs
     */
    _loadSOPs() {
        const stored = localStorage.getItem(SOP_STORAGE_KEYS.SOPS);
        return stored ? JSON.parse(stored) : [];
    }
    
    /**
     * Save all SOPs to storage
     * @private
     * @param {Array} sops - Array of SOPs to save
     */
    _saveSOPs(sops) {
        localStorage.setItem(SOP_STORAGE_KEYS.SOPS, JSON.stringify(sops));
    }
    
    /**
     * Setup auto-save functionality
     * @private
     */
    _setupAutoSave() {
        if (!this.options.autoSaveDrafts) return;
        
        // Clear existing timer
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        // Set up new timer
        this.autoSaveTimer = setInterval(() => {
            this._saveDraft();
        }, this.options.autoSaveInterval);
    }
    
    /**
     * Save current form state as draft
     * @private
     */
    _saveDraft() {
        if (this.options.mode === 'create' && this._hasContent()) {
            const draft = {
                ...this.formState,
                savedAt: Date.now()
            };
            localStorage.setItem(SOP_STORAGE_KEYS.DRAFTS, JSON.stringify(draft));
            this._showNotification('Draft auto-saved', 'info');
        }
    }
    
    /**
     * Load draft if exists
     * @private
     * @returns {Object|null} Draft data or null
     */
    _loadDraft() {
        const stored = localStorage.getItem(SOP_STORAGE_KEYS.DRAFTS);
        return stored ? JSON.parse(stored) : null;
    }
    
    /**
     * Clear saved draft
     * @private
     */
    _clearDraft() {
        localStorage.removeItem(SOP_STORAGE_KEYS.DRAFTS);
    }
    
    /**
     * Check if form has any content
     * @private
     * @returns {boolean}
     */
    _hasContent() {
        return this.formState.title.trim() !== '' || 
               this.formState.description.trim() !== '' ||
               this.formState.steps.length > 0;
    }
    
    // ========================================================================
    // RENDERING
    // ========================================================================
    
    /**
     * Main render function
     * @private
     */
    _render() {
        this.container.innerHTML = '';
        this.container.className = 'sop-create-container';
        
        const isEditMode = this.options.mode === 'edit';
        const headerTitle = isEditMode ? 'Edit SOP' : 'Create New SOP';
        const saveButtonText = isEditMode ? 'Update SOP' : 'Save SOP';
        
        this.container.innerHTML = `
            <div class="sop-create-layout">
                <!-- Header -->
                <header class="sop-create-header">
                    <div class="header-left">
                        <button class="btn-back" id="btn-back" title="Go Back">
                            ← Back
                        </button>
                        <h2>${headerTitle}</h2>
                        ${isEditMode && this.currentSOP ? `
                            <span class="edit-indicator">Editing: ${this._escapeHtml(this.currentSOP.title)}</span>
                        ` : ''}
                    </div>
                    <div class="header-right">
                        <span class="status-badge status-${this.formState.status}">
                            ${this.formState.status}
                        </span>
                        ${this.options.autoSaveDrafts ? `
                            <span class="auto-save-indicator" id="auto-save-indicator">
                                Auto-save enabled
                            </span>
                        ` : ''}
                    </div>
                </header>
                
                <!-- Main Form -->
                <main class="sop-create-main">
                    <form class="sop-form" id="sop-form">
                        <!-- Basic Info Section -->
                        <section class="form-section">
                            <h3>📝 Basic Information</h3>
                            
                            <div class="form-group">
                                <label for="sop-title">
                                    SOP Title <span class="required">*</span>
                                </label>
                                <input 
                                    type="text" 
                                    id="sop-title" 
                                    class="form-input"
                                    placeholder="e.g., New Employee Onboarding Process"
                                    value="${this._escapeHtml(this.formState.title)}"
                                    maxlength="200"
                                    required
                                />
                                <span class="char-count">
                                    <span id="title-count">${this.formState.title.length}</span>/200
                                </span>
                                
                                <!-- AI Touchpoint: Generate Title Suggestions -->
                                ${this.options.enableAIFeatures ? `
                                <button type="button" class="ai-btn-inline" data-ai-action="suggest-title">
                                    ✨ AI: Suggest Better Title
                                </button>
                                ` : ''}
                            </div>
                            
                            <div class="form-group">
                                <label for="sop-description">Description</label>
                                <textarea 
                                    id="sop-description" 
                                    class="form-textarea"
                                    placeholder="Brief description of what this SOP covers and when to use it..."
                                    rows="3"
                                    maxlength="500"
                                >${this._escapeHtml(this.formState.description)}</textarea>
                                <span class="char-count">
                                    <span id="desc-count">${this.formState.description.length}</span>/500
                                </span>
                                
                                <!-- AI Touchpoint: Improve Description -->
                                ${this.options.enableAIFeatures ? `
                                <button type="button" class="ai-btn-inline" data-ai-action="improve-description">
                                    ✨ AI: Improve Description
                                </button>
                                ` : ''}
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="sop-folder">Folder / Category</label>
                                    <select id="sop-folder" class="form-select">
                                        ${this._renderFolderOptions()}
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="sop-status">Status</label>
                                    <select id="sop-status" class="form-select">
                                        <option value="draft" ${this.formState.status === 'draft' ? 'selected' : ''}>
                                            📝 Draft
                                        </option>
                                        <option value="active" ${this.formState.status === 'active' ? 'selected' : ''}>
                                            ✅ Active
                                        </option>
                                        <option value="archived" ${this.formState.status === 'archived' ? 'selected' : ''}>
                                            📦 Archived
                                        </option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="sop-tags">Tags (comma-separated)</label>
                                <input 
                                    type="text" 
                                    id="sop-tags" 
                                    class="form-input"
                                    placeholder="e.g., onboarding, hr, training"
                                    value="${this.formState.tags.join(', ')}"
                                />
                                <span class="help-text">Add tags to make this SOP easier to find</span>
                            </div>
                        </section>
                        
                        <!-- Steps Section -->
                        <section class="form-section steps-section">
                            <div class="section-header">
                                <h3>📋 Steps</h3>
                                <span class="step-count" id="step-count">
                                    ${this.formState.steps.length} / ${this.options.maxSteps} steps
                                </span>
                            </div>
                            
                            <!-- AI Touchpoint: Generate Steps -->
                            ${this.options.enableAIFeatures ? `
                            <div class="ai-steps-panel">
                                <p class="ai-panel-description">
                                    Let AI help you draft steps based on your title and description
                                </p>
                                <div class="ai-steps-actions">
                                    <button type="button" class="ai-btn" data-ai-action="draft-steps">
                                        ✨ AI: Draft Steps Automatically
                                    </button>
                                    <button type="button" class="ai-btn-secondary" data-ai-action="suggest-missing">
                                        🔍 AI: Suggest Missing Steps
                                    </button>
                                </div>
                            </div>
                            ` : ''}
                            
                            <!-- Steps List -->
                            <div class="steps-list" id="steps-list">
                                ${this._renderStepsList()}
                            </div>
                            
                            <!-- Add Step Button -->
                            <button 
                                type="button" 
                                class="btn-add-step" 
                                id="btn-add-step"
                                ${this.formState.steps.length >= this.options.maxSteps ? 'disabled' : ''}
                            >
                                ➕ Add Step
                            </button>
                        </section>
                        
                        <!-- Form Actions -->
                        <section class="form-actions">
                            <div class="actions-left">
                                ${isEditMode ? `
                                <button type="button" class="btn btn-danger" id="btn-delete">
                                    🗑️ Delete SOP
                                </button>
                                ` : ''}
                            </div>
                            <div class="actions-right">
                                <button type="button" class="btn btn-secondary" id="btn-cancel">
                                    Cancel
                                </button>
                                <button type="button" class="btn btn-secondary" id="btn-preview">
                                    👁️ Preview
                                </button>
                                <button type="submit" class="btn btn-primary" id="btn-save">
                                    💾 ${saveButtonText}
                                </button>
                            </div>
                        </section>
                    </form>
                </main>
                
                <!-- Preview Modal (hidden by default) -->
                <div class="preview-modal" id="preview-modal" style="display: none;">
                    <div class="preview-content">
                        <div class="preview-header">
                            <h3>Preview SOP</h3>
                            <button class="btn-close" id="btn-close-preview">✕</button>
                        </div>
                        <div class="preview-body" id="preview-body">
                            <!-- Preview content rendered here -->
                        </div>
                    </div>
                </div>
                
                <!-- Notification Toast -->
                <div class="notification-toast" id="notification-toast" style="display: none;">
                    <span class="notification-message"></span>
                </div>
            </div>
        `;
    }
    
    /**
     * Render folder dropdown options
     * @private
     * @returns {string} HTML options string
     */
    _renderFolderOptions() {
        return this.folders.map(folder => `
            <option value="${folder.id}" ${this.formState.folderId === folder.id ? 'selected' : ''}>
                ${folder.icon || '📁'} ${folder.name}
            </option>
        `).join('');
    }
    
    /**
     * Render the steps list with drag handles
     * @private
     * @returns {string} HTML string for steps
     */
    _renderStepsList() {
        if (this.formState.steps.length === 0) {
            return `
                <div class="steps-empty" id="steps-empty">
                    <p>📭 No steps added yet</p>
                    <p class="help-text">Click "Add Step" or use AI to generate steps</p>
                </div>
            `;
        }
        
        return this.formState.steps.map((step, index) => `
            <div class="step-item ${this.dragState.dragOverIndex === index ? 'drag-over' : ''}" 
                 data-step-index="${index}"
                 draggable="true">
                
                <!-- Drag Handle -->
                <div class="step-drag-handle" title="Drag to reorder">
                    ⋮⋮
                </div>
                
                <!-- Step Number -->
                <div class="step-number">${index + 1}</div>
                
                <!-- Step Content -->
                <div class="step-content">
                    <textarea 
                        class="step-input"
                        data-step-index="${index}"
                        placeholder="Describe this step..."
                        rows="2"
                    >${this._escapeHtml(step.text)}</textarea>
                    
                    <!-- Step Meta (optional fields) -->
                    <div class="step-meta">
                        <input 
                            type="text" 
                            class="step-note-input"
                            data-step-index="${index}"
                            placeholder="Add note or tip (optional)"
                            value="${this._escapeHtml(step.note || '')}"
                        />
                    </div>
                </div>
                
                <!-- Step Actions -->
                <div class="step-actions">
                    <!-- AI Touchpoint: Improve Step Language -->
                    ${this.options.enableAIFeatures ? `
                    <button type="button" 
                            class="step-action-btn ai-step-btn" 
                            data-ai-action="improve-step" 
                            data-step-index="${index}"
                            title="AI: Improve Step Language">
                        ✨
                    </button>
                    ` : ''}
                    
                    <button type="button" 
                            class="step-action-btn" 
                            data-action="move-up" 
                            data-step-index="${index}"
                            title="Move Up"
                            ${index === 0 ? 'disabled' : ''}>
                        ↑
                    </button>
                    
                    <button type="button" 
                            class="step-action-btn" 
                            data-action="move-down" 
                            data-step-index="${index}"
                            title="Move Down"
                            ${index === this.formState.steps.length - 1 ? 'disabled' : ''}>
                        ↓
                    </button>
                    
                    <button type="button" 
                            class="step-action-btn step-delete-btn" 
                            data-action="delete" 
                            data-step-index="${index}"
                            title="Delete Step">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Render preview content
     * @private
     * @returns {string} HTML preview string
     */
    _renderPreview() {
        const folder = this.folders.find(f => f.id === this.formState.folderId);
        
        return `
            <div class="preview-sop">
                <div class="preview-meta">
                    <span class="preview-folder" style="background: ${folder?.color || '#666'}20; color: ${folder?.color || '#666'}">
                        ${folder?.icon || '📁'} ${folder?.name || 'Uncategorized'}
                    </span>
                    <span class="preview-status status-${this.formState.status}">
                        ${this.formState.status}
                    </span>
                </div>
                
                <h2 class="preview-title">${this._escapeHtml(this.formState.title) || 'Untitled SOP'}</h2>
                
                <p class="preview-description">
                    ${this._escapeHtml(this.formState.description) || 'No description provided'}
                </p>
                
                ${this.formState.tags.length > 0 ? `
                <div class="preview-tags">
                    ${this.formState.tags.map(tag => `<span class="tag">#${this._escapeHtml(tag)}</span>`).join('')}
                </div>
                ` : ''}
                
                <hr />
                
                <h3>Steps (${this.formState.steps.length})</h3>
                
                ${this.formState.steps.length > 0 ? `
                <ol class="preview-steps">
                    ${this.formState.steps.map((step, i) => `
                        <li class="preview-step">
                            <strong>${this._escapeHtml(step.text)}</strong>
                            ${step.note ? `<p class="step-note">💡 ${this._escapeHtml(step.note)}</p>` : ''}
                        </li>
                    `).join('')}
                </ol>
                ` : '<p class="empty-message">No steps defined</p>'}
            </div>
        `;
    }
    
    /**
     * Inject CSS styles for the module
     * @private
     */
    _injectStyles() {
        if (document.getElementById('sop-create-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'sop-create-styles';
        styles.textContent = `
            /* ============================================
               SOP Create/Edit Module - Minimal CSS
               Desktop-first design
               ============================================ */
            
            .sop-create-container {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #1f2937;
                background: #f9fafb;
                min-height: 100vh;
            }
            
            .sop-create-layout {
                max-width: 900px;
                margin: 0 auto;
                padding: 2rem;
            }
            
            /* Header */
            .sop-create-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 2rem;
                padding-bottom: 1rem;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .header-left {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            
            .header-left h2 {
                margin: 0;
                font-size: 1.5rem;
            }
            
            .btn-back {
                padding: 0.5rem 1rem;
                background: none;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9rem;
                transition: background 0.15s;
            }
            
            .btn-back:hover {
                background: #f3f4f6;
            }
            
            .edit-indicator {
                color: #6b7280;
                font-size: 0.875rem;
                font-style: italic;
            }
            
            .header-right {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            
            .status-badge {
                padding: 0.25rem 0.75rem;
                border-radius: 999px;
                font-size: 0.75rem;
                font-weight: 500;
                text-transform: uppercase;
            }
            
            .status-draft { background: #fef3c7; color: #92400e; }
            .status-active { background: #d1fae5; color: #065f46; }
            .status-archived { background: #e5e7eb; color: #6b7280; }
            
            .auto-save-indicator {
                color: #6b7280;
                font-size: 0.75rem;
            }
            
            /* Form Sections */
            .form-section {
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                padding: 1.5rem;
                margin-bottom: 1.5rem;
            }
            
            .form-section h3 {
                margin: 0 0 1.25rem;
                font-size: 1.1rem;
                font-weight: 600;
            }
            
            .section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
            }
            
            .section-header h3 {
                margin: 0;
            }
            
            .step-count {
                color: #6b7280;
                font-size: 0.875rem;
            }
            
            /* Form Elements */
            .form-group {
                margin-bottom: 1.25rem;
            }
            
            .form-group:last-child {
                margin-bottom: 0;
            }
            
            .form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1.5rem;
            }
            
            label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 500;
                font-size: 0.9rem;
            }
            
            .required {
                color: #ef4444;
            }
            
            .form-input,
            .form-textarea,
            .form-select {
                width: 100%;
                padding: 0.75rem 1rem;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                font-size: 0.95rem;
                transition: border-color 0.15s, box-shadow 0.15s;
                box-sizing: border-box;
            }
            
            .form-input:focus,
            .form-textarea:focus,
            .form-select:focus {
                outline: none;
                border-color: #6366f1;
                box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
            }
            
            .form-textarea {
                resize: vertical;
                min-height: 80px;
            }
            
            .char-count {
                display: block;
                text-align: right;
                font-size: 0.75rem;
                color: #9ca3af;
                margin-top: 0.25rem;
            }
            
            .help-text {
                font-size: 0.8rem;
                color: #6b7280;
                margin-top: 0.25rem;
            }
            
            /* AI Buttons */
            .ai-btn,
            .ai-btn-secondary {
                padding: 0.75rem 1.25rem;
                border-radius: 8px;
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s;
            }
            
            .ai-btn {
                background: linear-gradient(135deg, #f0fdf4, #ecfeff);
                border: 1px solid #a7f3d0;
                color: #065f46;
            }
            
            .ai-btn:hover {
                background: linear-gradient(135deg, #dcfce7, #cffafe);
            }
            
            .ai-btn-secondary {
                background: white;
                border: 1px solid #d1d5db;
                color: #374151;
            }
            
            .ai-btn-secondary:hover {
                background: #f9fafb;
            }
            
            .ai-btn-inline {
                margin-top: 0.5rem;
                padding: 0.375rem 0.75rem;
                background: linear-gradient(135deg, #f0fdf4, #ecfeff);
                border: 1px solid #a7f3d0;
                border-radius: 6px;
                color: #065f46;
                font-size: 0.75rem;
                cursor: pointer;
                transition: all 0.15s;
            }
            
            .ai-btn-inline:hover {
                background: linear-gradient(135deg, #dcfce7, #cffafe);
            }
            
            /* AI Steps Panel */
            .ai-steps-panel {
                background: linear-gradient(135deg, #f0fdf4, #ecfeff);
                border: 1px solid #a7f3d0;
                border-radius: 8px;
                padding: 1rem 1.25rem;
                margin-bottom: 1.25rem;
            }
            
            .ai-panel-description {
                margin: 0 0 0.75rem;
                font-size: 0.875rem;
                color: #065f46;
            }
            
            .ai-steps-actions {
                display: flex;
                gap: 0.75rem;
            }
            
            /* Steps List */
            .steps-list {
                min-height: 100px;
            }
            
            .steps-empty {
                text-align: center;
                padding: 2rem;
                background: #f9fafb;
                border: 2px dashed #e5e7eb;
                border-radius: 8px;
                color: #6b7280;
            }
            
            .steps-empty p {
                margin: 0.25rem 0;
            }
            
            .step-item {
                display: flex;
                align-items: flex-start;
                gap: 0.75rem;
                padding: 1rem;
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                margin-bottom: 0.75rem;
                transition: all 0.15s;
            }
            
            .step-item:hover {
                background: #f3f4f6;
            }
            
            .step-item.dragging {
                opacity: 0.5;
                background: #dbeafe;
            }
            
            .step-item.drag-over {
                border-color: #6366f1;
                border-style: dashed;
            }
            
            .step-drag-handle {
                cursor: grab;
                color: #9ca3af;
                font-weight: bold;
                padding: 0.25rem;
                user-select: none;
            }
            
            .step-drag-handle:active {
                cursor: grabbing;
            }
            
            .step-number {
                min-width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #6366f1;
                color: white;
                border-radius: 50%;
                font-size: 0.8rem;
                font-weight: 600;
            }
            
            .step-content {
                flex: 1;
            }
            
            .step-input {
                width: 100%;
                padding: 0.5rem 0.75rem;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 0.9rem;
                resize: vertical;
                box-sizing: border-box;
            }
            
            .step-input:focus {
                outline: none;
                border-color: #6366f1;
            }
            
            .step-meta {
                margin-top: 0.5rem;
            }
            
            .step-note-input {
                width: 100%;
                padding: 0.375rem 0.625rem;
                border: 1px solid #e5e7eb;
                border-radius: 4px;
                font-size: 0.8rem;
                background: white;
                box-sizing: border-box;
            }
            
            .step-note-input:focus {
                outline: none;
                border-color: #6366f1;
            }
            
            .step-actions {
                display: flex;
                flex-direction: column;
                gap: 0.375rem;
            }
            
            .step-action-btn {
                width: 32px;
                height: 32px;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                background: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s;
                font-size: 0.85rem;
            }
            
            .step-action-btn:hover:not(:disabled) {
                background: #f3f4f6;
            }
            
            .step-action-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            
            .step-delete-btn:hover:not(:disabled) {
                background: #fef2f2;
                border-color: #fecaca;
            }
            
            .ai-step-btn {
                background: linear-gradient(135deg, #f0fdf4, #ecfeff);
                border-color: #a7f3d0;
            }
            
            .ai-step-btn:hover {
                background: linear-gradient(135deg, #dcfce7, #cffafe);
            }
            
            .btn-add-step {
                width: 100%;
                padding: 0.875rem;
                background: white;
                border: 2px dashed #d1d5db;
                border-radius: 8px;
                color: #6b7280;
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s;
            }
            
            .btn-add-step:hover:not(:disabled) {
                border-color: #6366f1;
                color: #6366f1;
                background: #f5f3ff;
            }
            
            .btn-add-step:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            /* Form Actions */
            .form-actions {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-top: 1rem;
            }
            
            .actions-left,
            .actions-right {
                display: flex;
                gap: 0.75rem;
            }
            
            .btn {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 8px;
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s;
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
            
            .btn-danger {
                background: #fef2f2;
                color: #dc2626;
                border: 1px solid #fecaca;
            }
            
            .btn-danger:hover {
                background: #fee2e2;
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
                max-width: 700px;
                max-height: 80vh;
                overflow: hidden;
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
            }
            
            .preview-sop {}
            
            .preview-meta {
                display: flex;
                gap: 0.75rem;
                margin-bottom: 1rem;
            }
            
            .preview-folder {
                padding: 0.25rem 0.75rem;
                border-radius: 6px;
                font-size: 0.8rem;
                font-weight: 500;
            }
            
            .preview-title {
                margin: 0 0 0.5rem;
                font-size: 1.5rem;
            }
            
            .preview-description {
                color: #6b7280;
                margin: 0 0 1rem;
            }
            
            .preview-tags {
                display: flex;
                gap: 0.5rem;
                margin-bottom: 1rem;
            }
            
            .tag {
                color: #6366f1;
                font-size: 0.85rem;
            }
            
            .preview-steps {
                padding-left: 1.5rem;
            }
            
            .preview-step {
                margin-bottom: 1rem;
                line-height: 1.5;
            }
            
            .step-note {
                margin: 0.25rem 0 0;
                font-size: 0.85rem;
                color: #6b7280;
                font-weight: normal;
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
            
            /* Responsive */
            @media (max-width: 768px) {
                .sop-create-layout {
                    padding: 1rem;
                }
                
                .sop-create-header {
                    flex-direction: column;
                    gap: 1rem;
                    align-items: flex-start;
                }
                
                .form-row {
                    grid-template-columns: 1fr;
                }
                
                .ai-steps-actions {
                    flex-direction: column;
                }
                
                .form-actions {
                    flex-direction: column;
                    gap: 1rem;
                }
                
                .actions-left,
                .actions-right {
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
        // Form submission
        const form = document.getElementById('sop-form');
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this._handleSave();
        });
        
        // Back button
        document.getElementById('btn-back')?.addEventListener('click', () => {
            this._handleCancel();
        });
        
        // Cancel button
        document.getElementById('btn-cancel')?.addEventListener('click', () => {
            this._handleCancel();
        });
        
        // Preview button
        document.getElementById('btn-preview')?.addEventListener('click', () => {
            this._showPreview();
        });
        
        // Close preview
        document.getElementById('btn-close-preview')?.addEventListener('click', () => {
            this._hidePreview();
        });
        
        // Delete button (edit mode)
        document.getElementById('btn-delete')?.addEventListener('click', () => {
            this._handleDelete();
        });
        
        // Title input
        const titleInput = document.getElementById('sop-title');
        titleInput?.addEventListener('input', (e) => {
            this.formState.title = e.target.value;
            document.getElementById('title-count').textContent = e.target.value.length;
            this._triggerChange();
        });
        
        // Description input
        const descInput = document.getElementById('sop-description');
        descInput?.addEventListener('input', (e) => {
            this.formState.description = e.target.value;
            document.getElementById('desc-count').textContent = e.target.value.length;
            this._triggerChange();
        });
        
        // Folder select
        document.getElementById('sop-folder')?.addEventListener('change', (e) => {
            this.formState.folderId = e.target.value;
            this._triggerChange();
        });
        
        // Status select
        document.getElementById('sop-status')?.addEventListener('change', (e) => {
            this.formState.status = e.target.value;
            this._updateStatusBadge();
            this._triggerChange();
        });
        
        // Tags input
        document.getElementById('sop-tags')?.addEventListener('input', (e) => {
            this.formState.tags = e.target.value
                .split(',')
                .map(tag => tag.trim().toLowerCase())
                .filter(tag => tag.length > 0);
            this._triggerChange();
        });
        
        // Add step button
        document.getElementById('btn-add-step')?.addEventListener('click', () => {
            this._addStep();
        });
        
        // Steps list event delegation
        this._attachStepsListeners();
        
        // AI action buttons
        document.querySelectorAll('[data-ai-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.aiAction;
                const stepIndex = e.target.dataset.stepIndex;
                this._handleAIAction(action, stepIndex);
            });
        });
        
        // Click outside preview to close
        document.getElementById('preview-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'preview-modal') {
                this._hidePreview();
            }
        });
    }
    
    /**
     * Attach event listeners for the steps list
     * Includes drag-and-drop functionality
     * @private
     */
    _attachStepsListeners() {
        const stepsList = document.getElementById('steps-list');
        if (!stepsList) return;
        
        // Step input changes
        stepsList.addEventListener('input', (e) => {
            if (e.target.classList.contains('step-input')) {
                const index = parseInt(e.target.dataset.stepIndex);
                this.formState.steps[index].text = e.target.value;
                this._triggerChange();
            }
            
            if (e.target.classList.contains('step-note-input')) {
                const index = parseInt(e.target.dataset.stepIndex);
                this.formState.steps[index].note = e.target.value;
                this._triggerChange();
            }
        });
        
        // Step action buttons
        stepsList.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            
            const action = btn.dataset.action;
            const index = parseInt(btn.dataset.stepIndex);
            
            switch (action) {
                case 'move-up':
                    this._moveStep(index, index - 1);
                    break;
                case 'move-down':
                    this._moveStep(index, index + 1);
                    break;
                case 'delete':
                    this._deleteStep(index);
                    break;
            }
        });
        
        // AI step buttons
        stepsList.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-ai-action]');
            if (btn) {
                const action = btn.dataset.aiAction;
                const stepIndex = btn.dataset.stepIndex;
                this._handleAIAction(action, stepIndex);
            }
        });
        
        // Drag and drop
        stepsList.addEventListener('dragstart', (e) => {
            const stepItem = e.target.closest('.step-item');
            if (!stepItem) return;
            
            this.dragState.dragging = true;
            this.dragState.draggedIndex = parseInt(stepItem.dataset.stepIndex);
            stepItem.classList.add('dragging');
            
            e.dataTransfer.effectAllowed = 'move';
        });
        
        stepsList.addEventListener('dragend', (e) => {
            const stepItem = e.target.closest('.step-item');
            if (stepItem) {
                stepItem.classList.remove('dragging');
            }
            
            this.dragState.dragging = false;
            this.dragState.draggedIndex = null;
            this.dragState.dragOverIndex = null;
            
            // Remove all drag-over classes
            document.querySelectorAll('.step-item.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        });
        
        stepsList.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const stepItem = e.target.closest('.step-item');
            if (!stepItem || !this.dragState.dragging) return;
            
            const overIndex = parseInt(stepItem.dataset.stepIndex);
            
            // Remove previous drag-over
            document.querySelectorAll('.step-item.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
            
            if (overIndex !== this.dragState.draggedIndex) {
                stepItem.classList.add('drag-over');
                this.dragState.dragOverIndex = overIndex;
            }
        });
        
        stepsList.addEventListener('drop', (e) => {
            e.preventDefault();
            
            if (this.dragState.draggedIndex !== null && 
                this.dragState.dragOverIndex !== null &&
                this.dragState.draggedIndex !== this.dragState.dragOverIndex) {
                
                this._moveStep(this.dragState.draggedIndex, this.dragState.dragOverIndex);
            }
        });
    }
    
    /**
     * Trigger change callback
     * @private
     */
    _triggerChange() {
        if (this.callbacks.onChange) {
            this.callbacks.onChange(this.formState);
        }
    }
    
    /**
     * Update status badge display
     * @private
     */
    _updateStatusBadge() {
        const badge = document.querySelector('.status-badge');
        if (badge) {
            badge.className = `status-badge status-${this.formState.status}`;
            badge.textContent = this.formState.status;
        }
    }
    
    // ========================================================================
    // STEP MANAGEMENT
    // ========================================================================
    
    /**
     * Add a new step
     * @private
     * @param {string} text - Initial step text (optional)
     */
    _addStep(text = '') {
        if (this.formState.steps.length >= this.options.maxSteps) {
            this._showNotification('Maximum steps reached', 'error');
            return;
        }
        
        const newStep = {
            id: `step_${Date.now()}`,
            text: text,
            note: '',
            order: this.formState.steps.length + 1
        };
        
        this.formState.steps.push(newStep);
        this._updateStepsList();
        this._triggerChange();
        
        // Focus the new step input
        setTimeout(() => {
            const inputs = document.querySelectorAll('.step-input');
            const lastInput = inputs[inputs.length - 1];
            if (lastInput) lastInput.focus();
        }, 50);
    }
    
    /**
     * Delete a step
     * @private
     * @param {number} index - Step index to delete
     */
    _deleteStep(index) {
        if (confirm('Are you sure you want to delete this step?')) {
            this.formState.steps.splice(index, 1);
            this._reorderSteps();
            this._updateStepsList();
            this._triggerChange();
        }
    }
    
    /**
     * Move a step from one position to another
     * @private
     * @param {number} fromIndex - Original position
     * @param {number} toIndex - Target position
     */
    _moveStep(fromIndex, toIndex) {
        if (toIndex < 0 || toIndex >= this.formState.steps.length) return;
        
        const [movedStep] = this.formState.steps.splice(fromIndex, 1);
        this.formState.steps.splice(toIndex, 0, movedStep);
        
        this._reorderSteps();
        this._updateStepsList();
        this._triggerChange();
    }
    
    /**
     * Update step order numbers
     * @private
     */
    _reorderSteps() {
        this.formState.steps.forEach((step, index) => {
            step.order = index + 1;
        });
    }
    
    /**
     * Update the steps list display
     * @private
     */
    _updateStepsList() {
        const stepsList = document.getElementById('steps-list');
        const stepCount = document.getElementById('step-count');
        const addBtn = document.getElementById('btn-add-step');
        
        if (stepsList) {
            stepsList.innerHTML = this._renderStepsList();
        }
        
        if (stepCount) {
            stepCount.textContent = `${this.formState.steps.length} / ${this.options.maxSteps} steps`;
        }
        
        if (addBtn) {
            addBtn.disabled = this.formState.steps.length >= this.options.maxSteps;
        }
    }
    
    // ========================================================================
    // AI TOUCHPOINT HANDLERS
    // ========================================================================
    
    /**
     * Handle AI action triggers
     * These are placeholder hooks for AI integration
     * 
     * @private
     * @param {string} action - AI action type
     * @param {string|number} stepIndex - Optional step index for step-specific actions
     */
    _handleAIAction(action, stepIndex = null) {
        /**
         * AI TOUCHPOINT DOCUMENTATION
         * 
         * Each action is designed to integrate with an AI service.
         * Replace the placeholder implementations with actual API calls.
         */
        
        switch (action) {
            case 'suggest-title':
                /**
                 * AI Touchpoint: Suggest Better Title
                 * 
                 * Purpose: Generate improved title suggestions based on description/steps
                 * Input: Current title, description, steps
                 * Output: Array of title suggestions
                 * 
                 * Example prompt: "Based on this SOP description and steps,
                 * suggest 3 clear, action-oriented titles..."
                 */
                console.log('🤖 AI Action: Suggest Title');
                console.log('Input:', {
                    currentTitle: this.formState.title,
                    description: this.formState.description,
                    steps: this.formState.steps
                });
                
                this._showAIPlaceholder(
                    'Analyzing your SOP to suggest better titles...',
                    'suggest-title'
                );
                break;
                
            case 'improve-description':
                /**
                 * AI Touchpoint: Improve Description
                 * 
                 * Purpose: Enhance the description for clarity and completeness
                 * Input: Current title, description
                 * Output: Improved description text
                 * 
                 * Example prompt: "Improve this SOP description to be more
                 * clear, comprehensive, and professionally written..."
                 */
                console.log('🤖 AI Action: Improve Description');
                console.log('Input:', {
                    title: this.formState.title,
                    description: this.formState.description
                });
                
                this._showAIPlaceholder(
                    'Improving your description for clarity...',
                    'improve-description'
                );
                break;
                
            case 'draft-steps':
                /**
                 * AI Touchpoint: Draft Steps Automatically
                 * 
                 * Purpose: Generate a complete set of steps based on title/description
                 * Input: Title, description
                 * Output: Array of step objects with text and optional notes
                 * 
                 * Example prompt: "Based on this SOP title and description,
                 * generate a comprehensive list of steps. Each step should
                 * be clear, actionable, and start with a verb..."
                 */
                console.log('🤖 AI Action: Draft Steps');
                console.log('Input:', {
                    title: this.formState.title,
                    description: this.formState.description
                });
                
                this._showAIPlaceholder(
                    'Generating steps based on your title and description...',
                    'draft-steps',
                    () => {
                        // Simulate AI-generated steps (replace with actual API)
                        const sampleSteps = [
                            { text: 'Review prerequisites and gather necessary materials', note: '' },
                            { text: 'Complete initial setup and verification', note: '' },
                            { text: 'Execute main procedure steps', note: '' },
                            { text: 'Verify completion and document results', note: '' }
                        ];
                        
                        if (confirm('AI has generated 4 sample steps. Add them to your SOP?')) {
                            sampleSteps.forEach(step => {
                                this._addStep(step.text);
                            });
                        }
                    }
                );
                break;
                
            case 'suggest-missing':
                /**
                 * AI Touchpoint: Suggest Missing Steps
                 * 
                 * Purpose: Analyze existing steps and suggest additions
                 * Input: Title, description, current steps
                 * Output: Array of suggested additional steps
                 * 
                 * Example prompt: "Review these SOP steps and suggest any
                 * missing steps that would make the procedure more complete..."
                 */
                console.log('🤖 AI Action: Suggest Missing Steps');
                console.log('Input:', {
                    title: this.formState.title,
                    description: this.formState.description,
                    existingSteps: this.formState.steps
                });
                
                this._showAIPlaceholder(
                    'Analyzing your steps to identify gaps...',
                    'suggest-missing'
                );
                break;
                
            case 'improve-step':
                /**
                 * AI Touchpoint: Improve Step Language
                 * 
                 * Purpose: Improve a single step's clarity and language
                 * Input: Step text, context (other steps)
                 * Output: Improved step text
                 * 
                 * Example prompt: "Improve this step to be clearer, more
                 * actionable, and consistent with professional SOP language..."
                 */
                const step = this.formState.steps[parseInt(stepIndex)];
                console.log('🤖 AI Action: Improve Step', stepIndex);
                console.log('Input:', {
                    step: step,
                    context: this.formState.steps
                });
                
                this._showAIPlaceholder(
                    `Improving step ${parseInt(stepIndex) + 1}...`,
                    'improve-step'
                );
                break;
                
            default:
                console.log('Unknown AI action:', action);
        }
    }
    
    /**
     * Show AI placeholder message/modal
     * @private
     * @param {string} message - Loading message
     * @param {string} action - Action identifier
     * @param {Function} callback - Optional callback after "completion"
     */
    _showAIPlaceholder(message, action, callback = null) {
        // In production, replace with actual AI integration
        // This is a simple demonstration
        
        this._showNotification(message, 'info');
        
        // Simulate AI processing delay
        setTimeout(() => {
            alert(`✨ AI Feature Placeholder\n\nAction: ${action}\n\nThis is where the AI integration would provide results.\n\nIn production, this would call your AI service and update the form with suggestions.`);
            
            if (callback) {
                callback();
            }
        }, 1000);
    }
    
    // ========================================================================
    // FORM ACTIONS
    // ========================================================================
    
    /**
     * Handle form save
     * @private
     */
    _handleSave() {
        // Validate
        if (!this._validate()) return;
        
        // Prepare SOP data
        const sopData = {
            title: this.formState.title.trim(),
            description: this.formState.description.trim(),
            folderId: this.formState.folderId,
            steps: this.formState.steps.map((step, index) => ({
                id: step.id,
                text: step.text.trim(),
                note: step.note?.trim() || '',
                order: index + 1
            })),
            tags: this.formState.tags,
            status: this.formState.status,
            updatedAt: Date.now()
        };
        
        // Load existing SOPs
        const sops = this._loadSOPs();
        
        if (this.options.mode === 'edit' && this.currentSOP) {
            // Update existing SOP
            const index = sops.findIndex(s => s.id === this.currentSOP.id);
            if (index !== -1) {
                sops[index] = {
                    ...sops[index],
                    ...sopData
                };
            }
        } else {
            // Create new SOP
            sopData.id = `sop_${Date.now()}`;
            sopData.createdAt = Date.now();
            sops.push(sopData);
        }
        
        // Save to storage
        this._saveSOPs(sops);
        
        // Clear draft
        this._clearDraft();
        
        // Show success message
        this._showNotification(
            this.options.mode === 'edit' ? 'SOP updated successfully!' : 'SOP created successfully!',
            'success'
        );
        
        // Trigger callback
        if (this.callbacks.onSave) {
            this.callbacks.onSave(sopData);
        }
    }
    
    /**
     * Validate form data
     * @private
     * @returns {boolean} True if valid
     */
    _validate() {
        const errors = [];
        
        if (!this.formState.title.trim()) {
            errors.push('Title is required');
        }
        
        if (this.formState.steps.length === 0) {
            errors.push('At least one step is required');
        }
        
        // Check for empty steps
        const emptySteps = this.formState.steps.filter(s => !s.text.trim());
        if (emptySteps.length > 0) {
            errors.push(`${emptySteps.length} step(s) have no text`);
        }
        
        if (errors.length > 0) {
            alert('Please fix the following issues:\n\n• ' + errors.join('\n• '));
            return false;
        }
        
        return true;
    }
    
    /**
     * Handle cancel action
     * @private
     */
    _handleCancel() {
        if (this._hasContent()) {
            if (!confirm('You have unsaved changes. Are you sure you want to leave?')) {
                return;
            }
        }
        
        if (this.callbacks.onCancel) {
            this.callbacks.onCancel();
        }
    }
    
    /**
     * Handle delete action (edit mode only)
     * @private
     */
    _handleDelete() {
        if (!this.currentSOP) return;
        
        if (confirm(`Are you sure you want to delete "${this.currentSOP.title}"?\n\nThis action cannot be undone.`)) {
            const sops = this._loadSOPs();
            const filtered = sops.filter(s => s.id !== this.currentSOP.id);
            this._saveSOPs(filtered);
            
            this._showNotification('SOP deleted', 'success');
            
            if (this.callbacks.onDelete) {
                this.callbacks.onDelete(this.currentSOP);
            }
        }
    }
    
    /**
     * Show preview modal
     * @private
     */
    _showPreview() {
        const modal = document.getElementById('preview-modal');
        const body = document.getElementById('preview-body');
        
        if (modal && body) {
            body.innerHTML = this._renderPreview();
            modal.style.display = 'flex';
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
     * Show notification toast
     * @private
     * @param {string} message - Notification message
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
    
    // ========================================================================
    // PUBLIC API
    // ========================================================================
    
    /**
     * Open the editor in create mode
     * @public
     * @param {Object} options - Optional initial data
     */
    create(options = {}) {
        this.options.mode = 'create';
        this.currentSOP = null;
        
        // Check for saved draft
        const draft = this._loadDraft();
        if (draft && confirm('You have a saved draft. Would you like to continue editing it?')) {
            this.formState = { ...draft };
        } else {
            this.formState = {
                title: options.title || '',
                description: options.description || '',
                folderId: options.folderId || 'general',
                steps: options.steps || [],
                tags: options.tags || [],
                status: 'draft'
            };
        }
        
        this._render();
        this._attachEventListeners();
    }
    
    /**
     * Open the editor in edit mode
     * @public
     * @param {string|Object} sopOrId - SOP object or ID to edit
     */
    edit(sopOrId) {
        this.options.mode = 'edit';
        
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
        
        this.currentSOP = sop;
        
        // Populate form state
        this.formState = {
            title: sop.title || '',
            description: sop.description || '',
            folderId: sop.folderId || 'general',
            steps: sop.steps ? [...sop.steps] : [],
            tags: sop.tags ? [...sop.tags] : [],
            status: sop.status || 'draft'
        };
        
        this._render();
        this._attachEventListeners();
    }
    
    /**
     * Get current form data
     * @public
     * @returns {Object} Current form state
     */
    getData() {
        return { ...this.formState };
    }
    
    /**
     * Set form data
     * @public
     * @param {Object} data - Form data to set
     */
    setData(data) {
        this.formState = {
            ...this.formState,
            ...data
        };
        this._render();
        this._attachEventListeners();
    }
    
    /**
     * Register callback functions
     * @public
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        const validEvents = ['onSave', 'onCancel', 'onDelete', 'onChange'];
        
        if (validEvents.includes(event)) {
            this.callbacks[event] = callback;
        } else {
            console.warn(`Unknown event: ${event}. Valid: ${validEvents.join(', ')}`);
        }
    }
    
    /**
     * Refresh the view
     * @public
     */
    refresh() {
        this._loadFolders();
        this._render();
        this._attachEventListeners();
    }
    
    /**
     * Destroy the module and clean up
     * @public
     */
    destroy() {
        // Clear auto-save timer
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        // Clear container
        this.container.innerHTML = '';
        
        // Remove styles
        const styles = document.getElementById('sop-create-styles');
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
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

/**
 * Factory function to create SOP Create/Edit instance
 * @param {HTMLElement|string} container - Container element or selector
 * @param {Object} options - Configuration options
 * @returns {SOPCreate} SOPCreate instance
 */
function createSOPEditor(container, options = {}) {
    const containerEl = typeof container === 'string'
        ? document.querySelector(container)
        : container;
    
    if (!containerEl) {
        throw new Error('SOP Editor container element not found');
    }
    
    return new SOPCreate(containerEl, options);
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SOPCreate, createSOPEditor, SOP_STORAGE_KEYS };
} else if (typeof window !== 'undefined') {
    window.SOPCreate = SOPCreate;
    window.createSOPEditor = createSOPEditor;
    window.SOP_STORAGE_KEYS = SOP_STORAGE_KEYS;
}

// ES6 module export
export { SOPCreate, createSOPEditor, SOP_STORAGE_KEYS };
