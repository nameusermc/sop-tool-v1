/**
 * Folder Management Module - SOP Tool v1
 * 
 * This module handles folder/category organization:
 * - List folders with their contained SOPs
 * - Create, edit, and delete folders
 * - Move SOPs between folders (drag-and-drop + dropdown)
 * - Folder color and icon customization
 * - Local storage persistence
 * 
 * FOLDER/SOP RELATIONSHIP:
 * - Folders are independent entities stored in FOLDERS storage
 * - SOPs reference folders via folderId property
 * - One SOP belongs to exactly one folder (or 'uncategorized')
 * - Deleting a folder moves its SOPs to 'uncategorized'
 * - Folder IDs are stable; names/colors can change
 * 
 * @module Folders
 */

// ============================================================================
// STORAGE KEYS (Shared with other modules)
// ============================================================================

/**
 * Local Storage Keys
 * 
 * Data Relationship:
 * - FOLDERS: Array of folder objects (id, name, color, icon, order)
 * - SOPS: Array of SOP objects, each with a folderId property
 * - When folder is deleted, SOPs with that folderId become 'uncategorized'
 */
const FOLDER_STORAGE_KEYS = {
    FOLDERS: 'sop_tool_folders',    // Folder definitions
    SOPS: 'sop_tool_sops'           // SOPs (for reading/updating folderId)
};

/**
 * Available folder colors for selection
 */
const FOLDER_COLORS = [
    { id: 'indigo', value: '#6366f1', name: 'Indigo' },
    { id: 'green', value: '#22c55e', name: 'Green' },
    { id: 'amber', value: '#f59e0b', name: 'Amber' },
    { id: 'red', value: '#ef4444', name: 'Red' },
    { id: 'purple', value: '#8b5cf6', name: 'Purple' },
    { id: 'pink', value: '#ec4899', name: 'Pink' },
    { id: 'cyan', value: '#06b6d4', name: 'Cyan' },
    { id: 'slate', value: '#64748b', name: 'Slate' }
];

/**
 * Available folder icons for selection
 */
const FOLDER_ICONS = [
    '📁', '📂', '🗂️', '📋', '📄', '📝', '📑',
    '⚙️', '🔧', '🛠️', '🔨', '⚡', '🎯', '🎨',
    '👋', '👥', '👤', '🏢', '🏠', '🏭', '🏗️',
    '🛡️', '🔒', '🔑', '⚠️', '✅', '❌', '⭐',
    '💼', '💰', '📊', '📈', '📉', '🧮', '💻',
    '📧', '📞', '📱', '🌐', '🔗', '📦', '🚀'
];

/**
 * Default folders if none exist
 */
const DEFAULT_FOLDERS = [
    { id: 'general', name: 'General', color: '#6366f1', icon: '📁', order: 0 },
    { id: 'onboarding', name: 'Onboarding', color: '#22c55e', icon: '👋', order: 1 },
    { id: 'operations', name: 'Operations', color: '#f59e0b', icon: '⚙️', order: 2 },
    { id: 'safety', name: 'Safety', color: '#ef4444', icon: '🛡️', order: 3 },
    { id: 'hr', name: 'HR & Compliance', color: '#8b5cf6', icon: '📋', order: 4 }
];

// ============================================================================
// FOLDER MANAGEMENT MODULE CLASS
// ============================================================================

/**
 * FolderManager Class
 * Handles all folder organization and SOP categorization
 */
