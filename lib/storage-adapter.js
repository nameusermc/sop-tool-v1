/**
 * StorageAdapter - Unified Storage Layer
 * 
 * Provides localStorage persistence with optional Supabase cloud sync.
 * 
 * BEHAVIOR:
 * - Logged OUT: localStorage only (current behavior preserved)
 * - Logged IN: localStorage + Supabase sync
 *   - On login: upload local data if no cloud data, else pull cloud data
 *   - On changes: persist to both localStorage and Supabase
 * 
 * CRITICAL: This must be loaded BEFORE the modules (dashboard.js, sop-create.js, checklist.js)
 * 
 * @version 3.0.0
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
        SYNC_STATUS: 'sop_tool_sync_status'
    };

    // ========================================================================
    // INTERNAL STATE
    // ========================================================================

    const _state = {
        isAuthenticated: false,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        user: null,
        syncInProgress: false,
        authListeners: [],
        dataListeners: []
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
    // SUPABASE SYNC HELPERS
    // ========================================================================

    /**
     * Check if SupabaseClient is available
     */
    function _hasSupabase() {
        return typeof SupabaseClient !== 'undefined' && SupabaseClient !== null;
    }

    /**
     * Sync a single SOP to Supabase (non-blocking)
     */
    async function _syncSOP(sop) {
        if (!_state.isAuthenticated || !_hasSupabase() || !_state.isOnline) return;
        try {
            await SupabaseClient.saveSOP(sop);
        } catch (e) {
            console.warn('[StorageAdapter] Failed to sync SOP:', e.message);
        }
    }

    /**
     * Sync a single folder to Supabase (non-blocking)
     */
    async function _syncFolder(folder) {
        if (!_state.isAuthenticated || !_hasSupabase() || !_state.isOnline) return;
        if (folder.id === 'general') return; // Skip default folder
        try {
            await SupabaseClient.saveFolder(folder);
        } catch (e) {
            console.warn('[StorageAdapter] Failed to sync folder:', e.message);
        }
    }

    /**
     * Sync a single checklist to Supabase (non-blocking)
     */
    async function _syncChecklist(checklist) {
        if (!_state.isAuthenticated || !_hasSupabase() || !_state.isOnline) return;
        try {
            await SupabaseClient.saveChecklist(checklist);
        } catch (e) {
            console.warn('[StorageAdapter] Failed to sync checklist:', e.message);
        }
    }

    /**
     * Perform initial sync on login
     * - If no cloud data: upload local data to cloud
     * - If cloud data exists: pull cloud data and hydrate localStorage
     */
    async function _performInitialSync() {
        if (!_hasSupabase() || _state.syncInProgress) return;

        _state.syncInProgress = true;
        console.log('[StorageAdapter] Performing initial sync...');

        try {
            const hasCloud = await SupabaseClient.hasCloudData();
            
            if (hasCloud) {
                // Cloud data exists - pull and hydrate localStorage
                console.log('[StorageAdapter] Cloud data found - pulling...');
                
                const [cloudSOPs, cloudFolders, cloudChecklists] = await Promise.all([
                    SupabaseClient.fetchSOPs(),
                    SupabaseClient.fetchFolders(),
                    SupabaseClient.fetchChecklists()
                ]);

                // Hydrate localStorage with cloud data
                if (cloudSOPs.length > 0) _set(STORAGE_KEYS.SOPS, cloudSOPs);
                if (cloudFolders.length > 0) _set(STORAGE_KEYS.FOLDERS, cloudFolders);
                if (cloudChecklists.length > 0) _set(STORAGE_KEYS.CHECKLISTS, cloudChecklists);

                console.log('[StorageAdapter] Pulled from cloud:', {
                    sops: cloudSOPs.length,
                    folders: cloudFolders.length,
                    checklists: cloudChecklists.length
                });

                _set(STORAGE_KEYS.SYNC_STATUS, { lastSync: Date.now(), direction: 'pull' });
                
            } else {
                // No cloud data - upload local data
                const localSOPs = _get(STORAGE_KEYS.SOPS, []);
                const localFolders = _get(STORAGE_KEYS.FOLDERS, []);
                const localChecklists = _get(STORAGE_KEYS.CHECKLISTS, []);

                if (localSOPs.length > 0 || localFolders.length > 0 || localChecklists.length > 0) {
                    console.log('[StorageAdapter] No cloud data - uploading local data...');
                    
                    const result = await SupabaseClient.uploadLocalData({
                        sops: localSOPs,
                        folders: localFolders,
                        checklists: localChecklists
                    });

                    if (result.success) {
                        console.log('[StorageAdapter] Local data uploaded to cloud');
                        _set(STORAGE_KEYS.SYNC_STATUS, { lastSync: Date.now(), direction: 'push' });
                    } else {
                        console.warn('[StorageAdapter] Upload failed:', result.error);
                    }
                } else {
                    console.log('[StorageAdapter] No local data to upload');
                }
            }

            // Notify listeners
            _notifyDataListeners('sync_complete');

        } catch (e) {
            console.error('[StorageAdapter] Initial sync failed:', e);
        } finally {
            _state.syncInProgress = false;
        }
    }

    /**
     * Notify auth state change listeners
     */
    function _notifyAuthListeners(isAuthenticated, user) {
        _state.authListeners.forEach(fn => {
            try { fn(isAuthenticated, user); } catch (e) { console.error(e); }
        });
    }

    /**
     * Notify data change listeners
     */
    function _notifyDataListeners(event) {
        _state.dataListeners.forEach(fn => {
            try { fn(event); } catch (e) { console.error(e); }
        });
    }

    // ========================================================================
    // ONLINE/OFFLINE HANDLING
    // ========================================================================

    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
            console.log('[StorageAdapter] Back online');
            _state.isOnline = true;
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
            // Always save to localStorage first (fallback)
            _set(STORAGE_KEYS.SOPS, sops);
            
            // Sync to cloud if authenticated (non-blocking)
            if (_state.isAuthenticated && _hasSupabase() && _state.isOnline) {
                // Find changed SOPs and sync them
                sops.forEach(sop => _syncSOP(sop));
            }
        },

        // ----------------------------------------------------------------
        // Folders
        // ----------------------------------------------------------------
        
        getFolders() {
            return _get(STORAGE_KEYS.FOLDERS, []);
        },

        saveFolders(folders) {
            // Always save to localStorage first (fallback)
            _set(STORAGE_KEYS.FOLDERS, folders);
            
            // Sync to cloud if authenticated (non-blocking)
            if (_state.isAuthenticated && _hasSupabase() && _state.isOnline) {
                folders.forEach(folder => _syncFolder(folder));
            }
        },

        // ----------------------------------------------------------------
        // Checklists
        // ----------------------------------------------------------------
        
        getChecklists() {
            return _get(STORAGE_KEYS.CHECKLISTS, []);
        },

        saveChecklists(checklists) {
            // Always save to localStorage first (fallback)
            _set(STORAGE_KEYS.CHECKLISTS, checklists);
            
            // Sync to cloud if authenticated (non-blocking)
            if (_state.isAuthenticated && _hasSupabase() && _state.isOnline) {
                checklists.forEach(cl => _syncChecklist(cl));
            }
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

            /**
             * Initialize auth state from Supabase session
             * Call this on app startup
             */
            async init() {
                if (!_hasSupabase()) {
                    console.log('[StorageAdapter] Supabase not available - local-only mode');
                    return false;
                }

                try {
                    const { user, session } = await SupabaseClient.getSession();
                    if (session && user) {
                        _state.isAuthenticated = true;
                        _state.user = user;
                        console.log('[StorageAdapter] Session restored for:', user.email);
                        _notifyAuthListeners(true, user);
                        return true;
                    }
                } catch (e) {
                    console.warn('[StorageAdapter] Session check failed:', e);
                }
                
                _state.isAuthenticated = false;
                _state.user = null;
                return false;
            },

            /**
             * Sign up with email/password
             */
            async signUp(email, password) {
                if (!_hasSupabase()) {
                    throw new Error('Cloud sync not available');
                }

                const result = await SupabaseClient.signUp(email, password);
                
                if (result.error) {
                    throw new Error(result.error);
                }

                if (result.session && result.user) {
                    _state.isAuthenticated = true;
                    _state.user = result.user;
                    console.log('[StorageAdapter] Signed up:', result.user.email);
                    _notifyAuthListeners(true, result.user);
                    
                    // Perform initial sync after signup
                    await _performInitialSync();
                }

                return result;
            },

            /**
             * Sign in with email/password
             */
            async signIn(email, password) {
                if (!_hasSupabase()) {
                    throw new Error('Cloud sync not available');
                }

                const result = await SupabaseClient.signIn(email, password);
                
                if (result.error) {
                    throw new Error(result.error);
                }

                if (result.session && result.user) {
                    _state.isAuthenticated = true;
                    _state.user = result.user;
                    console.log('[StorageAdapter] Signed in:', result.user.email);
                    _notifyAuthListeners(true, result.user);
                    
                    // Perform initial sync after login
                    await _performInitialSync();
                }

                return result;
            },

            /**
             * Sign out
             */
            async signOut() {
                if (!_hasSupabase()) return;

                try {
                    await SupabaseClient.signOut();
                } catch (e) {
                    console.warn('[StorageAdapter] Sign out error:', e);
                }

                _state.isAuthenticated = false;
                _state.user = null;
                console.log('[StorageAdapter] Signed out');
                _notifyAuthListeners(false, null);
                
                // Note: localStorage data is preserved for offline use
            },

            /**
             * Listen for auth state changes
             */
            onAuthStateChange(callback) {
                _state.authListeners.push(callback);
                return () => {
                    const idx = _state.authListeners.indexOf(callback);
                    if (idx > -1) _state.authListeners.splice(idx, 1);
                };
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

            isSyncing() {
                return _state.syncInProgress;
            },

            getLastSync() {
                return _get(STORAGE_KEYS.SYNC_STATUS, null);
            },

            /**
             * Manually trigger a full sync
             */
            async syncNow() {
                if (!_state.isAuthenticated) {
                    console.log('[StorageAdapter] Not authenticated - skipping sync');
                    return;
                }
                await _performInitialSync();
            },

            /**
             * Listen for data/sync events
             */
            onDataChange(callback) {
                _state.dataListeners.push(callback);
                return () => {
                    const idx = _state.dataListeners.indexOf(callback);
                    if (idx > -1) _state.dataListeners.splice(idx, 1);
                };
            }
        },

        // ----------------------------------------------------------------
        // Utilities
        // ----------------------------------------------------------------
        
        isOnline() {
            return _state.isOnline;
        },

        hasSupabase() {
            return _hasSupabase();
        }
    };

    // ========================================================================
    // SUPABASE AUTH STATE LISTENER
    // ========================================================================

    // Set up auth state change listener when SupabaseClient is available
    if (typeof window !== 'undefined') {
        window.addEventListener('load', () => {
            if (_hasSupabase() && SupabaseClient.onAuthStateChange) {
                SupabaseClient.onAuthStateChange((event, session) => {
                    console.log('[StorageAdapter] Auth event:', event);
                    
                    if (event === 'SIGNED_IN' && session?.user) {
                        _state.isAuthenticated = true;
                        _state.user = session.user;
                        _notifyAuthListeners(true, session.user);
                    } else if (event === 'SIGNED_OUT') {
                        _state.isAuthenticated = false;
                        _state.user = null;
                        _notifyAuthListeners(false, null);
                    }
                });
            }
        });
    }

    // Export
    global.StorageAdapter = StorageAdapter;

    console.log('[StorageAdapter] Ready');

})(typeof window !== 'undefined' ? window : this);
