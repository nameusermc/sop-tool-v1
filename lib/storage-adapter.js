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
     * Get current user ID for scoping
     */
    function _getUserId() {
        return _state.user?.id || null;
    }

    /**
     * CRITICAL: Check if we should perform cloud operations
     * Returns true ONLY if user explicitly signed in during this session
     */
    function _canSync() {
        // Must be authenticated
        if (!_state.isAuthenticated) {
            return false;
        }
        // Must have a valid user
        if (!_state.user || !_state.user.id) {
            return false;
        }
        // Must have Supabase available
        if (!_hasSupabase()) {
            return false;
        }
        // Must be online
        if (!_state.isOnline) {
            return false;
        }
        return true;
    }

    /**
     * Debug log for sync operations
     */
    function _syncLog(action, details = {}) {
        const userId = _getUserId();
        console.log(`[StorageAdapter:Sync] ${action}`, {
            user_id: userId ? userId.substring(0, 8) + '...' : 'none',
            authenticated: _state.isAuthenticated,
            canSync: _canSync(),
            ...details
        });
    }

    /**
     * Sync a single SOP to Supabase (fire-and-forget with logging)
     * ONLY runs if user is authenticated and _canSync() returns true
     */
    function _syncSOP(sop) {
        if (!_canSync()) {
            return; // Silently skip - not authenticated or can't sync
        }
        
        _syncLog('Uploading SOP', { title: sop.title, id: sop.id });
        
        SupabaseClient.saveSOP(sop)
            .then(result => {
                if (result.success) {
                    _syncLog('SOP uploaded OK', { title: sop.title });
                } else {
                    console.warn('[StorageAdapter] SOP upload failed:', sop.title, result.error);
                }
            })
            .catch(e => {
                console.warn('[StorageAdapter] SOP sync error:', sop.title, e.message);
            });
    }

    /**
     * Sync a single folder to Supabase (fire-and-forget with logging)
     */
    function _syncFolder(folder) {
        if (!_canSync()) {
            return; // Silently skip
        }
        if (folder.id === 'general' || folder.id?.startsWith('folder_default_')) {
            return; // Skip default folders
        }
        
        _syncLog('Uploading folder', { name: folder.name });
        
        SupabaseClient.saveFolder(folder)
            .then(result => {
                if (!result.success) {
                    console.warn('[StorageAdapter] Folder upload failed:', folder.name, result.error);
                }
            })
            .catch(e => {
                console.warn('[StorageAdapter] Folder sync error:', folder.name, e.message);
            });
    }

    /**
     * Sync a single checklist to Supabase (fire-and-forget with logging)
     */
    function _syncChecklist(checklist) {
        if (!_canSync()) {
            return; // Silently skip
        }
        
        _syncLog('Uploading checklist', { sopTitle: checklist.sopTitle });
        
        SupabaseClient.saveChecklist(checklist)
            .then(result => {
                if (!result.success) {
                    console.warn('[StorageAdapter] Checklist upload failed:', checklist.sopTitle, result.error);
                }
            })
            .catch(e => {
                console.warn('[StorageAdapter] Checklist sync error:', checklist.sopTitle, e.message);
            });
    }

    /**
     * Merge two arrays by ID/title, preferring items with newer updatedAt
     * Returns merged array with all unique items
     */
    function _mergeByIdOrTitle(localItems, cloudItems, idField = 'id', titleField = 'title') {
        const merged = new Map();
        
        // Add all local items first
        localItems.forEach(item => {
            const key = item[idField] || item[titleField];
            merged.set(key, item);
        });
        
        // Merge cloud items - only add if local doesn't have it, or cloud is newer
        cloudItems.forEach(cloudItem => {
            const key = cloudItem[idField] || cloudItem[titleField];
            const localItem = merged.get(key);
            
            if (!localItem) {
                // Cloud has item that local doesn't - add it
                merged.set(key, cloudItem);
            } else {
                // Both have it - keep the one with newer updatedAt
                const localTime = localItem.updatedAt || localItem.createdAt || 0;
                const cloudTime = cloudItem.updatedAt || cloudItem.createdAt || 0;
                
                if (cloudTime > localTime) {
                    merged.set(key, cloudItem);
                }
                // else keep local (it's newer or same age)
            }
        });
        
        return Array.from(merged.values());
    }

    /**
     * Perform initial sync on login with SMART MERGE (not blind overwrite)
     * 
     * CRITICAL: This function should ONLY be called after explicit signIn/signUp
     * It should NEVER be called automatically on page load or session restoration
     * 
     * Strategy:
     * - If local has data and cloud is empty → upload local to cloud
     * - If cloud has data and local is empty → pull cloud to local
     * - If BOTH have data → merge by ID/title, newest wins, then sync merged set to both
     */
    async function _performInitialSync() {
        // CRITICAL: Triple-check we should be doing this
        if (!_canSync()) {
            console.log('[StorageAdapter] Sync blocked - not authenticated or cannot sync');
            return;
        }
        
        if (_state.syncInProgress) {
            console.log('[StorageAdapter] Sync already in progress - skipping');
            return;
        }

        _state.syncInProgress = true;
        
        const userId = _getUserId();
        _syncLog('Starting initial sync', { user_id: userId });

        try {
            // Get local data
            const localSOPs = _get(STORAGE_KEYS.SOPS, []);
            const localFolders = _get(STORAGE_KEYS.FOLDERS, []);
            const localChecklists = _get(STORAGE_KEYS.CHECKLISTS, []);
            
            // Get cloud data
            const [cloudSOPs, cloudFolders, cloudChecklists] = await Promise.all([
                SupabaseClient.fetchSOPs(),
                SupabaseClient.fetchFolders(),
                SupabaseClient.fetchChecklists()
            ]);

            _syncLog('Data counts', {
                local_sops: localSOPs.length,
                cloud_sops: cloudSOPs.length,
                local_folders: localFolders.length,
                cloud_folders: cloudFolders.length,
                local_checklists: localChecklists.length,
                cloud_checklists: cloudChecklists.length
            });

            const hasLocal = localSOPs.length > 0 || localFolders.length > 0 || localChecklists.length > 0;
            const hasCloud = cloudSOPs.length > 0 || cloudFolders.length > 0 || cloudChecklists.length > 0;

            if (hasLocal && !hasCloud) {
                // CASE 1: Local only → upload to cloud
                _syncLog('UPLOAD: Local has data, cloud empty - uploading');
                
                await SupabaseClient.uploadLocalData({
                    sops: localSOPs,
                    folders: localFolders,
                    checklists: localChecklists
                });
                
                _set(STORAGE_KEYS.SYNC_STATUS, { lastSync: Date.now(), direction: 'upload' });
                _syncLog('Upload complete');
                
            } else if (!hasLocal && hasCloud) {
                // CASE 2: Cloud only → pull to local
                _syncLog('PULL: Cloud has data, local empty - pulling');
                
                _set(STORAGE_KEYS.SOPS, cloudSOPs);
                _set(STORAGE_KEYS.FOLDERS, cloudFolders);
                _set(STORAGE_KEYS.CHECKLISTS, cloudChecklists);
                
                _set(STORAGE_KEYS.SYNC_STATUS, { lastSync: Date.now(), direction: 'pull' });
                _syncLog('Pull complete');
                
            } else if (hasLocal && hasCloud) {
                // CASE 3: BOTH have data → MERGE (don't blindly overwrite!)
                _syncLog('MERGE: Both local and cloud have data - merging');
                
                // Merge SOPs by title (since local IDs don't map to cloud IDs)
                const mergedSOPs = _mergeByIdOrTitle(localSOPs, cloudSOPs, 'title', 'title');
                
                // Merge folders by name
                const mergedFolders = _mergeByIdOrTitle(localFolders, cloudFolders, 'name', 'name');
                
                // Merge checklists by sopTitle + status combo
                const mergedChecklists = _mergeByIdOrTitle(localChecklists, cloudChecklists, 'id', 'sopTitle');
                
                _syncLog('Merge result', {
                    merged_sops: mergedSOPs.length,
                    merged_folders: mergedFolders.length,
                    merged_checklists: mergedChecklists.length
                });
                
                // Write merged data to localStorage
                _set(STORAGE_KEYS.SOPS, mergedSOPs);
                _set(STORAGE_KEYS.FOLDERS, mergedFolders);
                _set(STORAGE_KEYS.CHECKLISTS, mergedChecklists);
                
                // Upload merged data to cloud (so cloud has everything local has)
                _syncLog('Uploading merged data to cloud');
                for (const sop of mergedSOPs) {
                    await SupabaseClient.saveSOP(sop).catch(e => 
                        console.warn('[StorageAdapter] Merge upload SOP failed:', e.message)
                    );
                }
                for (const folder of mergedFolders) {
                    if (folder.id !== 'general' && !folder.id?.startsWith('folder_default_')) {
                        await SupabaseClient.saveFolder(folder).catch(e => 
                            console.warn('[StorageAdapter] Merge upload folder failed:', e.message)
                        );
                    }
                }
                for (const cl of mergedChecklists) {
                    await SupabaseClient.saveChecklist(cl).catch(e => 
                        console.warn('[StorageAdapter] Merge upload checklist failed:', e.message)
                    );
                }
                
                _set(STORAGE_KEYS.SYNC_STATUS, { lastSync: Date.now(), direction: 'merge' });
                _syncLog('Merge complete');
                
            } else {
                // CASE 4: Both empty - nothing to do
                _syncLog('SKIP: Both local and cloud are empty');
            }

            // Notify listeners
            _notifyDataListeners('sync_complete');

        } catch (e) {
            console.error('[StorageAdapter] Initial sync failed:', e);
            _syncLog('Sync FAILED', { error: e.message });
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
            // Always save to localStorage first (source of truth)
            _set(STORAGE_KEYS.SOPS, sops);
            
            // Debug log
            _syncLog('saveSops called', { 
                count: sops.length, 
                willSync: _canSync()
            });
            
            // Sync to cloud if authenticated (fire-and-forget)
            if (_canSync()) {
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
            // Always save to localStorage first (source of truth)
            _set(STORAGE_KEYS.FOLDERS, folders);
            
            // Debug log
            _syncLog('saveFolders called', { 
                count: folders.length, 
                willSync: _canSync()
            });
            
            // Sync to cloud if authenticated (fire-and-forget)
            if (_canSync()) {
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
            // Always save to localStorage first (source of truth)
            _set(STORAGE_KEYS.CHECKLISTS, checklists);
            
            // Debug log
            _syncLog('saveChecklists called', { 
                count: checklists.length, 
                willSync: _canSync()
            });
            
            // Sync to cloud if authenticated (fire-and-forget)
            if (_canSync()) {
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
    // NOTE: This listener updates auth state but does NOT trigger any cloud sync
    // Cloud sync ONLY happens on explicit signIn() or signUp() calls
    if (typeof window !== 'undefined') {
        window.addEventListener('load', () => {
            if (_hasSupabase() && SupabaseClient.onAuthStateChange) {
                SupabaseClient.onAuthStateChange((event, session) => {
                    console.log('[StorageAdapter] Auth event:', event);
                    
                    if (event === 'SIGNED_IN' && session?.user) {
                        // Update local auth state only - NO SYNC
                        // Sync only happens in explicit signIn/signUp methods
                        _state.isAuthenticated = true;
                        _state.user = session.user;
                        _notifyAuthListeners(true, session.user);
                        console.log('[StorageAdapter] Auth state updated (no sync on session restore)');
                    } else if (event === 'SIGNED_OUT') {
                        _state.isAuthenticated = false;
                        _state.user = null;
                        _notifyAuthListeners(false, null);
                        console.log('[StorageAdapter] Signed out - local data preserved');
                    }
                    // Ignore other events like INITIAL_SESSION, TOKEN_REFRESHED, etc.
                });
            }
        });
    }

    // Export
    global.StorageAdapter = StorageAdapter;

    console.log('[StorageAdapter] Ready');

})(typeof window !== 'undefined' ? window : this);
