/**
 * StorageAdapter - Unified Storage Layer
 * 
 * Provides localStorage persistence with optional API sync.
 * Works in local-only mode by default; API sync activates when authenticated.
 * 
 * CRITICAL: This must be loaded BEFORE the modules (dashboard.js, sop-create.js, checklist.js)
 * 
 * @version 2.0.0
 */

(function(global) {
    'use strict';

    console.log('[StorageAdapter] Initializing...');

    // ========================================================================
    // STORAGE KEYS
    // ========================================================================

    const STORAGE_KEYS = {
        SOPS: 'sop_tool_sops',
        FOLDERS: 'sop_tool_folders',
        CHECKLISTS: 'sop_tool_checklists',
        SOP_USAGE: 'sop_tool_sop_usage',
        DASHBOARD_PREFS: 'sop_tool_dashboard_prefs',
        DRAFTS: 'sop_tool_drafts',
        AUTH_STATE: 'sop_tool_auth_state',
        SYNC_QUEUE: 'sop_tool_sync_queue'
    };

    // ========================================================================
    // INTERNAL STATE
    // ========================================================================

    const _state = {
        isAuthenticated: false,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        user: null,
        syncQueue: [],
        listeners: []
    };

    // ========================================================================
    // CORE LOCALSTORAGE HELPERS
    // ========================================================================

    // IMPORTANT: Capture original methods BEFORE any override happens
    const _nativeGetItem = localStorage.getItem.bind(localStorage);
    const _nativeSetItem = localStorage.setItem.bind(localStorage);
    const _nativeRemoveItem = localStorage.removeItem.bind(localStorage);

    /**
     * Safely get from localStorage (using native methods)
     */
    function _get(key, defaultValue = null) {
        try {
            const item = _nativeGetItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item);
        } catch (e) {
            console.warn('[StorageAdapter] Failed to parse', key, e);
            return defaultValue;
        }
    }

    /**
     * Safely set to localStorage (using native methods)
     */
    function _set(key, value) {
        try {
            _nativeSetItem(key, JSON.stringify(value));
            console.log('[StorageAdapter] Saved to localStorage:', key);
            return true;
        } catch (e) {
            console.error('[StorageAdapter] Failed to save', key, e);
            return false;
        }
    }

    /**
     * Remove from localStorage (using native methods)
     */
    function _remove(key) {
        try {
            _nativeRemoveItem(key);
            return true;
        } catch (e) {
            return false;
        }
    }

    // ========================================================================
    // API HELPERS (for authenticated users)
    // ========================================================================

    async function _apiCall(endpoint, method = 'GET', body = null) {
        if (!_state.isAuthenticated || !_state.isOnline) {
            return null;
        }

        try {
            const options = {
                method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            };

            if (body) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(`/api${endpoint}`, options);
            
            if (response.status === 204) {
                return { success: true };
            }
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            return await response.json();
        } catch (e) {
            console.warn('[StorageAdapter] API call failed:', endpoint, e.message);
            return null;
        }
    }

    /**
     * Queue an operation for later sync
     */
    function _queueSync(operation) {
        _state.syncQueue.push({
            ...operation,
            timestamp: Date.now()
        });
        _set(STORAGE_KEYS.SYNC_QUEUE, _state.syncQueue);
        console.log('[StorageAdapter] Queued for sync:', operation.type);
    }

    /**
     * Process sync queue when online
     */
    async function _processQueue() {
        if (!_state.isAuthenticated || !_state.isOnline || _state.syncQueue.length === 0) {
            return;
        }

        console.log('[StorageAdapter] Processing sync queue:', _state.syncQueue.length, 'items');
        
        const queue = [..._state.syncQueue];
        _state.syncQueue = [];

        for (const op of queue) {
            try {
                switch (op.type) {
                    case 'sop_create':
                    case 'sop_update':
                        await _apiCall(`/sops${op.id ? '/' + op.id : ''}`, op.id ? 'PUT' : 'POST', op.data);
                        break;
                    case 'sop_delete':
                        await _apiCall(`/sops/${op.id}`, 'DELETE');
                        break;
                    case 'folder_create':
                    case 'folder_update':
                        await _apiCall(`/folders${op.id ? '/' + op.id : ''}`, op.id ? 'PUT' : 'POST', op.data);
                        break;
                    case 'folder_delete':
                        await _apiCall(`/folders/${op.id}`, 'DELETE');
                        break;
                    case 'checklist_create':
                    case 'checklist_update':
                        await _apiCall(`/checklists${op.id ? '/' + op.id : ''}`, op.id ? 'PUT' : 'POST', op.data);
                        break;
                    case 'checklist_delete':
                        await _apiCall(`/checklists/${op.id}`, 'DELETE');
                        break;
                }
            } catch (e) {
                console.warn('[StorageAdapter] Sync failed for', op.type, '- re-queueing');
                _state.syncQueue.push(op);
            }
        }

        _set(STORAGE_KEYS.SYNC_QUEUE, _state.syncQueue);
    }

    // ========================================================================
    // ONLINE/OFFLINE HANDLING
    // ========================================================================

    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
            console.log('[StorageAdapter] Back online');
            _state.isOnline = true;
            _processQueue();
        });

        window.addEventListener('offline', () => {
            console.log('[StorageAdapter] Gone offline');
            _state.isOnline = false;
        });
    }

    // ========================================================================
    // PUBLIC API - DATA ACCESS
    // ========================================================================

    const StorageAdapter = {
        STORAGE_KEYS,

        // ----------------------------------------------------------------
        // SOPs
        // ----------------------------------------------------------------
        
        getSops() {
            return _get(STORAGE_KEYS.SOPS, []);
        },

        saveSops(sops) {
            _set(STORAGE_KEYS.SOPS, sops);
        },

        // ----------------------------------------------------------------
        // Folders
        // ----------------------------------------------------------------
        
        getFolders() {
            return _get(STORAGE_KEYS.FOLDERS, []);
        },

        saveFolders(folders) {
            _set(STORAGE_KEYS.FOLDERS, folders);
        },

        // ----------------------------------------------------------------
        // Checklists
        // ----------------------------------------------------------------
        
        getChecklists() {
            return _get(STORAGE_KEYS.CHECKLISTS, []);
        },

        saveChecklists(checklists) {
            _set(STORAGE_KEYS.CHECKLISTS, checklists);
        },

        // ----------------------------------------------------------------
        // Usage tracking
        // ----------------------------------------------------------------
        
        getSopUsage() {
            return _get(STORAGE_KEYS.SOP_USAGE, {});
        },

        saveSopUsage(usage) {
            _set(STORAGE_KEYS.SOP_USAGE, usage);
        },

        // ----------------------------------------------------------------
        // Dashboard preferences
        // ----------------------------------------------------------------
        
        getDashboardPrefs() {
            return _get(STORAGE_KEYS.DASHBOARD_PREFS, {});
        },

        saveDashboardPrefs(prefs) {
            _set(STORAGE_KEYS.DASHBOARD_PREFS, prefs);
        },

        // ----------------------------------------------------------------
        // Drafts
        // ----------------------------------------------------------------
        
        getDraft() {
            return _get(STORAGE_KEYS.DRAFTS, null);
        },

        saveDraft(draft) {
            _set(STORAGE_KEYS.DRAFTS, draft);
        },

        clearDraft() {
            _remove(STORAGE_KEYS.DRAFTS);
        },

        // ----------------------------------------------------------------
        // Auth state
        // ----------------------------------------------------------------
        
        Auth: {
            isAuthenticated() {
                return _state.isAuthenticated;
            },

            getUser() {
                return _state.user;
            },

            async checkSession() {
                try {
                    const result = await _apiCall('/auth/session');
                    if (result?.data?.authenticated) {
                        _state.isAuthenticated = true;
                        _state.user = result.data.user;
                        return true;
                    }
                } catch (e) {
                    console.warn('[StorageAdapter] Session check failed');
                }
                _state.isAuthenticated = false;
                _state.user = null;
                return false;
            },

            async login(email, password) {
                const result = await _apiCall('/auth/login', 'POST', { email, password });
                if (result?.data?.user) {
                    _state.isAuthenticated = true;
                    _state.user = result.data.user;
                    _processQueue();
                    return result.data;
                }
                throw new Error(result?.error || 'Login failed');
            },

            async register(email, password, displayName) {
                const result = await _apiCall('/auth/register', 'POST', { email, password, displayName });
                if (result?.data?.user) {
                    if (!result.data.requiresConfirmation) {
                        _state.isAuthenticated = true;
                        _state.user = result.data.user;
                    }
                    return result.data;
                }
                throw new Error(result?.error || 'Registration failed');
            },

            async logout() {
                await _apiCall('/auth/logout', 'POST');
                _state.isAuthenticated = false;
                _state.user = null;
            },

            setAuthenticated(authenticated, user = null) {
                _state.isAuthenticated = authenticated;
                _state.user = user;
                if (authenticated) {
                    _processQueue();
                }
            }
        },

        // ----------------------------------------------------------------
        // Sync
        // ----------------------------------------------------------------
        
        Sync: {
            hasLocalData() {
                const sops = _get(STORAGE_KEYS.SOPS, []);
                const checklists = _get(STORAGE_KEYS.CHECKLISTS, []);
                const folders = _get(STORAGE_KEYS.FOLDERS, []);
                return sops.length > 0 || checklists.length > 0 || folders.length > 0;
            },

            async syncToServer() {
                if (!_state.isAuthenticated) {
                    throw new Error('Not authenticated');
                }

                const data = {
                    sops: _get(STORAGE_KEYS.SOPS, []),
                    checklists: _get(STORAGE_KEYS.CHECKLISTS, []),
                    folders: _get(STORAGE_KEYS.FOLDERS, [])
                };

                const result = await _apiCall('/user/sync', 'POST', data);
                return result?.data;
            },

            getPendingCount() {
                return _state.syncQueue.length;
            },

            onSyncStatus(callback) {
                _state.listeners.push(callback);
            }
        },

        // ----------------------------------------------------------------
        // Utilities
        // ----------------------------------------------------------------
        
        isOnline() {
            return _state.isOnline;
        },

        onDataChange(callback) {
            // For future use
        },

        // Queue an operation for API sync
        queueOperation(type, data, id = null) {
            if (_state.isAuthenticated) {
                _queueSync({ type, data, id });
            }
        }
    };

    // Load sync queue from storage
    _state.syncQueue = _get(STORAGE_KEYS.SYNC_QUEUE, []);

    // Export
    global.StorageAdapter = StorageAdapter;

    console.log('[StorageAdapter] Ready');

})(typeof window !== 'undefined' ? window : this);
