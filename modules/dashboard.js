/**
 * Enhanced Dashboard Module - SOP Tool v1
 * 
 * Features:
 * - SOP listing grouped by folders/categories
 * - Folder management (create, edit, delete, reorder)
 * - Sorting by date created (toggle: newest/oldest)
 * - Filtering by folder, search term, status, hashtag
 * - Clickable hashtags in SOP titles for quick filtering
 * - Recently edited SOP highlighting
 * - Collapsible folder sections
 * - Most Used SOPs tracking
 * - In-progress and completed checklists display
 * 
 * STORAGE KEYS:
 * - 'sop_tool_sops' - All SOP documents
 * - 'sop_tool_folders' - Folder definitions
 * - 'sop_tool_sop_usage' - Usage tracking
 * - 'sop_tool_dashboard_prefs' - User preferences (collapsed folders, sort, etc.)
 * 
 * @module Dashboard
 * @version 2.2.0
 */

(function(global) {
    'use strict';

    // ========================================================================
    // STORAGE KEYS & CONSTANTS
    // ========================================================================

    const STORAGE_KEYS = {
        SOPS: 'sop_tool_sops',
        FOLDERS: 'sop_tool_folders',
        SOP_USAGE: 'sop_tool_sop_usage',
        DASHBOARD_PREFS: 'sop_tool_dashboard_prefs'
    };

    /**
     * Default folders - created on first load
     */
    const DEFAULT_FOLDERS = [
        { id: 'general', name: 'General', color: '#6366f1', icon: '📁', order: 0 },
        { id: 'onboarding', name: 'Onboarding', color: '#22c55e', icon: '👋', order: 1 },
        { id: 'operations', name: 'Operations', color: '#f59e0b', icon: '⚙️', order: 2 },
        { id: 'safety', name: 'Safety', color: '#ef4444', icon: '🛡️', order: 3 },
        { id: 'hr', name: 'HR & Compliance', color: '#8b5cf6', icon: '📋', order: 4 }
    ];

    /**
     * Available folder colors for customization
     */
    const FOLDER_COLORS = [
        '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
        '#f59e0b', '#22c55e', '#14b8a6', '#0ea5e9'
    ];

    /**
     * Available folder icons
     */
    const FOLDER_ICONS = [
        '📁', '📂', '📋', '📝', '📄', '📑', '🗂️', '🗃️',
        '👋', '⚙️', '🛡️', '🔧', '💼', '📊', '🎯', '✅',
        '⚠️', '🔒', '💡', '🚀', '📦', '🏷️', '⭐', '🔥'
    ];

    /**
     * Sort options (simplified: creation date only)
     */
    const SORT_OPTIONS = {
        CREATED_DESC: 'created_desc',  // Newest first (default)
        CREATED_ASC: 'created_asc'     // Oldest first
    };

    /**
     * How long (ms) to consider an SOP "recently edited"
     * Default: 24 hours
     */
    const RECENT_EDIT_THRESHOLD = 24 * 60 * 60 * 1000;

    // ========================================================================
    // DASHBOARD CLASS
    // ========================================================================

    class Dashboard {
        /**
         * Initialize the Dashboard
         * @param {HTMLElement|string} containerElement - Container element or selector
         * @param {Object} options - Configuration options
         */
        constructor(containerElement, options = {}) {
            if (typeof containerElement === 'string') {
                containerElement = document.querySelector(containerElement);
            }
            
            if (!containerElement) {
                throw new Error('Dashboard: Container element not found');
            }
            
            this.container = containerElement;
            
            // Configuration
            this.options = {
                showMostUsed: true,
                mostUsedLimit: 5,
                enableFolderManagement: true,
                enableSorting: true,
                enableFiltering: true,
                highlightRecentEdits: true,
                recentEditThreshold: RECENT_EDIT_THRESHOLD,
                autoRender: true,
                ...options
            };
            
            // State
            this.state = {
                sops: [],
                folders: [],
                filteredSops: [],
                sopUsage: {},
                
                // Filtering & Sorting
                selectedFolderId: null,      // null = all folders
                searchQuery: '',
                sortBy: SORT_OPTIONS.CREATED_DESC,  // Default: newest first
                statusFilter: null,          // null = all statuses
                hashtagFilter: null,         // null = no hashtag filter
                
                // UI state
                collapsedFolders: new Set(),
                completedCollapsed: false,   // Collapse "Recently Completed" section
                showFolderModal: false,
                editingFolder: null
            };
            
            // Callbacks
            this.callbacks = {
                onCreateSOP: null,
                onEditSOP: null,
                onDeleteSOP: null,
                onRunChecklist: null,
                onResumeChecklist: null,
                onViewCompletedChecklist: null
            };
            
            this._init();
        }
        
        // ====================================================================
        // INITIALIZATION
        // ====================================================================
        
        _init() {
            this._loadData();
            this._loadPreferences();
            if (this.options.autoRender) {
                this._render();
                this._attachEventListeners();
            }
        }
        
        /**
         * Load all data from localStorage
         */
        _loadData() {
            // Load folders
            const storedFolders = localStorage.getItem(STORAGE_KEYS.FOLDERS);
            if (storedFolders) {
                this.state.folders = JSON.parse(storedFolders);
            } else {
                this.state.folders = [...DEFAULT_FOLDERS];
                this._saveFolders();
            }
            
            // Sort folders by order
            this.state.folders.sort((a, b) => (a.order || 0) - (b.order || 0));
            
            // Load SOPs
            const storedSops = localStorage.getItem(STORAGE_KEYS.SOPS);
            this.state.sops = storedSops ? JSON.parse(storedSops) : [];
            
            // Load usage data
            const storedUsage = localStorage.getItem(STORAGE_KEYS.SOP_USAGE);
            this.state.sopUsage = storedUsage ? JSON.parse(storedUsage) : {};
            
            // Apply current filters
            this._applyFiltersAndSort();
            
            console.log(`Dashboard: Loaded ${this.state.sops.length} SOPs, ${this.state.folders.length} folders`);
        }
        
        /**
         * Load user preferences (collapsed folders, sort order, etc.)
         */
        _loadPreferences() {
            const prefs = localStorage.getItem(STORAGE_KEYS.DASHBOARD_PREFS);
            if (prefs) {
                const parsed = JSON.parse(prefs);
                this.state.collapsedFolders = new Set(parsed.collapsedFolders || []);
                this.state.completedCollapsed = parsed.completedCollapsed || false;
                
                // Handle legacy sort values - migrate to creation-based sorting
                const savedSort = parsed.sortBy;
                if (savedSort === SORT_OPTIONS.CREATED_DESC || savedSort === SORT_OPTIONS.CREATED_ASC) {
                    this.state.sortBy = savedSort;
                } else {
                    // Legacy sort value - default to newest first
                    this.state.sortBy = SORT_OPTIONS.CREATED_DESC;
                }
            }
        }
        
        /**
         * Save user preferences
         */
        _savePreferences() {
            const prefs = {
                collapsedFolders: Array.from(this.state.collapsedFolders),
                completedCollapsed: this.state.completedCollapsed,
                sortBy: this.state.sortBy
            };
            localStorage.setItem(STORAGE_KEYS.DASHBOARD_PREFS, JSON.stringify(prefs));
        }
        
        // ====================================================================
        // DATA PERSISTENCE
        // ====================================================================
        
        _saveSops() {
            localStorage.setItem(STORAGE_KEYS.SOPS, JSON.stringify(this.state.sops));
        }
        
        _saveFolders() {
            localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(this.state.folders));
        }
        
        _saveUsage() {
            localStorage.setItem(STORAGE_KEYS.SOP_USAGE, JSON.stringify(this.state.sopUsage));
        }
        
        trackUsage(sopId) {
            if (!this.state.sopUsage[sopId]) {
                this.state.sopUsage[sopId] = 0;
            }
            this.state.sopUsage[sopId]++;
            this._saveUsage();
        }
        
        // ====================================================================
        // FILTERING & SORTING
        // ====================================================================
        
        /**
         * Apply all active filters and sort the SOPs
         */
        _applyFiltersAndSort() {
            let filtered = [...this.state.sops];
            
            // Filter by folder
            if (this.state.selectedFolderId) {
                filtered = filtered.filter(sop => sop.folderId === this.state.selectedFolderId);
            }
            
            // Filter by search query
            if (this.state.searchQuery) {
                const query = this.state.searchQuery.toLowerCase();
                filtered = filtered.filter(sop => {
                    const titleMatch = sop.title?.toLowerCase().includes(query);
                    const descMatch = sop.description?.toLowerCase().includes(query);
                    const tagMatch = sop.tags?.some(tag => tag.toLowerCase().includes(query));
                    return titleMatch || descMatch || tagMatch;
                });
            }
            
            // Filter by status
            if (this.state.statusFilter) {
                filtered = filtered.filter(sop => sop.status === this.state.statusFilter);
            }
            
            // Filter by hashtag
            if (this.state.hashtagFilter) {
                filtered = filtered.filter(sop => this._sopHasHashtag(sop, this.state.hashtagFilter));
            }
            
            // Apply sorting
            filtered = this._sortSops(filtered);
            
            this.state.filteredSops = filtered;
        }
        
        /**
         * Sort SOPs based on current sort setting (creation date only)
         */
        _sortSops(sops) {
            const sorted = [...sops];
            
            if (this.state.sortBy === SORT_OPTIONS.CREATED_ASC) {
                // Oldest first
                sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
            } else {
                // Newest first (default)
                sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            }
            
            return sorted;
        }
        
        /**
         * Extract hashtags from text
         * @param {string} text - Text to search for hashtags
         * @returns {string[]} Array of hashtags (without # prefix)
         */
        _extractHashtags(text) {
            if (!text) return [];
            const matches = text.match(/#[a-zA-Z0-9_]+/g);
            return matches ? matches.map(tag => tag.substring(1).toLowerCase()) : [];
        }
        
        /**
         * Check if SOP contains a specific hashtag
         * @param {Object} sop - SOP object
         * @param {string} hashtag - Hashtag to search for (without #)
         * @returns {boolean}
         */
        _sopHasHashtag(sop, hashtag) {
            const hashtagLower = hashtag.toLowerCase();
            
            // Check title
            const titleHashtags = this._extractHashtags(sop.title);
            if (titleHashtags.includes(hashtagLower)) return true;
            
            // Check steps
            if (sop.steps) {
                for (const step of sop.steps) {
                    const stepHashtags = this._extractHashtags(step.text);
                    if (stepHashtags.includes(hashtagLower)) return true;
                    
                    // Also check step notes
                    const noteHashtags = this._extractHashtags(step.note);
                    if (noteHashtags.includes(hashtagLower)) return true;
                }
            }
            
            return false;
        }
        
        /**
         * Render text with clickable hashtags
         * @param {string} text - Text to render
         * @returns {string} HTML with clickable hashtag spans
         */
        _renderWithHashtags(text) {
            if (!text) return '';
            
            const escaped = this._escapeHtml(text);
            const activeHashtag = this.state.hashtagFilter?.toLowerCase();
            
            // Replace hashtags with clickable spans
            return escaped.replace(/#([a-zA-Z0-9_]+)/g, (match, tag) => {
                const isActive = activeHashtag === tag.toLowerCase();
                return `<span class="hashtag${isActive ? ' active' : ''}" data-hashtag="${this._escapeHtml(tag.toLowerCase())}">${match}</span>`;
            });
        }
        
        /**
         * Check if SOP was recently edited
         */
        _isRecentlyEdited(sop) {
            if (!this.options.highlightRecentEdits) return false;
            const threshold = Date.now() - this.options.recentEditThreshold;
            return (sop.updatedAt || sop.createdAt || 0) > threshold;
        }
        
        /**
         * Group SOPs by folder
         */
        _groupSopsByFolder() {
            const groups = {};
            
            // Initialize groups for all folders
            this.state.folders.forEach(folder => {
                groups[folder.id] = {
                    folder: folder,
                    sops: []
                };
            });
            
            // Add uncategorized group
            groups['uncategorized'] = {
                folder: { id: 'uncategorized', name: 'Other', icon: '📄', color: '#6b7280' },
                sops: []
            };
            
            // Group filtered SOPs
            this.state.filteredSops.forEach(sop => {
                const folderId = sop.folderId || 'uncategorized';
                if (groups[folderId]) {
                    groups[folderId].sops.push(sop);
                } else {
                    groups['uncategorized'].sops.push(sop);
                }
            });
            
            return groups;
        }
        
        // ====================================================================
        // FOLDER MANAGEMENT
        // ====================================================================
        
        /**
         * Create a new folder
         */
        createFolder(folderData) {
            const newFolder = {
                id: `folder_${Date.now()}`,
                name: folderData.name || 'New Folder',
                color: folderData.color || FOLDER_COLORS[0],
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
         * Update an existing folder
         */
        updateFolder(folderId, updates) {
            const index = this.state.folders.findIndex(f => f.id === folderId);
            if (index === -1) return null;
            
            this.state.folders[index] = {
                ...this.state.folders[index],
                ...updates
            };
            
            this._saveFolders();
            this.refresh();
            
            return this.state.folders[index];
        }
        
        /**
         * Delete a folder (moves SOPs to uncategorized)
         */
        deleteFolder(folderId) {
            // Don't delete default folders or uncategorized
            if (['general', 'uncategorized'].includes(folderId)) {
                this._showNotification('Cannot delete this folder', 'error');
                return false;
            }
            
            const folder = this.state.folders.find(f => f.id === folderId);
            if (!folder) return false;
            
            // Move all SOPs in this folder to "general"
            let movedCount = 0;
            this.state.sops.forEach(sop => {
                if (sop.folderId === folderId) {
                    sop.folderId = 'general';
                    movedCount++;
                }
            });
            
            if (movedCount > 0) {
                this._saveSops();
            }
            
            // Remove the folder
            this.state.folders = this.state.folders.filter(f => f.id !== folderId);
            this._saveFolders();
            
            this._showNotification(`Folder "${folder.name}" deleted. ${movedCount} SOPs moved to General.`, 'success');
            this.refresh();
            
            return true;
        }
        
        /**
         * Toggle folder collapsed state
         */
        toggleFolderCollapse(folderId) {
            if (this.state.collapsedFolders.has(folderId)) {
                this.state.collapsedFolders.delete(folderId);
            } else {
                this.state.collapsedFolders.add(folderId);
            }
            this._savePreferences();
            this._updateFolderCollapseUI(folderId);
        }
        
        // ====================================================================
        // RENDERING
        // ====================================================================
        
        _render() {
            this.container.innerHTML = '';
            this.container.className = 'dashboard-container';
            
            this.container.innerHTML = `
                <div class="dashboard-layout">
                    <!-- Sidebar -->
                    <aside class="dashboard-sidebar" id="folder-sidebar">
                        <div class="sidebar-header">
                            <h3>📂 Folders</h3>
                            ${this.options.enableFolderManagement ? `
                            <button class="btn-icon" id="btn-add-folder" title="Add Folder">➕</button>
                            ` : ''}
                        </div>
                        <nav class="folder-list" id="folder-list">
                            ${this._renderFolderList()}
                        </nav>
                    </aside>
                    
                    <!-- Main Content -->
                    <main class="dashboard-main">
                        <!-- Header -->
                        <header class="dashboard-header">
                            <div class="search-container">
                                <input 
                                    type="text" 
                                    id="sop-search" 
                                    class="search-input" 
                                    placeholder="Search SOPs..."
                                    value="${this._escapeHtml(this.state.searchQuery)}"
                                />
                                <span class="search-icon">🔍</span>
                            </div>
                            
                            ${this.options.enableSorting ? `
                            <button class="sort-toggle-btn" id="btn-sort-toggle" title="Toggle sort order">
                                ${this.state.sortBy === SORT_OPTIONS.CREATED_DESC ? '↓ Newest' : '↑ Oldest'}
                            </button>
                            ` : ''}
                            
                            <div class="quick-actions">
                                <button class="btn btn-primary" id="btn-create-sop">
                                    ➕ Create SOP
                                </button>
                            </div>
                        </header>
                        
                        <!-- Active Filters -->
                        ${this._renderActiveFilters()}
                        
                        <!-- Resume Section (primary action for returning users) -->
                        ${this._renderRecentChecklists()}
                        
                        <!-- Most Used Section -->
                        ${this.options.showMostUsed && this.state.sops.length > 0 ? `
                        <section class="most-used-section" id="most-used-section">
                            <div class="section-header">
                                <h3>🔥 Most Used</h3>
                            </div>
                            <div class="most-used-list" id="most-used-list">
                                ${this._renderMostUsedSops()}
                            </div>
                        </section>
                        ` : ''}
                        
                        <!-- SOP List by Folders -->
                        <section class="sop-list-section">
                            <div class="section-header">
                                <h3>📄 Your SOPs</h3>
                                <span class="sop-count" id="sop-count">
                                    ${this.state.filteredSops.length} of ${this.state.sops.length} SOPs
                                </span>
                            </div>
                            
                            <div class="sop-groups" id="sop-groups">
                                ${this._renderSopGroups()}
                            </div>
                        </section>
                        
                        <!-- Completed Checklists (archival) -->
                        ${this._renderCompletedChecklists()}
                    </main>
                </div>
                
                <!-- Folder Modal -->
                <div class="modal-overlay" id="folder-modal" style="display: none;">
                    <div class="modal-content folder-modal-content">
                        <div class="modal-header">
                            <h3 id="folder-modal-title">Add Folder</h3>
                            <button class="btn-close" id="btn-close-folder-modal">✕</button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label>Folder Name</label>
                                <input type="text" id="folder-name-input" class="form-input" placeholder="Enter folder name" maxlength="50" />
                            </div>
                            <div class="form-group">
                                <label>Icon</label>
                                <div class="icon-picker" id="icon-picker">
                                    ${FOLDER_ICONS.map(icon => `
                                        <button type="button" class="icon-option" data-icon="${icon}">${icon}</button>
                                    `).join('')}
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Color</label>
                                <div class="color-picker" id="color-picker">
                                    ${FOLDER_COLORS.map(color => `
                                        <button type="button" class="color-option" data-color="${color}" style="background: ${color}"></button>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" id="btn-cancel-folder">Cancel</button>
                            <button class="btn btn-primary" id="btn-save-folder">Save Folder</button>
                        </div>
                    </div>
                </div>
                
                <!-- Notification Toast -->
                <div class="notification-toast" id="notification-toast" style="display: none;">
                    <span class="notification-message"></span>
                </div>
            `;
            
            this._injectStyles();
        }
        
        /**
         * Render folder list in sidebar
         */
        _renderFolderList() {
            const sopCounts = {};
            this.state.sops.forEach(sop => {
                const folderId = sop.folderId || 'uncategorized';
                sopCounts[folderId] = (sopCounts[folderId] || 0) + 1;
            });
            
            let html = `
                <div class="folder-item ${!this.state.selectedFolderId ? 'active' : ''}" 
                     data-folder-id="">
                    <span class="folder-icon">📁</span>
                    <span class="folder-name">All SOPs</span>
                    <span class="folder-count">${this.state.sops.length}</span>
                </div>
            `;
            
            this.state.folders.forEach(folder => {
                const count = sopCounts[folder.id] || 0;
                const isActive = this.state.selectedFolderId === folder.id;
                
                html += `
                    <div class="folder-item ${isActive ? 'active' : ''}" 
                         data-folder-id="${folder.id}"
                         style="--folder-color: ${folder.color}">
                        <span class="folder-icon">${folder.icon || '📁'}</span>
                        <span class="folder-name">${this._escapeHtml(folder.name)}</span>
                        <span class="folder-count">${count}</span>
                        ${this.options.enableFolderManagement && !['general'].includes(folder.id) ? `
                        <div class="folder-actions">
                            <button class="folder-action-btn" data-action="edit-folder" data-folder-id="${folder.id}" title="Edit">✏️</button>
                            <button class="folder-action-btn" data-action="delete-folder" data-folder-id="${folder.id}" title="Delete">🗑️</button>
                        </div>
                        ` : ''}
                    </div>
                `;
            });
            
            // Uncategorized
            const uncategorizedCount = sopCounts['uncategorized'] || 0;
            if (uncategorizedCount > 0) {
                html += `
                    <div class="folder-item ${this.state.selectedFolderId === 'uncategorized' ? 'active' : ''}" 
                         data-folder-id="uncategorized"
                         style="--folder-color: #6b7280">
                        <span class="folder-icon">📄</span>
                        <span class="folder-name">Other</span>
                        <span class="folder-count">${uncategorizedCount}</span>
                    </div>
                `;
            }
            
            return html;
        }
        
        /**
         * Render active filter badges
         */
        _renderActiveFilters() {
            const filters = [];
            
            if (this.state.selectedFolderId) {
                const folder = this.state.folders.find(f => f.id === this.state.selectedFolderId);
                if (folder) {
                    filters.push({
                        type: 'folder',
                        label: `Folder: ${folder.name}`,
                        value: this.state.selectedFolderId
                    });
                }
            }
            
            if (this.state.searchQuery) {
                filters.push({
                    type: 'search',
                    label: `Search: "${this.state.searchQuery}"`,
                    value: this.state.searchQuery
                });
            }
            
            if (this.state.hashtagFilter) {
                filters.push({
                    type: 'hashtag',
                    label: `#${this.state.hashtagFilter}`,
                    value: this.state.hashtagFilter
                });
            }
            
            if (filters.length === 0) return '';
            
            return `
                <div class="active-filters">
                    ${filters.map(f => `
                        <span class="filter-badge${f.type === 'hashtag' ? ' filter-badge-hashtag' : ''}" data-filter-type="${f.type}">
                            ${this._escapeHtml(f.label)}
                            <button class="filter-remove" data-filter-type="${f.type}">✕</button>
                        </span>
                    `).join('')}
                    <button class="btn-link" id="btn-clear-filters">Clear All</button>
                </div>
            `;
        }
        
        /**
         * Render recent/in-progress checklists section
         */
        _renderRecentChecklists() {
            const checklists = this._loadChecklists();
            const inProgress = checklists.filter(c => c.status === 'in_progress').slice(0, 5);
            
            if (inProgress.length === 0) return '';
            
            return `
                <section class="recent-checklists-section">
                    <div class="section-header">
                        <h3>📋 Continue Where You Left Off</h3>
                    </div>
                    <div class="checklists-list">
                        ${inProgress.map(checklist => {
                            const progress = Math.round((checklist.completedSteps / checklist.totalSteps) * 100);
                            const folder = this.state.folders.find(f => f.id === checklist.folderId);
                            return `
                                <div class="checklist-card" data-checklist-id="${checklist.id}">
                                    <div class="checklist-card-main">
                                        <span class="checklist-folder" style="color: ${folder?.color || '#6b7280'}">
                                            ${folder?.icon || '📁'}
                                        </span>
                                        <div class="checklist-info">
                                            <h4>${this._escapeHtml(checklist.sopTitle)}</h4>
                                            <div class="checklist-progress">
                                                <div class="mini-progress-bar">
                                                    <div class="mini-progress-fill" style="width: ${progress}%"></div>
                                                </div>
                                                <span>${checklist.completedSteps}/${checklist.totalSteps}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button class="btn-resume" data-checklist-id="${checklist.id}">Resume →</button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </section>
            `;
        }
        
        /**
         * Render completed checklists section
         */
        _renderCompletedChecklists() {
            const checklists = this._loadChecklists();
            const completed = checklists
                .filter(c => c.status === 'completed')
                .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
                .slice(0, 5);
            
            if (completed.length === 0) return '';
            
            const isCollapsed = this.state.completedCollapsed;
            
            return `
                <section class="completed-checklists-section ${isCollapsed ? 'collapsed' : ''}">
                    <div class="section-header section-header-collapsible" id="completed-section-header">
                        <h3>✅ Recently Completed <span class="completed-count">(${completed.length})</span></h3>
                        <button class="collapse-arrow ${isCollapsed ? 'collapsed' : ''}" id="btn-toggle-completed" title="${isCollapsed ? 'Expand' : 'Collapse'}">
                            ▼
                        </button>
                    </div>
                    <div class="checklists-list ${isCollapsed ? 'hidden' : ''}">
                        ${completed.map(checklist => {
                            const completedDate = checklist.completedAt 
                                ? new Date(checklist.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
                                : 'Unknown';
                            const completedTime = checklist.completedAt
                                ? new Date(checklist.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '';
                            return `
                                <div class="checklist-card completed-checklist-card" data-completed-checklist-id="${checklist.id}">
                                    <div class="checklist-card-main">
                                        <span class="checklist-complete-icon">✓</span>
                                        <div class="checklist-info">
                                            <h4>${this._escapeHtml(checklist.sopTitle)}</h4>
                                            <div class="checklist-completed-date">
                                                <span>Completed ${completedDate} at ${completedTime}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button class="btn-view-completed" data-completed-checklist-id="${checklist.id}">View →</button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </section>
            `;
        }
        
        /**
         * Load checklists from localStorage
         */
        /**
         * Load checklists from localStorage
         * Returns raw data without recalculating status - status is persisted explicitly
         */
        _loadChecklists() {
            const stored = localStorage.getItem('sop_tool_checklists');
            if (!stored) return [];
            
            const checklists = JSON.parse(stored);
            
            // Defensive: ensure each checklist has required fields
            // but do NOT recalculate status - respect persisted values
            return checklists.map(c => ({
                ...c,
                // Ensure required fields exist with defaults only if missing
                status: c.status || 'in_progress',
                completedSteps: c.completedSteps ?? 0,
                totalSteps: c.totalSteps ?? (c.steps?.length || 0),
                completedAt: c.completedAt ?? null
            }));
        }
        
        /**
         * Render most used SOPs
         */
        _renderMostUsedSops() {
            const sortedByUsage = [...this.state.sops]
                .filter(sop => sop.status !== 'archived')
                .sort((a, b) => {
                    const usageA = this.state.sopUsage[a.id] || 0;
                    const usageB = this.state.sopUsage[b.id] || 0;
                    return usageB - usageA;
                })
                .slice(0, this.options.mostUsedLimit);
            
            if (sortedByUsage.length === 0) {
                return '<p class="empty-message">No frequently used SOPs yet. SOPs you use often will appear here automatically.</p>';
            }
            
            return sortedByUsage.map(sop => {
                const folder = this.state.folders.find(f => f.id === sop.folderId);
                const usage = this.state.sopUsage[sop.id] || 0;
                
                return `
                    <div class="most-used-card" data-sop-id="${sop.id}">
                        <div class="card-header">
                            <span class="card-icon">${folder?.icon || '📄'}</span>
                            <span class="usage-badge">${usage} uses</span>
                        </div>
                        <h4 class="card-title">${this._escapeHtml(sop.title)}</h4>
                    </div>
                `;
            }).join('');
        }
        
        /**
         * Render SOPs grouped by folder with collapsible sections
         */
        _renderSopGroups() {
            if (this.state.filteredSops.length === 0) {
                const isFiltered = this.state.searchQuery || this.state.selectedFolderId || this.state.hashtagFilter;
                
                if (isFiltered) {
                    // Contextual empty message based on which filter is active
                    let emptyMsg = '';
                    if (this.state.searchQuery && !this.state.selectedFolderId && !this.state.hashtagFilter) {
                        emptyMsg = 'No results found. Try a different keyword or check your spelling.';
                    } else if (this.state.selectedFolderId && !this.state.searchQuery && !this.state.hashtagFilter) {
                        emptyMsg = 'No SOPs in this folder yet. Add an existing SOP or create a new one to get started.';
                    } else {
                        emptyMsg = 'No SOPs match these filters. Try adjusting your filters or clearing them to see all SOPs.';
                    }
                    return `
                        <div class="empty-state">
                            <p>${emptyMsg}</p>
                            <button class="btn btn-primary" id="btn-create-sop-empty">
                                ➕ Create New SOP
                            </button>
                        </div>
                    `;
                }
                
                // First-time user empty state
                return `
                    <div class="empty-state empty-state-welcome">
                        <div class="welcome-header">
                            <p class="welcome-title">Stop being the bottleneck.</p>
                            <p class="welcome-subtitle">Turn how you do work into clear steps your team can follow without you.</p>
                        </div>
                        
                        <div class="welcome-why">
                            <p class="why-text">Write simple, step-by-step procedures for the tasks your business does every day — so work gets done consistently, even when you're not there.</p>
                        </div>
                        
                        <div class="welcome-actions">
                            <button class="btn btn-primary" id="btn-create-sop-empty">
                                ➕ Create your first SOP
                            </button>
                        </div>
                        
                        <div class="welcome-starter">
                            <p class="starter-idea">Start with something your team does often — like onboarding a new hire, handling a request, or answering a common question.</p>
                        </div>
                        
                        <div class="trust-notice">
                            <p>Your SOPs are saved on this device and update automatically.</p>
                        </div>
                    </div>
                `;
            }
            
            const groups = this._groupSopsByFolder();
            let html = '';
            
            // Render folders in order
            const orderedFolderIds = this.state.folders.map(f => f.id);
            orderedFolderIds.push('uncategorized');
            
            orderedFolderIds.forEach(folderId => {
                const group = groups[folderId];
                if (!group || group.sops.length === 0) return;
                
                const isCollapsed = this.state.collapsedFolders.has(folderId);
                const folder = group.folder;
                
                html += `
                    <div class="sop-group" data-folder-id="${folderId}">
                        <div class="sop-group-header" data-folder-id="${folderId}" style="--folder-color: ${folder.color}">
                            <button class="collapse-btn ${isCollapsed ? 'collapsed' : ''}" data-action="toggle-collapse" data-folder-id="${folderId}">
                                ${isCollapsed ? '▶' : '▼'}
                            </button>
                            <span class="group-icon">${folder.icon}</span>
                            <span class="group-name">${this._escapeHtml(folder.name)}</span>
                            <span class="group-count">${group.sops.length}</span>
                        </div>
                        <div class="sop-group-content ${isCollapsed ? 'collapsed' : ''}" id="group-content-${folderId}">
                            ${group.sops.map(sop => this._renderSopCard(sop)).join('')}
                        </div>
                    </div>
                `;
            });
            
            return html;
        }
        
        /**
         * Render a single SOP card
         */
        _renderSopCard(sop) {
            const folder = this.state.folders.find(f => f.id === sop.folderId);
            const updatedDate = new Date(sop.updatedAt || sop.createdAt).toLocaleDateString();
            const stepCount = sop.steps?.length || 0;
            const isRecent = this._isRecentlyEdited(sop);
            
            return `
                <div class="sop-card ${isRecent ? 'recently-edited' : ''}" data-sop-id="${sop.id}">
                    ${isRecent ? '<span class="recent-badge">Recently Updated</span>' : ''}
                    <div class="sop-card-main">
                        <div class="sop-card-header">
                            <span class="sop-status status-${sop.status || 'draft'}">${sop.status || 'draft'}</span>
                        </div>
                        
                        <h4 class="sop-title">${this._renderWithHashtags(sop.title)}</h4>
                        <p class="sop-description">${this._escapeHtml(sop.description || 'No description')}</p>
                        
                        <div class="sop-meta">
                            <span class="meta-item">📝 ${stepCount} steps</span>
                            <span class="meta-item">🕐 ${updatedDate}</span>
                        </div>
                        
                        ${sop.tags && sop.tags.length > 0 ? `
                        <div class="sop-tags">
                            ${sop.tags.slice(0, 3).map(tag => `<span class="tag">#${this._escapeHtml(tag)}</span>`).join('')}
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="sop-card-actions">
                        <button class="action-btn checklist-btn" data-action="checklist" data-sop-id="${sop.id}" title="Use as checklist">
                            ✅ Use
                        </button>
                        <button class="action-btn edit-btn" data-action="edit" data-sop-id="${sop.id}" title="Edit SOP">
                            ✏️ Edit
                        </button>
                        <button class="action-btn delete-btn" data-action="delete" data-sop-id="${sop.id}" title="Delete SOP">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }
        
        /**
         * Update folder collapse UI without full re-render
         */
        _updateFolderCollapseUI(folderId) {
            const content = document.getElementById(`group-content-${folderId}`);
            const btn = document.querySelector(`[data-action="toggle-collapse"][data-folder-id="${folderId}"]`);
            
            if (content && btn) {
                const isCollapsed = this.state.collapsedFolders.has(folderId);
                content.classList.toggle('collapsed', isCollapsed);
                btn.classList.toggle('collapsed', isCollapsed);
                btn.textContent = isCollapsed ? '▶' : '▼';
            }
        }
        
        // ====================================================================
        // EVENT HANDLING
        // ====================================================================
        
        _attachEventListeners() {
            // Search
            document.getElementById('sop-search')?.addEventListener('input', (e) => {
                this.state.searchQuery = e.target.value;
                this._applyFiltersAndSort();
                this._updateSopList();
            });
            
            // Sort toggle button
            document.getElementById('btn-sort-toggle')?.addEventListener('click', () => {
                // Toggle between newest and oldest
                if (this.state.sortBy === SORT_OPTIONS.CREATED_DESC) {
                    this.state.sortBy = SORT_OPTIONS.CREATED_ASC;
                } else {
                    this.state.sortBy = SORT_OPTIONS.CREATED_DESC;
                }
                
                // Update button text
                const btn = document.getElementById('btn-sort-toggle');
                if (btn) {
                    btn.textContent = this.state.sortBy === SORT_OPTIONS.CREATED_DESC ? '↓ Newest' : '↑ Oldest';
                }
                
                this._savePreferences();
                this._applyFiltersAndSort();
                this._updateSopList();
            });
            
            // Folder selection
            document.getElementById('folder-list')?.addEventListener('click', (e) => {
                const folderItem = e.target.closest('.folder-item');
                const actionBtn = e.target.closest('.folder-action-btn');
                
                if (actionBtn) {
                    e.stopPropagation();
                    const action = actionBtn.dataset.action;
                    const folderId = actionBtn.dataset.folderId;
                    
                    if (!folderId) {
                        console.warn('Dashboard: Folder action button missing folderId');
                        return;
                    }
                    
                    if (action === 'edit-folder') {
                        this._openFolderModal(folderId);
                    } else if (action === 'delete-folder') {
                        if (confirm('Delete this folder? SOPs will be moved to General.')) {
                            this.deleteFolder(folderId);
                        }
                    } else {
                        console.warn('Dashboard: Unknown folder action:', action);
                    }
                    return;
                }
                
                if (folderItem) {
                    const folderId = folderItem.dataset.folderId || null;
                    this.state.selectedFolderId = folderId;
                    this._applyFiltersAndSort();
                    this.refresh();
                }
            });
            
            // Create SOP buttons
            document.getElementById('btn-create-sop')?.addEventListener('click', () => {
                if (this.callbacks.onCreateSOP) {
                    this.callbacks.onCreateSOP();
                } else {
                    console.warn('Dashboard: onCreateSOP callback not registered');
                }
            });
            
            document.getElementById('btn-create-sop-empty')?.addEventListener('click', () => {
                if (this.callbacks.onCreateSOP) {
                    this.callbacks.onCreateSOP();
                } else {
                    console.warn('Dashboard: onCreateSOP callback not registered');
                }
            });
            
            // Add folder button
            document.getElementById('btn-add-folder')?.addEventListener('click', () => {
                this._openFolderModal();
            });
            
            // SOP groups (collapse, edit, delete, hashtag clicks)
            document.getElementById('sop-groups')?.addEventListener('click', (e) => {
                // Hashtag clicks
                const hashtagEl = e.target.closest('.hashtag');
                if (hashtagEl) {
                    e.stopPropagation();
                    const hashtag = hashtagEl.dataset.hashtag;
                    if (!hashtag) return;
                    
                    // Toggle: if same hashtag clicked, clear filter; otherwise set filter
                    if (this.state.hashtagFilter === hashtag) {
                        this.state.hashtagFilter = null;
                    } else {
                        this.state.hashtagFilter = hashtag;
                    }
                    
                    this._applyFiltersAndSort();
                    this.refresh();
                    return;
                }
                
                // Collapse toggle
                const collapseBtn = e.target.closest('[data-action="toggle-collapse"]');
                if (collapseBtn) {
                    const folderId = collapseBtn.dataset.folderId;
                    if (folderId !== undefined) {
                        this.toggleFolderCollapse(folderId);
                    } else {
                        console.warn('Dashboard: Collapse button missing folderId');
                    }
                    return;
                }
                
                // SOP actions
                const actionBtn = e.target.closest('[data-action]');
                if (actionBtn) {
                    const action = actionBtn.dataset.action;
                    const sopId = actionBtn.dataset.sopId;
                    if (action && sopId) {
                        this._handleSopAction(action, sopId);
                    } else if (action && !sopId) {
                        console.warn('Dashboard: Action button missing sopId for action:', action);
                    }
                }
            });
            
            // Most used cards
            document.getElementById('most-used-list')?.addEventListener('click', (e) => {
                const card = e.target.closest('.most-used-card');
                if (card) {
                    const sopId = card.dataset.sopId;
                    if (!sopId) {
                        console.warn('Dashboard: Most used card missing sopId');
                        return;
                    }
                    const sop = this.state.sops.find(s => s.id === sopId);
                    if (!sop) {
                        console.warn('Dashboard: SOP not found in most-used list:', sopId);
                        return;
                    }
                    if (this.callbacks.onEditSOP) {
                        this.trackUsage(sopId);
                        this.callbacks.onEditSOP(sop);
                    } else {
                        console.warn('Dashboard: onEditSOP callback not registered');
                    }
                }
            });
            
            // Clear filters
            document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
                this.state.selectedFolderId = null;
                this.state.searchQuery = '';
                this.state.hashtagFilter = null;
                this._applyFiltersAndSort();
                this.refresh();
            });
            
            // Resume checklist buttons
            document.querySelectorAll('.btn-resume').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const checklistId = btn.dataset.checklistId;
                    if (!checklistId) {
                        console.warn('Dashboard: Resume button missing checklistId');
                        return;
                    }
                    if (this.callbacks.onResumeChecklist) {
                        this.callbacks.onResumeChecklist(checklistId);
                    } else {
                        console.warn('Dashboard: onResumeChecklist callback not registered');
                    }
                });
            });
            
            // In-progress checklist card click (resumes)
            document.querySelectorAll('.checklist-card[data-checklist-id]').forEach(card => {
                card.addEventListener('click', () => {
                    const checklistId = card.dataset.checklistId;
                    if (!checklistId) {
                        console.warn('Dashboard: Checklist card missing checklistId');
                        return;
                    }
                    if (this.callbacks.onResumeChecklist) {
                        this.callbacks.onResumeChecklist(checklistId);
                    } else {
                        console.warn('Dashboard: onResumeChecklist callback not registered');
                    }
                });
            });
            
            // Toggle completed checklists section collapse
            document.getElementById('btn-toggle-completed')?.addEventListener('click', () => {
                this.state.completedCollapsed = !this.state.completedCollapsed;
                this._savePreferences();
                this.refresh();
            });
            
            // Also allow clicking the header to toggle
            document.getElementById('completed-section-header')?.addEventListener('click', (e) => {
                // Don't toggle if clicking the button directly (it has its own handler)
                if (e.target.id === 'btn-toggle-completed') return;
                this.state.completedCollapsed = !this.state.completedCollapsed;
                this._savePreferences();
                this.refresh();
            });
            
            // View completed checklist buttons
            document.querySelectorAll('.btn-view-completed').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const checklistId = btn.dataset.completedChecklistId;
                    if (!checklistId) {
                        console.warn('Dashboard: View completed button missing checklistId');
                        return;
                    }
                    if (this.callbacks.onViewCompletedChecklist) {
                        this.callbacks.onViewCompletedChecklist(checklistId);
                    } else {
                        console.warn('Dashboard: onViewCompletedChecklist callback not registered');
                    }
                });
            });
            
            // Completed checklist card click (views)
            document.querySelectorAll('.completed-checklist-card').forEach(card => {
                card.addEventListener('click', () => {
                    const checklistId = card.dataset.completedChecklistId;
                    if (!checklistId) {
                        console.warn('Dashboard: Completed checklist card missing checklistId');
                        return;
                    }
                    if (this.callbacks.onViewCompletedChecklist) {
                        this.callbacks.onViewCompletedChecklist(checklistId);
                    } else {
                        console.warn('Dashboard: onViewCompletedChecklist callback not registered');
                    }
                });
            });
            
            // Filter badges remove
            document.querySelectorAll('.filter-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const type = e.target.dataset.filterType;
                    if (type === 'folder') this.state.selectedFolderId = null;
                    if (type === 'search') this.state.searchQuery = '';
                    if (type === 'hashtag') this.state.hashtagFilter = null;
                    this._applyFiltersAndSort();
                    this.refresh();
                });
            });
            
            // Folder modal
            this._attachFolderModalListeners();
        }
        
        /**
         * Handle SOP action buttons
         */
        _handleSopAction(action, sopId) {
            const sop = this.state.sops.find(s => s.id === sopId);
            if (!sop) {
                console.warn('Dashboard: SOP not found for action:', action, sopId);
                return;
            }
            
            switch (action) {
                case 'edit':
                    if (this.callbacks.onEditSOP) {
                        this.trackUsage(sopId);
                        this.callbacks.onEditSOP(sop);
                    } else {
                        console.warn('Dashboard: onEditSOP callback not registered');
                    }
                    break;
                    
                case 'checklist':
                    if (this.callbacks.onRunChecklist) {
                        this.trackUsage(sopId);
                        this.callbacks.onRunChecklist(sop);
                    } else {
                        console.warn('Dashboard: onRunChecklist callback not registered');
                    }
                    break;
                    
                case 'delete':
                    if (confirm(`Delete "${sop.title}"?\n\nThis SOP and all its steps will be permanently removed. This cannot be undone.`)) {
                        this.state.sops = this.state.sops.filter(s => s.id !== sopId);
                        delete this.state.sopUsage[sopId];
                        this._saveSops();
                        this._saveUsage();
                        this._showNotification('SOP deleted', 'error');
                        if (this.callbacks.onDeleteSOP) this.callbacks.onDeleteSOP(sop);
                        this.refresh();
                    }
                    break;
                    
                default:
                    console.warn('Dashboard: Unknown action:', action);
            }
        }
        
        /**
         * Update SOP list without full re-render
         */
        _updateSopList() {
            const sopGroups = document.getElementById('sop-groups');
            const sopCount = document.getElementById('sop-count');
            
            if (sopGroups) {
                sopGroups.innerHTML = this._renderSopGroups();
            }
            
            if (sopCount) {
                sopCount.textContent = `${this.state.filteredSops.length} of ${this.state.sops.length} SOPs`;
            }
        }
        
        // ====================================================================
        // FOLDER MODAL
        // ====================================================================
        
        _openFolderModal(folderId = null) {
            this.state.editingFolder = folderId ? this.state.folders.find(f => f.id === folderId) : null;
            
            const modal = document.getElementById('folder-modal');
            const title = document.getElementById('folder-modal-title');
            const nameInput = document.getElementById('folder-name-input');
            
            if (this.state.editingFolder) {
                title.textContent = 'Edit Folder';
                nameInput.value = this.state.editingFolder.name;
                this._selectIcon(this.state.editingFolder.icon);
                this._selectColor(this.state.editingFolder.color);
            } else {
                title.textContent = 'Add Folder';
                nameInput.value = '';
                this._selectIcon('📁');
                this._selectColor(FOLDER_COLORS[0]);
            }
            
            modal.style.display = 'flex';
            nameInput.focus();
        }
        
        _closeFolderModal() {
            document.getElementById('folder-modal').style.display = 'none';
            this.state.editingFolder = null;
        }
        
        _selectIcon(icon) {
            document.querySelectorAll('.icon-option').forEach(btn => {
                btn.classList.toggle('selected', btn.dataset.icon === icon);
            });
        }
        
        _selectColor(color) {
            document.querySelectorAll('.color-option').forEach(btn => {
                btn.classList.toggle('selected', btn.dataset.color === color);
            });
        }
        
        _attachFolderModalListeners() {
            document.getElementById('btn-close-folder-modal')?.addEventListener('click', () => this._closeFolderModal());
            document.getElementById('btn-cancel-folder')?.addEventListener('click', () => this._closeFolderModal());
            
            document.getElementById('folder-modal')?.addEventListener('click', (e) => {
                if (e.target.id === 'folder-modal') this._closeFolderModal();
            });
            
            document.getElementById('icon-picker')?.addEventListener('click', (e) => {
                const btn = e.target.closest('.icon-option');
                if (btn) this._selectIcon(btn.dataset.icon);
            });
            
            document.getElementById('color-picker')?.addEventListener('click', (e) => {
                const btn = e.target.closest('.color-option');
                if (btn) this._selectColor(btn.dataset.color);
            });
            
            document.getElementById('btn-save-folder')?.addEventListener('click', () => {
                const name = document.getElementById('folder-name-input').value.trim();
                const icon = document.querySelector('.icon-option.selected')?.dataset.icon || '📁';
                const color = document.querySelector('.color-option.selected')?.dataset.color || FOLDER_COLORS[0];
                
                if (!name) {
                    this._showNotification('Please enter a folder name', 'error');
                    return;
                }
                
                if (this.state.editingFolder) {
                    this.updateFolder(this.state.editingFolder.id, { name, icon, color });
                    this._showNotification('Folder updated', 'success');
                } else {
                    this.createFolder({ name, icon, color });
                    this._showNotification('Folder created', 'success');
                }
                
                this._closeFolderModal();
            });
        }
        
        // ====================================================================
        // NOTIFICATIONS
        // ====================================================================
        
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
            toast._hideTimer = setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }
        
        // ====================================================================
        // STYLES
        // ====================================================================
        
        _injectStyles() {
            if (document.getElementById('dashboard-styles-v2')) return;
            
            const styles = document.createElement('style');
            styles.id = 'dashboard-styles-v2';
            styles.textContent = `
                /* ============================================
                   Enhanced Dashboard Styles v2
                   ============================================ */
                
                .dashboard-container {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: #1f2937;
                    background: #f9fafb;
                    min-height: 100vh;
                    overflow-x: hidden;
                }
                
                .dashboard-layout {
                    display: grid;
                    grid-template-columns: 260px 1fr;
                    min-height: 100vh;
                    overflow: hidden;
                    max-width: 100%;
                }
                
                /* Sidebar */
                .dashboard-sidebar {
                    background: #fff;
                    border-right: 1px solid #e5e7eb;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    position: sticky;
                    top: 0;
                    overflow-y: auto;
                }
                
                .sidebar-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem 1rem;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .sidebar-header h3 {
                    margin: 0;
                    font-size: 1rem;
                }
                
                .btn-icon {
                    width: 28px;
                    height: 28px;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    background: #fff;
                    cursor: pointer;
                    font-size: 0.8rem;
                }
                
                .btn-icon:hover {
                    background: #f3f4f6;
                }
                
                .folder-list {
                    flex: 1;
                    padding: 0.5rem 0;
                }
                
                .folder-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    cursor: pointer;
                    border-left: 3px solid transparent;
                    transition: all 0.15s;
                    position: relative;
                }
                
                .folder-item:hover {
                    background: #f3f4f6;
                }
                
                .folder-item:hover .folder-actions {
                    opacity: 1;
                }
                
                .folder-item.active {
                    background: #eff6ff;
                    border-left-color: var(--folder-color, #6366f1);
                }
                
                .folder-icon { font-size: 1rem; }
                .folder-name { flex: 1; font-size: 0.875rem; }
                .folder-count {
                    background: #e5e7eb;
                    color: #6b7280;
                    padding: 0.125rem 0.5rem;
                    border-radius: 999px;
                    font-size: 0.7rem;
                }
                
                .folder-actions {
                    display: flex;
                    gap: 0.25rem;
                    opacity: 0;
                    transition: opacity 0.15s;
                }
                
                .folder-action-btn {
                    width: 24px;
                    height: 24px;
                    border: none;
                    background: none;
                    cursor: pointer;
                    font-size: 0.75rem;
                    border-radius: 4px;
                }
                
                .folder-action-btn:hover {
                    background: #e5e7eb;
                }
                
                /* Main */
                .dashboard-main {
                    padding: 1.5rem 2rem;
                    max-width: 1000px;
                    min-width: 0;
                    overflow-x: hidden;
                }
                
                .dashboard-header {
                    display: flex;
                    gap: 1rem;
                    align-items: center;
                    flex-wrap: wrap;
                    margin-bottom: 1.5rem;
                    overflow: hidden;
                }
                
                .search-container {
                    position: relative;
                    flex: 1;
                    min-width: 200px;
                }
                
                .search-input {
                    width: 100%;
                    padding: 0.625rem 1rem 0.625rem 2.25rem;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    box-sizing: border-box;
                }
                
                .search-input:focus {
                    outline: none;
                    border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                }
                
                .search-icon {
                    position: absolute;
                    left: 0.75rem;
                    top: 50%;
                    transform: translateY(-50%);
                    opacity: 0.4;
                }
                
                .sort-toggle-btn {
                    padding: 0.625rem 1rem;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    font-size: 0.875rem;
                    background: #fff;
                    cursor: pointer;
                    transition: all 0.15s;
                    white-space: nowrap;
                }
                
                .sort-toggle-btn:hover {
                    background: #f3f4f6;
                    border-color: #9ca3af;
                }
                
                .quick-actions {
                    display: flex;
                    gap: 0.5rem;
                }
                
                /* Buttons */
                .btn {
                    padding: 0.625rem 1.25rem;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.875rem;
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
                
                .btn-link {
                    background: none;
                    border: none;
                    color: #6366f1;
                    font-size: 0.8rem;
                    cursor: pointer;
                    text-decoration: underline;
                }
                
                /* Active Filters */
                .active-filters {
                    display: flex;
                    gap: 0.5rem;
                    align-items: center;
                    flex-wrap: wrap;
                    margin-bottom: 1.5rem;
                    padding: 0.75rem;
                    background: #f3f4f6;
                    border-radius: 8px;
                }
                
                .filter-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.25rem 0.5rem;
                    background: #fff;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 0.8rem;
                }
                
                .filter-remove {
                    border: none;
                    background: none;
                    cursor: pointer;
                    font-size: 0.7rem;
                    color: #6b7280;
                }
                
                .filter-remove:hover { color: #dc2626; }
                
                /* Sections */
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                
                .section-header h3 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 600;
                }
                
                .sop-count {
                    color: #6b7280;
                    font-size: 0.8rem;
                }
                
                /* Most Used */
                .most-used-section {
                    margin-bottom: 2rem;
                    padding-bottom: 1.5rem;
                    border-bottom: 1px solid #f3f4f6;
                    min-width: 0;
                    overflow: hidden;
                }
                
                .most-used-section .section-header h3,
                .completed-checklists-section h3 {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #4b5563;
                }

                .recent-checklists-section .section-header h3 {
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: #1e293b;
                }

                .most-used-list {
                    display: flex;
                    gap: 0.75rem;
                    overflow-x: auto;
                    padding-bottom: 0.5rem;
                }
                
                .most-used-card {
                    flex-shrink: 0;
                    width: 160px;
                    background: #fff;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 0.875rem;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                
                .most-used-card:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                    transform: translateY(-2px);
                }
                
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }
                
                .card-icon { font-size: 1.25rem; }
                
                .usage-badge {
                    background: #fef3c7;
                    color: #92400e;
                    padding: 0.125rem 0.375rem;
                    border-radius: 4px;
                    font-size: 0.65rem;
                    font-weight: 500;
                }
                
                .card-title {
                    margin: 0;
                    font-size: 0.85rem;
                    font-weight: 600;
                    line-height: 1.3;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                /* SOP Groups */
                .sop-groups {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                
                .sop-group {
                    background: #fff;
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    overflow: hidden;
                }
                
                .sop-group-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1rem;
                    background: linear-gradient(to right, var(--folder-color, #6366f1)10, transparent);
                    border-bottom: 1px solid #e5e7eb;
                    cursor: pointer;
                    overflow: hidden;
                }
                
                .sop-group-header:hover {
                    background: linear-gradient(to right, var(--folder-color, #6366f1)15, #f9fafb);
                }
                
                .collapse-btn {
                    width: 20px;
                    height: 20px;
                    border: none;
                    background: none;
                    cursor: pointer;
                    font-size: 0.7rem;
                    color: #6b7280;
                }
                
                .group-icon { font-size: 1rem; }
                .group-name { flex: 1; font-weight: 600; font-size: 0.9rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .group-count {
                    background: var(--folder-color, #6366f1);
                    color: #fff;
                    padding: 0.125rem 0.5rem;
                    border-radius: 999px;
                    font-size: 0.7rem;
                    font-weight: 500;
                }
                
                .sop-group-content {
                    max-height: 2000px;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                }
                
                .sop-group-content.collapsed {
                    max-height: 0;
                }
                
                /* SOP Cards */
                .sop-card {
                    display: flex;
                    justify-content: space-between;
                    gap: 1rem;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid #f3f4f6;
                    position: relative;
                    transition: background 0.2s ease;
                    overflow: hidden;
                }
                
                .sop-card:last-child {
                    border-bottom: none;
                }
                
                .sop-card:hover {
                    background: #fafafa;
                }
                
                .sop-card.recently-edited {
                    background: linear-gradient(to right, #fef3c710, transparent);
                    border-left: 3px solid #f59e0b;
                }
                
                .recent-badge {
                    position: absolute;
                    top: 0.5rem;
                    right: 0.5rem;
                    background: #fef3c7;
                    color: #92400e;
                    padding: 0.125rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.65rem;
                    font-weight: 500;
                }
                
                .sop-card-main {
                    flex: 1;
                    min-width: 0;
                }
                
                .sop-card-header {
                    margin-bottom: 0.375rem;
                }
                
                .sop-status {
                    padding: 0.125rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.65rem;
                    font-weight: 500;
                    text-transform: uppercase;
                }
                
                .status-active { background: #d1fae5; color: #065f46; }
                .status-draft { background: #fef3c7; color: #92400e; }
                .status-archived { background: #e5e7eb; color: #6b7280; }
                
                .sop-title {
                    margin: 0 0 0.375rem;
                    font-size: 0.95rem;
                    font-weight: 600;
                    line-height: 1.4;
                    overflow-wrap: anywhere;
                    word-break: break-word;
                }
                
                .sop-description {
                    margin: 0 0 0.5rem;
                    color: #6b7280;
                    font-size: 0.8rem;
                    line-height: 1.5;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                .sop-meta {
                    display: flex;
                    gap: 1rem;
                    font-size: 0.75rem;
                    color: #9ca3af;
                    line-height: 1.4;
                }
                
                .sop-tags {
                    margin-top: 0.5rem;
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                    overflow: hidden;
                }
                
                .tag {
                    color: #6366f1;
                    font-size: 0.7rem;
                }
                
                /* Hashtag styling */
                .hashtag {
                    color: #6366f1;
                    cursor: pointer;
                    transition: all 0.15s;
                    border-radius: 3px;
                    padding: 0 2px;
                }
                
                .hashtag:hover {
                    background: #e0e7ff;
                    color: #4338ca;
                }
                
                .hashtag.active {
                    background: #6366f1;
                    color: #fff;
                }
                
                .filter-badge-hashtag {
                    background: #e0e7ff !important;
                    color: #4338ca !important;
                }
                
                .sop-card-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                    flex-shrink: 0;
                }
                
                .action-btn {
                    padding: 0.375rem 0.75rem;
                    border: 1px solid #f3f4f6;
                    border-radius: 6px;
                    background: #fff;
                    cursor: pointer;
                    font-size: 0.75rem;
                    color: #9ca3af;
                    transition: all 0.2s ease;
                    line-height: 1.4;
                }
                
                .action-btn:hover { 
                    background: #f9fafb;
                    border-color: #d1d5db;
                    color: #374151;
                }
                
                .edit-btn:hover {
                    background: #eff6ff;
                    border-color: #bfdbfe;
                    color: #1d4ed8;
                }
                
                .delete-btn {
                    color: #6b7280;
                }
                
                .delete-btn:hover {
                    background: #fef2f2;
                    border-color: #fecaca;
                    color: #b91c1c;
                }
                
                .checklist-btn {
                    background: #f0fdf4;
                    border-color: #bbf7d0;
                    color: #15803d;
                }
                
                .checklist-btn:hover {
                    background: #dcfce7;
                    border-color: #86efac;
                }
                
                /* Recent Checklists - primary action area when present */
                .recent-checklists-section {
                    margin-bottom: 1.5rem;
                    padding: 1rem 1.25rem;
                    background: #fafafe;
                    border: 1px solid #e0e7ff;
                    border-radius: 10px;
                    overflow: hidden;
                }
                
                .checklists-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                
                .checklist-card {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                    padding: 0.75rem 1rem;
                    background: #fff;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                
                .checklist-card:hover {
                    border-color: #d1d5db;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                }
                
                .checklist-card-main {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    flex: 1;
                    min-width: 0;
                }
                
                .checklist-folder {
                    font-size: 1.25rem;
                }
                
                .checklist-info {
                    flex: 1;
                    min-width: 0;
                }
                
                .checklist-info h4 {
                    margin: 0 0 0.25rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .checklist-progress {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.75rem;
                    color: #6b7280;
                }
                
                .mini-progress-bar {
                    width: 80px;
                    height: 4px;
                    background: #e5e7eb;
                    border-radius: 2px;
                    overflow: hidden;
                }
                
                .mini-progress-fill {
                    height: 100%;
                    background: #6366f1;
                    border-radius: 2px;
                }
                
                .btn-resume {
                    padding: 0.375rem 0.875rem;
                    background: #6366f1;
                    color: #fff;
                    border: none;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    white-space: nowrap;
                    box-shadow: 0 1px 3px rgba(99, 102, 241, 0.2);
                }
                
                .btn-resume:hover {
                    background: #4f46e5;
                    box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
                }
                
                /* Completed Checklists Section */
                .completed-checklists-section {
                    margin-top: 1.5rem;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1.5rem;
                    border-bottom: 1px solid #f3f4f6;
                }
                
                .completed-checklists-section.collapsed {
                    padding-bottom: 0.75rem;
                    margin-bottom: 1rem;
                }
                
                .section-header-collapsible {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                    user-select: none;
                }
                
                .section-header-collapsible:hover {
                    opacity: 0.8;
                }
                
                .collapse-arrow {
                    background: none;
                    border: none;
                    font-size: 0.75rem;
                    color: #6b7280;
                    cursor: pointer;
                    padding: 0.25rem 0.5rem;
                    transition: transform 0.2s ease;
                }
                
                .collapse-arrow:hover {
                    color: #374151;
                }
                
                .collapse-arrow.collapsed {
                    transform: rotate(-90deg);
                }
                
                .completed-count {
                    font-size: 0.875rem;
                    font-weight: 400;
                    color: #6b7280;
                }
                
                .checklists-list.hidden {
                    display: none;
                }
                
                .completed-checklist-card {
                    background: #f9fafb;
                }
                
                .completed-checklist-card:hover {
                    background: #f3f4f6;
                }
                
                .checklist-complete-icon {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #22c55e;
                    color: #fff;
                    border-radius: 50%;
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                
                .checklist-completed-date {
                    font-size: 0.75rem;
                    color: #6b7280;
                }
                
                .btn-view-completed {
                    padding: 0.375rem 0.75rem;
                    background: #e5e7eb;
                    color: #374151;
                    border: none;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 500;
                    cursor: pointer;
                    white-space: nowrap;
                }
                
                .btn-view-completed:hover {
                    background: #d1d5db;
                }
                
                /* Empty State */
                .empty-state {
                    text-align: center;
                    padding: 3rem 2rem;
                    background: #fff;
                    border: 2px dashed #e5e7eb;
                    border-radius: 12px;
                }
                
                .empty-state p {
                    margin: 0 0 1rem;
                    color: #6b7280;
                    line-height: 1.5;
                }
                
                .empty-state-welcome {
                    padding: 2.5rem 2rem;
                    max-width: 480px;
                    margin: 0 auto;
                    border-style: solid;
                    border-color: #e5e7eb;
                }
                
                .welcome-header {
                    margin-bottom: 1.75rem;
                }
                
                .welcome-title {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: #374151;
                    margin: 0 0 0.625rem;
                    line-height: 1.4;
                }
                
                .welcome-subtitle {
                    font-size: 0.9rem;
                    color: #6b7280;
                    margin: 0;
                    line-height: 1.6;
                }
                
                .welcome-why {
                    background: #f9fafb;
                    border-radius: 8px;
                    padding: 1.125rem 1.25rem;
                    margin-bottom: 1.75rem;
                    text-align: left;
                }
                
                .why-title {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #374151;
                    margin: 0 0 0.5rem;
                    line-height: 1.4;
                }
                
                .why-text {
                    font-size: 0.8rem;
                    color: #6b7280;
                    margin: 0;
                    line-height: 1.6;
                }
                
                .welcome-actions {
                    margin-bottom: 1.75rem;
                }
                
                .welcome-starter {
                    margin-bottom: 1.5rem;
                    padding-bottom: 1.5rem;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .starter-label {
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: #6b7280;
                    margin: 0 0 0.375rem;
                    line-height: 1.4;
                }
                
                .starter-idea {
                    font-size: 0.8rem;
                    color: #9ca3af;
                    margin: 0;
                    line-height: 1.6;
                }
                
                .trust-notice {
                    margin-top: 0;
                    padding-top: 0;
                    border-top: none;
                }
                
                .trust-notice p {
                    font-size: 0.75rem;
                    color: #9ca3af;
                    margin: 0 0 0.5rem;
                    line-height: 1.4;
                }
                
                .trust-notice p:last-child {
                    margin-bottom: 0;
                }
                
                .empty-message {
                    color: #9ca3af;
                    font-size: 0.8rem;
                    text-align: center;
                }
                
                /* Modal */
                .modal-overlay {
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
                
                .modal-content {
                    background: #fff;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 400px;
                    overflow: hidden;
                }
                
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .modal-header h3 { margin: 0; font-size: 1rem; }
                
                .btn-close {
                    width: 28px;
                    height: 28px;
                    border: none;
                    background: #f3f4f6;
                    border-radius: 6px;
                    cursor: pointer;
                }
                
                .btn-close:hover { background: #e5e7eb; }
                
                .modal-body {
                    padding: 1.25rem;
                }
                
                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.5rem;
                    padding: 1rem 1.25rem;
                    border-top: 1px solid #e5e7eb;
                    background: #f9fafb;
                }
                
                .form-group {
                    margin-bottom: 1rem;
                }
                
                .form-group:last-child { margin-bottom: 0; }
                
                .form-group label {
                    display: block;
                    margin-bottom: 0.375rem;
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: #374151;
                }
                
                .form-input {
                    width: 100%;
                    padding: 0.625rem 0.75rem;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 0.9rem;
                    box-sizing: border-box;
                }
                
                .form-input:focus {
                    outline: none;
                    border-color: #6366f1;
                }
                
                .icon-picker, .color-picker {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.375rem;
                }
                
                .icon-option {
                    width: 36px;
                    height: 36px;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    background: #fff;
                    cursor: pointer;
                    font-size: 1.1rem;
                }
                
                .icon-option:hover { background: #f3f4f6; }
                .icon-option.selected {
                    border-color: #6366f1;
                    background: #eff6ff;
                }
                
                .color-option {
                    width: 28px;
                    height: 28px;
                    border: 2px solid transparent;
                    border-radius: 6px;
                    cursor: pointer;
                }
                
                .color-option:hover { transform: scale(1.1); }
                .color-option.selected { border-color: #1f2937; }
                
                /* Notification */
                .notification-toast {
                    position: fixed;
                    bottom: 1.5rem;
                    right: 1.5rem;
                    padding: 0.875rem 1.25rem;
                    background: #1f2937;
                    color: #fff;
                    border-radius: 8px;
                    font-size: 0.875rem;
                    z-index: 1001;
                    animation: slideIn 0.3s ease;
                }
                
                .notification-toast.success { background: #059669; }
                .notification-toast.error { background: #dc2626; }
                
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                
                /* Responsive */
                @media (max-width: 768px) {
                    .dashboard-layout {
                        grid-template-columns: 1fr;
                        grid-template-rows: auto 1fr;
                    }
                    .dashboard-sidebar {
                        height: auto;
                        position: static;
                        border-right: none;
                        border-bottom: 1px solid #e5e7eb;
                        overflow: hidden;
                    }
                    .sidebar-header {
                        padding: 0.75rem 1rem;
                        border-bottom: none;
                    }
                    .sidebar-header h3 {
                        font-size: 0.85rem;
                    }
                    .folder-list {
                        display: flex;
                        overflow-x: auto;
                        padding: 0 0.75rem 0.75rem;
                        gap: 0.375rem;
                        -webkit-overflow-scrolling: touch;
                    }
                    .folder-item {
                        flex-shrink: 0;
                        padding: 0.375rem 0.75rem;
                        border-left: none;
                        border-radius: 999px;
                        border: 1px solid #e5e7eb;
                        background: #fff;
                        gap: 0.375rem;
                        white-space: nowrap;
                    }
                    .folder-item.active {
                        border-color: var(--folder-color, #6366f1);
                        background: #eff6ff;
                    }
                    .folder-item:hover {
                        background: #f9fafb;
                    }
                    .folder-actions {
                        display: none;
                    }
                    .folder-count {
                        font-size: 0.65rem;
                        padding: 0.0625rem 0.375rem;
                    }
                    .dashboard-main {
                        padding: 1rem;
                    }
                    .dashboard-header {
                        gap: 0.5rem;
                    }
                    .search-container {
                        min-width: 0;
                    }
                    .sop-card { flex-direction: column; }
                    .sop-card-actions { flex-direction: row; }
                }
            `;
            
            document.head.appendChild(styles);
        }
        
        // ====================================================================
        // PUBLIC API
        // ====================================================================
        
        on(event, callback) {
            const valid = ['onCreateSOP', 'onEditSOP', 'onDeleteSOP', 'onRunChecklist', 'onResumeChecklist', 'onViewCompletedChecklist'];
            if (valid.includes(event)) {
                this.callbacks[event] = callback;
            }
        }
        
        refresh() {
            this._loadData();
            this._render();
            this._attachEventListeners();
        }
        
        getFolders() {
            return [...this.state.folders];
        }
        
        getAllSOPs() {
            return [...this.state.sops];
        }
        
        getSOP(sopId) {
            return this.state.sops.find(s => s.id === sopId) || null;
        }
        
        _escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    function createDashboard(container, options = {}) {
        return new Dashboard(container, options);
    }

    global.Dashboard = Dashboard;
    global.createDashboard = createDashboard;
    global.DASHBOARD_STORAGE_KEYS = STORAGE_KEYS;
    global.FOLDER_COLORS = FOLDER_COLORS;
    global.FOLDER_ICONS = FOLDER_ICONS;

    console.log('✅ Enhanced Dashboard module loaded');

})(typeof window !== 'undefined' ? window : this);
