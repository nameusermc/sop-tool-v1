/**
 * SOP Create/Edit Module - SOP Tool v1
 * 
 * Features:
 * - Form for title, description, and folder assignment
 * - Step editor with add, edit, remove, reorder
 * - Folder/category selection (integrates with Dashboard folders)
 * - Tags and status management
 * - AI-powered step generation via Anthropic API
 * - AI-powered clarity improvement with before/after preview
 * - Auto-save drafts
 * 
 * STORAGE KEY: 'sop_tool_sops' - Must match Dashboard module
 * 
 * @module SOPCreate
 * @version 2.2.0
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
                draggedIndex: null,
                dragOverIndex: null
            };
            
            this.autoSaveTimer = null;
            
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
            this.folders = stored ? JSON.parse(stored) : [...DEFAULT_FOLDERS];
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
        
        _loadDraft() {
            const stored = localStorage.getItem(SOP_STORAGE_KEYS.DRAFTS);
            return stored ? JSON.parse(stored) : null;
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
                                        placeholder="e.g., New Employee Onboarding Process"
                                        value="${this._escapeHtml(this.formState.title)}"
                                        maxlength="200" required />
                                    <span class="char-count"><span id="title-count">${this.formState.title.length}</span>/200</span>
                                </div>
                                
                                <div class="form-group">
                                    <label for="sop-description">Description</label>
                                    <textarea id="sop-description" class="form-textarea" rows="3"
                                        placeholder="Brief description of what this SOP covers..."
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
                                        placeholder="e.g., training, safety, weekly"
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
                                    <p>✨ Let AI help you with your SOP steps</p>
                                    <div class="ai-steps-actions">
                                        <button type="button" class="ai-btn" id="btn-ai-generate" data-ai-action="draft-steps">
                                            🤖 Generate Steps
                                        </button>
                                        <button type="button" class="ai-btn ai-btn-secondary" id="btn-ai-improve" data-ai-action="improve-clarity"
                                            ${this.formState.steps.length === 0 ? 'disabled' : ''}>
                                            ✏️ Improve Clarity
                                        </button>
                                    </div>
                                    <p class="ai-hint">Generate: Create steps from title | Improve: Simplify existing steps</p>
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
                    
                    <!-- Clarity Preview Modal -->
                    <div class="clarity-modal" id="clarity-modal" style="display: none;">
                        <div class="clarity-content">
                            <div class="clarity-header">
                                <h3>✏️ Review Improved Steps</h3>
                                <button class="btn-close" id="btn-close-clarity">✕</button>
                            </div>
                            <p class="clarity-description">AI has simplified your steps for clarity. Review the changes below:</p>
                            <div class="clarity-comparison" id="clarity-comparison"></div>
                            <div class="clarity-actions">
                                <button type="button" class="btn btn-secondary" id="btn-reject-clarity">Keep Original</button>
                                <button type="button" class="btn btn-primary" id="btn-accept-clarity">✓ Accept Changes</button>
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
            return this.folders.map(folder => `
                <option value="${folder.id}" ${this.formState.folderId === folder.id ? 'selected' : ''}>
                    ${folder.icon || '📁'} ${this._escapeHtml(folder.name)}
                </option>
            `).join('');
        }
        
        _renderStepsList() {
            if (this.formState.steps.length === 0) {
                return `
                    <div class="steps-empty">
                        <p>📭 No steps added yet</p>
                        <p class="help-text">Click "Add Step" to begin</p>
                    </div>
                `;
            }
            
            return this.formState.steps.map((step, index) => `
                <div class="step-item" data-step-index="${index}" draggable="true">
                    <div class="step-drag-handle">⋮⋮</div>
                    <div class="step-number">${index + 1}</div>
                    <div class="step-content">
                        <textarea class="step-input" data-step-index="${index}"
                            placeholder="Describe this step..." rows="2">${this._escapeHtml(step.text)}</textarea>
                        <input type="text" class="step-note-input" data-step-index="${index}"
                            placeholder="Add note (optional)" value="${this._escapeHtml(step.note || '')}" />
                    </div>
                    <div class="step-actions">
                        <button type="button" class="step-action-btn" data-action="move-up" 
                            data-step-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button>
                        <button type="button" class="step-action-btn" data-action="move-down" 
                            data-step-index="${index}" ${index === this.formState.steps.length - 1 ? 'disabled' : ''}>↓</button>
                        <button type="button" class="step-action-btn step-delete-btn" 
                            data-action="delete" data-step-index="${index}">🗑️</button>
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
            
            // Form inputs
            document.getElementById('sop-title')?.addEventListener('input', (e) => {
                this.formState.title = e.target.value;
                document.getElementById('title-count').textContent = e.target.value.length;
            });
            
            document.getElementById('sop-description')?.addEventListener('input', (e) => {
                this.formState.description = e.target.value;
                document.getElementById('desc-count').textContent = e.target.value.length;
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
            });
            
            document.getElementById('btn-add-step')?.addEventListener('click', () => this._addStep());
            
            this._attachStepsListeners();
            
            // AI actions
            document.querySelectorAll('[data-ai-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this._handleAIAction(e.target.dataset.aiAction);
                });
            });
            
            document.getElementById('preview-modal')?.addEventListener('click', (e) => {
                if (e.target.id === 'preview-modal') this._hidePreview();
            });
        }
        
        _attachStepsListeners() {
            const stepsList = document.getElementById('steps-list');
            if (!stepsList) return;
            
            stepsList.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.stepIndex);
                if (e.target.classList.contains('step-input') && this.formState.steps[index]) {
                    this.formState.steps[index].text = e.target.value;
                }
                if (e.target.classList.contains('step-note-input') && this.formState.steps[index]) {
                    this.formState.steps[index].note = e.target.value;
                }
            });
            
            stepsList.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                
                const action = btn.dataset.action;
                const index = parseInt(btn.dataset.stepIndex);
                
                if (action === 'move-up') this._moveStep(index, index - 1);
                else if (action === 'move-down') this._moveStep(index, index + 1);
                else if (action === 'delete') this._deleteStep(index);
            });
            
            // Drag and drop
            stepsList.addEventListener('dragstart', (e) => {
                const item = e.target.closest('.step-item');
                if (item) {
                    this.dragState.dragging = true;
                    this.dragState.draggedIndex = parseInt(item.dataset.stepIndex);
                    item.classList.add('dragging');
                }
            });
            
            stepsList.addEventListener('dragend', (e) => {
                const item = e.target.closest('.step-item');
                if (item) item.classList.remove('dragging');
                this.dragState = { dragging: false, draggedIndex: null, dragOverIndex: null };
                document.querySelectorAll('.step-item.drag-over').forEach(el => el.classList.remove('drag-over'));
            });
            
            stepsList.addEventListener('dragover', (e) => {
                e.preventDefault();
                const item = e.target.closest('.step-item');
                if (item && this.dragState.dragging) {
                    document.querySelectorAll('.step-item.drag-over').forEach(el => el.classList.remove('drag-over'));
                    const overIndex = parseInt(item.dataset.stepIndex);
                    if (overIndex !== this.dragState.draggedIndex) {
                        item.classList.add('drag-over');
                        this.dragState.dragOverIndex = overIndex;
                    }
                }
            });
            
            stepsList.addEventListener('drop', (e) => {
                e.preventDefault();
                if (this.dragState.draggedIndex !== null && this.dragState.dragOverIndex !== null) {
                    this._moveStep(this.dragState.draggedIndex, this.dragState.dragOverIndex);
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
                order: this.formState.steps.length + 1
            });
            
            this._updateStepsList();
            
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
            }
        }
        
        _moveStep(from, to) {
            if (to < 0 || to >= this.formState.steps.length) return;
            const [moved] = this.formState.steps.splice(from, 1);
            this.formState.steps.splice(to, 0, moved);
            this._reorderSteps();
            this._updateStepsList();
        }
        
        _reorderSteps() {
            this.formState.steps.forEach((step, i) => step.order = i + 1);
        }
        
        _updateStepsList() {
            const list = document.getElementById('steps-list');
            const count = document.getElementById('step-count');
            const addBtn = document.getElementById('btn-add-step');
            const improveBtn = document.getElementById('btn-ai-improve');
            
            if (list) {
                list.innerHTML = this._renderStepsList();
                this._attachStepsListeners();
            }
            if (count) count.textContent = `${this.formState.steps.length} / ${this.options.maxSteps}`;
            if (addBtn) addBtn.disabled = this.formState.steps.length >= this.options.maxSteps;
            if (improveBtn) improveBtn.disabled = this.formState.steps.length === 0;
        }
        
        // ====================================================================
        // AI HANDLERS
        // ====================================================================
        
        _handleAIAction(action) {
            if (action === 'draft-steps') {
                this._generateStepsWithAI();
            } else if (action === 'improve-clarity') {
                this._improveStepsWithAI();
            }
        }
        
        /**
         * Generate SOP steps using AI
         * Calls Anthropic API to generate steps based on title and description
         */
        async _generateStepsWithAI() {
            // Collect current form data
            this._collectFormData();
            
            const title = this.formState.title?.trim();
            const description = this.formState.description?.trim();
            
            // Validate input
            if (!title) {
                this._showNotification('Please enter a title first', 'error');
                document.getElementById('sop-title')?.focus();
                return;
            }
            
            // Check if steps already exist
            if (this.formState.steps.length > 0) {
                if (!confirm('This will replace your existing steps. Continue?')) {
                    return;
                }
            }
            
            // Show loading state
            const aiBtn = document.getElementById('btn-ai-generate');
            const aiPanel = document.getElementById('ai-steps-panel');
            const originalBtnText = aiBtn?.textContent;
            
            if (aiBtn) {
                aiBtn.disabled = true;
                aiBtn.textContent = '⏳ Generating...';
            }
            if (aiPanel) {
                aiPanel.classList.add('loading');
            }
            
            this._showNotification('AI is drafting steps...', 'info');
            
            try {
                const steps = await this._callAIForSteps(title, description);
                
                if (steps && steps.length > 0) {
                    // Clear existing steps
                    this.formState.steps = [];
                    
                    // Add AI-generated steps
                    steps.forEach((stepText, index) => {
                        this.formState.steps.push({
                            id: `step_ai_${Date.now()}_${index}`,
                            text: stepText,
                            note: '',
                            order: index + 1,
                            aiGenerated: true  // Mark as AI-generated
                        });
                    });
                    
                    this._updateStepsList();
                    this._showNotification(`✨ AI generated ${steps.length} draft steps. Review and edit as needed.`, 'success');
                    
                    // Show draft notice
                    this._showAIDraftNotice();
                } else {
                    this._showNotification('AI could not generate steps. Try adding more detail to your title.', 'error');
                }
            } catch (error) {
                console.error('AI generation error:', error);
                this._handleAIError(error);
            } finally {
                // Restore button state
                if (aiBtn) {
                    aiBtn.disabled = false;
                    aiBtn.textContent = originalBtnText || '🤖 Generate Steps with AI';
                }
                if (aiPanel) {
                    aiPanel.classList.remove('loading');
                }
            }
        }
        
        /**
         * Call Anthropic API to generate steps
         */
        async _callAIForSteps(title, description) {
            const prompt = `You are helping create a Standard Operating Procedure (SOP) for a small business.

Title: ${title}
${description ? `Description: ${description}` : ''}

Generate 4-8 clear, actionable steps for this SOP. Requirements:
- Use simple, non-technical language
- Each step should be a single, concrete action
- Start each step with an action verb
- Keep steps brief (under 15 words each)
- Focus on practical execution

Respond with ONLY a JSON array of step strings, nothing else. Example:
["Step one text", "Step two text", "Step three text"]`;

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 1000,
                    messages: [
                        { role: 'user', content: prompt }
                    ]
                })
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Extract text from response
            const textContent = data.content?.find(block => block.type === 'text');
            if (!textContent?.text) {
                throw new Error('No text in API response');
            }
            
            // Parse JSON array from response
            const responseText = textContent.text.trim();
            
            // Handle potential markdown code blocks
            let jsonText = responseText;
            if (responseText.startsWith('```')) {
                jsonText = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }
            
            const steps = JSON.parse(jsonText);
            
            if (!Array.isArray(steps)) {
                throw new Error('Response is not an array');
            }
            
            // Validate and clean steps
            return steps
                .filter(step => typeof step === 'string' && step.trim().length > 0)
                .map(step => step.trim())
                .slice(0, this.options.maxSteps);
        }
        
        /**
         * Handle AI errors gracefully
         */
        _handleAIError(error) {
            let message = 'AI generation failed. Please try again or add steps manually.';
            
            if (error.message?.includes('API request failed')) {
                message = 'Could not connect to AI service. Please try again later.';
            } else if (error.message?.includes('JSON')) {
                message = 'AI response was unclear. Please try again with a more specific title.';
            }
            
            this._showNotification(message, 'error');
        }
        
        /**
         * Show notice that steps are AI-generated drafts
         */
        _showAIDraftNotice() {
            // Remove existing notice if present
            document.getElementById('ai-draft-notice')?.remove();
            
            const notice = document.createElement('div');
            notice.id = 'ai-draft-notice';
            notice.className = 'ai-draft-notice';
            notice.innerHTML = `
                <span class="notice-icon">📝</span>
                <span class="notice-text">These steps are AI-generated drafts. Please review and edit before saving.</span>
                <button type="button" class="notice-dismiss" onclick="this.parentElement.remove()">✕</button>
            `;
            
            const stepsList = document.getElementById('steps-list');
            if (stepsList) {
                stepsList.parentNode.insertBefore(notice, stepsList);
            }
        }
        
        /**
         * Improve clarity of existing steps using AI
         */
        async _improveStepsWithAI() {
            // Collect current form data
            this._collectFormData();
            
            // Validate steps exist
            if (this.formState.steps.length === 0) {
                this._showNotification('Add some steps first before improving them', 'error');
                return;
            }
            
            // Store original steps for comparison
            this._originalSteps = this.formState.steps.map(s => ({ ...s }));
            
            // Show loading state
            const aiBtn = document.getElementById('btn-ai-improve');
            const aiPanel = document.getElementById('ai-steps-panel');
            const originalBtnText = aiBtn?.textContent;
            
            if (aiBtn) {
                aiBtn.disabled = true;
                aiBtn.textContent = '⏳ Improving...';
            }
            if (aiPanel) {
                aiPanel.classList.add('loading');
            }
            
            this._showNotification('AI is improving your steps...', 'info');
            
            try {
                const improvedSteps = await this._callAIForClarity(this._originalSteps);
                
                if (improvedSteps && improvedSteps.length > 0) {
                    this._improvedSteps = improvedSteps;
                    this._showClarityPreview();
                } else {
                    this._showNotification('AI could not improve the steps. They may already be clear!', 'info');
                }
            } catch (error) {
                console.error('AI clarity error:', error);
                this._handleAIError(error);
            } finally {
                // Restore button state
                if (aiBtn) {
                    aiBtn.disabled = false;
                    aiBtn.textContent = originalBtnText || '✏️ Improve Clarity';
                }
                if (aiPanel) {
                    aiPanel.classList.remove('loading');
                }
            }
        }
        
        /**
         * Call Anthropic API to improve step clarity
         */
        async _callAIForClarity(steps) {
            const stepsText = steps.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
            
            const prompt = `You are helping improve a Standard Operating Procedure (SOP) for non-technical employees.

Current steps:
${stepsText}

Rewrite each step to be:
- Shorter (under 12 words if possible)
- Clearer and more direct
- Easy for non-technical employees to understand
- Starting with a simple action verb

IMPORTANT: Preserve the original meaning of each step. Do not add or remove steps.

Respond with ONLY a JSON array of the improved step strings, in the same order. Example:
["Improved step one", "Improved step two", "Improved step three"]`;

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 1000,
                    messages: [
                        { role: 'user', content: prompt }
                    ]
                })
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Extract text from response
            const textContent = data.content?.find(block => block.type === 'text');
            if (!textContent?.text) {
                throw new Error('No text in API response');
            }
            
            // Parse JSON array from response
            const responseText = textContent.text.trim();
            
            // Handle potential markdown code blocks
            let jsonText = responseText;
            if (responseText.startsWith('```')) {
                jsonText = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }
            
            const improvedSteps = JSON.parse(jsonText);
            
            if (!Array.isArray(improvedSteps)) {
                throw new Error('Response is not an array');
            }
            
            // Validate we got the same number of steps
            if (improvedSteps.length !== steps.length) {
                console.warn('AI returned different number of steps, adjusting...');
            }
            
            return improvedSteps
                .filter(step => typeof step === 'string' && step.trim().length > 0)
                .map(step => step.trim());
        }
        
        /**
         * Show before/after clarity preview modal
         */
        _showClarityPreview() {
            const modal = document.getElementById('clarity-modal');
            const comparison = document.getElementById('clarity-comparison');
            
            if (!modal || !comparison) return;
            
            // Build comparison HTML
            const comparisonHtml = this._originalSteps.map((original, index) => {
                const improved = this._improvedSteps[index] || original.text;
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
            
            closeBtn?.addEventListener('click', closeModal);
            rejectBtn?.addEventListener('click', () => {
                closeModal();
                this._showNotification('Changes discarded. Original steps kept.', 'info');
            });
            
            acceptBtn?.addEventListener('click', () => {
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
            if (!this._improvedSteps || !this._originalSteps) return;
            
            // Update each step with improved text
            this.formState.steps.forEach((step, index) => {
                if (this._improvedSteps[index]) {
                    step.text = this._improvedSteps[index];
                    step.aiImproved = true;  // Mark as AI-improved
                }
            });
            
            this._updateStepsList();
            this._showNotification('✨ Steps updated with improved clarity!', 'success');
            
            // Show notice that steps were improved
            this._showAIImprovedNotice();
        }
        
        /**
         * Show notice that steps were AI-improved
         */
        _showAIImprovedNotice() {
            // Remove existing notices
            document.getElementById('ai-draft-notice')?.remove();
            document.getElementById('ai-improved-notice')?.remove();
            
            const notice = document.createElement('div');
            notice.id = 'ai-improved-notice';
            notice.className = 'ai-draft-notice ai-improved-notice';
            notice.innerHTML = `
                <span class="notice-icon">✨</span>
                <span class="notice-text">Steps improved for clarity. Review and save when ready.</span>
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
                if (index !== -1) sops[index] = sopData;
                else sops.push(sopData);
            } else {
                sops.push(sopData);
            }
            
            this._saveSOPs(sops);
            this._clearDraft();
            
            this._showNotification(this.options.mode === 'edit' ? 'SOP updated!' : 'SOP created!', 'success');
            
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
            
            document.querySelectorAll('.step-input').forEach((input, i) => {
                if (this.formState.steps[i]) this.formState.steps[i].text = input.value;
            });
            document.querySelectorAll('.step-note-input').forEach((input, i) => {
                if (this.formState.steps[i]) this.formState.steps[i].note = input.value;
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
            if (this._hasContent() && !confirm('Discard unsaved changes?')) return;
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
            if (!confirm(`Permanently delete "${this.currentSOP.title}"?\n\nThis cannot be undone.`)) return;
            
            const sops = this._loadSOPs().filter(s => s.id !== this.currentSOP.id);
            this._saveSOPs(sops);
            
            this._showNotification('SOP deleted', 'success');
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
            const toast = document.getElementById('notification-toast');
            if (!toast) {
                console.warn('SOPCreate: Notification toast element not found');
                return;
            }
            const msgEl = toast.querySelector('.notification-message');
            if (!msgEl) {
                console.warn('SOPCreate: Notification message element not found');
                return;
            }
            toast.className = `notification-toast ${type}`;
            msgEl.textContent = message;
            toast.style.display = 'block';
            setTimeout(() => toast.style.display = 'none', 3000);
        }
        
        // ====================================================================
        // PUBLIC API
        // ====================================================================
        
        create(options = {}) {
            this.options.mode = 'create';
            this.currentSOP = null;
            this._loadFolders();
            
            const draft = this._loadDraft();
            if (draft && confirm('Continue editing saved draft?')) {
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
                steps: sop.steps ? [...sop.steps] : [],
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
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    padding: 1.25rem;
                    margin-bottom: 1.25rem;
                }
                
                .form-section h3 {
                    margin: 0 0 1rem;
                    font-size: 1rem;
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
                    opacity: 0.7;
                    cursor: wait;
                }
                
                .ai-hint {
                    font-size: 0.7rem !important;
                    color: #6b7280 !important;
                    margin-top: 0.5rem !important;
                    margin-bottom: 0 !important;
                }
                
                .ai-steps-panel.loading {
                    opacity: 0.7;
                    pointer-events: none;
                }
                
                .ai-draft-notice {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1rem;
                    background: #fef3c7;
                    border: 1px solid #fcd34d;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                    font-size: 0.8rem;
                    color: #92400e;
                }
                
                .ai-draft-notice .notice-icon {
                    font-size: 1rem;
                }
                
                .ai-draft-notice .notice-text {
                    flex: 1;
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
                
                .steps-empty p { margin: 0.25rem 0; }
                
                .step-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.625rem;
                    padding: 0.875rem;
                    background: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    margin-bottom: 0.625rem;
                    transition: all 0.15s;
                }
                
                .step-item:hover { background: #f3f4f6; }
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
                    padding: 0.5rem 0.625rem;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    resize: vertical;
                    box-sizing: border-box;
                }
                
                .step-input:focus {
                    outline: none;
                    border-color: #6366f1;
                }
                
                .step-note-input {
                    width: 100%;
                    margin-top: 0.375rem;
                    padding: 0.375rem 0.5rem;
                    border: 1px solid #e5e7eb;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    box-sizing: border-box;
                }
                
                .step-note-input:focus {
                    outline: none;
                    border-color: #6366f1;
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
                    padding-top: 0.5rem;
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
                }
                
                .btn-primary { background: #6366f1; color: #fff; }
                .btn-primary:hover { background: #4f46e5; }
                
                .btn-secondary { background: #e5e7eb; color: #374151; }
                .btn-secondary:hover { background: #d1d5db; }
                
                .btn-danger {
                    background: #fef2f2;
                    color: #dc2626;
                    border: 1px solid #fecaca;
                }
                .btn-danger:hover { background: #fee2e2; }
                
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
