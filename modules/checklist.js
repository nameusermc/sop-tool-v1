/**
 * Checklist Module - SOP Tool v1
 * 
 * Features:
 * - Generate interactive checklists from SOPs
 * - Mark steps as complete/incomplete
 * - Persist progress to localStorage
 * - Resume partially completed checklists
 * - Track completion timestamps
 * - Notes per step
 * 
 * SNAPSHOT RULE:
 * Checklists are immutable snapshots of SOPs at creation time.
 * - When a checklist is created, it captures the SOP's steps at that exact moment
 * - Subsequent edits to the SOP do NOT affect existing checklists
 * - Each checklist stores `sopSnapshotAt` to track when it was captured
 * - "Restart" creates a NEW checklist from the CURRENT SOP (with warning if SOP changed)
 * - If the source SOP is deleted, existing checklists remain functional
 * 
 * STORAGE KEY: 'sop_tool_checklists'
 * 
 * @module Checklist
 * @version 1.1.0
 */

(function(global) {
    'use strict';

    const CHECKLIST_STORAGE_KEYS = {
        CHECKLISTS: 'sop_tool_checklists',
        SOPS: 'sop_tool_sops',
        FOLDERS: 'sop_tool_folders'
    };

    const CHECKLIST_STATUS = {
        IN_PROGRESS: 'in_progress',
        COMPLETED: 'completed',
        ABANDONED: 'abandoned'
    };

    class Checklist {
        constructor(containerElement, options = {}) {
            if (typeof containerElement === 'string') {
                containerElement = document.querySelector(containerElement);
            }
            
            if (!containerElement) {
                throw new Error('Checklist: Container element not found');
            }
            
            this.container = containerElement;
            
            this.options = {
                autoSave: true,
                autoSaveDelay: 1000,
                showNotes: true,
                showTimestamps: true,
                autoRender: true,
                ...options
            };
            
            this.currentChecklist = null;
            this.currentSOP = null;
            this.folders = [];
            this.saveTimer = null;
            this.readOnly = false;  // True when viewing completed checklists
            
            this.callbacks = {
                onComplete: null,
                onBack: null,
                onStepChange: null
            };
            
            this._init();
        }
        
        _init() {
            this._loadFolders();
            this._injectStyles();
        }
        
        _loadFolders() {
            const stored = localStorage.getItem(CHECKLIST_STORAGE_KEYS.FOLDERS);
            this.folders = stored ? JSON.parse(stored) : [];
        }
        
        _loadChecklists() {
            const stored = localStorage.getItem(CHECKLIST_STORAGE_KEYS.CHECKLISTS);
            return stored ? JSON.parse(stored) : [];
        }
        
        _saveChecklists(checklists) {
            localStorage.setItem(CHECKLIST_STORAGE_KEYS.CHECKLISTS, JSON.stringify(checklists));
        }
        
        _loadSOPs() {
            const stored = localStorage.getItem(CHECKLIST_STORAGE_KEYS.SOPS);
            return stored ? JSON.parse(stored) : [];
        }
        
        _getSOP(sopId) {
            return this._loadSOPs().find(s => s.id === sopId) || null;
        }
        
        createFromSOP(sopId) {
            const sop = this._getSOP(sopId);
            if (!sop) {
                console.warn('Checklist: Cannot create checklist - SOP not found:', sopId);
                return null;
            }
            
            // Defensive check: SOP must have steps
            if (!sop.steps || sop.steps.length === 0) {
                console.warn('Checklist: Cannot create checklist - SOP has no steps:', sopId);
                return null;
            }
            
            // SNAPSHOT RULE: Checklists capture SOP state at creation time.
            // Subsequent edits to the SOP do not affect this checklist.
            const checklist = {
                id: 'checklist_' + Date.now(),
                sopId: sop.id,
                sopTitle: sop.title,
                sopSnapshotAt: sop.updatedAt || sop.createdAt || Date.now(), // Track SOP version
                folderId: sop.folderId,
                status: CHECKLIST_STATUS.IN_PROGRESS,
                steps: sop.steps.map((step, i) => ({
                    id: step.id || 'step_' + i,
                    text: step.text || '',
                    note: step.note || '',
                    userNote: '',
                    completed: false,
                    completedAt: null,
                    order: i + 1
                })),
                createdAt: Date.now(),
                updatedAt: Date.now(),
                completedAt: null,
                completedSteps: 0,
                totalSteps: sop.steps.length
            };
            
            const checklists = this._loadChecklists();
            checklists.unshift(checklist);
            this._saveChecklists(checklists);
            
            return checklist;
        }
        
        _updateChecklist(checklist) {
            checklist.updatedAt = Date.now();
            checklist.completedSteps = checklist.steps.filter(s => s.completed).length;
            
            if (checklist.completedSteps === checklist.totalSteps && checklist.status !== CHECKLIST_STATUS.COMPLETED) {
                checklist.status = CHECKLIST_STATUS.COMPLETED;
                checklist.completedAt = Date.now();
            }
            
            const checklists = this._loadChecklists();
            const index = checklists.findIndex(c => c.id === checklist.id);
            
            if (index !== -1) {
                checklists[index] = checklist;
            } else {
                checklists.unshift(checklist);
            }
            
            this._saveChecklists(checklists);
            return checklist;
        }
        
        deleteChecklist(checklistId) {
            const checklists = this._loadChecklists().filter(c => c.id !== checklistId);
            this._saveChecklists(checklists);
        }
        
        getRecentChecklists(limit = 10) {
            return this._loadChecklists()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .slice(0, limit);
        }
        
        getInProgressChecklists() {
            return this._loadChecklists()
                .filter(c => c.status === CHECKLIST_STATUS.IN_PROGRESS)
                .sort((a, b) => b.updatedAt - a.updatedAt);
        }
        
        getChecklist(checklistId) {
            return this._loadChecklists().find(c => c.id === checklistId) || null;
        }
        
        startFromSOP(sopId) {
            if (!sopId) {
                console.error('Checklist: startFromSOP called without sopId');
                return;
            }
            
            const sop = this._getSOP(sopId);
            if (!sop) {
                console.warn('Checklist: SOP not found:', sopId);
                this._showNotification('SOP not found', 'error');
                if (this.callbacks.onBack) {
                    this.callbacks.onBack();
                }
                return;
            }
            
            this.currentSOP = sop;
            this.currentChecklist = this.createFromSOP(sopId);
            
            // Handle case where checklist creation failed (e.g., no steps)
            if (!this.currentChecklist) {
                console.warn('Checklist: Failed to create checklist from SOP:', sopId);
                this._showNotification('Cannot create checklist - SOP has no steps', 'error');
                if (this.callbacks.onBack) {
                    this.callbacks.onBack();
                }
                return;
            }
            
            this.readOnly = false;  // New checklists are editable
            this._render();
            this._attachEventListeners();
        }
        
        resumeChecklist(checklistId) {
            if (!checklistId) {
                console.error('Checklist: resumeChecklist called without checklistId');
                return;
            }
            
            const checklist = this.getChecklist(checklistId);
            if (!checklist) {
                console.warn('Checklist: Checklist not found:', checklistId);
                this._showNotification('Checklist not found', 'error');
                if (this.callbacks.onBack) {
                    this.callbacks.onBack();
                }
                return;
            }
            
            // Validate checklist has required data
            if (!checklist.steps || checklist.totalSteps === 0) {
                console.warn('Checklist: Invalid checklist data:', checklistId);
                this._showNotification('Checklist data is invalid', 'error');
                if (this.callbacks.onBack) {
                    this.callbacks.onBack();
                }
                return;
            }
            
            this.readOnly = false;  // Resuming allows editing
            this.currentChecklist = checklist;
            this.currentSOP = this._getSOP(checklist.sopId);
            // Note: currentSOP may be null if original SOP was deleted - that's okay for resuming
            
            this._loadFolders(); // Refresh folders in case they changed
            this._render();
            this._attachEventListeners();
        }
        
        /**
         * View a completed checklist in read-only mode
         * @param {string} checklistId - ID of the completed checklist
         */
        viewCompleted(checklistId) {
            if (!checklistId) {
                console.error('Checklist: viewCompleted called without checklistId');
                return;
            }
            
            const checklist = this.getChecklist(checklistId);
            if (!checklist) {
                console.warn('Checklist: Checklist not found:', checklistId);
                this._showNotification('Checklist not found', 'error');
                if (this.callbacks.onBack) {
                    this.callbacks.onBack();
                }
                return;
            }
            
            this.readOnly = true;  // View mode - no editing
            this.currentChecklist = checklist;
            this.currentSOP = this._getSOP(checklist.sopId);
            
            this._loadFolders();
            this._render();
            this._attachEventListeners();
        }
        
        _render() {
            if (!this.currentChecklist) {
                console.warn('Checklist: _render called without currentChecklist');
                return;
            }
            
            this.container.innerHTML = '';
            this.container.className = 'checklist-container';
            
            const checklist = this.currentChecklist;
            const folder = this.folders.find(f => f.id === checklist.folderId);
            
            // Safe progress calculation (avoid division by zero)
            const totalSteps = checklist.totalSteps || 1;
            const progress = Math.round((checklist.completedSteps / totalSteps) * 100);
            const isComplete = checklist.status === CHECKLIST_STATUS.COMPLETED;
            const isReadOnly = this.readOnly;
            
            // Determine status badge text
            let statusBadgeText = isComplete ? '✅ Completed' : '🔄 In Progress';
            if (isReadOnly) {
                statusBadgeText = '👁️ Viewing';
            }
            
            // Build completion banner (different for read-only)
            let completionBanner = '';
            if (isComplete) {
                completionBanner = '<div class="completion-banner">' +
                    '<span class="completion-icon">🎉</span>' +
                    '<div class="completion-text">' +
                        '<strong>Checklist Complete!</strong>' +
                        '<p>Completed on ' + new Date(checklist.completedAt).toLocaleString() + '</p>' +
                    '</div>' +
                    (isReadOnly ? '' : '<button class="btn btn-primary" id="btn-restart">🔄 Start New</button>') +
                '</div>';
            }
            
            // Build footer (simpler for read-only)
            let footer = '';
            if (isReadOnly) {
                footer = '<footer class="checklist-footer">' +
                    '<div class="footer-left"></div>' +
                    '<div class="footer-right">' +
                        '<button class="btn btn-primary" id="btn-done">← Back to Dashboard</button>' +
                    '</div>' +
                '</footer>';
            } else {
                footer = '<footer class="checklist-footer">' +
                    '<div class="footer-left">' +
                        '<button class="btn btn-secondary" id="btn-reset">↩️ Clear Progress</button>' +
                    '</div>' +
                    '<div class="footer-right">' +
                        (!isComplete ?
                            '<button class="btn btn-secondary" id="btn-save-exit">✓ Done</button>' +
                            '<button class="btn btn-primary" id="btn-mark-all"' + (checklist.completedSteps === checklist.totalSteps ? ' disabled' : '') + '>✅ Complete All</button>'
                            : '<button class="btn btn-primary" id="btn-done">✓ Done</button>') +
                    '</div>' +
                '</footer>';
            }
            
            this.container.innerHTML = '<div class="checklist-layout">' +
                '<header class="checklist-header">' +
                    '<div class="header-left">' +
                        '<button class="btn-back" id="btn-back">← Back</button>' +
                        '<div class="header-info">' +
                            '<h2>' + this._escapeHtml(checklist.sopTitle) + '</h2>' +
                            '<div class="header-meta">' +
                                '<span class="folder-badge" style="background: ' + (folder?.color || '#6b7280') + '20; color: ' + (folder?.color || '#6b7280') + '">' +
                                    (folder?.icon || '📁') + ' ' + this._escapeHtml(folder?.name || 'General') +
                                '</span>' +
                                '<span class="status-badge status-' + checklist.status + (isReadOnly ? ' readonly' : '') + '">' +
                                    statusBadgeText +
                                '</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="header-right">' +
                        '<div class="progress-info">' +
                            '<span class="progress-text">' + checklist.completedSteps + ' / ' + checklist.totalSteps + ' steps</span>' +
                            '<div class="progress-bar">' +
                                '<div class="progress-fill" style="width: ' + progress + '%"></div>' +
                            '</div>' +
                            '<span class="progress-percent">' + progress + '%</span>' +
                        '</div>' +
                    '</div>' +
                '</header>' +
                completionBanner +
                '<main class="checklist-main">' +
                    '<div class="steps-checklist" id="steps-checklist">' +
                        this._renderSteps() +
                    '</div>' +
                '</main>' +
                footer +
                '<div class="notification-toast" id="notification-toast" style="display: none;">' +
                    '<span class="notification-message"></span>' +
                '</div>' +
            '</div>';
        }
        
        _renderSteps() {
            if (!this.currentChecklist || !this.currentChecklist.steps.length) {
                return '<div class="empty-state"><p>No steps in this checklist</p></div>';
            }
            
            const isReadOnly = this.readOnly;
            
            return this.currentChecklist.steps.map((step, index) => {
                const isCompleted = step.completed;
                
                // In read-only mode, show static checkmark; otherwise show interactive checkbox
                let checkboxHtml;
                if (isReadOnly) {
                    checkboxHtml = '<div class="step-checkbox readonly">' +
                        '<span class="checkbox-static' + (isCompleted ? ' checked' : '') + '">' +
                            (isCompleted ? '✓' : '') +
                        '</span>' +
                    '</div>';
                } else {
                    checkboxHtml = '<div class="step-checkbox">' +
                        '<input type="checkbox" id="step-' + index + '" class="step-check" data-step-index="' + index + '"' + (isCompleted ? ' checked' : '') + ' />' +
                        '<label for="step-' + index + '" class="checkbox-label">' +
                            '<span class="checkbox-custom"></span>' +
                        '</label>' +
                    '</div>';
                }
                
                // User notes input (only show when not read-only)
                let userNoteHtml = '';
                if (!isReadOnly && this.options.showNotes) {
                    userNoteHtml = '<div class="step-user-note">' +
                        '<input type="text" class="user-note-input" data-step-index="' + index + '" placeholder="Your notes..." value="' + this._escapeHtml(step.userNote || '') + '" />' +
                    '</div>';
                } else if (isReadOnly && step.userNote) {
                    // Show user note as static text in read-only mode
                    userNoteHtml = '<p class="step-user-note-readonly">📝 ' + this._escapeHtml(step.userNote) + '</p>';
                }
                
                return '<div class="checklist-step' + (isCompleted ? ' completed' : '') + (isReadOnly ? ' readonly' : '') + '" data-step-index="' + index + '">' +
                    checkboxHtml +
                    '<div class="step-content">' +
                        '<div class="step-number">' + (index + 1) + '</div>' +
                        '<div class="step-text-container">' +
                            '<p class="step-text">' + this._escapeHtml(step.text) + '</p>' +
                            (step.note ? '<p class="step-note">💡 ' + this._escapeHtml(step.note) + '</p>' : '') +
                            userNoteHtml +
                        '</div>' +
                    '</div>' +
                    '<div class="step-status">' +
                        (isCompleted && this.options.showTimestamps && step.completedAt ? 
                            '<span class="completed-time">✓ ' + this._formatTime(step.completedAt) + '</span>' : '') +
                    '</div>' +
                '</div>';
            }).join('');
        }
        
        _formatTime(timestamp) {
            return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        _attachEventListeners() {
            // Back and Done buttons always work
            document.getElementById('btn-back')?.addEventListener('click', () => this._handleBack());
            document.getElementById('btn-done')?.addEventListener('click', () => this._handleBack());
            
            // Skip interactive handlers in read-only mode
            if (this.readOnly) {
                return;
            }
            
            // Step checkbox changes
            document.getElementById('steps-checklist')?.addEventListener('change', (e) => {
                if (e.target.classList.contains('step-check')) {
                    this._toggleStep(parseInt(e.target.dataset.stepIndex), e.target.checked);
                }
            });
            
            // User note input
            document.getElementById('steps-checklist')?.addEventListener('input', (e) => {
                if (e.target.classList.contains('user-note-input')) {
                    this._updateStepNote(parseInt(e.target.dataset.stepIndex), e.target.value);
                }
            });
            
            // Step row click (toggles checkbox)
            document.getElementById('steps-checklist')?.addEventListener('click', (e) => {
                const stepEl = e.target.closest('.checklist-step');
                if (stepEl && !e.target.closest('.step-checkbox') && !e.target.closest('.user-note-input')) {
                    const index = parseInt(stepEl.dataset.stepIndex);
                    const checkbox = document.getElementById('step-' + index);
                    if (checkbox) {
                        checkbox.checked = !checkbox.checked;
                        this._toggleStep(index, checkbox.checked);
                    }
                }
            });
            
            // Reset button
            document.getElementById('btn-reset')?.addEventListener('click', () => {
                if (confirm('Clear all progress on this checklist?\n\nThis cannot be undone.')) this._resetAll();
            });
            
            // Other action buttons
            document.getElementById('btn-mark-all')?.addEventListener('click', () => this._markAllComplete());
            document.getElementById('btn-save-exit')?.addEventListener('click', () => this._saveAndExit());
            document.getElementById('btn-restart')?.addEventListener('click', () => {
                this._handleRestart();
            });
        }
        
        /**
         * Handle Restart button - creates new checklist from current SOP
         * SNAPSHOT RULE: Warns user if SOP has changed since checklist was created
         */
        _handleRestart() {
            const checklist = this.currentChecklist;
            if (!checklist) {
                console.warn('Checklist: Cannot restart - no current checklist');
                return;
            }
            
            const sopId = this.currentSOP?.id || checklist.sopId;
            if (!sopId) {
                console.warn('Checklist: Cannot restart - no SOP reference');
                this._showNotification('Cannot restart - original SOP not found', 'error');
                return;
            }
            
            // Check if SOP still exists
            const currentSOP = this._getSOP(sopId);
            if (!currentSOP) {
                this._showNotification('Cannot restart - SOP has been deleted', 'error');
                return;
            }
            
            // Check if SOP has been modified since this checklist was created
            const sopLastModified = currentSOP.updatedAt || currentSOP.createdAt || 0;
            const snapshotTime = checklist.sopSnapshotAt || checklist.createdAt;
            const sopChanged = sopLastModified > snapshotTime;
            
            if (sopChanged) {
                // SOP was edited - confirm with user
                const confirmed = confirm(
                    'The SOP has been updated since this checklist was created.\n\n' +
                    'Start a new checklist with the updated steps?'
                );
                if (!confirmed) return;
            }
            
            // Create new checklist from current SOP
            this.startFromSOP(sopId);
        }
        
        _toggleStep(index, completed) {
            if (!this.currentChecklist) return;
            
            const step = this.currentChecklist.steps[index];
            if (!step) return;
            
            step.completed = completed;
            step.completedAt = completed ? Date.now() : null;
            
            const stepEl = document.querySelector('[data-step-index="' + index + '"]');
            if (stepEl) {
                stepEl.classList.toggle('completed', completed);
                const statusEl = stepEl.querySelector('.step-status');
                if (statusEl && this.options.showTimestamps) {
                    statusEl.innerHTML = completed && step.completedAt 
                        ? '<span class="completed-time">✓ ' + this._formatTime(step.completedAt) + '</span>'
                        : '';
                }
            }
            
            this._scheduleSave();
            this._updateProgress();
            
            if (this.callbacks.onStepChange) {
                this.callbacks.onStepChange(step, index, this.currentChecklist);
            }
        }
        
        _updateStepNote(index, note) {
            if (!this.currentChecklist) return;
            const step = this.currentChecklist.steps[index];
            if (step) {
                step.userNote = note;
                this._scheduleSave();
            }
        }
        
        _scheduleSave() {
            if (!this.options.autoSave) return;
            if (this.saveTimer) clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => this._saveProgress(), this.options.autoSaveDelay);
        }
        
        _saveProgress() {
            if (!this.currentChecklist) return;
            this._updateChecklist(this.currentChecklist);
        }
        
        _updateProgress() {
            if (!this.currentChecklist) {
                console.warn('Checklist: _updateProgress called without currentChecklist');
                return;
            }
            
            const checklist = this.currentChecklist;
            checklist.completedSteps = checklist.steps.filter(s => s.completed).length;
            
            // Safe progress calculation (avoid division by zero)
            const totalSteps = checklist.totalSteps || 1;
            const progress = Math.round((checklist.completedSteps / totalSteps) * 100);
            
            const progressFill = document.querySelector('.progress-fill');
            const progressText = document.querySelector('.progress-text');
            const progressPercent = document.querySelector('.progress-percent');
            
            if (progressFill) progressFill.style.width = progress + '%';
            if (progressText) progressText.textContent = checklist.completedSteps + ' / ' + checklist.totalSteps + ' steps';
            if (progressPercent) progressPercent.textContent = progress + '%';
            
            if (checklist.completedSteps === checklist.totalSteps && checklist.status !== CHECKLIST_STATUS.COMPLETED) {
                checklist.status = CHECKLIST_STATUS.COMPLETED;
                checklist.completedAt = Date.now();
                this._saveProgress();
                this._showCompletionCelebration();
            }
            
            const markAllBtn = document.getElementById('btn-mark-all');
            if (markAllBtn) markAllBtn.disabled = checklist.completedSteps === checklist.totalSteps;
        }
        
        _showCompletionCelebration() {
            this._showNotification('🎉 Checklist completed!', 'success');
            setTimeout(() => {
                this._render();
                this._attachEventListeners();
            }, 500);
            if (this.callbacks.onComplete) this.callbacks.onComplete(this.currentChecklist);
        }
        
        _resetAll() {
            if (!this.currentChecklist) return;
            this.currentChecklist.steps.forEach(step => {
                step.completed = false;
                step.completedAt = null;
                step.userNote = '';
            });
            this.currentChecklist.status = CHECKLIST_STATUS.IN_PROGRESS;
            this.currentChecklist.completedAt = null;
            this.currentChecklist.completedSteps = 0;
            this._saveProgress();
            this._render();
            this._attachEventListeners();
            this._showNotification('Checklist reset', 'info');
        }
        
        _markAllComplete() {
            if (!this.currentChecklist) return;
            const now = Date.now();
            this.currentChecklist.steps.forEach(step => {
                if (!step.completed) {
                    step.completed = true;
                    step.completedAt = now;
                }
            });
            this._saveProgress();
            this._updateProgress();
            this._render();
            this._attachEventListeners();
        }
        
        _saveAndExit() {
            if (this.currentChecklist) this._saveProgress();
            this._showNotification('Progress saved', 'success');
            setTimeout(() => this._navigateBack(), 300);
        }
        
        _handleBack() {
            // Back button now behaves same as Done - save and show confirmation
            this._saveAndExit();
        }
        
        /**
         * Navigate back to dashboard (internal)
         */
        _navigateBack() {
            if (this.callbacks.onBack) {
                this.callbacks.onBack();
            } else {
                console.warn('Checklist: onBack callback not registered - navigation may not work');
            }
        }
        
        _showNotification(message, type) {
            const toast = document.getElementById('notification-toast');
            if (!toast) {
                console.warn('Checklist: Notification toast element not found');
                return;
            }
            const msgEl = toast.querySelector('.notification-message');
            if (!msgEl) {
                console.warn('Checklist: Notification message element not found');
                return;
            }
            toast.className = 'notification-toast ' + (type || 'info');
            msgEl.textContent = message;
            toast.style.display = 'block';
            setTimeout(() => toast.style.display = 'none', 3000);
        }
        
        on(event, callback) {
            const valid = ['onComplete', 'onBack', 'onStepChange'];
            if (valid.includes(event)) this.callbacks[event] = callback;
        }
        
        destroy() {
            if (this.saveTimer) clearTimeout(this.saveTimer);
            this.container.innerHTML = '';
            document.getElementById('checklist-styles')?.remove();
        }
        
        _escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        _injectStyles() {
            if (document.getElementById('checklist-styles')) return;
            
            const styles = document.createElement('style');
            styles.id = 'checklist-styles';
            styles.textContent = '.checklist-container{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1f2937;background:#f9fafb;min-height:100vh;display:flex;flex-direction:column}.checklist-layout{max-width:800px;margin:0 auto;padding:1.5rem;width:100%;display:flex;flex-direction:column;min-height:100vh}.checklist-header{display:flex;justify-content:space-between;align-items:flex-start;gap:1.5rem;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid #e5e7eb}.header-left{display:flex;align-items:flex-start;gap:1rem}.btn-back{padding:.5rem .75rem;background:none;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;font-size:.875rem;white-space:nowrap}.btn-back:hover{background:#f3f4f6}.header-info h2{margin:0 0 .5rem;font-size:1.25rem;line-height:1.3}.header-meta{display:flex;gap:.5rem;flex-wrap:wrap}.folder-badge,.status-badge{padding:.25rem .5rem;border-radius:4px;font-size:.75rem;font-weight:500}.status-in_progress{background:#fef3c7;color:#92400e}.status-completed{background:#d1fae5;color:#065f46}.status-badge.readonly{background:#e0e7ff;color:#4338ca}.progress-info{display:flex;align-items:center;gap:.75rem}.progress-text{font-size:.8rem;color:#6b7280;white-space:nowrap}.progress-bar{width:120px;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden}.progress-fill{height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:4px;transition:width .3s ease}.progress-percent{font-size:.875rem;font-weight:600;color:#6366f1;min-width:40px}.completion-banner{display:flex;align-items:center;gap:1rem;padding:1rem 1.25rem;background:linear-gradient(135deg,#d1fae5,#a7f3d0);border:1px solid #6ee7b7;border-radius:10px;margin-bottom:1.5rem}.completion-icon{font-size:2rem}.completion-text{flex:1}.completion-text strong{display:block;font-size:1rem;color:#065f46}.completion-text p{margin:.25rem 0 0;font-size:.8rem;color:#047857}.checklist-main{flex:1}.steps-checklist{display:flex;flex-direction:column;gap:.75rem}.checklist-step{display:flex;align-items:flex-start;gap:.75rem;padding:1rem;background:#fff;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:all .15s}.checklist-step:hover{border-color:#d1d5db;box-shadow:0 2px 8px rgba(0,0,0,.04)}.checklist-step.readonly{cursor:default}.checklist-step.readonly:hover{border-color:#e5e7eb;box-shadow:none}.checklist-step.completed{background:#f0fdf4;border-color:#bbf7d0}.checklist-step.completed .step-text{text-decoration:line-through;color:#6b7280}.step-checkbox{position:relative;flex-shrink:0}.step-checkbox.readonly{cursor:default}.checkbox-static{display:flex;align-items:center;justify-content:center;width:24px;height:24px;border:2px solid #d1d5db;border-radius:6px;background:#fff;font-size:14px;color:#fff}.checkbox-static.checked{background:#22c55e;border-color:#22c55e}.step-check{position:absolute;opacity:0;width:0;height:0}.checkbox-label{display:block;cursor:pointer}.checkbox-custom{display:block;width:24px;height:24px;border:2px solid #d1d5db;border-radius:6px;background:#fff;transition:all .15s;position:relative}.checkbox-custom::after{content:"✓";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);font-size:14px;color:#fff;transition:transform .15s}.step-check:checked+.checkbox-label .checkbox-custom{background:#22c55e;border-color:#22c55e}.step-check:checked+.checkbox-label .checkbox-custom::after{transform:translate(-50%,-50%) scale(1)}.step-check:focus+.checkbox-label .checkbox-custom{box-shadow:0 0 0 3px rgba(34,197,94,.2)}.step-content{flex:1;display:flex;gap:.75rem;min-width:0}.step-number{min-width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:#e5e7eb;color:#6b7280;border-radius:50%;font-size:.75rem;font-weight:600;flex-shrink:0}.checklist-step.completed .step-number{background:#22c55e;color:#fff}.step-text-container{flex:1;min-width:0}.step-text{margin:0;font-size:.95rem;line-height:1.4;transition:all .15s}.step-note{margin:.375rem 0 0;font-size:.8rem;color:#6b7280}.step-user-note{margin-top:.5rem}.step-user-note-readonly{margin:.375rem 0 0;font-size:.8rem;color:#4b5563;font-style:italic}.user-note-input{width:100%;padding:.375rem .5rem;border:1px solid #e5e7eb;border-radius:4px;font-size:.8rem;background:#f9fafb;box-sizing:border-box}.user-note-input:focus{outline:none;border-color:#6366f1;background:#fff}.step-status{flex-shrink:0}.completed-time{font-size:.7rem;color:#22c55e;white-space:nowrap}.checklist-footer{display:flex;justify-content:space-between;align-items:center;margin-top:1.5rem;padding-top:1rem;border-top:1px solid #e5e7eb}.footer-left,.footer-right{display:flex;gap:.5rem}.btn{padding:.625rem 1.25rem;border:none;border-radius:8px;font-size:.85rem;font-weight:500;cursor:pointer;transition:all .15s}.btn:disabled{opacity:.5;cursor:not-allowed}.btn-primary{background:#6366f1;color:#fff}.btn-primary:hover:not(:disabled){background:#4f46e5}.btn-secondary{background:#e5e7eb;color:#374151}.btn-secondary:hover:not(:disabled){background:#d1d5db}.empty-state{text-align:center;padding:3rem;color:#6b7280}.notification-toast{position:fixed;bottom:1.5rem;right:1.5rem;padding:.875rem 1.25rem;background:#1f2937;color:#fff;border-radius:8px;font-size:.85rem;z-index:1001;animation:slideIn .3s ease}.notification-toast.success{background:#059669}.notification-toast.error{background:#dc2626}.notification-toast.info{background:#2563eb}@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@media(max-width:640px){.checklist-layout{padding:1rem}.checklist-header{flex-direction:column;gap:1rem}.progress-info{width:100%;justify-content:space-between}.progress-bar{flex:1}.checklist-footer{flex-direction:column;gap:.75rem}.footer-left,.footer-right{width:100%;justify-content:center}}';
            document.head.appendChild(styles);
        }
    }

    function createChecklist(container, options) {
        return new Checklist(container, options || {});
    }

    global.Checklist = Checklist;
    global.createChecklist = createChecklist;
    global.CHECKLIST_STATUS = CHECKLIST_STATUS;
    global.CHECKLIST_STORAGE_KEYS = CHECKLIST_STORAGE_KEYS;

    console.log('✅ Checklist module loaded');

})(typeof window !== 'undefined' ? window : this);
