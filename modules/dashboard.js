/**
 * Dashboard Module - SOP Tool v1
 * 
 * This module handles the main dashboard view including:
 * - SOP listing with folder/category organization
 * - Folder sidebar for filtering
 * - Search functionality
 * - Quick action buttons
 * - Most Used SOPs tracking
 * - Local storage persistence
 * - AI touchpoint placeholders
 * 
 * USAGE:
 * Include via script tag: <script src="modules/dashboard.js"></script>
 * Then instantiate: const dashboard = new Dashboard(document.getElementById('app'));
 * Or use factory: const dashboard = createDashboard('#app');
 * 
 * @module Dashboard
 */

// ============================================================================
// IMMEDIATELY INVOKED FUNCTION TO AVOID GLOBAL POLLUTION
// While still exposing necessary classes to window
// ============================================================================

(function(global) {
    'use strict';

    // ========================================================================
    // DATA STRUCTURES & STORAGE KEYS
    // ========================================================================

    /**
     * Local Storage Keys used by the Dashboard module
     * Centralized for easy modification and consistency
     */
    const STORAGE_KEYS = {
        SOPS: 'sop_tool_sops',                    // All SOP documents
        FOLDERS: 'sop_tool_folders',              // Folder/category structure
        RECENT_CHECKLISTS: 'sop_tool_recent_checklists',  // Recently viewed checklists
        SOP_USAGE: 'sop_tool_sop_usage',          // Usage tracking for "Most Used"
        USER_PREFERENCES: 'sop_tool_user_prefs'   // User dashboard preferences
    };

    /**
     * Default folder structure if none exists
     * Each folder has an id, name, color, and optional icon
     */
    const DEFAULT_FOLDERS = [
        { id: 'general', name: 'General', color: '#6366f1', icon: '📁' },
        { id: 'onboarding', name: 'Onboarding', color: '#22c55e', icon: '👋' },
        { id: 'operations', name: 'Operations', color: '#f59e0b', icon: '⚙️' },
        { id: 'safety', name: 'Safety', color: '#ef4444', icon: '🛡️' },
        { id: 'hr', name: 'HR & Compliance', color: '#8b5cf6', icon: '📋' }
    ];

    /**
     * Sample SOP data structure for reference and initial seeding
     * 
     * SOP Object Structure:
     * {
     *   id: string,           // Unique identifier
     *   title: string,        // SOP title
     *   description: string,  // Brief description
     *   folderId: string,     // Reference to folder
     *   steps: array,         // Array of step objects
     *   createdAt: timestamp, // Creation date
     *   updatedAt: timestamp, // Last modification date
     *   tags: array,          // Searchable tags
     *   status: string        // 'draft' | 'active' | 'archived'
     * }
     */
    const SAMPLE_SOPS = [
        {
            id: 'sop_001',
            title: 'New Employee Onboarding',
            description: 'Complete checklist for onboarding new team members',
            folderId: 'onboarding',
            steps: [
                { id: 's1', text: 'Send welcome email', order: 1 },
                { id: 's2', text: 'Set up workstation', order: 2 },
                { id: 's3', text: 'Schedule orientation meeting', order: 3 }
            ],
            createdAt: Date.now() - 86400000 * 7,
            updatedAt: Date.now() - 86400000 * 2,
            tags: ['hr', 'new hire', 'setup'],
            status: 'active'
        },
        {
            id: 'sop_002',
            title: 'Daily Safety Inspection',
            description: 'Standard safety checks to perform each morning',
            folderId: 'safety',
            steps: [
                { id: 's1', text: 'Check emergency exits', order: 1 },
                { id: 's2', text: 'Verify fire extinguishers', order: 2 },
                { id: 's3', text: 'Inspect first aid kits', order: 3 }
            ],
            createdAt: Date.now() - 86400000 * 14,
            updatedAt: Date.now() - 86400000 * 1,
            tags: ['safety', 'daily', 'inspection'],
            status: 'active'
        },
        {
            id: 'sop_003',
            title: 'Equipment Maintenance',
            description: 'Monthly maintenance procedures for office equipment',
            folderId: 'operations',
            steps: [
                { id: 's1', text: 'Clean and dust equipment', order: 1 },
                { id: 's2', text: 'Check for wear and tear', order: 2 },
                { id: 's3', text: 'Update maintenance log', order: 3 }
            ],
            createdAt: Date.now() - 86400000 * 30,
            updatedAt: Date.now() - 86400000 * 5,
            tags: ['maintenance', 'equipment', 'monthly'],
            status: 'active'
        }
    ];

    // ========================================================================
    // DASHBOARD MODULE CLASS
    // ========================================================================

    /**
     * Dashboard Class
     * Main controller for the dashboard view and functionality
     */
    class Dashboard {
        /**
         * Initialize the Dashboard module
         * @param {HTMLElement} containerElement - The DOM element to render the dashboard into
         * @param {Object} options - Configuration options
         */
        constructor(containerElement, options = {}) {
            // Handle string selector or element
            if (typeof containerElement === 'string') {
                containerElement = document.querySelector(containerElement);
            }
            
            // Validate container
            if (!containerElement) {
                throw new Error('Dashboard: Container element not found');
            }
            
            // Store reference to the container element
            this.container = containerElement;
            
            // Configuration options with defaults
            this.options = {
                showMostUsed: true,           // Show "Most Used SOPs" section
                mostUsedLimit: 5,             // Number of SOPs to show in "Most Used"
                recentChecklistsLimit: 5,     // Number of recent checklists to track
                enableAIFeatures: true,       // Enable AI touchpoint placeholders
                autoRender: true,             // Automatically render on initialization
                ...options
            };
            
            // Internal state
            this.state = {
                sops: [],                     // All SOPs
                folders: [],                  // All folders
                filteredSops: [],             // SOPs after filtering
                selectedFolderId: null,       // Currently selected folder filter
                searchQuery: '',              // Current search query
                sopUsage: {}                  // Usage count per SOP
            };
            
            // Event callbacks (for integration with other modules)
            this.callbacks = {
                onCreateSOP: null,            // Called when "Create New SOP" clicked
                onViewSOP: null,              // Called when an SOP is selected
                onViewChecklists: null,       // Called when "View Recent Checklists" clicked
                onEditSOP: null,              // Called when edit action triggered
                onDeleteSOP: null             // Called when delete action triggered
            };
            
            // Initialize the dashboard
            this._init();
        }
        
        // ====================================================================
        // INITIALIZATION
        // ====================================================================
        
        /**
         * Initialize the dashboard - load data and render
         * @private
         */
        _init() {
            this._loadData();
            if (this.options.autoRender) {
                this._render();
                this._attachEventListeners();
            }
        }
        
        /**
         * Load all data from local storage
         * Seeds with sample data if first run
         * @private
         */
        _loadData() {
            // Load folders (or use defaults)
            const storedFolders = localStorage.getItem(STORAGE_KEYS.FOLDERS);
            if (storedFolders) {
                this.state.folders = JSON.parse(storedFolders);
            } else {
                this.state.folders = [...DEFAULT_FOLDERS];
                this._saveFolders();
            }
            
            // Load SOPs (or seed with samples)
            const storedSops = localStorage.getItem(STORAGE_KEYS.SOPS);
            if (storedSops) {
                this.state.sops = JSON.parse(storedSops);
            } else {
                this.state.sops = [...SAMPLE_SOPS];
                this._saveSops();
            }
            
            // Load usage tracking data
            const storedUsage = localStorage.getItem(STORAGE_KEYS.SOP_USAGE);
            if (storedUsage) {
                this.state.sopUsage = JSON.parse(storedUsage);
            } else {
                // Initialize usage counts
                this.state.sopUsage = {};
                this.state.sops.forEach(sop => {
                    this.state.sopUsage[sop.id] = Math.floor(Math.random() * 20); // Sample data
                });
                this._saveUsage();
            }
            
            // Initialize filtered SOPs to all SOPs
            this.state.filteredSops = [...this.state.sops];
        }
        
        // ====================================================================
        // DATA PERSISTENCE
        // ====================================================================
        
        /**
         * Save SOPs to local storage
         * @private
         */
        _saveSops() {
            localStorage.setItem(STORAGE_KEYS.SOPS, JSON.stringify(this.state.sops));
        }
        
        /**
         * Save folders to local storage
         * @private
         */
        _saveFolders() {
            localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(this.state.folders));
        }
        
        /**
         * Save usage data to local storage
         * @private
         */
        _saveUsage() {
            localStorage.setItem(STORAGE_KEYS.SOP_USAGE, JSON.stringify(this.state.sopUsage));
        }
        
        /**
         * Track SOP usage for "Most Used" feature
         * @param {string} sopId - The ID of the SOP being accessed
         */
        trackUsage(sopId) {
            if (!this.state.sopUsage[sopId]) {
                this.state.sopUsage[sopId] = 0;
            }
            this.state.sopUsage[sopId]++;
            this._saveUsage();
        }
        
        // ====================================================================
        // RENDERING
        // ====================================================================
        
        /**
         * Main render function - builds entire dashboard UI
         * @private
         */
        _render() {
            this.container.innerHTML = '';
            this.container.className = 'dashboard-container';
            
            // Build dashboard structure
            this.container.innerHTML = `
                <div class="dashboard-layout">
                    <!-- Folder Sidebar -->
                    <aside class="dashboard-sidebar" id="folder-sidebar">
                        <div class="sidebar-header">
                            <h3>📂 Folders</h3>
                        </div>
                        <nav class="folder-list" id="folder-list">
                            ${this._renderFolderList()}
                        </nav>
                        
                        <!-- AI Touchpoint: Suggest Folder Organization -->
                        ${this.options.enableAIFeatures ? `
                        <div class="ai-touchpoint" id="ai-organize-folders">
                            <button class="ai-btn" data-ai-action="organize-folders">
                                ✨ AI: Suggest Folder Organization
                            </button>
                        </div>
                        ` : ''}
                    </aside>
                    
                    <!-- Main Content Area -->
                    <main class="dashboard-main">
                        <!-- Header with Search and Quick Actions -->
                        <header class="dashboard-header">
                            <div class="search-container">
                                <input 
                                    type="text" 
                                    id="sop-search" 
                                    class="search-input" 
                                    placeholder="Search SOPs by title or description..."
                                    value="${this.state.searchQuery}"
                                />
                                <span class="search-icon">🔍</span>
                            </div>
                            
                            <div class="quick-actions">
                                <button class="btn btn-primary" id="btn-create-sop">
                                    ➕ Create New SOP
                                </button>
                                <button class="btn btn-secondary" id="btn-view-checklists">
                                    📋 View Recent Checklists
                                </button>
                            </div>
                        </header>
                        
                        <!-- Most Used SOPs Section (Optional) -->
                        ${this.options.showMostUsed ? `
                        <section class="most-used-section" id="most-used-section">
                            <div class="section-header">
                                <h3>🔥 Most Used SOPs</h3>
                                
                                <!-- AI Touchpoint: Analyze Usage Patterns -->
                                ${this.options.enableAIFeatures ? `
                                <button class="ai-btn-small" data-ai-action="analyze-usage">
                                    ✨ Analyze Patterns
                                </button>
                                ` : ''}
                            </div>
                            <div class="most-used-list" id="most-used-list">
                                ${this._renderMostUsedSops()}
                            </div>
                        </section>
                        ` : ''}
                        
                        <!-- SOP List Section -->
                        <section class="sop-list-section">
                            <div class="section-header">
                                <h3>📄 All SOPs</h3>
                                <span class="sop-count" id="sop-count">
                                    ${this.state.filteredSops.length} SOPs
                                </span>
                            </div>
                            
                            <!-- AI Touchpoint: Bulk Improve -->
                            ${this.options.enableAIFeatures ? `
                            <div class="ai-touchpoint-inline">
                                <button class="ai-btn-small" data-ai-action="bulk-improve">
                                    ✨ AI: Review All SOPs for Improvements
                                </button>
                            </div>
                            ` : ''}
                            
                            <div class="sop-list" id="sop-list">
                                ${this._renderSopList()}
                            </div>
                        </section>
                    </main>
                </div>
            `;
            
            // Inject minimal styles
            this._injectStyles();
        }
        
        /**
         * Render the folder sidebar list
         * @private
         * @returns {string} HTML string for folder list
         */
        _renderFolderList() {
            // "All" option
            let html = `
                <div class="folder-item ${!this.state.selectedFolderId ? 'active' : ''}" 
                     data-folder-id="">
                    <span class="folder-icon">📁</span>
                    <span class="folder-name">All SOPs</span>
                    <span class="folder-count">${this.state.sops.length}</span>
                </div>
            `;
            
            // Individual folders
            this.state.folders.forEach(folder => {
                const count = this.state.sops.filter(s => s.folderId === folder.id).length;
                const isActive = this.state.selectedFolderId === folder.id;
                
                html += `
                    <div class="folder-item ${isActive ? 'active' : ''}" 
                         data-folder-id="${folder.id}"
                         style="--folder-color: ${folder.color}">
                        <span class="folder-icon">${folder.icon || '📁'}</span>
                        <span class="folder-name">${folder.name}</span>
                        <span class="folder-count">${count}</span>
                    </div>
                `;
            });
            
            return html;
        }
        
        /**
         * Render the Most Used SOPs section
         * @private
         * @returns {string} HTML string for most used SOPs
         */
        _renderMostUsedSops() {
            // Sort SOPs by usage count and take top N
            const sortedByUsage = [...this.state.sops]
                .filter(sop => sop.status === 'active')
                .sort((a, b) => {
                    const usageA = this.state.sopUsage[a.id] || 0;
                    const usageB = this.state.sopUsage[b.id] || 0;
                    return usageB - usageA;
                })
                .slice(0, this.options.mostUsedLimit);
            
            if (sortedByUsage.length === 0) {
                return '<p class="empty-message">No usage data yet. Start using SOPs to see trends!</p>';
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
                        <p class="card-folder" style="color: ${folder?.color || '#666'}">
                            ${folder?.name || 'Uncategorized'}
                        </p>
                    </div>
                `;
            }).join('');
        }
        
        /**
         * Render the main SOP list
         * @private
         * @returns {string} HTML string for SOP list
         */
        _renderSopList() {
            if (this.state.filteredSops.length === 0) {
                return `
                    <div class="empty-state">
                        <p>📭 No SOPs found matching your criteria.</p>
                        <button class="btn btn-primary" id="btn-create-sop-empty">
                            Create your first SOP
                        </button>
                    </div>
                `;
            }
            
            return this.state.filteredSops.map(sop => {
                const folder = this.state.folders.find(f => f.id === sop.folderId);
                const updatedDate = new Date(sop.updatedAt).toLocaleDateString();
                const stepCount = sop.steps?.length || 0;
                
                return `
                    <div class="sop-card" data-sop-id="${sop.id}">
                        <div class="sop-card-main">
                            <div class="sop-card-header">
                                <span class="sop-icon">${folder?.icon || '📄'}</span>
                                <span class="sop-status status-${sop.status}">${sop.status}</span>
                            </div>
                            
                            <h4 class="sop-title">${this._escapeHtml(sop.title)}</h4>
                            <p class="sop-description">${this._escapeHtml(sop.description)}</p>
                            
                            <div class="sop-meta">
                                <span class="meta-item folder-tag" style="background: ${folder?.color || '#666'}20; color: ${folder?.color || '#666'}">
                                    ${folder?.name || 'Uncategorized'}
                                </span>
                                <span class="meta-item">📝 ${stepCount} steps</span>
                                <span class="meta-item">🕐 ${updatedDate}</span>
                            </div>
                            
                            <!-- Tags -->
                            ${sop.tags && sop.tags.length > 0 ? `
                            <div class="sop-tags">
                                ${sop.tags.slice(0, 3).map(tag => `
                                    <span class="tag">#${this._escapeHtml(tag)}</span>
                                `).join('')}
                            </div>
                            ` : ''}
                        </div>
                        
                        <div class="sop-card-actions">
                            <button class="action-btn view-btn" data-action="view" data-sop-id="${sop.id}" title="View SOP">
                                👁️
                            </button>
                            <button class="action-btn edit-btn" data-action="edit" data-sop-id="${sop.id}" title="Edit SOP">
                                ✏️
                            </button>
                            <button class="action-btn checklist-btn" data-action="checklist" data-sop-id="${sop.id}" title="Run as Checklist">
                                ✅
                            </button>
                            
                            <!-- AI Touchpoint: Improve this SOP -->
                            ${this.options.enableAIFeatures ? `
                            <button class="action-btn ai-btn-icon" data-ai-action="improve-sop" data-sop-id="${sop.id}" title="AI: Suggest Improvements">
                                ✨
                            </button>
                            ` : ''}
                            
                            <button class="action-btn delete-btn" data-action="delete" data-sop-id="${sop.id}" title="Delete SOP">
                                🗑️
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        /**
         * Inject minimal CSS styles for the dashboard
         * @private
         */
        _injectStyles() {
            // Check if styles already injected
            if (document.getElementById('dashboard-styles')) return;
            
            const styles = document.createElement('style');
            styles.id = 'dashboard-styles';
            styles.textContent = `
                /* ============================================
                   Dashboard Module - Minimal CSS
                   ============================================ */
                
                /* Layout */
                .dashboard-container {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: #1f2937;
                    background: #f9fafb;
                    min-height: 100vh;
                }
                
                .dashboard-layout {
                    display: grid;
                    grid-template-columns: 250px 1fr;
                    gap: 0;
                    min-height: 100vh;
                }
                
                /* Sidebar */
                .dashboard-sidebar {
                    background: #ffffff;
                    border-right: 1px solid #e5e7eb;
                    padding: 1.5rem 0;
                    position: sticky;
                    top: 0;
                    height: 100vh;
                    overflow-y: auto;
                }
                
                .sidebar-header {
                    padding: 0 1.5rem 1rem;
                    border-bottom: 1px solid #e5e7eb;
                    margin-bottom: 1rem;
                }
                
                .sidebar-header h3 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 600;
                }
                
                .folder-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1.5rem;
                    cursor: pointer;
                    transition: background 0.15s;
                    border-left: 3px solid transparent;
                }
                
                .folder-item:hover {
                    background: #f3f4f6;
                }
                
                .folder-item.active {
                    background: #eff6ff;
                    border-left-color: var(--folder-color, #6366f1);
                }
                
                .folder-icon {
                    font-size: 1.1rem;
                }
                
                .folder-name {
                    flex: 1;
                    font-size: 0.9rem;
                }
                
                .folder-count {
                    background: #e5e7eb;
                    color: #6b7280;
                    padding: 0.125rem 0.5rem;
                    border-radius: 999px;
                    font-size: 0.75rem;
                }
                
                /* Main Content */
                .dashboard-main {
                    padding: 2rem;
                    max-width: 1200px;
                }
                
                /* Header */
                .dashboard-header {
                    display: flex;
                    gap: 1.5rem;
                    align-items: center;
                    flex-wrap: wrap;
                    margin-bottom: 2rem;
                }
                
                .search-container {
                    position: relative;
                    flex: 1;
                    min-width: 250px;
                }
                
                .search-input {
                    width: 100%;
                    padding: 0.75rem 1rem 0.75rem 2.5rem;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    font-size: 0.95rem;
                    transition: border-color 0.15s, box-shadow 0.15s;
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
                    opacity: 0.5;
                }
                
                .quick-actions {
                    display: flex;
                    gap: 0.75rem;
                }
                
                /* Buttons */
                .btn {
                    padding: 0.75rem 1.25rem;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.15s, transform 0.1s;
                }
                
                .btn:hover {
                    transform: translateY(-1px);
                }
                
                .btn:active {
                    transform: translateY(0);
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
                
                /* Sections */
                .section-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 1rem;
                }
                
                .section-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 600;
                }
                
                .sop-count {
                    color: #6b7280;
                    font-size: 0.875rem;
                }
                
                /* Most Used Section */
                .most-used-section {
                    margin-bottom: 2rem;
                    padding-bottom: 2rem;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .most-used-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                    gap: 1rem;
                }
                
                .most-used-card {
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    padding: 1rem;
                    cursor: pointer;
                    transition: box-shadow 0.15s, transform 0.15s;
                }
                
                .most-used-card:hover {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                    transform: translateY(-2px);
                }
                
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }
                
                .card-icon {
                    font-size: 1.25rem;
                }
                
                .usage-badge {
                    background: #fef3c7;
                    color: #92400e;
                    padding: 0.125rem 0.5rem;
                    border-radius: 999px;
                    font-size: 0.7rem;
                    font-weight: 500;
                }
                
                .card-title {
                    margin: 0 0 0.25rem;
                    font-size: 0.9rem;
                    font-weight: 600;
                    line-height: 1.3;
                }
                
                .card-folder {
                    margin: 0;
                    font-size: 0.75rem;
                    font-weight: 500;
                }
                
                /* SOP List */
                .sop-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                
                .sop-card {
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    padding: 1.25rem;
                    display: flex;
                    justify-content: space-between;
                    gap: 1rem;
                    transition: box-shadow 0.15s;
                }
                
                .sop-card:hover {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                }
                
                .sop-card-main {
                    flex: 1;
                }
                
                .sop-card-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 0.5rem;
                }
                
                .sop-icon {
                    font-size: 1.25rem;
                }
                
                .sop-status {
                    padding: 0.125rem 0.5rem;
                    border-radius: 999px;
                    font-size: 0.7rem;
                    font-weight: 500;
                    text-transform: uppercase;
                }
                
                .status-active {
                    background: #d1fae5;
                    color: #065f46;
                }
                
                .status-draft {
                    background: #fef3c7;
                    color: #92400e;
                }
                
                .status-archived {
                    background: #e5e7eb;
                    color: #6b7280;
                }
                
                .sop-title {
                    margin: 0 0 0.25rem;
                    font-size: 1rem;
                    font-weight: 600;
                }
                
                .sop-description {
                    margin: 0 0 0.75rem;
                    color: #6b7280;
                    font-size: 0.875rem;
                    line-height: 1.4;
                }
                
                .sop-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                    font-size: 0.8rem;
                }
                
                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }
                
                .folder-tag {
                    padding: 0.125rem 0.5rem;
                    border-radius: 4px;
                    font-weight: 500;
                }
                
                .sop-tags {
                    margin-top: 0.75rem;
                    display: flex;
                    gap: 0.5rem;
                }
                
                .tag {
                    color: #6366f1;
                    font-size: 0.75rem;
                }
                
                /* Action Buttons */
                .sop-card-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                
                .action-btn {
                    width: 36px;
                    height: 36px;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    background: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.15s, border-color 0.15s;
                }
                
                .action-btn:hover {
                    background: #f3f4f6;
                }
                
                .delete-btn:hover {
                    background: #fef2f2;
                    border-color: #fecaca;
                }
                
                .ai-btn-icon {
                    background: linear-gradient(135deg, #f0fdf4, #ecfeff);
                    border-color: #a7f3d0;
                }
                
                .ai-btn-icon:hover {
                    background: linear-gradient(135deg, #dcfce7, #cffafe);
                }
                
                /* AI Touchpoints */
                .ai-touchpoint {
                    padding: 1rem 1.5rem;
                    margin-top: auto;
                    border-top: 1px solid #e5e7eb;
                }
                
                .ai-touchpoint-inline {
                    margin-bottom: 1rem;
                }
                
                .ai-btn {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    background: linear-gradient(135deg, #f0fdf4, #ecfeff);
                    border: 1px solid #a7f3d0;
                    border-radius: 8px;
                    color: #065f46;
                    font-size: 0.85rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                
                .ai-btn:hover {
                    background: linear-gradient(135deg, #dcfce7, #cffafe);
                }
                
                .ai-btn-small {
                    padding: 0.5rem 0.75rem;
                    background: linear-gradient(135deg, #f0fdf4, #ecfeff);
                    border: 1px solid #a7f3d0;
                    border-radius: 6px;
                    color: #065f46;
                    font-size: 0.75rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                
                .ai-btn-small:hover {
                    background: linear-gradient(135deg, #dcfce7, #cffafe);
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
                    margin: 0 0 1rem;
                    color: #6b7280;
                }
                
                .empty-message {
                    color: #6b7280;
                    font-size: 0.875rem;
                    text-align: center;
                    padding: 1rem;
                }
                
                /* Responsive */
                @media (max-width: 768px) {
                    .dashboard-layout {
                        grid-template-columns: 1fr;
                    }
                    
                    .dashboard-sidebar {
                        display: none; /* Or implement a mobile menu */
                    }
                    
                    .dashboard-header {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    
                    .quick-actions {
                        justify-content: center;
                    }
                    
                    .sop-card {
                        flex-direction: column;
                    }
                    
                    .sop-card-actions {
                        flex-direction: row;
                        justify-content: flex-end;
                    }
                }
            `;
            
            document.head.appendChild(styles);
        }
        
        // ====================================================================
        // EVENT HANDLING
        // ====================================================================
        
        /**
         * Attach all event listeners
         * @private
         */
        _attachEventListeners() {
            // Search input
            const searchInput = document.getElementById('sop-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this._handleSearch(e.target.value);
                });
            }
            
            // Folder selection
            const folderList = document.getElementById('folder-list');
            if (folderList) {
                folderList.addEventListener('click', (e) => {
                    const folderItem = e.target.closest('.folder-item');
                    if (folderItem) {
                        const folderId = folderItem.dataset.folderId;
                        this._handleFolderSelect(folderId || null);
                    }
                });
            }
            
            // Quick action buttons
            document.getElementById('btn-create-sop')?.addEventListener('click', () => {
                this._handleCreateSOP();
            });
            
            document.getElementById('btn-view-checklists')?.addEventListener('click', () => {
                this._handleViewChecklists();
            });
            
            // SOP list actions (event delegation)
            const sopList = document.getElementById('sop-list');
            if (sopList) {
                sopList.addEventListener('click', (e) => {
                    const actionBtn = e.target.closest('[data-action]');
                    const aiBtn = e.target.closest('[data-ai-action]');
                    
                    if (actionBtn) {
                        const action = actionBtn.dataset.action;
                        const sopId = actionBtn.dataset.sopId;
                        this._handleSopAction(action, sopId);
                    }
                    
                    if (aiBtn) {
                        const aiAction = aiBtn.dataset.aiAction;
                        const sopId = aiBtn.dataset.sopId;
                        this._handleAIAction(aiAction, sopId);
                    }
                });
            }
            
            // Most used cards click
            const mostUsedList = document.getElementById('most-used-list');
            if (mostUsedList) {
                mostUsedList.addEventListener('click', (e) => {
                    const card = e.target.closest('.most-used-card');
                    if (card) {
                        const sopId = card.dataset.sopId;
                        this._handleSopAction('view', sopId);
                    }
                });
            }
            
            // AI touchpoint buttons (global)
            document.querySelectorAll('[data-ai-action]').forEach(btn => {
                if (!btn.closest('#sop-list')) { // Don't double-bind
                    btn.addEventListener('click', (e) => {
                        const aiAction = e.currentTarget.dataset.aiAction;
                        this._handleAIAction(aiAction);
                    });
                }
            });
            
            // Empty state create button
            document.getElementById('btn-create-sop-empty')?.addEventListener('click', () => {
                this._handleCreateSOP();
            });
        }
        
        /**
         * Handle search input
         * @private
         * @param {string} query - Search query
         */
        _handleSearch(query) {
            this.state.searchQuery = query.toLowerCase().trim();
            this._applyFilters();
        }
        
        /**
         * Handle folder selection
         * @private
         * @param {string|null} folderId - Selected folder ID or null for all
         */
        _handleFolderSelect(folderId) {
            this.state.selectedFolderId = folderId;
            this._applyFilters();
            this._updateFolderActiveState();
        }
        
        /**
         * Apply all active filters (search + folder) and update display
         * @private
         */
        _applyFilters() {
            // Start with all SOPs
            let filtered = [...this.state.sops];
            
            // Apply folder filter
            if (this.state.selectedFolderId) {
                filtered = filtered.filter(sop => sop.folderId === this.state.selectedFolderId);
            }
            
            // Apply search filter
            if (this.state.searchQuery) {
                filtered = filtered.filter(sop => {
                    const titleMatch = sop.title.toLowerCase().includes(this.state.searchQuery);
                    const descMatch = sop.description.toLowerCase().includes(this.state.searchQuery);
                    const tagMatch = sop.tags?.some(tag => 
                        tag.toLowerCase().includes(this.state.searchQuery)
                    );
                    return titleMatch || descMatch || tagMatch;
                });
            }
            
            this.state.filteredSops = filtered;
            
            // Update the SOP list
            const sopListEl = document.getElementById('sop-list');
            const sopCountEl = document.getElementById('sop-count');
            
            if (sopListEl) {
                sopListEl.innerHTML = this._renderSopList();
            }
            
            if (sopCountEl) {
                sopCountEl.textContent = `${filtered.length} SOPs`;
            }
        }
        
        /**
         * Update folder active state in sidebar
         * @private
         */
        _updateFolderActiveState() {
            const folderItems = document.querySelectorAll('.folder-item');
            folderItems.forEach(item => {
                const folderId = item.dataset.folderId;
                if (folderId === (this.state.selectedFolderId || '')) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        }
        
        /**
         * Handle SOP action (view, edit, checklist, delete)
         * @private
         * @param {string} action - Action type
         * @param {string} sopId - SOP ID
         */
        _handleSopAction(action, sopId) {
            const sop = this.state.sops.find(s => s.id === sopId);
            if (!sop) return;
            
            switch (action) {
                case 'view':
                    // Track usage for "Most Used" feature
                    this.trackUsage(sopId);
                    
                    if (this.callbacks.onViewSOP) {
                        this.callbacks.onViewSOP(sop);
                    } else {
                        console.log('View SOP:', sop);
                        // Default behavior - could show a modal
                    }
                    break;
                    
                case 'edit':
                    if (this.callbacks.onEditSOP) {
                        this.callbacks.onEditSOP(sop);
                    } else {
                        console.log('Edit SOP:', sop);
                    }
                    break;
                    
                case 'checklist':
                    this.trackUsage(sopId);
                    
                    if (this.callbacks.onViewChecklists) {
                        // Could navigate to checklist with this SOP
                        this.callbacks.onViewChecklists(sop);
                    } else {
                        console.log('Run as checklist:', sop);
                    }
                    break;
                    
                case 'delete':
                    if (confirm(`Are you sure you want to delete "${sop.title}"?`)) {
                        this._deleteSOP(sopId);
                        
                        if (this.callbacks.onDeleteSOP) {
                            this.callbacks.onDeleteSOP(sop);
                        }
                    }
                    break;
            }
        }
        
        /**
         * Handle Create SOP button click
         * @private
         */
        _handleCreateSOP() {
            if (this.callbacks.onCreateSOP) {
                this.callbacks.onCreateSOP();
            } else {
                console.log('Create New SOP clicked');
                // Default behavior - could show a creation modal
            }
        }
        
        /**
         * Handle View Checklists button click
         * @private
         */
        _handleViewChecklists() {
            if (this.callbacks.onViewChecklists) {
                this.callbacks.onViewChecklists();
            } else {
                console.log('View Recent Checklists clicked');
            }
        }
        
        // ====================================================================
        // AI TOUCHPOINT HANDLERS
        // ====================================================================
        
        /**
         * Handle AI action triggers
         * These are placeholder hooks for AI integration
         * 
         * @private
         * @param {string} action - AI action type
         * @param {string} [sopId] - Optional SOP ID for SOP-specific actions
         */
        _handleAIAction(action, sopId = null) {
            /**
             * AI TOUCHPOINT DOCUMENTATION
             * 
             * This method handles various AI-powered features. Each action
             * is designed to be connected to an AI service (e.g., OpenAI, Claude).
             * 
             * Integration points:
             * 1. Replace console.log with actual API calls
             * 2. Add loading states while AI processes
             * 3. Handle responses and update UI accordingly
             * 4. Add error handling for failed API calls
             */
            
            switch (action) {
                case 'organize-folders':
                    /**
                     * AI Touchpoint: Suggest Folder Organization
                     * 
                     * Purpose: Analyze existing SOPs and suggest better folder structure
                     * 
                     * Input: All SOPs, current folders
                     * Expected Output: Suggested folder structure with SOP assignments
                     * 
                     * Example prompt: "Analyze these SOPs and suggest an optimal
                     * folder organization based on their content and purpose..."
                     */
                    console.log('🤖 AI Action: Suggest Folder Organization');
                    console.log('Input data:', {
                        sops: this.state.sops,
                        currentFolders: this.state.folders
                    });
                    
                    // Placeholder for AI integration
                    this._showAIPlaceholderMessage(
                        'Analyzing your SOPs to suggest an optimal folder structure...'
                    );
                    break;
                    
                case 'analyze-usage':
                    /**
                     * AI Touchpoint: Analyze Usage Patterns
                     * 
                     * Purpose: Identify trends and suggest improvements based on usage
                     * 
                     * Input: Usage data, SOPs
                     * Expected Output: Insights about usage patterns, recommendations
                     * 
                     * Example prompt: "Analyze these SOP usage patterns and provide
                     * insights about which procedures might need updating..."
                     */
                    console.log('🤖 AI Action: Analyze Usage Patterns');
                    console.log('Input data:', {
                        usage: this.state.sopUsage,
                        sops: this.state.sops
                    });
                    
                    this._showAIPlaceholderMessage(
                        'Analyzing usage patterns to identify trends and recommendations...'
                    );
                    break;
                    
                case 'bulk-improve':
                    /**
                     * AI Touchpoint: Bulk Review for Improvements
                     * 
                     * Purpose: Review all SOPs for clarity, completeness, consistency
                     * 
                     * Input: All SOPs
                     * Expected Output: List of suggestions per SOP
                     * 
                     * Example prompt: "Review these SOPs for clarity, completeness,
                     * and consistency. Suggest improvements for each..."
                     */
                    console.log('🤖 AI Action: Bulk Review SOPs');
                    console.log('Input data:', this.state.sops);
                    
                    this._showAIPlaceholderMessage(
                        'Reviewing all SOPs for potential improvements...'
                    );
                    break;
                    
                case 'improve-sop':
                    /**
                     * AI Touchpoint: Improve Specific SOP
                     * 
                     * Purpose: Suggest improvements for a single SOP
                     * 
                     * Input: Single SOP object
                     * Expected Output: Specific suggestions for steps, language, structure
                     * 
                     * Example prompt: "Review this SOP and suggest improvements for
                     * step clarity, action language, and completeness..."
                     */
                    const sop = this.state.sops.find(s => s.id === sopId);
                    console.log('🤖 AI Action: Improve SOP', sopId);
                    console.log('Input data:', sop);
                    
                    this._showAIPlaceholderMessage(
                        `Analyzing "${sop?.title}" for improvement suggestions...`
                    );
                    break;
                    
                default:
                    console.log('Unknown AI action:', action);
            }
        }
        
        /**
         * Show a placeholder message for AI features
         * Replace this with actual AI response handling
         * @private
         * @param {string} message - Loading/placeholder message
         */
        _showAIPlaceholderMessage(message) {
            // Simple alert for demonstration
            // In production, replace with a modal or toast notification
            alert(`✨ AI Feature Placeholder\n\n${message}\n\nThis is where AI integration would happen.`);
        }
        
        // ====================================================================
        // PUBLIC API
        // ====================================================================
        
        /**
         * Add a new SOP
         * @public
         * @param {Object} sop - SOP object to add
         * @returns {Object} The added SOP with generated ID
         */
        addSOP(sop) {
            const newSop = {
                id: `sop_${Date.now()}`,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                status: 'draft',
                tags: [],
                steps: [],
                ...sop
            };
            
            this.state.sops.push(newSop);
            this.state.sopUsage[newSop.id] = 0;
            this._saveSops();
            this._saveUsage();
            this._applyFilters();
            
            // Update most used section if visible
            const mostUsedList = document.getElementById('most-used-list');
            if (mostUsedList) {
                mostUsedList.innerHTML = this._renderMostUsedSops();
            }
            
            return newSop;
        }
        
        /**
         * Update an existing SOP
         * @public
         * @param {string} sopId - ID of SOP to update
         * @param {Object} updates - Fields to update
         * @returns {Object|null} Updated SOP or null if not found
         */
        updateSOP(sopId, updates) {
            const index = this.state.sops.findIndex(s => s.id === sopId);
            if (index === -1) return null;
            
            this.state.sops[index] = {
                ...this.state.sops[index],
                ...updates,
                updatedAt: Date.now()
            };
            
            this._saveSops();
            this._applyFilters();
            
            return this.state.sops[index];
        }
        
        /**
         * Delete an SOP
         * @private
         * @param {string} sopId - ID of SOP to delete
         */
        _deleteSOP(sopId) {
            this.state.sops = this.state.sops.filter(s => s.id !== sopId);
            delete this.state.sopUsage[sopId];
            
            this._saveSops();
            this._saveUsage();
            this._applyFilters();
            
            // Update folder counts
            const folderList = document.getElementById('folder-list');
            if (folderList) {
                folderList.innerHTML = this._renderFolderList();
            }
            
            // Update most used section
            const mostUsedList = document.getElementById('most-used-list');
            if (mostUsedList) {
                mostUsedList.innerHTML = this._renderMostUsedSops();
            }
        }
        
        /**
         * Get all SOPs
         * @public
         * @returns {Array} Array of all SOPs
         */
        getAllSOPs() {
            return [...this.state.sops];
        }
        
        /**
         * Get SOP by ID
         * @public
         * @param {string} sopId - SOP ID
         * @returns {Object|null} SOP object or null
         */
        getSOP(sopId) {
            return this.state.sops.find(s => s.id === sopId) || null;
        }
        
        /**
         * Get all folders
         * @public
         * @returns {Array} Array of all folders
         */
        getFolders() {
            return [...this.state.folders];
        }
        
        /**
         * Add a new folder
         * @public
         * @param {Object} folder - Folder object
         * @returns {Object} The added folder
         */
        addFolder(folder) {
            const newFolder = {
                id: `folder_${Date.now()}`,
                icon: '📁',
                color: '#6366f1',
                ...folder
            };
            
            this.state.folders.push(newFolder);
            this._saveFolders();
            
            // Update sidebar
            const folderList = document.getElementById('folder-list');
            if (folderList) {
                folderList.innerHTML = this._renderFolderList();
            }
            
            return newFolder;
        }
        
        /**
         * Register callback functions for integration with other modules
         * @public
         * @param {string} event - Event name
         * @param {Function} callback - Callback function
         */
        on(event, callback) {
            const validEvents = ['onCreateSOP', 'onViewSOP', 'onViewChecklists', 'onEditSOP', 'onDeleteSOP'];
            
            if (validEvents.includes(event)) {
                this.callbacks[event] = callback;
            } else {
                console.warn(`Unknown event: ${event}. Valid events: ${validEvents.join(', ')}`);
            }
        }
        
        /**
         * Refresh the dashboard view
         * @public
         */
        refresh() {
            this._loadData();
            this._render();
            this._attachEventListeners();
        }
        
        /**
         * Render the dashboard (useful if autoRender was false)
         * @public
         */
        render() {
            this._render();
            this._attachEventListeners();
        }
        
        /**
         * Destroy the dashboard and clean up
         * @public
         */
        destroy() {
            this.container.innerHTML = '';
            const styles = document.getElementById('dashboard-styles');
            if (styles) {
                styles.remove();
            }
        }
        
        // ====================================================================
        // UTILITY FUNCTIONS
        // ====================================================================
        
        /**
         * Escape HTML to prevent XSS
         * @private
         * @param {string} text - Text to escape
         * @returns {string} Escaped text
         */
        _escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    }

    // ========================================================================
    // FACTORY FUNCTION
    // ========================================================================

    /**
     * Factory function to create a new Dashboard instance
     * @param {HTMLElement|string} container - Container element or selector
     * @param {Object} options - Configuration options
     * @returns {Dashboard} Dashboard instance
     */
    function createDashboard(container, options = {}) {
        return new Dashboard(container, options);
    }

    // ========================================================================
    // EXPOSE TO GLOBAL SCOPE
    // ========================================================================

    // Make Dashboard and createDashboard globally accessible
    global.Dashboard = Dashboard;
    global.createDashboard = createDashboard;
    global.DASHBOARD_STORAGE_KEYS = STORAGE_KEYS;

    // Log successful load for debugging
    console.log('✅ Dashboard module loaded successfully');

})(typeof window !== 'undefined' ? window : this);
