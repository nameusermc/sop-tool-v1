/**
 * SOP Create/Edit Module - SOP Tool v1
 * 
 * Features:
 * - Form for title, description, and folder assignment
 * - Step editor with add, edit, remove, reorder
 * - Folder/category selection (integrates with Dashboard folders)
 * - Tags and status management
 * - AI-assisted drafting via external tools (paste workflow)
 * - AI-assisted clarity improvement via external tools
 * - Auto-save drafts
 * 
 * AI WORKFLOW NOTE:
 * This standalone app uses an external-paste workflow for AI features.
 * Users generate content in Claude/ChatGPT and paste it here.
 * AI accelerates drafting but is always optional and editable.
 * 
 * STORAGE KEY: 'sop_tool_sops' - Must match Dashboard module
 * 
 * @module SOPCreate
 * @version 2.3.0
 */

(function(global) {
    'use strict';

    // ========================================================================
    // STORAGE KEYS
    // ========================================================================

    const SOP_STORAGE_KEYS = {
        SOPS: 'sop_tool_sops',
        FOLDERS: 'sop_tool_folders',
        DRAFTS: 'sop_tool_drafts'
    };

    const DEFAULT_FOLDERS = [
        { id: 'general', name: 'General', color: '#6366f1', icon: '📁' },
        { id: 'onboarding', name: 'Onboarding', color: '#22c55e', icon: '👋' },
        { id: 'operations', name: 'Operations', color: '#f59e0b', icon: '⚙️' },
        { id: 'safety', name: 'Safety', color: '#ef4444', icon: '🛡️' },
        { id: 'hr', name: 'HR & Compliance', color: '#8b5cf6', icon: '📋' }
    ];

    // ========================================================================
    // SOPCreate CLASS
    // ========================================================================

    class SOPCreate {
        constructor(containerElement, options = {}) {
            if (typeof containerElement === 'string') {
                containerElement = document.querySelector(containerElement);
            }
            
            if (!containerElement) {
                throw new Error('SOPCreate: Container element not found');
            }
            
            this.container = containerElement;
            
            this.options = {
                mode: 'create',
                enableAIFeatures: true,
                autoSaveDrafts: true,
                autoSaveInterval: 30000,
                maxSteps: 50,
                autoRender: true,
                ...options
            };
            
            this.currentSOP = null;
            this.folders = [];
            
            this.formState = {
                title: '',
                description: '',
                folderId: 'general',
                steps: [],
                tags: [],
                status: 'draft'
            };
            
            this.dragState = {
                dragging: false,
                draggedId: null,
                dragOverId: null
            };
            
            this.autoSaveTimer = null;
            this._draftDebounceTimer = null;
            
            this.callbacks = {
                onSave: null,
                onCancel: null,
                onDelete: null,
                onChange: null
            };
            
            this._init();
        }
        
        // ====================================================================
        // INITIALIZATION
        // ====================================================================
        
        _init() {
            this._loadFolders();
            this._injectStyles();
            if (this.options.autoRender) {
                this._render();
                this._attachEventListeners();
            }
            this._setupAutoSave();
        }
        
        _loadFolders() {
            const stored = localStorage.getItem(SOP_STORAGE_KEYS.FOLDERS);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.folders = (Array.isArray(parsed) && parsed.length > 0) ? parsed : [...DEFAULT_FOLDERS];
            } else {
                this.folders = [...DEFAULT_FOLDERS];
            }
        }
        
        _loadSOPs() {
            const stored = localStorage.getItem(SOP_STORAGE_KEYS.SOPS);
            return stored ? JSON.parse(stored) : [];
        }
        
        _saveSOPs(sops) {
            localStorage.setItem(SOP_STORAGE_KEYS.SOPS, JSON.stringify(sops));
        }
        
        _setupAutoSave() {
            if (!this.options.autoSaveDrafts) return;
            
            if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
            
            this.autoSaveTimer = setInterval(() => {
                this._saveDraft();
            }, this.options.autoSaveInterval);
            
            // Flush any pending debounced write on page unload (refresh/close)
            if (this._beforeUnloadHandler) {
                window.removeEventListener('beforeunload', this._beforeUnloadHandler);
            }
            this._beforeUnloadHandler = () => {
                if (this._draftDebounceTimer) {
                    clearTimeout(this._draftDebounceTimer);
                    this._draftDebounceTimer = null;
                    try { this._saveDraftFromState(); } catch (e) { /* quota/serialization — best effort */ }
                }
            };
            window.addEventListener('beforeunload', this._beforeUnloadHandler);
        }
        
        _saveDraft() {
            if (this.options.mode === 'create' && this._hasContent()) {
                this._collectFormData();
                localStorage.setItem(SOP_STORAGE_KEYS.DRAFTS, JSON.stringify({
                    ...this.formState,
                    savedAt: Date.now()
                }));
            }
        }
        
        /**
         * Debounced draft save for typing events (500ms).
         * formState is already current from input handlers — skip _collectFormData.
         */
        _saveDraftDebounced() {
            if (!this.options.autoSaveDrafts) return;
            clearTimeout(this._draftDebounceTimer);
            this._draftDebounceTimer = setTimeout(() => {
                this._saveDraftFromState();
            }, 500);
        }
        
        /**
         * Immediate draft save for structural changes (add/delete/reorder).
         */
        _saveDraftNow() {
            if (!this.options.autoSaveDrafts) return;
            clearTimeout(this._draftDebounceTimer);
            this._saveDraftFromState();
        }
        
        /**
         * Write current formState to draft storage (no _collectFormData needed
         * when called right after a handler that already updated formState).
         */
        _saveDraftFromState() {
            if (this.options.mode === 'create' && this._hasContent()) {
                localStorage.setItem(SOP_STORAGE_KEYS.DRAFTS, JSON.stringify({
                    ...this.formState,
                    savedAt: Date.now()
                }));
            }
        }
        
        _loadDraft() {
            const stored = localStorage.getItem(SOP_STORAGE_KEYS.DRAFTS);
            if (!stored) return null;
            try {
                const draft = JSON.parse(stored);
                // Only return if draft has meaningful content
                const hasTitle = draft.title && draft.title.trim() !== '';
                const hasDescription = draft.description && draft.description.trim() !== '';
                const hasSteps = Array.isArray(draft.steps) && draft.steps.length > 0;
                if (hasTitle || hasDescription || hasSteps) return draft;
                // Empty draft — clean it up
                localStorage.removeItem(SOP_STORAGE_KEYS.DRAFTS);
                return null;
            } catch (e) {
                localStorage.removeItem(SOP_STORAGE_KEYS.DRAFTS);
                return null;
            }
        }
        
        _clearDraft() {
            localStorage.removeItem(SOP_STORAGE_KEYS.DRAFTS);
        }
        
        _hasContent() {
            return this.formState.title.trim() !== '' || 
                   this.formState.description.trim() !== '' ||
                   this.formState.steps.length > 0;
        }
        
        // ====================================================================
        // RENDERING
        // ====================================================================
        
        _render() {
            this.container.innerHTML = '';
            this.container.className = 'sop-create-container';
            
            const isEdit = this.options.mode === 'edit';
            const headerTitle = isEdit ? 'Edit SOP' : 'Create New SOP';
            const saveText = isEdit ? 'Update SOP' : 'Save SOP';
            
            this.container.innerHTML = `
                <div class="sop-create-layout">
                    <header class="sop-create-header">
                        <div class="header-left">
                            <button class="btn-back" id="btn-back">← Back</button>
                            <h2>${headerTitle}</h2>
                        </div>
                        <div class="header-right">
                            <span class="status-badge status-${this.formState.status}">${this.formState.status}</span>
                        </div>
                    </header>
                    
                    <main class="sop-create-main">
                        <form class="sop-form" id="sop-form">
                            <!-- Basic Info -->
                            <section class="form-section">
                                <h3>📝 Basic Information</h3>
                                
                                <div class="form-group">
                                    <label for="sop-title">Title <span class="required">*</span></label>
                                    <input type="text" id="sop-title" class="form-input" 
                                        placeholder="Example: Opening the shop each morning"
                                        value="${this._escapeHtml(this.formState.title)}"
                                        maxlength="200" required />
                                    <span class="char-count"><span id="title-count">${this.formState.title.length}</span>/200</span>
                                </div>
                                
                                <div class="form-group">
                                    <label for="sop-description">Description</label>
                                    <textarea id="sop-description" class="form-textarea" rows="3"
                                        placeholder="What this procedure covers and when it should be used"
                                        maxlength="500">${this._escapeHtml(this.formState.description)}</textarea>
                                    <span class="char-count"><span id="desc-count">${this.formState.description.length}</span>/500</span>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="sop-folder">Category</label>
                                        <select id="sop-folder" class="form-select">
                                            ${this._renderFolderOptions()}
                                        </select>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label for="sop-status">Status</label>
                                        <select id="sop-status" class="form-select">
                                            <option value="draft" ${this.formState.status === 'draft' ? 'selected' : ''}>📝 Draft</option>
                                            <option value="active" ${this.formState.status === 'active' ? 'selected' : ''}>✅ Active</option>
                                            <option value="archived" ${this.formState.status === 'archived' ? 'selected' : ''}>📦 Archived</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="sop-tags">Keywords</label>
                                    <input type="text" id="sop-tags" class="form-input"
                                        placeholder="Optional — words your team might search for"
                                        value="${this.formState.tags.join(', ')}" />
                                </div>
                            </section>
                            
                            <!-- Steps -->
                            <section class="form-section steps-section">
                                <div class="section-header">
                                    <h3>📋 Steps</h3>
                                    <span class="step-count" id="step-count">${this.formState.steps.length} / ${this.options.maxSteps}</span>
                                </div>
                                
                                ${this.options.enableAIFeatures ? `
                                <div class="ai-steps-panel" id="ai-steps-panel">
                                    ${this._isProPlan() ? `
                                    <div class="ai-panel-header">
                                        <span class="ai-icon">✨</span>
                                        <span class="ai-title">AI-Powered Steps</span>
                                        <span class="ai-badge ai-badge-pro">Pro</span>
                                    </div>
                                    <p class="ai-description">Generate steps automatically or improve existing ones with AI. You can edit everything before saving.</p>
                                    <div class="ai-steps-actions">
                                        <button type="button" class="ai-btn" id="btn-ai-generate" data-ai-action="draft-steps">
                                            ✨ Suggest Steps
                                        </button>
                                        <button type="button" class="ai-btn ai-btn-secondary" id="btn-ai-improve" data-ai-action="improve-clarity"
                                            ${this.formState.steps.length === 0 ? 'disabled' : ''}>
                                            ✏️ Improve Clarity
                                        </button>
                                    </div>
                                    <p class="ai-hint">This is optional. You can always write steps yourself or <a href="#" id="btn-ai-manual-paste" class="ai-link">paste from an external tool</a>.</p>
                                    ` : `
                                    <div class="ai-panel-header">
                                        <span class="ai-icon">🤖</span>
                                        <span class="ai-title">Get Help Writing Steps</span>
                                        <span class="ai-badge">Paste from AI</span>
                                    </div>
                                    <p class="ai-description">Use an external AI tool to help write your steps, then paste them here. You can edit everything before saving.</p>
                                    <div class="ai-steps-actions">
                                        <button type="button" class="ai-btn" id="btn-ai-generate" data-ai-action="draft-steps">
                                            📋 Paste Steps
                                        </button>
                                        <button type="button" class="ai-btn ai-btn-secondary" id="btn-ai-improve" data-ai-action="improve-clarity"
                                            ${this.formState.steps.length === 0 ? 'disabled' : ''}>
                                            ✏️ Improve Clarity
                                        </button>
                                    </div>
                                    <p class="ai-hint">This is optional. You can always write steps yourself.</p>
                                    <p class="ai-upgrade-hint">✨ <a href="#" id="btn-ai-upgrade" class="ai-link">Upgrade to Pro</a> for one-click AI step generation.</p>
                                    `}
                                </div>
                                ` : ''}
                                
                                <div class="steps-list" id="steps-list">
                                    ${this._renderStepsList()}
                                </div>
                                
                                <button type="button" class="btn-add-step" id="btn-add-step"
                                    ${this.formState.steps.length >= this.options.maxSteps ? 'disabled' : ''}>
                                    ➕ Add Step
                                </button>
                            </section>
                            
                            <!-- Actions -->
                            <section class="form-actions">
                                <div class="actions-left">
                                    ${isEdit ? `<button type="button" class="btn btn-danger" id="btn-delete">🗑️ Delete</button>` : ''}
                                </div>
                                <div class="actions-right">
                                    <button type="button" class="btn btn-secondary" id="btn-cancel">Cancel</button>
                                    ${isEdit ? `<button type="button" class="btn btn-secondary" id="btn-history">🕐 History</button>` : ''}
                                    <button type="button" class="btn btn-secondary" id="btn-preview">👁️ Preview</button>
                                    <button type="submit" class="btn btn-primary" id="btn-save">💾 ${saveText}</button>
                                </div>
                            </section>
                        </form>
                    </main>
                    
                    <!-- Preview Modal -->
                    <div class="preview-modal" id="preview-modal" style="display: none;">
                        <div class="preview-content">
                            <div class="preview-header">
                                <h3>Preview SOP</h3>
                                <button class="btn-close" id="btn-close-preview">✕</button>
                            </div>
                            <div class="preview-body" id="preview-body"></div>
                        </div>
                    </div>
                    
                    <!-- Version History Modal -->
                    <div class="preview-modal" id="history-modal" style="display: none;">
                        <div class="preview-content">
                            <div class="preview-header">
                                <h3>🕐 Version History</h3>
                                <button class="btn-close" id="btn-close-history">✕</button>
                            </div>
                            <div class="preview-body" id="history-body"></div>
                        </div>
                    </div>
                    
                    <!-- Clarity Preview Modal -->
                    <div class="clarity-modal" id="clarity-modal" style="display: none;">
                        <div class="clarity-content">
                            <div class="clarity-header">
                                <h3>✏️ Review Improved Steps</h3>
                                <button class="btn-close" id="btn-close-clarity">✕</button>
                            </div>
                            <p class="clarity-description">Review the improved steps below:</p>
                            <div class="clarity-comparison" id="clarity-comparison"></div>
                            <div class="clarity-actions">
                                <button type="button" class="btn btn-secondary" id="btn-reject-clarity">Keep Original</button>
                                <button type="button" class="btn btn-primary" id="btn-accept-clarity">✓ Accept Changes</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- AI Paste Steps Modal -->
                    <div class="ai-modal" id="ai-paste-modal" style="display: none;">
                        <div class="ai-modal-content">
                            <div class="ai-modal-header">
                                <h3>📋 Paste Steps</h3>
                                <button class="btn-close" id="btn-close-ai-paste">✕</button>
                            </div>
                            <div class="ai-modal-body">
                                <div class="ai-instructions">
                                    <p><strong>How to use:</strong></p>
                                    <ol>
                                        <li>Copy your SOP title: <code id="copy-title-text"></code> <button type="button" class="btn-copy-small" id="btn-copy-title">Copy</button></li>
                                        <li>Open <a href="https://claude.ai" target="_blank" rel="noopener">Claude</a> or <a href="https://chat.openai.com" target="_blank" rel="noopener">ChatGPT</a></li>
                                        <li>Ask: "Create 5-8 simple steps for this SOP: [paste title]"</li>
                                        <li>Copy the steps and paste below</li>
                                    </ol>
                                    <p class="ai-draft-reminder">You can edit or remove any of these after adding them.</p>
                                </div>
                                <div class="ai-paste-area">
                                    <label for="ai-steps-input">Paste your steps here (one per line):</label>
                                    <textarea id="ai-steps-input" class="ai-textarea" rows="8" placeholder="1. First step here
2. Second step here
3. Third step here
..."></textarea>
                                    <p class="ai-paste-hint">Tip: Numbers and bullet points are cleaned up for you.</p>
                                </div>
                            </div>
                            <div class="ai-modal-footer">
                                <button type="button" class="btn btn-secondary" id="btn-cancel-ai-paste">Cancel</button>
                                <button type="button" class="btn btn-primary" id="btn-apply-ai-paste">Add Steps</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- AI Improve Clarity Modal -->
                    <div class="ai-modal" id="ai-improve-modal" style="display: none;">
                        <div class="ai-modal-content">
                            <div class="ai-modal-header">
                                <h3>✏️ Improve Step Clarity</h3>
                                <button class="btn-close" id="btn-close-ai-improve">✕</button>
                            </div>
                            <div class="ai-modal-body">
                                <div class="ai-instructions">
                                    <p><strong>How to use:</strong></p>
                                    <ol>
                                        <li>Copy your current steps below</li>
                                        <li>Open <a href="https://claude.ai" target="_blank" rel="noopener">Claude</a> or <a href="https://chat.openai.com" target="_blank" rel="noopener">ChatGPT</a></li>
                                        <li>Ask: "Make these steps shorter and clearer for non-technical employees"</li>
                                        <li>Paste the improved steps in the second box</li>
                                    </ol>
                                    <p class="ai-draft-reminder">You can edit these further or keep your originals.</p>
                                </div>
                                <div class="ai-copy-area">
                                    <label>Your current steps (copy these):</label>
                                    <div class="ai-current-steps" id="ai-current-steps"></div>
                                    <button type="button" class="btn btn-secondary btn-copy" id="btn-copy-steps">📋 Copy Steps</button>
                                </div>
                                <div class="ai-paste-area">
                                    <label for="ai-improved-input">Paste the improved steps here:</label>
                                    <textarea id="ai-improved-input" class="ai-textarea" rows="6" placeholder="Paste the improved steps here..."></textarea>
                                </div>
                            </div>
                            <div class="ai-modal-footer">
                                <button type="button" class="btn btn-secondary" id="btn-cancel-ai-improve">Cancel</button>
                                <button type="button" class="btn btn-primary" id="btn-preview-ai-improve">Preview Changes</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Notification -->
                    <div class="notification-toast" id="notification-toast" style="display: none;">
                        <span class="notification-message"></span>
                    </div>
                </div>
            `;
        }
        
        _renderFolderOptions() {
            // If no folders loaded, ensure select is still usable
            if (!this.folders || this.folders.length === 0) {
                return '<option value="" selected>No category</option>';
            }
            const placeholder = !this.formState.folderId ? 
                '<option value="" disabled selected>Optional — used to group similar SOPs</option>' : '';
            return placeholder + this.folders.map(folder => `
                <option value="${folder.id}" ${this.formState.folderId === folder.id ? 'selected' : ''}>
                    ${folder.icon || '📁'} ${this._escapeHtml(folder.name)}
                </option>
            `).join('');
        }
        
        _renderStepsList() {
            if (this.formState.steps.length === 0) {
                return `
                    <div class="steps-empty">
                        <p>No steps added yet</p>
                        <p class="help-text">Start with the first action your team should take.</p>
                    </div>
                `;
            }
            
            return this.formState.steps.map((step, index) => `
                <div class="step-item" data-step-id="${step.id}">
                    <div class="step-drag-handle">⋮⋮</div>
                    <div class="step-number">${index + 1}</div>
                    <div class="step-content">
                        <textarea class="step-input" data-step-id="${step.id}"
                            placeholder="Describe this step..." rows="2">${this._escapeHtml(step.text)}</textarea>
                        <input type="text" class="step-note-input" data-step-id="${step.id}"
                            placeholder="Add note (optional)" value="${this._escapeHtml(step.note || '')}" />
                        ${step.image ? `
                        <div class="step-image-preview">
                            <img src="${step.image}" alt="Step image" />
                            <button type="button" class="step-image-remove" data-action="remove-image" data-step-id="${step.id}" title="Remove image">✕</button>
                        </div>
                        ` : `
                        <button type="button" class="step-image-btn" data-action="add-image" data-step-id="${step.id}">📷 Add image</button>
                        `}
                    </div>
                    <div class="step-actions">
                        <button type="button" class="step-action-btn" data-action="move-up" 
                            data-step-id="${step.id}" ${index === 0 ? 'disabled' : ''} title="Move step up" aria-label="Move step up">↑</button>
                        <button type="button" class="step-action-btn" data-action="move-down" 
                            data-step-id="${step.id}" ${index === this.formState.steps.length - 1 ? 'disabled' : ''} title="Move step down" aria-label="Move step down">↓</button>
                        <button type="button" class="step-action-btn step-delete-btn" 
                            data-action="delete" data-step-id="${step.id}" title="Delete step" aria-label="Delete step">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
        
        _renderPreview() {
            const folder = this.folders.find(f => f.id === this.formState.folderId);
            
            return `
                <div class="preview-sop">
                    <div class="preview-meta">
                        <span class="preview-folder" style="background: ${folder?.color || '#666'}20; color: ${folder?.color || '#666'}">
                            ${folder?.icon || '📁'} ${this._escapeHtml(folder?.name || 'Uncategorized')}
                        </span>
                        <span class="preview-status status-${this.formState.status}">${this.formState.status}</span>
                    </div>
                    
                    <h2>${this._escapeHtml(this.formState.title) || 'Untitled SOP'}</h2>
                    <p class="preview-description">${this._escapeHtml(this.formState.description) || 'No description'}</p>
                    
                    ${this.formState.tags.length > 0 ? `
                    <div class="preview-tags">
                        ${this.formState.tags.map(tag => `<span class="tag">#${this._escapeHtml(tag)}</span>`).join('')}
                    </div>
                    ` : ''}
                    
                    <hr />
                    
                    <h3>Steps (${this.formState.steps.length})</h3>
                    ${this.formState.steps.length > 0 ? `
                    <ol class="preview-steps">
                        ${this.formState.steps.map(step => `
                            <li>
                                <strong>${this._escapeHtml(step.text)}</strong>
                                ${step.note ? `<p class="step-note">💡 ${this._escapeHtml(step.note)}</p>` : ''}
                                ${step.image ? `<img src="${step.image}" alt="Step image" style="max-width:100%;border-radius:6px;margin-top:8px;" />` : ''}
                            </li>
                        `).join('')}
                    </ol>
                    ` : '<p>No steps defined</p>'}
                </div>
            `;
        }
        
        // ====================================================================
        // EVENT HANDLING
        // ====================================================================
        
        _attachEventListeners() {
            const form = document.getElementById('sop-form');
            form?.addEventListener('submit', (e) => {
                e.preventDefault();
                this._handleSave();
            });
            
            document.getElementById('btn-back')?.addEventListener('click', () => this._handleCancel());
            document.getElementById('btn-cancel')?.addEventListener('click', () => this._handleCancel());
            document.getElementById('btn-preview')?.addEventListener('click', () => this._showPreview());
            document.getElementById('btn-close-preview')?.addEventListener('click', () => this._hidePreview());
            document.getElementById('btn-delete')?.addEventListener('click', () => this._handleDelete());
            document.getElementById('btn-history')?.addEventListener('click', () => this._showHistory());
            document.getElementById('btn-close-history')?.addEventListener('click', () => this._hideHistory());
            document.getElementById('history-modal')?.addEventListener('click', (e) => {
                if (e.target.id === 'history-modal') this._hideHistory();
            });
            
            // Form inputs
            document.getElementById('sop-title')?.addEventListener('input', (e) => {
                this.formState.title = e.target.value;
                document.getElementById('title-count').textContent = e.target.value.length;
                this._saveDraftDebounced();
            });
            
            document.getElementById('sop-description')?.addEventListener('input', (e) => {
                this.formState.description = e.target.value;
                document.getElementById('desc-count').textContent = e.target.value.length;
                this._saveDraftDebounced();
            });
            
            document.getElementById('sop-folder')?.addEventListener('change', (e) => {
                this.formState.folderId = e.target.value;
            });
            
            document.getElementById('sop-status')?.addEventListener('change', (e) => {
                this.formState.status = e.target.value;
                this._updateStatusBadge();
            });
            
            document.getElementById('sop-tags')?.addEventListener('input', (e) => {
                this.formState.tags = e.target.value.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
                this._saveDraftDebounced();
            });
            
            document.getElementById('btn-add-step')?.addEventListener('click', () => this._addStep());
            
            this._attachStepsListeners();
            
            // AI actions
            document.querySelectorAll('[data-ai-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const target = e.target.closest('[data-ai-action]');
                    if (target) this._handleAIAction(target.dataset.aiAction);
                });
            });
            
            // Pro: manual paste fallback link
            document.getElementById('btn-ai-manual-paste')?.addEventListener('click', (e) => {
                e.preventDefault();
                this._showAIPasteModal();
            });
            
            // Free: upgrade to Pro link
            document.getElementById('btn-ai-upgrade')?.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof PaddleBilling !== 'undefined') {
                    PaddleBilling.showPricingModal();
                }
            });
            
            document.getElementById('preview-modal')?.addEventListener('click', (e) => {
                if (e.target.id === 'preview-modal') this._hidePreview();
            });
            
            this._autoResizeTextareas();
        }
        
        _autoResizeTextareas() {
            document.querySelectorAll('.step-input, .step-note-input').forEach(ta => {
                ta.style.height = 'auto';
                ta.style.height = ta.scrollHeight + 'px';
            });
        }
        
        _attachStepsListeners() {
            const stepsList = document.getElementById('steps-list');
            if (!stepsList || stepsList._listenersAttached) return;
            stepsList._listenersAttached = true;
            
            // Input: update formState by step ID (not index)
            stepsList.addEventListener('input', (e) => {
                const stepId = e.target.dataset.stepId;
                if (!stepId) return;
                const step = this.formState.steps.find(s => s.id === stepId);
                if (!step) return;
                if (e.target.classList.contains('step-input')) {
                    step.text = e.target.value;
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                }
                if (e.target.classList.contains('step-note-input')) {
                    step.note = e.target.value;
                }
                this._saveDraftDebounced();
            });
            
            // Click: move/delete by step ID
            stepsList.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                
                const action = btn.dataset.action;
                const stepId = btn.dataset.stepId;
                if (!stepId) return;
                const index = this.formState.steps.findIndex(s => s.id === stepId);
                if (index === -1) return;
                
                if (action === 'move-up') this._moveStep(index, index - 1);
                else if (action === 'move-down') this._moveStep(index, index + 1);
                else if (action === 'delete') this._deleteStep(index);
                else if (action === 'add-image') this._handleStepImage(stepId);
                else if (action === 'remove-image') this._removeStepImage(stepId);
            });
            
            // Drag: restrict to handle only.
            // Mousedown on handle sets draggable on parent; dragend removes it.
            stepsList.addEventListener('mousedown', (e) => {
                const handle = e.target.closest('.step-drag-handle');
                if (!handle) return;
                const item = handle.closest('.step-item');
                if (item) item.setAttribute('draggable', 'true');
            });
            
            stepsList.addEventListener('dragstart', (e) => {
                const item = e.target.closest('.step-item');
                if (item) {
                    this.dragState.dragging = true;
                    this.dragState.draggedId = item.dataset.stepId;
                    item.classList.add('dragging');
                }
            });
            
            stepsList.addEventListener('dragend', (e) => {
                const item = e.target.closest('.step-item');
                if (item) {
                    item.classList.remove('dragging');
                    item.removeAttribute('draggable');
                }
                this.dragState = { dragging: false, draggedId: null, dragOverId: null };
                stepsList.querySelectorAll('.step-item.drag-over').forEach(el => el.classList.remove('drag-over'));
            });
            
            stepsList.addEventListener('dragover', (e) => {
                e.preventDefault();
                const item = e.target.closest('.step-item');
                if (item && this.dragState.dragging) {
                    stepsList.querySelectorAll('.step-item.drag-over').forEach(el => el.classList.remove('drag-over'));
                    const overId = item.dataset.stepId;
                    if (overId !== this.dragState.draggedId) {
                        item.classList.add('drag-over');
                        this.dragState.dragOverId = overId;
                    }
                }
            });
            
            stepsList.addEventListener('drop', (e) => {
                e.preventDefault();
                if (this.dragState.draggedId != null && this.dragState.dragOverId != null) {
                    const from = this.formState.steps.findIndex(s => s.id === this.dragState.draggedId);
                    const to = this.formState.steps.findIndex(s => s.id === this.dragState.dragOverId);
                    if (from !== -1 && to !== -1) {
                        this._moveStep(from, to);
                    }
                }
            });
        }
        
        _updateStatusBadge() {
            const badge = document.querySelector('.status-badge');
            if (badge) {
                badge.className = `status-badge status-${this.formState.status}`;
                badge.textContent = this.formState.status;
            }
        }
        
        // ====================================================================
        // STEP MANAGEMENT
        // ====================================================================
        
        _addStep(text = '') {
            if (this.formState.steps.length >= this.options.maxSteps) return;
            
            this.formState.steps.push({
                id: `step_${Date.now()}`,
                text: text,
                note: '',
                image: null,
                order: this.formState.steps.length + 1
            });
            
            this._updateStepsList();
            this._saveDraftNow();
            
            setTimeout(() => {
                const inputs = document.querySelectorAll('.step-input');
                inputs[inputs.length - 1]?.focus();
            }, 50);
        }
        
        _deleteStep(index) {
            if (confirm('Delete this step?')) {
                this.formState.steps.splice(index, 1);
                this._reorderSteps();
                this._updateStepsList();
                this._saveDraftNow();
            }
        }
        
        _moveStep(from, to) {
            if (to < 0 || to >= this.formState.steps.length) return;
            // Create new array to avoid in-place mutation issues
            const steps = [...this.formState.steps];
            const [moved] = steps.splice(from, 1);
            steps.splice(to, 0, moved);
            this.formState.steps = steps;
            this._reorderSteps();
            this._updateStepsList();
            this._saveDraftNow();
        }
        
        _reorderSteps() {
            this.formState.steps.forEach((step, i) => step.order = i + 1);
        }
        
        /**
         * Handle image upload for a step.
         * Opens file picker, resizes via Canvas API (strips EXIF/scripts), stores as base64.
         */
        _handleStepImage(stepId) {
            const step = this.formState.steps.find(s => s.id === stepId);
            if (!step) return;
            
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.style.display = 'none';
            document.body.appendChild(input);
            
            input.addEventListener('change', () => {
                const file = input.files?.[0];
                document.body.removeChild(input);
                if (!file) return;
                
                // Validate file size (max 10MB raw — will be compressed)
                if (file.size > 10 * 1024 * 1024) {
                    this._showNotification('Image too large. Please use an image under 10MB.', 'error');
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        // SECURITY: Re-render through Canvas to strip embedded scripts, EXIF, malicious payloads
                        const canvas = document.createElement('canvas');
                        const maxWidth = 600;
                        let width = img.width;
                        let height = img.height;
                        
                        if (width > maxWidth) {
                            height = Math.round(height * (maxWidth / width));
                            width = maxWidth;
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        // Fill white background (prevents black areas from PNG transparency)
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, width, height);
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // Compress to JPEG (quality 0.6 keeps ~60-80KB base64)
                        const base64 = canvas.toDataURL('image/jpeg', 0.6);
                        step.image = base64;
                        
                        this._updateStepsList();
                        this._saveDraftNow();
                    };
                    img.onerror = () => {
                        this._showNotification('Could not load image. Try a different file.', 'error');
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
            
            input.click();
        }
        
        _removeStepImage(stepId) {
            const step = this.formState.steps.find(s => s.id === stepId);
            if (!step) return;
            step.image = null;
            this._updateStepsList();
            this._saveDraftNow();
        }
        
        // ====================================================================
        // VERSION HISTORY
        // ====================================================================
        
        /**
         * Snapshot the current SOP state before an edit overwrites it.
         * Stores in localStorage, capped at 5 versions per SOP.
         * Images stripped from snapshots to conserve storage budget.
         */
        _snapshotVersion(existingSop) {
            if (!existingSop?.id) return;
            
            const key = `withoutme_sop_history_${existingSop.id}`;
            let history = [];
            try {
                const stored = localStorage.getItem(key);
                if (stored) history = JSON.parse(stored);
            } catch (e) { history = []; }
            
            // Strip images from snapshot to save space
            const snapshot = {
                ...existingSop,
                steps: (existingSop.steps || []).map(s => ({
                    ...s,
                    image: s.image ? '[image]' : null
                }))
            };
            
            history.push({
                savedAt: Date.now(),
                snapshot
            });
            
            // Cap at 5 versions (FIFO)
            if (history.length > 5) {
                history = history.slice(-5);
            }
            
            try {
                localStorage.setItem(key, JSON.stringify(history));
            } catch (e) {
                // localStorage full — drop oldest and retry
                history = history.slice(-3);
                try { localStorage.setItem(key, JSON.stringify(history)); } catch (e2) { /* give up */ }
            }
        }
        
        _loadVersionHistory(sopId) {
            if (!sopId) return [];
            const key = `withoutme_sop_history_${sopId}`;
            try {
                const stored = localStorage.getItem(key);
                return stored ? JSON.parse(stored) : [];
            } catch (e) { return []; }
        }
        
        _showHistory() {
            const sopId = this.currentSOP?.id;
            if (!sopId) return;
            
            const history = this._loadVersionHistory(sopId);
            const body = document.getElementById('history-body');
            if (!body) return;
            
            if (history.length === 0) {
                body.innerHTML = `
                    <div class="history-empty">
                        <p>No previous versions yet.</p>
                        <p class="help-text">Versions are saved each time you edit and save this SOP.</p>
                    </div>
                `;
            } else {
                body.innerHTML = `
                    <div class="history-list" id="history-list">
                        ${history.slice().reverse().map((v, i) => {
                            const realIndex = history.length - 1 - i;
                            const date = new Date(v.savedAt);
                            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                            const stepCount = v.snapshot.steps?.length || 0;
                            return `
                                <div class="history-item">
                                    <div class="history-item-info">
                                        <div class="history-item-date">${dateStr} at ${timeStr}</div>
                                        <div class="history-item-detail">${this._escapeHtml(v.snapshot.title)} — ${stepCount} step${stepCount !== 1 ? 's' : ''}</div>
                                    </div>
                                    <div class="history-item-actions">
                                        <button type="button" class="btn btn-secondary btn-sm" data-action="view-version" data-version-index="${realIndex}">View</button>
                                        <button type="button" class="btn btn-primary btn-sm" data-action="restore-version" data-version-index="${realIndex}">Restore</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
                
                // Attach click handlers via delegation
                const list = document.getElementById('history-list');
                list?.addEventListener('click', (e) => {
                    const btn = e.target.closest('[data-action]');
                    if (!btn) return;
                    const idx = parseInt(btn.dataset.versionIndex);
                    const version = history[idx];
                    if (!version) return;
                    
                    if (btn.dataset.action === 'view-version') {
                        this._viewVersion(version);
                    } else if (btn.dataset.action === 'restore-version') {
                        this._restoreVersion(version);
                    }
                });
            }
            
            const modal = document.getElementById('history-modal');
            if (modal) modal.style.display = 'flex';
        }
        
        _hideHistory() {
            const modal = document.getElementById('history-modal');
            if (modal) modal.style.display = 'none';
        }
        
        _viewVersion(version) {
            const s = version.snapshot;
            const body = document.getElementById('history-body');
            if (!body) return;
            
            const dateStr = new Date(version.savedAt).toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit', hour12: true
            });
            
            body.innerHTML = `
                <div class="history-view">
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-history-back">← Back to list</button>
                    <div class="history-view-header">
                        <div class="history-view-date">Version from ${dateStr}</div>
                    </div>
                    <div class="preview-sop">
                        <h2>${this._escapeHtml(s.title)}</h2>
                        ${s.description ? `<p>${this._escapeHtml(s.description)}</p>` : ''}
                        <hr />
                        <h3>Steps (${(s.steps || []).length})</h3>
                        <ol class="preview-steps">
                            ${(s.steps || []).map(step => `
                                <li>
                                    <strong>${this._escapeHtml(step.text)}</strong>
                                    ${step.note ? `<p class="step-note">💡 ${this._escapeHtml(step.note)}</p>` : ''}
                                    ${step.image === '[image]' ? `<p class="step-note">📷 Image attached (preserved on restore)</p>` : ''}
                                </li>
                            `).join('')}
                        </ol>
                    </div>
                    <div class="history-view-actions">
                        <button type="button" class="btn btn-primary" id="btn-restore-this">Restore this version</button>
                    </div>
                </div>
            `;
            
            document.getElementById('btn-history-back')?.addEventListener('click', () => this._showHistory());
            document.getElementById('btn-restore-this')?.addEventListener('click', () => this._restoreVersion(version));
        }
        
        _restoreVersion(version) {
            if (!confirm('Restore this version? This will replace your current SOP content. You can undo by restoring a newer version from history.')) return;
            
            const s = version.snapshot;
            
            // Restore form state, preserving current images where step IDs match
            this.formState.title = s.title || '';
            this.formState.description = s.description || '';
            this.formState.tags = s.tags || [];
            this.formState.status = s.status || 'draft';
            this.formState.folderId = s.folderId || this.formState.folderId;
            
            // Restore steps — preserve images from current version where step IDs match
            const currentImages = {};
            this.formState.steps.forEach(step => {
                if (step.image) currentImages[step.id] = step.image;
            });
            
            this.formState.steps = (s.steps || []).map(step => ({
                id: step.id,
                text: step.text || '',
                note: step.note || '',
                image: currentImages[step.id] || null,
                order: step.order || 0
            }));
            
            // Update all form fields
            const titleEl = document.getElementById('sop-title');
            const descEl = document.getElementById('sop-description');
            const tagsEl = document.getElementById('sop-tags');
            const statusEl = document.getElementById('sop-status');
            
            if (titleEl) { titleEl.value = this.formState.title; document.getElementById('title-count').textContent = this.formState.title.length; }
            if (descEl) { descEl.value = this.formState.description; document.getElementById('desc-count').textContent = this.formState.description.length; }
            if (tagsEl) tagsEl.value = this.formState.tags.join(', ');
            if (statusEl) statusEl.value = this.formState.status;
            
            this._updateStepsList();
            this._hideHistory();
            this._showNotification('Version restored. Save to keep changes.', 'success');
        }
        
        _updateStepsList() {
            const list = document.getElementById('steps-list');
            const count = document.getElementById('step-count');
            const addBtn = document.getElementById('btn-add-step');
            const improveBtn = document.getElementById('btn-ai-improve');
            
            if (list) {
                list.innerHTML = this._renderStepsList();
                // Listeners are delegated on #steps-list — only need attaching once.
                // See _attachStepsListeners() guard.
                if (!list._listenersAttached) {
                    this._attachStepsListeners();
                }
            }
            if (count) count.textContent = `${this.formState.steps.length} / ${this.options.maxSteps}`;
            if (addBtn) addBtn.disabled = this.formState.steps.length >= this.options.maxSteps;
            if (improveBtn) improveBtn.disabled = this.formState.steps.length === 0;
            this._autoResizeTextareas();
        }
        
        // ====================================================================
        // AI HANDLERS (External Paste Workflow)
        // ====================================================================
        
        /**
         * Check if user is on Pro plan
         */
        _isProPlan() {
            return typeof PaddleBilling !== 'undefined' && PaddleBilling.isPro();
        }
        
        /**
         * Get business type from localStorage
         */
        _getBusinessType() {
            try {
                return localStorage.getItem('withoutme_business_type') || '';
            } catch (e) {
                return '';
            }
        }
        
        /**
         * Handle AI action buttons
         * Pro users get direct API calls; Free users get manual paste workflow
         */
        _handleAIAction(action) {
            if (action === 'draft-steps') {
                if (this._isProPlan()) {
                    this._aiSuggestSteps();
                } else {
                    this._showAIPasteModal();
                }
            } else if (action === 'improve-clarity') {
                if (this._isProPlan()) {
                    this._aiImproveSteps();
                } else {
                    this._showAIImproveModal();
                }
            }
        }
        
        /**
         * Pro: Call API to suggest steps based on SOP title/description
         */
        async _aiSuggestSteps() {
            this._collectFormData();
            
            const title = this.formState.title?.trim();
            if (!title) {
                this._showNotification('Add a title first so AI knows what steps to suggest.', 'error');
                return;
            }
            
            const generateBtn = document.getElementById('btn-ai-generate');
            const originalText = generateBtn?.textContent;
            
            try {
                // Show loading state
                if (generateBtn) {
                    generateBtn.disabled = true;
                    generateBtn.textContent = '⏳ Generating...';
                }
                
                // Get auth token for server-side verification
                let authHeaders = { 'Content-Type': 'application/json' };
                if (typeof SupabaseClient !== 'undefined' && SupabaseClient) {
                    try {
                        const { session } = await SupabaseClient.getSession();
                        if (session?.access_token) {
                            authHeaders['Authorization'] = `Bearer ${session.access_token}`;
                        }
                    } catch (e) { /* proceed without auth — server will reject */ }
                }

                const response = await fetch('/api/ai', {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({
                        action: 'suggest',
                        title: title,
                        description: this.formState.description?.trim() || '',
                        businessType: this._getBusinessType()
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (!data.steps || data.steps.length === 0) {
                    this._showNotification('AI couldn\'t generate steps. Try a more descriptive title.', 'error');
                    return;
                }
                
                // Confirm if replacing existing steps
                if (this.formState.steps.length > 0) {
                    if (!confirm(`This will replace your ${this.formState.steps.length} existing steps with ${data.steps.length} AI-generated steps. Continue?`)) {
                        return;
                    }
                }
                
                // Apply the steps
                this.formState.steps = data.steps.map((text, index) => ({
                    id: `step_ai_${Date.now()}_${index}`,
                    text: text,
                    note: '',
                    order: index + 1,
                    aiGenerated: true
                }));
                
                // Apply suggested tags (merge with existing, don't overwrite)
                let tagsAdded = 0;
                if (data.tags && data.tags.length > 0) {
                    const existingTags = new Set(this.formState.tags.map(t => t.toLowerCase()));
                    const newTags = data.tags.filter(t => !existingTags.has(t.toLowerCase()));
                    if (newTags.length > 0) {
                        this.formState.tags = [...this.formState.tags, ...newTags];
                        const tagsInput = document.getElementById('sop-tags');
                        if (tagsInput) tagsInput.value = this.formState.tags.join(', ');
                        tagsAdded = newTags.length;
                    }
                }
                
                this._updateStepsList();
                this._saveDraftNow();
                const tagMsg = tagsAdded > 0 ? ` + ${tagsAdded} keywords added.` : '.';
                this._showNotification(`✨ ${data.steps.length} steps generated${tagMsg} Review and edit as needed.`, 'success');
                this._showAIPastedNotice();
                if (typeof gtag === 'function') gtag('event', 'ai_suggest_used', { step_count: data.steps.length });
                
            } catch (e) {
                console.error('[AI Suggest] Error:', e);
                this._showNotification('AI step generation failed. Try again in a moment.', 'error');
            } finally {
                if (generateBtn) {
                    generateBtn.disabled = false;
                    generateBtn.textContent = originalText || '✨ Suggest Steps';
                }
            }
        }
        
        /**
         * Pro: Call API to improve existing steps
         */
        async _aiImproveSteps() {
            this._collectFormData();
            
            if (this.formState.steps.length === 0) {
                this._showNotification('Add some steps first before improving them.', 'error');
                return;
            }
            
            const improveBtn = document.getElementById('btn-ai-improve');
            const originalText = improveBtn?.textContent;
            
            // Store originals for comparison
            this._originalSteps = this.formState.steps.map(s => ({ ...s }));
            
            try {
                // Show loading state
                if (improveBtn) {
                    improveBtn.disabled = true;
                    improveBtn.textContent = '⏳ Improving...';
                }
                
                // Get auth token for server-side verification
                let improveHeaders = { 'Content-Type': 'application/json' };
                if (typeof SupabaseClient !== 'undefined' && SupabaseClient) {
                    try {
                        const { session } = await SupabaseClient.getSession();
                        if (session?.access_token) {
                            improveHeaders['Authorization'] = `Bearer ${session.access_token}`;
                        }
                    } catch (e) { /* proceed without auth — server will reject */ }
                }

                const response = await fetch('/api/ai', {
                    method: 'POST',
                    headers: improveHeaders,
                    body: JSON.stringify({
                        action: 'improve',
                        title: this.formState.title?.trim() || '',
                        steps: this.formState.steps.map(s => s.text),
                        businessType: this._getBusinessType()
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (!data.steps || data.steps.length === 0) {
                    this._showNotification('AI couldn\'t improve the steps. Try again.', 'error');
                    return;
                }
                
                // Store improved steps and show clarity preview
                this._improvedSteps = data.steps;
                this._showClarityPreview();
                if (typeof gtag === 'function') gtag('event', 'ai_improve_used', { step_count: data.steps.length });
                
            } catch (e) {
                console.error('[AI Improve] Error:', e);
                this._showNotification('AI improvement failed. Try again in a moment.', 'error');
                this._originalSteps = null;
            } finally {
                if (improveBtn) {
                    improveBtn.disabled = this.formState.steps.length === 0;
                    improveBtn.textContent = originalText || '✏️ Improve Clarity';
                }
            }
        }
        
        /**
         * Show the AI Paste Steps modal
         */
        _showAIPasteModal() {
            this._collectFormData();
            
            const modal = document.getElementById('ai-paste-modal');
            const titleText = document.getElementById('copy-title-text');
            const stepsInput = document.getElementById('ai-steps-input');
            
            if (!modal) return;
            
            // Set the title for copying
            const title = this.formState.title?.trim() || 'My SOP';
            if (titleText) titleText.textContent = `"${title}"`;
            
            // Clear previous input
            if (stepsInput) stepsInput.value = '';
            
            // Show modal
            modal.style.display = 'flex';
            
            // Attach listeners
            this._attachAIPasteModalListeners();
        }
        
        /**
         * Attach event listeners for AI Paste modal
         */
        _attachAIPasteModalListeners() {
            const modal = document.getElementById('ai-paste-modal');
            const closeBtn = document.getElementById('btn-close-ai-paste');
            const cancelBtn = document.getElementById('btn-cancel-ai-paste');
            const applyBtn = document.getElementById('btn-apply-ai-paste');
            const copyTitleBtn = document.getElementById('btn-copy-title');
            
            const closeModal = () => {
                modal.style.display = 'none';
            };
            
            // Remove old listeners by cloning
            const newCloseBtn = closeBtn?.cloneNode(true);
            const newCancelBtn = cancelBtn?.cloneNode(true);
            const newApplyBtn = applyBtn?.cloneNode(true);
            const newCopyTitleBtn = copyTitleBtn?.cloneNode(true);
            
            closeBtn?.parentNode?.replaceChild(newCloseBtn, closeBtn);
            cancelBtn?.parentNode?.replaceChild(newCancelBtn, cancelBtn);
            applyBtn?.parentNode?.replaceChild(newApplyBtn, applyBtn);
            copyTitleBtn?.parentNode?.replaceChild(newCopyTitleBtn, copyTitleBtn);
            
            newCloseBtn?.addEventListener('click', closeModal);
            newCancelBtn?.addEventListener('click', closeModal);
            
            newApplyBtn?.addEventListener('click', () => {
                this._applyPastedSteps();
                closeModal();
            });
            
            newCopyTitleBtn?.addEventListener('click', () => {
                const title = this.formState.title?.trim() || 'My SOP';
                navigator.clipboard?.writeText(title).then(() => {
                    this._showNotification('Title copied!', 'success');
                }).catch(() => {
                    this._showNotification('Could not copy. Please select and copy manually.', 'error');
                });
            });
            
            // Close on backdrop click
            modal?.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }
        
        /**
         * Parse and apply pasted steps from AI
         */
        _applyPastedSteps() {
            const input = document.getElementById('ai-steps-input');
            const rawText = input?.value?.trim();
            
            if (!rawText) {
                this._showNotification('Please paste some steps first', 'error');
                return;
            }
            
            // Parse steps from text
            const steps = this._parseStepsFromText(rawText);
            
            if (steps.length === 0) {
                this._showNotification('Could not parse any steps. Try one step per line.', 'error');
                return;
            }
            
            // Confirm if replacing existing steps
            if (this.formState.steps.length > 0) {
                if (!confirm(`This will replace your ${this.formState.steps.length} existing steps with ${steps.length} new steps. Continue?`)) {
                    return;
                }
            }
            
            // Apply the steps
            this.formState.steps = steps.map((text, index) => ({
                id: `step_pasted_${Date.now()}_${index}`,
                text: text,
                note: '',
                order: index + 1,
                aiPasted: true
            }));
            
            this._updateStepsList();
            this._saveDraftNow();
            this._showNotification(`✨ Added ${steps.length} steps. Review and edit as needed.`, 'success');
            this._showAIPastedNotice();
        }
        
        /**
         * Parse steps from raw text (handles various formats)
         */
        _parseStepsFromText(text) {
            // Split by newlines
            const lines = text.split(/\r?\n/);
            
            const steps = [];
            for (const line of lines) {
                // Clean up the line
                let cleaned = line.trim();
                
                // Skip empty lines
                if (!cleaned) continue;
                
                // Remove common prefixes: numbers, bullets, dashes, asterisks
                cleaned = cleaned
                    .replace(/^[\d]+[.):]\s*/, '')     // "1. " or "1) " or "1: "
                    .replace(/^[-•*]\s*/, '')          // "- " or "• " or "* "
                    .replace(/^Step\s*\d*[:.]\s*/i, '') // "Step 1: " or "Step: "
                    .trim();
                
                // Skip if nothing left
                if (!cleaned) continue;
                
                // Skip lines that are too short (likely not real steps)
                if (cleaned.length < 3) continue;
                
                steps.push(cleaned);
            }
            
            // Limit to max steps
            return steps.slice(0, this.options.maxSteps);
        }
        
        /**
         * Show notice that steps were pasted from AI
         */
        _showAIPastedNotice() {
            document.getElementById('ai-draft-notice')?.remove();
            document.getElementById('ai-improved-notice')?.remove();
            document.getElementById('ai-pasted-notice')?.remove();
            
            const notice = document.createElement('div');
            notice.id = 'ai-pasted-notice';
            notice.className = 'ai-draft-notice';
            notice.innerHTML = `
                <span class="notice-icon">📋</span>
                <span class="notice-text">Draft steps added. These are fully editable—review and adjust before saving.</span>
                <button type="button" class="notice-dismiss" onclick="this.parentElement.remove()">✕</button>
            `;
            
            const stepsList = document.getElementById('steps-list');
            if (stepsList) {
                stepsList.parentNode.insertBefore(notice, stepsList);
            }
        }
        
        /**
         * Show the AI Improve Clarity modal
         */
        _showAIImproveModal() {
            this._collectFormData();
            
            if (this.formState.steps.length === 0) {
                this._showNotification('Add some steps first before improving them', 'error');
                return;
            }
            
            const modal = document.getElementById('ai-improve-modal');
            const currentStepsEl = document.getElementById('ai-current-steps');
            const improvedInput = document.getElementById('ai-improved-input');
            
            if (!modal) return;
            
            // Store original steps
            this._originalSteps = this.formState.steps.map(s => ({ ...s }));
            
            // Display current steps for copying
            if (currentStepsEl) {
                const stepsText = this.formState.steps
                    .map((s, i) => `${i + 1}. ${s.text}`)
                    .join('\n');
                currentStepsEl.textContent = stepsText;
            }
            
            // Clear previous input
            if (improvedInput) improvedInput.value = '';
            
            // Show modal
            modal.style.display = 'flex';
            
            // Attach listeners
            this._attachAIImproveModalListeners();
        }
        
        /**
         * Attach event listeners for AI Improve modal
         */
        _attachAIImproveModalListeners() {
            const modal = document.getElementById('ai-improve-modal');
            const closeBtn = document.getElementById('btn-close-ai-improve');
            const cancelBtn = document.getElementById('btn-cancel-ai-improve');
            const previewBtn = document.getElementById('btn-preview-ai-improve');
            const copyStepsBtn = document.getElementById('btn-copy-steps');
            
            const closeModal = () => {
                modal.style.display = 'none';
                this._originalSteps = null;
            };
            
            // Remove old listeners by cloning
            const newCloseBtn = closeBtn?.cloneNode(true);
            const newCancelBtn = cancelBtn?.cloneNode(true);
            const newPreviewBtn = previewBtn?.cloneNode(true);
            const newCopyStepsBtn = copyStepsBtn?.cloneNode(true);
            
            closeBtn?.parentNode?.replaceChild(newCloseBtn, closeBtn);
            cancelBtn?.parentNode?.replaceChild(newCancelBtn, cancelBtn);
            previewBtn?.parentNode?.replaceChild(newPreviewBtn, previewBtn);
            copyStepsBtn?.parentNode?.replaceChild(newCopyStepsBtn, copyStepsBtn);
            
            newCloseBtn?.addEventListener('click', closeModal);
            newCancelBtn?.addEventListener('click', closeModal);
            
            newPreviewBtn?.addEventListener('click', () => {
                const improvedText = document.getElementById('ai-improved-input')?.value?.trim();
                if (!improvedText) {
                    this._showNotification('Please paste the improved steps first', 'error');
                    return;
                }
                
                const improvedSteps = this._parseStepsFromText(improvedText);
                if (improvedSteps.length === 0) {
                    this._showNotification('Could not parse steps. Try one step per line.', 'error');
                    return;
                }
                
                this._improvedSteps = improvedSteps;
                closeModal();
                this._showClarityPreview();
            });
            
            newCopyStepsBtn?.addEventListener('click', () => {
                const stepsText = this.formState.steps
                    .map((s, i) => `${i + 1}. ${s.text}`)
                    .join('\n');
                navigator.clipboard?.writeText(stepsText).then(() => {
                    this._showNotification('Steps copied! Now paste in your AI tool.', 'success');
                }).catch(() => {
                    this._showNotification('Could not copy. Please select and copy manually.', 'error');
                });
            });
            
            // Close on backdrop click
            modal?.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }
        
        /**
         * Show before/after clarity preview modal
         */
        _showClarityPreview() {
            const modal = document.getElementById('clarity-modal');
            const comparison = document.getElementById('clarity-comparison');
            
            if (!modal || !comparison || !this._originalSteps) return;
            
            // Build comparison HTML
            const comparisonHtml = this._originalSteps.map((original, index) => {
                const improved = this._improvedSteps?.[index] || original.text;
                const hasChanged = original.text.trim() !== improved.trim();
                
                return `
                    <div class="clarity-step ${hasChanged ? 'changed' : 'unchanged'}">
                        <div class="step-number">${index + 1}</div>
                        <div class="step-comparison">
                            <div class="step-original">
                                <span class="comparison-label">Before:</span>
                                <span class="comparison-text">${this._escapeHtml(original.text)}</span>
                            </div>
                            <div class="step-improved">
                                <span class="comparison-label">After:</span>
                                <span class="comparison-text ${hasChanged ? 'highlight' : ''}">${this._escapeHtml(improved)}</span>
                            </div>
                        </div>
                        ${hasChanged ? '<span class="change-badge">Changed</span>' : '<span class="unchanged-badge">No change</span>'}
                    </div>
                `;
            }).join('');
            
            // Handle case where improved has more/fewer steps
            if (this._improvedSteps && this._improvedSteps.length > this._originalSteps.length) {
                for (let i = this._originalSteps.length; i < this._improvedSteps.length; i++) {
                    comparison.innerHTML += `
                        <div class="clarity-step changed">
                            <div class="step-number">${i + 1}</div>
                            <div class="step-comparison">
                                <div class="step-original">
                                    <span class="comparison-label">Before:</span>
                                    <span class="comparison-text">(new step)</span>
                                </div>
                                <div class="step-improved">
                                    <span class="comparison-label">After:</span>
                                    <span class="comparison-text highlight">${this._escapeHtml(this._improvedSteps[i])}</span>
                                </div>
                            </div>
                            <span class="change-badge">Added</span>
                        </div>
                    `;
                }
            }
            
            comparison.innerHTML = comparisonHtml;
            
            // Show modal
            modal.style.display = 'flex';
            
            // Attach modal event listeners
            this._attachClarityModalListeners();
        }
        
        /**
         * Attach event listeners for clarity modal
         */
        _attachClarityModalListeners() {
            const modal = document.getElementById('clarity-modal');
            const closeBtn = document.getElementById('btn-close-clarity');
            const rejectBtn = document.getElementById('btn-reject-clarity');
            const acceptBtn = document.getElementById('btn-accept-clarity');
            
            const closeModal = () => {
                modal.style.display = 'none';
                this._originalSteps = null;
                this._improvedSteps = null;
            };
            
            // Remove old listeners by cloning
            const newCloseBtn = closeBtn?.cloneNode(true);
            const newRejectBtn = rejectBtn?.cloneNode(true);
            const newAcceptBtn = acceptBtn?.cloneNode(true);
            
            closeBtn?.parentNode?.replaceChild(newCloseBtn, closeBtn);
            rejectBtn?.parentNode?.replaceChild(newRejectBtn, rejectBtn);
            acceptBtn?.parentNode?.replaceChild(newAcceptBtn, acceptBtn);
            
            newCloseBtn?.addEventListener('click', closeModal);
            newRejectBtn?.addEventListener('click', () => {
                closeModal();
                this._showNotification('Changes discarded. Original steps kept.', 'info');
            });
            
            newAcceptBtn?.addEventListener('click', () => {
                this._acceptClarityChanges();
                closeModal();
            });
            
            // Close on backdrop click
            modal?.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }
        
        /**
         * Accept clarity improvements and update steps
         */
        _acceptClarityChanges() {
            if (!this._improvedSteps) return;
            
            // Replace steps with improved versions
            this.formState.steps = this._improvedSteps.map((text, index) => ({
                id: this._originalSteps?.[index]?.id || `step_improved_${Date.now()}_${index}`,
                text: text,
                note: this._originalSteps?.[index]?.note || '',
                order: index + 1,
                aiImproved: true
            }));
            
            this._updateStepsList();
            this._saveDraftNow();
            this._showNotification('✨ Steps updated with improved clarity!', 'success');
            this._showAIImprovedNotice();
        }
        
        /**
         * Show notice that steps were AI-improved
         */
        _showAIImprovedNotice() {
            document.getElementById('ai-draft-notice')?.remove();
            document.getElementById('ai-improved-notice')?.remove();
            document.getElementById('ai-pasted-notice')?.remove();
            
            const notice = document.createElement('div');
            notice.id = 'ai-improved-notice';
            notice.className = 'ai-draft-notice ai-improved-notice';
            notice.innerHTML = `
                <span class="notice-icon">✨</span>
                <span class="notice-text">Draft improvements applied. These are fully editable—review and save when ready.</span>
                <button type="button" class="notice-dismiss" onclick="this.parentElement.remove()">✕</button>
            `;
            
            const stepsList = document.getElementById('steps-list');
            if (stepsList) {
                stepsList.parentNode.insertBefore(notice, stepsList);
            }
        }
        
        // ====================================================================
        // FORM ACTIONS
        // ====================================================================
        
        _handleSave() {
            this._collectFormData();
            
            if (!this._validate()) return;
            
            const sopData = {
                id: (this.options.mode === 'edit' && this.currentSOP) 
                    ? this.currentSOP.id 
                    : `sop_${Date.now()}`,
                title: this.formState.title.trim(),
                description: this.formState.description.trim(),
                folderId: this.formState.folderId,
                steps: this.formState.steps.map((step, i) => ({
                    id: step.id || `step_${Date.now()}_${i}`,
                    text: step.text.trim(),
                    note: step.note?.trim() || '',
                    image: step.image || null,
                    order: i + 1
                })),
                tags: this.formState.tags,
                status: this.formState.status,
                createdAt: (this.options.mode === 'edit' && this.currentSOP) 
                    ? this.currentSOP.createdAt 
                    : Date.now(),
                updatedAt: Date.now()
            };
            
            const sops = this._loadSOPs();
            
            if (this.options.mode === 'edit' && this.currentSOP) {
                const index = sops.findIndex(s => s.id === this.currentSOP.id);
                if (index !== -1) {
                    this._snapshotVersion(sops[index]);
                    sops[index] = sopData;
                }
                else sops.push(sopData);
            } else {
                sops.push(sopData);
            }
            
            this._saveSOPs(sops);
            this._clearDraft();
            
            const isNewSop = !(this.options.mode === 'edit' && this.currentSOP);
            this._showNotification(isNewSop ? 'SOP created!' : 'SOP updated!', 'success');
            
            // GA4: Track new SOP creation (not edits)
            if (isNewSop && typeof gtag === 'function') {
                gtag('event', 'sop_created', { step_count: sopData.steps.length });
            }
            
            if (this.callbacks.onSave) {
                setTimeout(() => this.callbacks.onSave(sopData), 300);
            } else {
                console.warn('SOPCreate: onSave callback not registered - navigation may not work');
            }
        }
        
        _collectFormData() {
            const title = document.getElementById('sop-title');
            const desc = document.getElementById('sop-description');
            const folder = document.getElementById('sop-folder');
            const status = document.getElementById('sop-status');
            const tags = document.getElementById('sop-tags');
            
            if (title) this.formState.title = title.value;
            if (desc) this.formState.description = desc.value;
            if (folder) this.formState.folderId = folder.value;
            if (status) this.formState.status = status.value;
            if (tags) this.formState.tags = tags.value.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
            
            // Collect step values by stable ID, not DOM order
            document.querySelectorAll('.step-input').forEach(input => {
                const step = this.formState.steps.find(s => s.id === input.dataset.stepId);
                if (step) step.text = input.value;
            });
            document.querySelectorAll('.step-note-input').forEach(input => {
                const step = this.formState.steps.find(s => s.id === input.dataset.stepId);
                if (step) step.note = input.value;
            });
        }
        
        _validate() {
            const errors = [];
            if (!this.formState.title.trim()) errors.push('Title is required');
            if (this.formState.steps.length === 0) errors.push('At least one step is required');
            if (this.formState.steps.some(s => !s.text.trim())) errors.push('Some steps are empty');
            
            if (errors.length > 0) {
                alert('Please fix:\n\n• ' + errors.join('\n• '));
                return false;
            }
            return true;
        }
        
        _handleCancel() {
            if (this._hasContent() && !confirm('Discard unsaved changes?\n\nYour edits have not been saved and will be lost.')) return;
            if (this.callbacks.onCancel) {
                this.callbacks.onCancel();
            } else {
                console.warn('SOPCreate: onCancel callback not registered - navigation may not work');
            }
        }
        
        _handleDelete() {
            if (!this.currentSOP) {
                console.warn('SOPCreate: _handleDelete called but no currentSOP');
                return;
            }
            if (!confirm(`Delete "${this.currentSOP.title}"?\n\nThis SOP and all its steps will be permanently removed. This cannot be undone.`)) return;
            
            const sops = this._loadSOPs().filter(s => s.id !== this.currentSOP.id);
            this._saveSOPs(sops);
            
            this._showNotification('SOP deleted', 'error');
            if (this.callbacks.onDelete) {
                setTimeout(() => this.callbacks.onDelete(this.currentSOP), 300);
            } else {
                console.warn('SOPCreate: onDelete callback not registered - navigation may not work');
            }
        }
        
        _showPreview() {
            this._collectFormData();
            const modal = document.getElementById('preview-modal');
            const body = document.getElementById('preview-body');
            if (modal && body) {
                body.innerHTML = this._renderPreview();
                modal.style.display = 'flex';
            }
        }
        
        _hidePreview() {
            const modal = document.getElementById('preview-modal');
            if (modal) modal.style.display = 'none';
        }
        
        _showNotification(message, type = 'info') {
            // Use a body-level toast so it survives view switches and re-renders
            let toast = document.getElementById('app-notification-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'app-notification-toast';
                toast.innerHTML = '<span class="notification-message"></span>';
                document.body.appendChild(toast);
            }
            const msgEl = toast.querySelector('.notification-message');
            if (!msgEl) return;
            toast.className = `notification-toast ${type}`;
            msgEl.textContent = message;
            toast.style.display = 'block';
            if (toast._hideTimer) clearTimeout(toast._hideTimer);
            toast._hideTimer = setTimeout(() => toast.style.display = 'none', 3000);
        }
        
        // ====================================================================
        // PUBLIC API
        // ====================================================================
        
        create(options = {}) {
            this.options.mode = 'create';
            this.currentSOP = null;
            this._loadFolders();
            
            const draft = this._loadDraft();
            if (draft) {
                this._showDraftRecoveryPrompt(draft, options);
            } else {
                this._startFreshEditor(options);
            }
        }
        
        _showDraftRecoveryPrompt(draft, options) {
            const draftLabel = (draft.title && draft.title.trim()) 
                ? `"${draft.title.trim()}"` 
                : 'Untitled draft';
            
            // Render a minimal recovery screen inside the editor container
            this.container.innerHTML = `
                <div class="draft-recovery-overlay">
                    <div class="draft-recovery-prompt">
                        <h3>Unsaved work found</h3>
                        <p>You have an unfinished SOP draft: <strong>${this._escapeHtml(draftLabel)}</strong></p>
                        <p class="draft-recovery-sub">What would you like to do?</p>
                        <div class="draft-recovery-actions">
                            <button class="btn btn-primary" id="btn-continue-draft">Continue editing</button>
                            <button class="btn btn-secondary" id="btn-start-new">Start a new SOP</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.getElementById('btn-continue-draft')?.addEventListener('click', () => {
                this.formState = { ...draft };
                // Ensure all steps have stable IDs
                if (Array.isArray(this.formState.steps)) {
                    this.formState.steps = this.formState.steps.map((s, i) => ({
                        ...s,
                        id: s.id || `step_${Date.now()}_${i}`
                    }));
                }
                this._showNotification('Continuing your draft', 'info');
                this._render();
                this._attachEventListeners();
            });
            
            document.getElementById('btn-start-new')?.addEventListener('click', () => {
                this._clearDraft();
                this._startFreshEditor(options);
                this._showNotification('Started a new SOP', 'info');
            });
        }
        
        _startFreshEditor(options = {}) {
            const steps = (options.steps || []).map((s, i) => ({
                ...s,
                id: s.id || `step_${Date.now()}_${i}`
            }));
            this.formState = {
                title: options.title || '',
                description: options.description || '',
                folderId: options.folderId || 'general',
                steps,
                tags: options.tags || [],
                status: options.status || 'draft'
            };
            
            this._render();
            this._attachEventListeners();
        }
        
        edit(sopOrId) {
            this.options.mode = 'edit';
            this._loadFolders();
            
            let sop = sopOrId;
            if (typeof sopOrId === 'string') {
                sop = this._loadSOPs().find(s => s.id === sopOrId);
            }
            
            if (!sop) {
                this._showNotification('SOP not found', 'error');
                return;
            }
            
            this.currentSOP = sop;
            this.formState = {
                title: sop.title || '',
                description: sop.description || '',
                folderId: sop.folderId || 'general',
                steps: sop.steps ? sop.steps.map((s, i) => ({
                    ...s,
                    id: s.id || `step_${Date.now()}_${i}`
                })) : [],
                tags: sop.tags ? [...sop.tags] : [],
                status: sop.status || 'draft'
            };
            
            this._render();
            this._attachEventListeners();
        }
        
        on(event, callback) {
            const valid = ['onSave', 'onCancel', 'onDelete', 'onChange'];
            if (valid.includes(event)) this.callbacks[event] = callback;
        }
        
        refresh() {
            this._loadFolders();
            this._render();
            this._attachEventListeners();
        }
        
        destroy() {
            if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
            clearTimeout(this._draftDebounceTimer);
            if (this._beforeUnloadHandler) {
                window.removeEventListener('beforeunload', this._beforeUnloadHandler);
            }
            this.container.innerHTML = '';
            document.getElementById('sop-create-styles')?.remove();
        }
        
        _escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // ====================================================================
        // STYLES
        // ====================================================================
        
        _injectStyles() {
            if (document.getElementById('sop-create-styles')) return;
            
            const styles = document.createElement('style');
            styles.id = 'sop-create-styles';
            styles.textContent = `
                .sop-create-container {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: #1f2937;
                    background: #f9fafb;
                    min-height: 100vh;
                }
                
                .sop-create-layout {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 1.5rem;
                }
                
                .sop-create-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
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
                    font-size: 1.25rem;
                }
                
                .btn-back {
                    padding: 0.5rem 0.75rem;
                    background: none;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.875rem;
                }
                
                .btn-back:hover { background: #f3f4f6; }
                
                .status-badge {
                    padding: 0.25rem 0.625rem;
                    border-radius: 999px;
                    font-size: 0.7rem;
                    font-weight: 500;
                    text-transform: uppercase;
                }
                
                .status-draft { background: #fef3c7; color: #92400e; }
                .status-active { background: #d1fae5; color: #065f46; }
                .status-archived { background: #e5e7eb; color: #6b7280; }
                
                .form-section {
                    background: #fff;
                    border: 1px solid #f3f4f6;
                    border-radius: 10px;
                    padding: 1.5rem;
                    margin-bottom: 1.25rem;
                }
                
                .form-section h3 {
                    margin: 0 0 1rem;
                    font-size: 0.95rem;
                    font-weight: 500;
                    color: #374151;
                }
                
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                
                .section-header h3 { margin: 0; }
                
                .step-count {
                    color: #6b7280;
                    font-size: 0.8rem;
                }
                
                .form-group {
                    margin-bottom: 1rem;
                }
                
                .form-group:last-child { margin-bottom: 0; }
                
                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }
                
                label {
                    display: block;
                    margin-bottom: 0.375rem;
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: #4b5563;
                }
                
                .required { color: #ef4444; }
                
                .form-input, .form-textarea, .form-select {
                    width: 100%;
                    padding: 0.625rem 0.75rem;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 0.9rem;
                    box-sizing: border-box;
                }
                
                .form-input:focus, .form-textarea:focus, .form-select:focus {
                    outline: none;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                }
                
                .form-textarea {
                    resize: vertical;
                    min-height: 70px;
                }
                
                .char-count {
                    display: block;
                    text-align: right;
                    font-size: 0.7rem;
                    color: #9ca3af;
                    margin-top: 0.25rem;
                }
                
                .help-text {
                    font-size: 0.75rem;
                    color: #6b7280;
                }
                
                /* AI Panel */
                .ai-steps-panel {
                    background: linear-gradient(135deg, #f0fdf4, #ecfeff);
                    border: 1px solid #a7f3d0;
                    border-radius: 8px;
                    padding: 0.875rem 1rem;
                    margin-bottom: 1rem;
                }
                
                .ai-panel-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.5rem;
                }
                
                .ai-icon {
                    font-size: 1.1rem;
                }
                
                .ai-title {
                    font-weight: 600;
                    font-size: 0.9rem;
                    color: #065f46;
                }
                
                .ai-badge {
                    font-size: 0.65rem;
                    padding: 0.125rem 0.5rem;
                    background: #d1fae5;
                    color: #047857;
                    border-radius: 10px;
                    font-weight: 500;
                }
                
                .ai-description {
                    font-size: 0.8rem;
                    color: #065f46;
                    margin: 0 0 0.75rem !important;
                }
                
                .ai-steps-actions {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }
                
                .ai-steps-panel p {
                    margin: 0 0 0.625rem;
                    font-size: 0.8rem;
                    color: #065f46;
                }
                
                .ai-btn {
                    padding: 0.5rem 1rem;
                    background: linear-gradient(135deg, #dcfce7, #cffafe);
                    border: 1px solid #a7f3d0;
                    border-radius: 6px;
                    color: #065f46;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                }
                
                .ai-btn:hover {
                    background: linear-gradient(135deg, #bbf7d0, #a5f3fc);
                }
                
                .ai-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .ai-hint {
                    font-size: 0.7rem !important;
                    color: #6b7280 !important;
                    margin-top: 0.5rem !important;
                    margin-bottom: 0 !important;
                }
                
                .ai-badge-pro {
                    background: #e0e7ff;
                    color: #4338ca;
                }
                
                .ai-upgrade-hint {
                    font-size: 0.7rem !important;
                    color: #6366f1 !important;
                    margin-top: 0.25rem !important;
                    margin-bottom: 0 !important;
                }
                
                .ai-link {
                    color: #6366f1;
                    text-decoration: underline;
                    cursor: pointer;
                }
                
                .ai-link:hover {
                    color: #4338ca;
                }
                
                .ai-steps-panel.loading {
                    opacity: 0.7;
                    pointer-events: none;
                }
                
                /* AI Modals */
                .ai-modal {
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
                    padding: 1rem;
                }
                
                .ai-modal-content {
                    background: #fff;
                    border-radius: 12px;
                    max-width: 600px;
                    width: 100%;
                    max-height: 85vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
                }
                
                .ai-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .ai-modal-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                }
                
                .ai-modal-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.25rem;
                }
                
                .ai-instructions {
                    background: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 1rem;
                    margin-bottom: 1rem;
                }
                
                .ai-instructions p {
                    margin: 0 0 0.5rem;
                    font-size: 0.85rem;
                }
                
                .ai-instructions ol {
                    margin: 0;
                    padding-left: 1.25rem;
                    font-size: 0.85rem;
                }
                
                .ai-instructions li {
                    margin-bottom: 0.375rem;
                }
                
                .ai-instructions code {
                    background: #e5e7eb;
                    padding: 0.125rem 0.375rem;
                    border-radius: 4px;
                    font-size: 0.8rem;
                }
                
                .ai-instructions a {
                    color: #4f46e5;
                }
                
                .btn-copy-small {
                    font-size: 0.7rem;
                    padding: 0.125rem 0.5rem;
                    background: #e5e7eb;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-left: 0.25rem;
                }
                
                .btn-copy-small:hover {
                    background: #d1d5db;
                }
                
                .ai-paste-area {
                    margin-top: 1rem;
                }
                
                .ai-paste-area label {
                    display: block;
                    font-size: 0.85rem;
                    font-weight: 500;
                    margin-bottom: 0.375rem;
                }
                
                .ai-textarea {
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 0.875rem;
                    font-family: inherit;
                    resize: vertical;
                    box-sizing: border-box;
                }
                
                .ai-textarea:focus {
                    outline: none;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                }
                
                .ai-paste-hint {
                    font-size: 0.75rem !important;
                    color: #6b7280 !important;
                    margin-top: 0.375rem !important;
                }
                
                .ai-draft-reminder {
                    font-size: 0.8rem;
                    color: #6b7280;
                    margin-top: 0.75rem;
                    padding-top: 0.75rem;
                    border-top: 1px solid #e5e7eb;
                }
                
                .ai-copy-area {
                    margin-bottom: 1rem;
                }
                
                .ai-copy-area label {
                    display: block;
                    font-size: 0.85rem;
                    font-weight: 500;
                    margin-bottom: 0.375rem;
                }
                
                .ai-current-steps {
                    background: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    padding: 0.75rem;
                    font-size: 0.85rem;
                    white-space: pre-wrap;
                    max-height: 150px;
                    overflow-y: auto;
                    margin-bottom: 0.5rem;
                }
                
                .btn-copy {
                    font-size: 0.8rem;
                }
                
                .ai-modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    padding: 1rem 1.25rem;
                    border-top: 1px solid #e5e7eb;
                    background: #f9fafb;
                    border-radius: 0 0 12px 12px;
                }
                
                .ai-draft-notice {
                    display: flex;
                    align-items: center;
                    gap: 0.625rem;
                    padding: 0.75rem 1rem;
                    background: #fefce8;
                    border: 1px solid #fde047;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                    font-size: 0.8rem;
                    line-height: 1.5;
                    color: #854d0e;
                }
                
                .ai-draft-notice .notice-icon {
                    font-size: 1rem;
                    flex-shrink: 0;
                }
                
                .ai-draft-notice .notice-text {
                    flex: 1;
                    line-height: 1.5;
                }
                
                .ai-draft-notice .notice-dismiss {
                    background: none;
                    border: none;
                    color: #92400e;
                    cursor: pointer;
                    padding: 0.25rem;
                    font-size: 0.9rem;
                    opacity: 0.7;
                }
                
                .ai-draft-notice .notice-dismiss:hover {
                    opacity: 1;
                }
                
                .ai-improved-notice {
                    background: #ecfdf5;
                    border-color: #6ee7b7;
                    color: #065f46;
                }
                
                .ai-btn-secondary {
                    background: linear-gradient(135deg, #f3f4f6, #e5e7eb) !important;
                    border-color: #d1d5db !important;
                    color: #374151 !important;
                }
                
                .ai-btn-secondary:hover {
                    background: linear-gradient(135deg, #e5e7eb, #d1d5db) !important;
                }
                
                .ai-btn-secondary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                /* Clarity Preview Modal */
                .clarity-modal {
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
                    padding: 1rem;
                }
                
                .clarity-content {
                    background: #fff;
                    border-radius: 12px;
                    max-width: 700px;
                    width: 100%;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
                }
                
                .clarity-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .clarity-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                }
                
                .clarity-description {
                    padding: 0.75rem 1.25rem;
                    margin: 0;
                    font-size: 0.85rem;
                    color: #6b7280;
                    background: #f9fafb;
                }
                
                .clarity-comparison {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1rem 1.25rem;
                }
                
                .clarity-step {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.75rem;
                    padding: 0.875rem;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    margin-bottom: 0.75rem;
                }
                
                .clarity-step.changed {
                    border-color: #6366f1;
                    background: #f5f3ff;
                }
                
                .clarity-step .step-number {
                    min-width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #e5e7eb;
                    border-radius: 50%;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #6b7280;
                }
                
                .clarity-step.changed .step-number {
                    background: #6366f1;
                    color: #fff;
                }
                
                .step-comparison {
                    flex: 1;
                    min-width: 0;
                }
                
                .step-original, .step-improved {
                    margin-bottom: 0.5rem;
                }
                
                .step-improved {
                    margin-bottom: 0;
                }
                
                .comparison-label {
                    display: block;
                    font-size: 0.65rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #9ca3af;
                    margin-bottom: 0.125rem;
                }
                
                .comparison-text {
                    font-size: 0.875rem;
                    line-height: 1.4;
                }
                
                .step-original .comparison-text {
                    color: #6b7280;
                    text-decoration: line-through;
                }
                
                .step-improved .comparison-text.highlight {
                    color: #4f46e5;
                    font-weight: 500;
                }
                
                .clarity-step.unchanged .step-original .comparison-text {
                    text-decoration: none;
                    color: #374151;
                }
                
                .change-badge {
                    font-size: 0.65rem;
                    padding: 0.25rem 0.5rem;
                    background: #6366f1;
                    color: #fff;
                    border-radius: 4px;
                    font-weight: 500;
                    white-space: nowrap;
                }
                
                .unchanged-badge {
                    font-size: 0.65rem;
                    padding: 0.25rem 0.5rem;
                    background: #e5e7eb;
                    color: #6b7280;
                    border-radius: 4px;
                    font-weight: 500;
                    white-space: nowrap;
                }
                
                .clarity-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    padding: 1rem 1.25rem;
                    border-top: 1px solid #e5e7eb;
                    background: #f9fafb;
                    border-radius: 0 0 12px 12px;
                }
                
                /* Steps */
                .steps-list {
                    min-height: 80px;
                }
                
                .steps-empty {
                    text-align: center;
                    padding: 1.5rem;
                    background: #f9fafb;
                    border: 2px dashed #e5e7eb;
                    border-radius: 8px;
                    color: #6b7280;
                }
                
                .steps-empty p { margin: 0.25rem 0; line-height: 1.5; }
                
                .step-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.75rem;
                    padding: 1rem;
                    background: #fafafa;
                    border: 1px solid #f3f4f6;
                    border-radius: 8px;
                    margin-bottom: 0.75rem;
                    transition: all 0.2s ease;
                }
                
                .step-item:hover { background: #f5f5f5; border-color: #e5e7eb; }
                .step-item.dragging { opacity: 0.5; background: #dbeafe; }
                .step-item.drag-over { border-color: #6366f1; border-style: dashed; }
                
                .step-drag-handle {
                    cursor: grab;
                    color: #9ca3af;
                    font-weight: bold;
                    padding: 0.25rem;
                }
                
                .step-number {
                    min-width: 26px;
                    height: 26px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #6366f1;
                    color: #fff;
                    border-radius: 50%;
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                
                .step-content { flex: 1; }
                
                .step-input {
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 0.875rem;
                    line-height: 1.5;
                    resize: none;
                    overflow: hidden;
                    box-sizing: border-box;
                    transition: border-color 0.2s ease;
                }
                
                .step-input:focus {
                    outline: none;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                }
                
                .step-note-input {
                    width: 100%;
                    margin-top: 0.5rem;
                    padding: 0.375rem 0.625rem;
                    border: 1px solid #e5e7eb;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    line-height: 1.5;
                    box-sizing: border-box;
                    transition: border-color 0.2s ease;
                }
                
                .step-note-input:focus {
                    outline: none;
                    border-color: #6366f1;
                }
                
                .step-image-btn {
                    display: inline-block;
                    margin-top: 0.5rem;
                    padding: 0.25rem 0.625rem;
                    border: 1px dashed #d1d5db;
                    border-radius: 4px;
                    background: transparent;
                    color: #6b7280;
                    font-size: 0.75rem;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .step-image-btn:hover { border-color: #6366f1; color: #6366f1; }
                
                .step-image-preview {
                    position: relative;
                    display: inline-block;
                    margin-top: 0.5rem;
                    max-width: 100%;
                }
                .step-image-preview img {
                    max-width: 100%;
                    max-height: 200px;
                    border-radius: 6px;
                    border: 1px solid #e5e7eb;
                    display: block;
                }
                .step-image-remove {
                    position: absolute;
                    top: 4px;
                    right: 4px;
                    width: 24px;
                    height: 24px;
                    border: none;
                    border-radius: 50%;
                    background: rgba(0,0,0,0.6);
                    color: #fff;
                    font-size: 12px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                }
                
                .history-empty {
                    text-align: center;
                    padding: 2rem;
                    color: #6b7280;
                }
                .history-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                .history-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.875rem 1rem;
                    background: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                }
                .history-item-date {
                    font-weight: 600;
                    font-size: 0.875rem;
                    color: #1f2937;
                }
                .history-item-detail {
                    font-size: 0.8rem;
                    color: #6b7280;
                    margin-top: 2px;
                }
                .history-item-actions {
                    display: flex;
                    gap: 0.5rem;
                    flex-shrink: 0;
                }
                .btn-sm {
                    padding: 0.375rem 0.75rem;
                    font-size: 0.75rem;
                }
                .history-view-header {
                    margin: 1rem 0 0.5rem;
                }
                .history-view-date {
                    font-size: 0.875rem;
                    color: #6b7280;
                    font-weight: 500;
                }
                .history-view-actions {
                    margin-top: 1.5rem;
                    text-align: right;
                }
                
                .step-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }
                
                .step-action-btn {
                    width: 28px;
                    height: 28px;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    background: #fff;
                    cursor: pointer;
                    font-size: 0.8rem;
                }
                
                .step-action-btn:hover:not(:disabled) { background: #f3f4f6; }
                .step-action-btn:focus-visible { outline: 2px solid #6366f1; outline-offset: 1px; }
                .step-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .step-delete-btn:hover:not(:disabled) { background: #fef2f2; border-color: #fecaca; }
                
                .btn-add-step {
                    width: 100%;
                    padding: 0.75rem;
                    background: #fff;
                    border: 2px dashed #d1d5db;
                    border-radius: 8px;
                    color: #6b7280;
                    font-size: 0.85rem;
                    font-weight: 500;
                    cursor: pointer;
                }
                
                .btn-add-step:hover:not(:disabled) {
                    border-color: #6366f1;
                    color: #6366f1;
                    background: #f5f3ff;
                }
                
                .btn-add-step:disabled { opacity: 0.5; cursor: not-allowed; }
                
                /* Actions */
                .form-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 1rem;
                }
                
                .actions-left, .actions-right {
                    display: flex;
                    gap: 0.5rem;
                }
                
                .btn {
                    padding: 0.625rem 1.25rem;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    line-height: 1.4;
                }
                
                .btn:focus {
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
                }
                
                .btn-primary { 
                    background: #6366f1; 
                    color: #fff;
                    box-shadow: 0 1px 3px rgba(99, 102, 241, 0.2);
                    font-weight: 600;
                }
                .btn-primary:hover { 
                    background: #4f46e5;
                    box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
                }
                
                .btn-secondary { 
                    background: #fff; 
                    color: #6b7280;
                    border: 1px solid #e5e7eb;
                    font-weight: 400;
                }
                .btn-secondary:hover { 
                    background: #f9fafb;
                    border-color: #d1d5db;
                    color: #374151;
                }
                
                .btn-danger {
                    background: #fef2f2;
                    color: #b91c1c;
                    border: 1px solid #fecaca;
                }
                .btn-danger:hover { 
                    background: #fee2e2;
                    border-color: #fca5a5;
                }
                
                /* Draft Recovery Prompt */
                .draft-recovery-overlay {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 60vh;
                    padding: 2rem;
                }
                .draft-recovery-prompt {
                    background: #fff;
                    border: 1px solid #f3f4f6;
                    border-radius: 12px;
                    padding: 2rem;
                    max-width: 420px;
                    width: 100%;
                    text-align: center;
                }
                .draft-recovery-prompt h3 {
                    margin: 0 0 0.75rem;
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #1e293b;
                }
                .draft-recovery-prompt p {
                    margin: 0 0 0.5rem;
                    font-size: 0.9rem;
                    color: #4b5563;
                    line-height: 1.5;
                }
                .draft-recovery-prompt strong {
                    color: #1e293b;
                }
                .draft-recovery-sub {
                    margin-top: 0.25rem;
                    color: #6b7280 !important;
                    font-size: 0.85rem !important;
                }
                .draft-recovery-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 0.625rem;
                    margin-top: 1.25rem;
                }
                .draft-recovery-actions .btn {
                    width: 100%;
                    padding: 0.75rem 1.25rem;
                }

                /* Preview Modal */
                .preview-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                
                .preview-content {
                    background: #fff;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 80vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                
                .preview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .preview-header h3 { margin: 0; font-size: 1rem; }
                
                .btn-close {
                    width: 28px;
                    height: 28px;
                    border: none;
                    background: #f3f4f6;
                    border-radius: 6px;
                    cursor: pointer;
                }
                
                .btn-close:hover { background: #e5e7eb; }
                
                .preview-body {
                    padding: 1.25rem;
                    overflow-y: auto;
                }
                
                .preview-meta {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }
                
                .preview-folder {
                    padding: 0.25rem 0.625rem;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 500;
                }
                
                .preview-status {
                    padding: 0.25rem 0.625rem;
                    border-radius: 6px;
                    font-size: 0.7rem;
                    font-weight: 500;
                }
                
                .preview-sop h2 {
                    margin: 0 0 0.5rem;
                    font-size: 1.25rem;
                }
                
                .preview-description {
                    color: #6b7280;
                    margin: 0 0 1rem;
                    font-size: 0.9rem;
                }
                
                .preview-tags {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }
                
                .tag { color: #6366f1; font-size: 0.8rem; }
                
                .preview-steps {
                    padding-left: 1.25rem;
                }
                
                .preview-steps li {
                    margin-bottom: 0.75rem;
                    line-height: 1.4;
                }
                
                .step-note {
                    margin: 0.25rem 0 0;
                    font-size: 0.8rem;
                    color: #6b7280;
                    font-weight: normal;
                }
                
                /* Notification */
                .notification-toast {
                    position: fixed;
                    bottom: 1.5rem;
                    right: 1.5rem;
                    padding: 0.875rem 1.25rem;
                    background: #1f2937;
                    color: #fff;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    z-index: 1001;
                }
                
                .notification-toast.success { background: #059669; }
                .notification-toast.error { background: #dc2626; }
                .notification-toast.info { background: #2563eb; }
                
                @media (max-width: 768px) {
                    .sop-create-layout { padding: 1rem; }
                    .form-row { grid-template-columns: 1fr; }
                    .form-actions { flex-direction: column; gap: 0.75rem; }
                    .actions-left, .actions-right { width: 100%; justify-content: center; }
                }
            `;
            
            document.head.appendChild(styles);
        }
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    function createSOPEditor(container, options = {}) {
        return new SOPCreate(container, options);
    }

    global.SOPCreate = SOPCreate;
    global.createSOPEditor = createSOPEditor;
    global.SOP_STORAGE_KEYS = SOP_STORAGE_KEYS;

    console.log('✅ SOPCreate module loaded');

})(typeof window !== 'undefined' ? window : this);