class FolderManager {
    /**
     * Initialize the Folder Manager module
     * @param {HTMLElement} containerElement - DOM element to render into
     * @param {Object} options - Configuration options
     */
    constructor(containerElement, options = {}) {
        // Container reference
        this.container = containerElement;
        
        // Configuration with defaults
        this.options = {
            enableDragDrop: true,         // Enable drag-and-drop for SOPs
            showSOPCount: true,           // Show SOP count per folder
            showEmptyFolders: true,       // Show folders with no SOPs
            allowDeleteWithSOPs: true,    // Allow deleting folders containing SOPs
            confirmDelete: true,          // Confirm before deletion
            maxFolders: 20,               // Maximum number of folders
            ...options
        };
        
        // Internal state
        this.state = {
            folders: [],                  // All folders
            sops: [],                     // All SOPs (for reference)
            expandedFolders: new Set(),   // IDs of expanded folders
            editingFolderId: null,        // Currently editing folder
            draggedSOPId: null,           // SOP being dragged
            dragOverFolderId: null        // Folder being dragged over
        };
        
        // Callbacks for integration
        this.callbacks = {
            onFolderCreate: null,         // Called when folder created
            onFolderUpdate: null,         // Called when folder updated
            onFolderDelete: null,         // Called when folder deleted
            onSOPMove: null,              // Called when SOP moved to folder
            onSOPClick: null,             // Called when SOP is clicked
            onChange: null                // Called on any change
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
        this._loadData();
        this._injectStyles();
        this._render();
        this._attachEventListeners();
    }
    
    /**
     * Load folders and SOPs from storage
     * @private
     */
    _loadData() {
        // Load folders
        const storedFolders = localStorage.getItem(FOLDER_STORAGE_KEYS.FOLDERS);
        if (storedFolders) {
            this.state.folders = JSON.parse(storedFolders);
        } else {
            // Initialize with defaults
            this.state.folders = [...DEFAULT_FOLDERS];
            this._saveFolders();
        }
        
        // Sort folders by order
        this.state.folders.sort((a, b) => (a.order || 0) - (b.order || 0));
        
        // Load SOPs for reference
        const storedSOPs = localStorage.getItem(FOLDER_STORAGE_KEYS.SOPS);
        this.state.sops = storedSOPs ? JSON.parse(storedSOPs) : [];
    }
    
    /**
     * Save folders to storage
     * @private
     */
    _saveFolders() {
        localStorage.setItem(FOLDER_STORAGE_KEYS.FOLDERS, JSON.stringify(this.state.folders));
    }
    
    /**
     * Save SOPs to storage (after moving between folders)
     * @private
     */
    _saveSOPs() {
        localStorage.setItem(FOLDER_STORAGE_KEYS.SOPS, JSON.stringify(this.state.sops));
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
        this.container.className = 'folder-manager-container';
        
        this.container.innerHTML = `
            <div class="folder-manager-layout">
                <!-- Header -->
                <header class="folder-manager-header">
                    <div class="header-left">
                        <h2>📂 Folder Management</h2>
                        <span class="folder-count">
                            ${this.state.folders.length} folders • ${this.state.sops.length} SOPs
                        </span>
                    </div>
                    <div class="header-right">
                        <button class="btn btn-primary" id="btn-create-folder"
                                ${this.state.folders.length >= this.options.maxFolders ? 'disabled' : ''}>
                            ➕ New Folder
                        </button>
                    </div>
                </header>
                
                <!-- Info Banner -->
                <div class="info-banner">
                    <span class="info-icon">💡</span>
                    <span>Drag and drop SOPs between folders to reorganize, or use the move button on each SOP.</span>
                </div>
                
                <!-- Folders Grid -->
                <main class="folders-grid" id="folders-grid">
                    ${this._renderFoldersList()}
                    
                    <!-- Uncategorized Section -->
                    ${this._renderUncategorizedSection()}
                </main>
                
                <!-- Create/Edit Folder Modal -->
                <div class="modal" id="folder-modal" style="display: none;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 id="modal-title">Create New Folder</h3>
                            <button class="btn-close" id="btn-close-modal">✕</button>
                        </div>
                        <div class="modal-body">
                            ${this._renderFolderForm()}
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" id="btn-cancel-folder">Cancel</button>
                            <button class="btn btn-primary" id="btn-save-folder">Save Folder</button>
                        </div>
                    </div>
                </div>
                
                <!-- Move SOP Modal -->
                <div class="modal" id="move-modal" style="display: none;">
                    <div class="modal-content modal-small">
                        <div class="modal-header">
                            <h3>Move SOP to Folder</h3>
                            <button class="btn-close" id="btn-close-move-modal">✕</button>
                        </div>
                        <div class="modal-body">
                            <p id="move-sop-name" class="move-sop-name"></p>
                            <label for="move-folder-select">Select destination folder:</label>
                            <select id="move-folder-select" class="form-select">
                                ${this._renderFolderOptions()}
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" id="btn-cancel-move">Cancel</button>
                            <button class="btn btn-primary" id="btn-confirm-move">Move SOP</button>
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
     * Render the folders list
     * @private
     * @returns {string} HTML string
     */
    _renderFoldersList() {
        if (this.state.folders.length === 0) {
            return `
                <div class="empty-state">
                    <p>📁 No folders yet</p>
                    <p class="help-text">Create folders to organize your SOPs</p>
                </div>
            `;
        }
        
        return this.state.folders.map(folder => {
            const sopsInFolder = this._getSOPsInFolder(folder.id);
            const isExpanded = this.state.expandedFolders.has(folder.id);
            const isDragOver = this.state.dragOverFolderId === folder.id;
            
            // Skip empty folders if option disabled
            if (!this.options.showEmptyFolders && sopsInFolder.length === 0) {
                return '';
            }
            
            return `
                <div class="folder-card ${isDragOver ? 'drag-over' : ''}" 
                     data-folder-id="${folder.id}"
                     data-drop-target="true">
                    
                    <!-- Folder Header -->
                    <div class="folder-card-header" style="--folder-color: ${folder.color}">
                        <div class="folder-info" data-toggle-folder="${folder.id}">
                            <span class="folder-icon">${folder.icon || '📁'}</span>
                            <div class="folder-details">
                                <h3 class="folder-name">${this._escapeHtml(folder.name)}</h3>
                                ${this.options.showSOPCount ? `
                                    <span class="sop-count">${sopsInFolder.length} SOP${sopsInFolder.length !== 1 ? 's' : ''}</span>
                                ` : ''}
                            </div>
                            <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
                        </div>
                        
                        <div class="folder-actions">
                            <button class="action-btn" data-action="edit" data-folder-id="${folder.id}" title="Edit Folder">
                                ✏️
                            </button>
                            <button class="action-btn delete-btn" data-action="delete" data-folder-id="${folder.id}" title="Delete Folder">
                                🗑️
                            </button>
                        </div>
                    </div>
                    
                    <!-- Folder Content (SOPs) -->
                    <div class="folder-content ${isExpanded ? 'expanded' : 'collapsed'}" 
                         id="folder-content-${folder.id}">
                        ${this._renderFolderSOPs(sopsInFolder, folder.id)}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Render SOPs within a folder
     * @private
     * @param {Array} sops - SOPs in the folder
     * @param {string} folderId - Folder ID
     * @returns {string} HTML string
     */
    _renderFolderSOPs(sops, folderId) {
        if (sops.length === 0) {
            return `
                <div class="folder-empty">
                    <p>No SOPs in this folder</p>
                    <p class="help-text">Drag SOPs here to organize</p>
                </div>
            `;
        }
        
        return `
            <div class="sops-list">
                ${sops.map(sop => this._renderSOPItem(sop, folderId)).join('')}
            </div>
        `;
    }
    
    /**
     * Render a single SOP item
     * @private
     * @param {Object} sop - SOP object
     * @param {string} folderId - Current folder ID
     * @returns {string} HTML string
     */
    _renderSOPItem(sop, folderId) {
        const isDragging = this.state.draggedSOPId === sop.id;
        
        return `
            <div class="sop-item ${isDragging ? 'dragging' : ''}" 
                 data-sop-id="${sop.id}"
                 data-folder-id="${folderId}"
                 draggable="${this.options.enableDragDrop}">
                
                <div class="sop-drag-handle" title="Drag to move">⋮⋮</div>
                
                <div class="sop-info" data-sop-click="${sop.id}">
                    <span class="sop-title">${this._escapeHtml(sop.title)}</span>
                    <span class="sop-status status-${sop.status || 'draft'}">${sop.status || 'draft'}</span>
                </div>
                
                <div class="sop-actions">
                    <button class="action-btn-small" 
                            data-action="move-sop" 
                            data-sop-id="${sop.id}"
                            title="Move to folder">
                        📁
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Render uncategorized SOPs section
     * @private
     * @returns {string} HTML string
     */
    _renderUncategorizedSection() {
        const uncategorizedSOPs = this._getUncategorizedSOPs();
        
        if (uncategorizedSOPs.length === 0) {
            return '';
        }
        
        const isExpanded = this.state.expandedFolders.has('uncategorized');
        const isDragOver = this.state.dragOverFolderId === 'uncategorized';
        
        return `
            <div class="folder-card uncategorized ${isDragOver ? 'drag-over' : ''}" 
                 data-folder-id="uncategorized"
                 data-drop-target="true">
                
                <div class="folder-card-header" style="--folder-color: #9ca3af">
                    <div class="folder-info" data-toggle-folder="uncategorized">
                        <span class="folder-icon">📭</span>
                        <div class="folder-details">
                            <h3 class="folder-name">Uncategorized</h3>
                            <span class="sop-count">${uncategorizedSOPs.length} SOP${uncategorizedSOPs.length !== 1 ? 's' : ''}</span>
                        </div>
                        <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
                    </div>
                </div>
                
                <div class="folder-content ${isExpanded ? 'expanded' : 'collapsed'}" 
                     id="folder-content-uncategorized">
                    ${this._renderFolderSOPs(uncategorizedSOPs, 'uncategorized')}
                </div>
            </div>
        `;
    }
    
    /**
     * Render folder form for create/edit modal
     * @private
     * @returns {string} HTML string
     */
    _renderFolderForm() {
        const editingFolder = this.state.editingFolderId 
            ? this.state.folders.find(f => f.id === this.state.editingFolderId)
            : null;
        
        return `
            <form id="folder-form">
                <div class="form-group">
                    <label for="folder-name">Folder Name <span class="required">*</span></label>
                    <input 
                        type="text" 
                        id="folder-name" 
                        class="form-input"
                        placeholder="e.g., Marketing, IT Support, Training"
                        value="${editingFolder ? this._escapeHtml(editingFolder.name) : ''}"
                        maxlength="50"
                        required
                    />
                </div>
                
                <div class="form-group">
                    <label>Folder Color</label>
                    <div class="color-picker" id="color-picker">
                        ${FOLDER_COLORS.map(color => `
                            <button type="button" 
                                    class="color-option ${editingFolder?.color === color.value ? 'selected' : ''}"
                                    data-color="${color.value}"
                                    style="background: ${color.value}"
                                    title="${color.name}">
                                ${editingFolder?.color === color.value ? '✓' : ''}
                            </button>
                        `).join('')}
                    </div>
                    <input type="hidden" id="folder-color" value="${editingFolder?.color || FOLDER_COLORS[0].value}" />
                </div>
                
                <div class="form-group">
                    <label>Folder Icon</label>
                    <div class="icon-picker" id="icon-picker">
                        ${FOLDER_ICONS.map(icon => `
                            <button type="button" 
                                    class="icon-option ${editingFolder?.icon === icon ? 'selected' : ''}"
                                    data-icon="${icon}">
                                ${icon}
                            </button>
                        `).join('')}
                    </div>
                    <input type="hidden" id="folder-icon" value="${editingFolder?.icon || '📁'}" />
                </div>
            </form>
        `;
    }
    
    /**
     * Render folder options for move dropdown
     * @private
     * @returns {string} HTML options
     */
    _renderFolderOptions() {
        return this.state.folders.map(folder => `
            <option value="${folder.id}">
                ${folder.icon || '📁'} ${folder.name}
            </option>
        `).join('') + `
            <option value="uncategorized">📭 Uncategorized</option>
        `;
    }
    
    /**
     * Inject CSS styles
     * @private
     */
    _injectStyles() {
        if (document.getElementById('folder-manager-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'folder-manager-styles';
        styles.textContent = `
            /* ============================================
               Folder Manager Module - Minimal CSS
               ============================================ */
            
            .folder-manager-container {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #1f2937;
                background: #f9fafb;
                min-height: 100vh;
            }
            
            .folder-manager-layout {
                max-width: 1000px;
                margin: 0 auto;
                padding: 2rem;
            }
            
            /* Header */
            .folder-manager-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.5rem;
            }
            
            .header-left h2 {
                margin: 0 0 0.25rem;
                font-size: 1.5rem;
            }
            
            .folder-count {
                font-size: 0.875rem;
                color: #6b7280;
            }
            
            /* Info Banner */
            .info-banner {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.875rem 1.25rem;
                background: #eff6ff;
                border: 1px solid #bfdbfe;
                border-radius: 8px;
                margin-bottom: 1.5rem;
                font-size: 0.9rem;
                color: #1e40af;
            }
            
            .info-icon {
                font-size: 1.1rem;
            }
            
            /* Folders Grid */
            .folders-grid {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            
            /* Folder Card */
            .folder-card {
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                overflow: hidden;
                transition: all 0.2s;
            }
            
            .folder-card.drag-over {
                border-color: #6366f1;
                border-style: dashed;
                background: #f5f3ff;
            }
            
            .folder-card.uncategorized {
                background: #fafafa;
                border-style: dashed;
            }
            
            .folder-card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem 1.25rem;
                background: linear-gradient(90deg, var(--folder-color, #6366f1)10, transparent);
                border-bottom: 1px solid #e5e7eb;
            }
            
            .folder-info {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                flex: 1;
                cursor: pointer;
            }
            
            .folder-icon {
                font-size: 1.5rem;
            }
            
            .folder-details {
                flex: 1;
            }
            
            .folder-name {
                margin: 0;
                font-size: 1rem;
                font-weight: 600;
            }
            
            .sop-count {
                font-size: 0.8rem;
                color: #6b7280;
            }
            
            .expand-icon {
                color: #9ca3af;
                font-size: 0.75rem;
                transition: transform 0.2s;
            }
            
            .folder-actions {
                display: flex;
                gap: 0.5rem;
            }
            
            /* Folder Content */
            .folder-content {
                overflow: hidden;
                transition: max-height 0.3s ease;
            }
            
            .folder-content.collapsed {
                max-height: 0;
            }
            
            .folder-content.expanded {
                max-height: 2000px;
            }
            
            .folder-empty {
                padding: 1.5rem;
                text-align: center;
                color: #9ca3af;
            }
            
            .folder-empty p {
                margin: 0.25rem 0;
            }
            
            .help-text {
                font-size: 0.8rem;
            }
            
            /* SOPs List */
            .sops-list {
                padding: 0.75rem;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .sop-item {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 1rem;
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                transition: all 0.15s;
            }
            
            .sop-item:hover {
                background: #f3f4f6;
                border-color: #d1d5db;
            }
            
            .sop-item.dragging {
                opacity: 0.5;
                background: #dbeafe;
            }
            
            .sop-drag-handle {
                cursor: grab;
                color: #9ca3af;
                font-weight: bold;
                user-select: none;
                padding: 0.25rem;
            }
            
            .sop-drag-handle:active {
                cursor: grabbing;
            }
            
            .sop-info {
                flex: 1;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                cursor: pointer;
            }
            
            .sop-title {
                font-size: 0.9rem;
                font-weight: 500;
            }
            
            .sop-status {
                padding: 0.125rem 0.5rem;
                border-radius: 999px;
                font-size: 0.65rem;
                font-weight: 500;
                text-transform: uppercase;
            }
            
            .status-active { background: #d1fae5; color: #065f46; }
            .status-draft { background: #fef3c7; color: #92400e; }
            .status-archived { background: #e5e7eb; color: #6b7280; }
            
            .sop-actions {
                display: flex;
                gap: 0.25rem;
            }
            
            /* Action Buttons */
            .action-btn {
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
            }
            
            .action-btn:hover {
                background: #f3f4f6;
            }
            
            .action-btn.delete-btn:hover {
                background: #fef2f2;
                border-color: #fecaca;
            }
            
            .action-btn-small {
                width: 28px;
                height: 28px;
                border: 1px solid #e5e7eb;
                border-radius: 4px;
                background: white;
                cursor: pointer;
                font-size: 0.8rem;
                transition: all 0.15s;
            }
            
            .action-btn-small:hover {
                background: #f3f4f6;
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
            
            .btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .btn-primary {
                background: #6366f1;
                color: white;
            }
            
            .btn-primary:hover:not(:disabled) {
                background: #4f46e5;
            }
            
            .btn-secondary {
                background: #e5e7eb;
                color: #374151;
            }
            
            .btn-secondary:hover {
                background: #d1d5db;
            }
            
            /* Modal */
            .modal {
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
            
            .modal-content {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            
            .modal-content.modal-small {
                max-width: 400px;
            }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem 1.5rem;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .modal-header h3 {
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
            
            .modal-body {
                padding: 1.5rem;
                overflow-y: auto;
            }
            
            .modal-footer {
                display: flex;
                justify-content: flex-end;
                gap: 0.75rem;
                padding: 1rem 1.5rem;
                border-top: 1px solid #e5e7eb;
            }
            
            /* Form Elements */
            .form-group {
                margin-bottom: 1.25rem;
            }
            
            .form-group:last-child {
                margin-bottom: 0;
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
            .form-select {
                width: 100%;
                padding: 0.75rem 1rem;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                font-size: 0.95rem;
                box-sizing: border-box;
            }
            
            .form-input:focus,
            .form-select:focus {
                outline: none;
                border-color: #6366f1;
                box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
            }
            
            /* Color Picker */
            .color-picker {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
            }
            
            .color-option {
                width: 36px;
                height: 36px;
                border: 2px solid transparent;
                border-radius: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                transition: all 0.15s;
            }
            
            .color-option:hover {
                transform: scale(1.1);
            }
            
            .color-option.selected {
                border-color: #1f2937;
                box-shadow: 0 0 0 2px white, 0 0 0 4px #1f2937;
            }
            
            /* Icon Picker */
            .icon-picker {
                display: flex;
                flex-wrap: wrap;
                gap: 0.375rem;
                max-height: 150px;
                overflow-y: auto;
                padding: 0.5rem;
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
            }
            
            .icon-option {
                width: 36px;
                height: 36px;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                background: white;
                cursor: pointer;
                font-size: 1.1rem;
                transition: all 0.15s;
            }
            
            .icon-option:hover {
                background: #f3f4f6;
                border-color: #d1d5db;
            }
            
            .icon-option.selected {
                background: #eff6ff;
                border-color: #6366f1;
            }
            
            /* Move Modal */
            .move-sop-name {
                font-weight: 600;
                margin-bottom: 1rem;
                padding: 0.75rem;
                background: #f3f4f6;
                border-radius: 6px;
            }
            
            /* Empty State */
            .empty-state {
                text-align: center;
                padding: 3rem;
                background: white;
                border: 2px dashed #e5e7eb;
                border-radius: 10px;
            }
            
            .empty-state p {
                margin: 0.25rem 0;
                color: #6b7280;
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
                .folder-manager-layout {
                    padding: 1rem;
                }
                
                .folder-manager-header {
                    flex-direction: column;
                    gap: 1rem;
                    align-items: flex-start;
                }
                
                .info-banner {
                    flex-direction: column;
                    text-align: center;
                }
                
                .icon-picker {
                    max-height: 120px;
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
        // Create folder button
        document.getElementById('btn-create-folder')?.addEventListener('click', () => {
            this._showFolderModal();
        });
        
        // Folder toggle (expand/collapse)
        document.querySelectorAll('[data-toggle-folder]').forEach(el => {
            el.addEventListener('click', (e) => {
                const folderId = e.currentTarget.dataset.toggleFolder;
                this._toggleFolder(folderId);
            });
        });
        
        // Folder actions (edit, delete)
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const folderId = btn.dataset.folderId;
                const sopId = btn.dataset.sopId;
                
                if (action === 'edit' && folderId) {
                    this._showFolderModal(folderId);
                } else if (action === 'delete' && folderId) {
                    this._deleteFolder(folderId);
                } else if (action === 'move-sop' && sopId) {
                    this._showMoveModal(sopId);
                }
            });
        });
        
        // SOP click
        document.querySelectorAll('[data-sop-click]').forEach(el => {
            el.addEventListener('click', (e) => {
                const sopId = e.currentTarget.dataset.sopClick;
                if (this.callbacks.onSOPClick) {
                    const sop = this.state.sops.find(s => s.id === sopId);
                    this.callbacks.onSOPClick(sop);
                }
            });
        });
        
        // Modal controls
        this._attachModalListeners();
        
        // Drag and drop
        if (this.options.enableDragDrop) {
            this._attachDragDropListeners();
        }
    }
    
    /**
     * Attach modal event listeners
     * @private
     */
    _attachModalListeners() {
        // Folder modal
        const folderModal = document.getElementById('folder-modal');
        const moveModal = document.getElementById('move-modal');
        
        // Close buttons
        document.getElementById('btn-close-modal')?.addEventListener('click', () => {
            this._hideFolderModal();
        });
        
        document.getElementById('btn-cancel-folder')?.addEventListener('click', () => {
            this._hideFolderModal();
        });
        
        document.getElementById('btn-close-move-modal')?.addEventListener('click', () => {
            this._hideMoveModal();
        });
        
        document.getElementById('btn-cancel-move')?.addEventListener('click', () => {
            this._hideMoveModal();
        });
        
        // Click outside to close
        folderModal?.addEventListener('click', (e) => {
            if (e.target === folderModal) this._hideFolderModal();
        });
        
        moveModal?.addEventListener('click', (e) => {
            if (e.target === moveModal) this._hideMoveModal();
        });
        
        // Save folder
        document.getElementById('btn-save-folder')?.addEventListener('click', () => {
            this._saveFolderFromModal();
        });
        
        // Confirm move
        document.getElementById('btn-confirm-move')?.addEventListener('click', () => {
            this._confirmMoveFromModal();
        });
        
        // Color picker
        document.querySelectorAll('.color-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.color-option').forEach(b => {
                    b.classList.remove('selected');
                    b.textContent = '';
                });
                btn.classList.add('selected');
                btn.textContent = '✓';
                document.getElementById('folder-color').value = btn.dataset.color;
            });
        });
        
        // Icon picker
        document.querySelectorAll('.icon-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                document.getElementById('folder-icon').value = btn.dataset.icon;
            });
        });
    }
    
    /**
     * Attach drag and drop listeners
     * @private
     */
    _attachDragDropListeners() {
        // SOP drag start
        document.querySelectorAll('.sop-item[draggable="true"]').forEach(el => {
            el.addEventListener('dragstart', (e) => {
                this.state.draggedSOPId = el.dataset.sopId;
                el.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            
            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
                this.state.draggedSOPId = null;
                this.state.dragOverFolderId = null;
                
                // Remove all drag-over states
                document.querySelectorAll('.folder-card.drag-over').forEach(card => {
                    card.classList.remove('drag-over');
                });
            });
        });
        
        // Folder drag over
        document.querySelectorAll('[data-drop-target="true"]').forEach(el => {
            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const folderId = el.dataset.folderId;
                
                // Don't allow drop on same folder
                const draggedSOP = this.state.sops.find(s => s.id === this.state.draggedSOPId);
                const currentFolderId = draggedSOP?.folderId || 'uncategorized';
                
                if (folderId !== currentFolderId) {
                    el.classList.add('drag-over');
                    this.state.dragOverFolderId = folderId;
                }
            });
            
            el.addEventListener('dragleave', (e) => {
                // Only remove if leaving the card (not entering a child)
                if (!el.contains(e.relatedTarget)) {
                    el.classList.remove('drag-over');
                }
            });
            
            el.addEventListener('drop', (e) => {
                e.preventDefault();
                el.classList.remove('drag-over');
                
                const targetFolderId = el.dataset.folderId;
                
                if (this.state.draggedSOPId && targetFolderId) {
                    this._moveSOPToFolder(this.state.draggedSOPId, targetFolderId);
                }
                
                this.state.draggedSOPId = null;
                this.state.dragOverFolderId = null;
            });
        });
    }
    
    // ========================================================================
    // FOLDER OPERATIONS
    // ========================================================================
    
    /**
     * Toggle folder expanded/collapsed state
     * @private
     * @param {string} folderId - Folder ID to toggle
     */
    _toggleFolder(folderId) {
        if (this.state.expandedFolders.has(folderId)) {
            this.state.expandedFolders.delete(folderId);
        } else {
            this.state.expandedFolders.add(folderId);
        }
        
        // Update UI
        const content = document.getElementById(`folder-content-${folderId}`);
        const folderCard = document.querySelector(`[data-folder-id="${folderId}"]`);
        const expandIcon = folderCard?.querySelector('.expand-icon');
        
        if (content) {
            content.classList.toggle('collapsed');
            content.classList.toggle('expanded');
        }
        
        if (expandIcon) {
            expandIcon.textContent = this.state.expandedFolders.has(folderId) ? '▼' : '▶';
        }
    }
    
    /**
     * Show folder modal for create/edit
     * @private
     * @param {string|null} folderId - Folder ID to edit (null for create)
     */
    _showFolderModal(folderId = null) {
        this.state.editingFolderId = folderId;
        
        const modal = document.getElementById('folder-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.querySelector('#folder-modal .modal-body');
        
        if (modalTitle) {
            modalTitle.textContent = folderId ? 'Edit Folder' : 'Create New Folder';
        }
        
        if (modalBody) {
            modalBody.innerHTML = this._renderFolderForm();
            this._attachModalListeners();
        }
        
        if (modal) {
            modal.style.display = 'flex';
        }
        
        // Focus name input
        setTimeout(() => {
            document.getElementById('folder-name')?.focus();
        }, 100);
    }
    
    /**
     * Hide folder modal
     * @private
     */
    _hideFolderModal() {
        const modal = document.getElementById('folder-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.state.editingFolderId = null;
    }
    
    /**
     * Save folder from modal form
     * @private
     */
    _saveFolderFromModal() {
        const nameInput = document.getElementById('folder-name');
        const colorInput = document.getElementById('folder-color');
        const iconInput = document.getElementById('folder-icon');
        
        const name = nameInput?.value?.trim();
        const color = colorInput?.value || FOLDER_COLORS[0].value;
        const icon = iconInput?.value || '📁';
        
        if (!name) {
            this._showNotification('Folder name is required', 'error');
            nameInput?.focus();
            return;
        }
        
        // Check for duplicate names
        const existingFolder = this.state.folders.find(
            f => f.name.toLowerCase() === name.toLowerCase() && f.id !== this.state.editingFolderId
        );
        
        if (existingFolder) {
            this._showNotification('A folder with this name already exists', 'error');
            return;
        }
        
        if (this.state.editingFolderId) {
            // Update existing folder
            this._updateFolder(this.state.editingFolderId, { name, color, icon });
        } else {
            // Create new folder
            this._createFolder({ name, color, icon });
        }
        
        this._hideFolderModal();
    }
    
    /**
     * Create a new folder
     * @private
     * @param {Object} folderData - Folder data
     */
    _createFolder(folderData) {
        const newFolder = {
            id: `folder_${Date.now()}`,
            name: folderData.name,
            color: folderData.color,
            icon: folderData.icon,
            order: this.state.folders.length,
            createdAt: Date.now()
        };
        
        this.state.folders.push(newFolder);
        this._saveFolders();
        
        // Re-render
        this._render();
        this._attachEventListeners();
        
        this._showNotification(`Folder "${newFolder.name}" created`, 'success');
        
        // Trigger callbacks
        if (this.callbacks.onFolderCreate) {
            this.callbacks.onFolderCreate(newFolder);
        }
        if (this.callbacks.onChange) {
            this.callbacks.onChange('create', newFolder);
        }
    }
    
    /**
     * Update an existing folder
     * @private
     * @param {string} folderId - Folder ID
     * @param {Object} updates - Updates to apply
     */
    _updateFolder(folderId, updates) {
        const index = this.state.folders.findIndex(f => f.id === folderId);
        if (index === -1) return;
        
        this.state.folders[index] = {
            ...this.state.folders[index],
            ...updates,
            updatedAt: Date.now()
        };
        
        this._saveFolders();
        
        // Re-render
        this._render();
        this._attachEventListeners();
        
        this._showNotification('Folder updated', 'success');
        
        // Trigger callbacks
        if (this.callbacks.onFolderUpdate) {
            this.callbacks.onFolderUpdate(this.state.folders[index]);
        }
        if (this.callbacks.onChange) {
            this.callbacks.onChange('update', this.state.folders[index]);
        }
    }
    
    /**
     * Delete a folder
     * @private
     * @param {string} folderId - Folder ID to delete
     */
    _deleteFolder(folderId) {
        const folder = this.state.folders.find(f => f.id === folderId);
        if (!folder) return;
        
        const sopsInFolder = this._getSOPsInFolder(folderId);
        
        // Check if folder has SOPs
        if (sopsInFolder.length > 0 && !this.options.allowDeleteWithSOPs) {
            this._showNotification('Cannot delete folder with SOPs. Move them first.', 'error');
            return;
        }
        
        // Confirm deletion
        if (this.options.confirmDelete) {
            let message = `Delete folder "${folder.name}"?`;
            if (sopsInFolder.length > 0) {
                message += `\n\n${sopsInFolder.length} SOP(s) will be moved to Uncategorized.`;
            }
            
            if (!confirm(message)) {
                return;
            }
        }
        
        // Move SOPs to uncategorized
        if (sopsInFolder.length > 0) {
            sopsInFolder.forEach(sop => {
                sop.folderId = null;
            });
            this._saveSOPs();
        }
        
        // Remove folder
        this.state.folders = this.state.folders.filter(f => f.id !== folderId);
        this._saveFolders();
        
        // Re-render
        this._render();
        this._attachEventListeners();
        
        this._showNotification(`Folder "${folder.name}" deleted`, 'success');
        
        // Trigger callbacks
        if (this.callbacks.onFolderDelete) {
            this.callbacks.onFolderDelete(folder);
        }
        if (this.callbacks.onChange) {
            this.callbacks.onChange('delete', folder);
        }
    }
    
    // ========================================================================
    // SOP MOVE OPERATIONS
    // ========================================================================
    
    /**
     * Show move SOP modal
     * @private
     * @param {string} sopId - SOP ID to move
     */
    _showMoveModal(sopId) {
        const sop = this.state.sops.find(s => s.id === sopId);
        if (!sop) return;
        
        this._movingSOPId = sopId;
        
        const modal = document.getElementById('move-modal');
        const sopName = document.getElementById('move-sop-name');
        const folderSelect = document.getElementById('move-folder-select');
        
        if (sopName) {
            sopName.textContent = sop.title;
        }
        
        if (folderSelect) {
            folderSelect.innerHTML = this._renderFolderOptions();
            folderSelect.value = sop.folderId || 'uncategorized';
        }
        
        if (modal) {
            modal.style.display = 'flex';
        }
    }
    
    /**
     * Hide move modal
     * @private
     */
    _hideMoveModal() {
        const modal = document.getElementById('move-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this._movingSOPId = null;
    }
    
    /**
     * Confirm move from modal
     * @private
     */
    _confirmMoveFromModal() {
        const folderSelect = document.getElementById('move-folder-select');
        const targetFolderId = folderSelect?.value;
        
        if (this._movingSOPId && targetFolderId) {
            this._moveSOPToFolder(this._movingSOPId, targetFolderId);
        }
        
        this._hideMoveModal();
    }
    
    /**
     * Move SOP to a different folder
     * @private
     * @param {string} sopId - SOP ID
     * @param {string} targetFolderId - Target folder ID
     */
    _moveSOPToFolder(sopId, targetFolderId) {
        const sop = this.state.sops.find(s => s.id === sopId);
        if (!sop) return;
        
        const oldFolderId = sop.folderId || 'uncategorized';
        
        // Don't move if same folder
        if (oldFolderId === targetFolderId) {
            return;
        }
        
        // Update SOP's folderId
        sop.folderId = targetFolderId === 'uncategorized' ? null : targetFolderId;
        sop.updatedAt = Date.now();
        
        this._saveSOPs();
        
        // Re-render
        this._render();
        this._attachEventListeners();
        
        // Get folder names for notification
        const targetFolder = this.state.folders.find(f => f.id === targetFolderId);
        const targetName = targetFolder?.name || 'Uncategorized';
        
        this._showNotification(`Moved "${sop.title}" to ${targetName}`, 'success');
        
        // Trigger callbacks
        if (this.callbacks.onSOPMove) {
            this.callbacks.onSOPMove(sop, oldFolderId, targetFolderId);
        }
        if (this.callbacks.onChange) {
            this.callbacks.onChange('move', { sop, oldFolderId, targetFolderId });
        }
    }
    
    // ========================================================================
    // HELPER METHODS
    // ========================================================================
    
    /**
     * Get SOPs in a specific folder
     * @private
     * @param {string} folderId - Folder ID
     * @returns {Array} SOPs in the folder
     */
    _getSOPsInFolder(folderId) {
        return this.state.sops.filter(sop => sop.folderId === folderId);
    }
    
    /**
     * Get uncategorized SOPs (no folderId or invalid folderId)
     * @private
     * @returns {Array} Uncategorized SOPs
     */
    _getUncategorizedSOPs() {
        const validFolderIds = new Set(this.state.folders.map(f => f.id));
        
        return this.state.sops.filter(sop => {
            // No folderId or folderId doesn't exist
            return !sop.folderId || !validFolderIds.has(sop.folderId);
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
    
    // ========================================================================
    // PUBLIC API
    // ========================================================================
    
    /**
     * Get all folders
     * @public
     * @returns {Array} Array of folders
     */
    getFolders() {
        return [...this.state.folders];
    }
    
    /**
     * Get a single folder by ID
     * @public
     * @param {string} folderId - Folder ID
     * @returns {Object|null} Folder object or null
     */
    getFolder(folderId) {
        return this.state.folders.find(f => f.id === folderId) || null;
    }
    
    /**
     * Get SOPs in a folder
     * @public
     * @param {string} folderId - Folder ID
     * @returns {Array} SOPs in the folder
     */
    getSOPsInFolder(folderId) {
        return this._getSOPsInFolder(folderId);
    }
    
    /**
     * Create a new folder programmatically
     * @public
     * @param {Object} folderData - Folder data { name, color, icon }
     * @returns {Object} Created folder
     */
    createFolder(folderData) {
        if (!folderData.name?.trim()) {
            throw new Error('Folder name is required');
        }
        
        if (this.state.folders.length >= this.options.maxFolders) {
            throw new Error(`Maximum of ${this.options.maxFolders} folders allowed`);
        }
        
        const newFolder = {
            id: `folder_${Date.now()}`,
            name: folderData.name.trim(),
            color: folderData.color || FOLDER_COLORS[0].value,
            icon: folderData.icon || '📁',
            order: this.state.folders.length,
            createdAt: Date.now()
        };
        
        this.state.folders.push(newFolder);
        this._saveFolders();
        this.refresh();
        
        return newFolder;
    }
    
    /**
     * Update a folder programmatically
     * @public
     * @param {string} folderId - Folder ID
     * @param {Object} updates - Updates to apply
     * @returns {Object|null} Updated folder or null
     */
    updateFolder(folderId, updates) {
        const index = this.state.folders.findIndex(f => f.id === folderId);
        if (index === -1) return null;
        
        this.state.folders[index] = {
            ...this.state.folders[index],
            ...updates,
            updatedAt: Date.now()
        };
        
        this._saveFolders();
        this.refresh();
        
        return this.state.folders[index];
    }
    
    /**
     * Delete a folder programmatically
     * @public
     * @param {string} folderId - Folder ID
     * @param {boolean} moveSOPs - Move SOPs to uncategorized (default: true)
     * @returns {boolean} Success
     */
    deleteFolder(folderId, moveSOPs = true) {
        const folder = this.state.folders.find(f => f.id === folderId);
        if (!folder) return false;
        
        if (moveSOPs) {
            const sopsInFolder = this._getSOPsInFolder(folderId);
            sopsInFolder.forEach(sop => {
                sop.folderId = null;
            });
            this._saveSOPs();
        }
        
        this.state.folders = this.state.folders.filter(f => f.id !== folderId);
        this._saveFolders();
        this.refresh();
        
        return true;
    }
    
    /**
     * Move SOP to folder programmatically
     * @public
     * @param {string} sopId - SOP ID
     * @param {string} folderId - Target folder ID (or null/undefined for uncategorized)
     * @returns {boolean} Success
     */
    moveSOP(sopId, folderId) {
        const sop = this.state.sops.find(s => s.id === sopId);
        if (!sop) return false;
        
        sop.folderId = folderId || null;
        sop.updatedAt = Date.now();
        
        this._saveSOPs();
        this.refresh();
        
        return true;
    }
    
    /**
     * Expand a folder
     * @public
     * @param {string} folderId - Folder ID
     */
    expandFolder(folderId) {
        this.state.expandedFolders.add(folderId);
        this.refresh();
    }
    
    /**
     * Collapse a folder
     * @public
     * @param {string} folderId - Folder ID
     */
    collapseFolder(folderId) {
        this.state.expandedFolders.delete(folderId);
        this.refresh();
    }
    
    /**
     * Expand all folders
     * @public
     */
    expandAll() {
        this.state.folders.forEach(f => this.state.expandedFolders.add(f.id));
        this.state.expandedFolders.add('uncategorized');
        this.refresh();
    }
    
    /**
     * Collapse all folders
     * @public
     */
    collapseAll() {
        this.state.expandedFolders.clear();
        this.refresh();
    }
    
    /**
     * Register callback functions
     * @public
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        const validEvents = ['onFolderCreate', 'onFolderUpdate', 'onFolderDelete', 'onSOPMove', 'onSOPClick', 'onChange'];
        
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
        this._loadData();
        this._render();
        this._attachEventListeners();
    }
    
    /**
     * Destroy and clean up
     * @public
     */
    destroy() {
        this.container.innerHTML = '';
        
        const styles = document.getElementById('folder-manager-styles');
        if (styles) {
            styles.remove();
        }
    }
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

/**
 * Factory function to create FolderManager instance
 * @param {HTMLElement|string} container - Container element or selector
 * @param {Object} options - Configuration options
 * @returns {FolderManager} FolderManager instance
 */
function createFolderManager(container, options = {}) {
    const containerEl = typeof container === 'string'
        ? document.querySelector(container)
        : container;
    
    if (!containerEl) {
        throw new Error('Folder Manager container element not found');
    }
    
    return new FolderManager(containerEl, options);
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FolderManager, createFolderManager, FOLDER_STORAGE_KEYS, FOLDER_COLORS, FOLDER_ICONS };
} else if (typeof window !== 'undefined') {
    window.FolderManager = FolderManager;
    window.createFolderManager = createFolderManager;
    window.FOLDER_STORAGE_KEYS = FOLDER_STORAGE_KEYS;
    window.FOLDER_COLORS = FOLDER_COLORS;
    window.FOLDER_ICONS = FOLDER_ICONS;
}

// ES6 module export
export { FolderManager, createFolderManager, FOLDER_STORAGE_KEYS, FOLDER_COLORS, FOLDER_ICONS };
