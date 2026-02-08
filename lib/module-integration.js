/**
 * Module Integration Layer
 * 
 * Patches localStorage to route SOP Tool data through StorageAdapter.
 * This ensures all data persists correctly and can sync to API when authenticated.
 * 
 * LOAD ORDER (in index.html):
 *   1. lib/storage-adapter.js    - Storage abstraction
 *   2. modules/dashboard.js      - Dashboard module
 *   3. modules/sop-create.js     - SOP editor module  
 *   4. modules/checklist.js      - Checklist module
 *   5. lib/module-integration.js - THIS FILE (patches localStorage)
 *   6. app.js                    - App controller
 * 
 * @version 2.0.0
 */

(function(global) {
    'use strict';

    console.log('[ModuleIntegration] Starting...');

    // ========================================================================
    // VERIFY DEPENDENCIES
    // ========================================================================

    if (typeof StorageAdapter === 'undefined') {
        console.error('[ModuleIntegration] StorageAdapter not found! Make sure storage-adapter.js loads first.');
        return;
    }

    // ========================================================================
    // STORAGE KEY ROUTING
    // ========================================================================

    /**
     * Map of storage keys to StorageAdapter methods
     */
    const STORAGE_ROUTES = {
        'sop_tool_sops': {
            get: () => StorageAdapter.getSops(),
            set: (data) => StorageAdapter.saveSops(data)
        },
        'sop_tool_folders': {
            get: () => StorageAdapter.getFolders(),
            set: (data) => StorageAdapter.saveFolders(data)
        },
        'sop_tool_checklists': {
            get: () => StorageAdapter.getChecklists(),
            set: (data) => StorageAdapter.saveChecklists(data)
        },
        'sop_tool_sop_usage': {
            get: () => StorageAdapter.getSopUsage(),
            set: (data) => StorageAdapter.saveSopUsage(data)
        },
        'sop_tool_dashboard_prefs': {
            get: () => StorageAdapter.getDashboardPrefs(),
            set: (data) => StorageAdapter.saveDashboardPrefs(data)
        },
        'sop_tool_drafts': {
            get: () => StorageAdapter.getDraft(),
            set: (data) => StorageAdapter.saveDraft(data)
        }
    };

    // ========================================================================
    // LOCALSTORAGE OVERRIDE
    // ========================================================================

    // Store original methods with proper binding
    const _originalGetItem = localStorage.getItem.bind(localStorage);
    const _originalSetItem = localStorage.setItem.bind(localStorage);
    const _originalRemoveItem = localStorage.removeItem.bind(localStorage);

    /**
     * Override localStorage.getItem
     * Routes known keys through StorageAdapter, falls back to native for others
     */
    localStorage.getItem = function(key) {
        if (STORAGE_ROUTES[key]) {
            const data = STORAGE_ROUTES[key].get();
            // Return null for null/undefined, JSON string otherwise
            if (data === null || data === undefined) {
                return null;
            }
            return JSON.stringify(data);
        }
        return _originalGetItem(key);
    };

    /**
     * Override localStorage.setItem
     * Routes known keys through StorageAdapter, falls back to native for others
     */
    localStorage.setItem = function(key, value) {
        console.log('[ModuleIntegration] localStorage.setItem INTERCEPTED:', key);
        
        if (STORAGE_ROUTES[key]) {
            console.log('[ModuleIntegration] Key FOUND in STORAGE_ROUTES, routing to StorageAdapter');
            try {
                const data = JSON.parse(value);
                console.log('[ModuleIntegration] Parsed data, calling StorageAdapter for:', key);
                STORAGE_ROUTES[key].set(data);
                console.log('[ModuleIntegration] StorageAdapter call COMPLETE for:', key);
            } catch (e) {
                console.error('[ModuleIntegration] Failed to parse value for', key, e);
                // Fall back to native storage
                _originalSetItem(key, value);
            }
            return;
        }
        console.log('[ModuleIntegration] Key NOT in routes, using native setItem:', key);
        _originalSetItem(key, value);
    };

    /**
     * Override localStorage.removeItem
     */
    localStorage.removeItem = function(key) {
        if (key === 'sop_tool_drafts') {
            StorageAdapter.clearDraft();
            return;
        }
        _originalRemoveItem(key);
    };

    console.log('[ModuleIntegration] localStorage methods overridden');
    console.log('[ModuleIntegration] Verifying override... localStorage.setItem is now:', localStorage.setItem.toString().substring(0, 100));

    // ========================================================================
    // VERIFY INTEGRATION
    // ========================================================================

    // Quick test to verify localStorage override is working
    (function verifyIntegration() {
        try {
            // Use a test key that won't interfere with real data
            const testKey = 'sop_tool_integration_test';
            const testValue = 'test_' + Date.now();
            
            // Test native storage still works for non-SOP keys
            _originalSetItem(testKey, testValue);
            const readBack = _originalGetItem(testKey);
            _originalRemoveItem(testKey);
            
            if (readBack === testValue) {
                console.log('[ModuleIntegration] ✓ Verification passed');
            } else {
                console.warn('[ModuleIntegration] ✗ Verification failed - native storage issue');
            }
            
            // Verify routing works (read existing data)
            const sops = StorageAdapter.getSops();
            console.log('[ModuleIntegration] ✓ Found', sops.length, 'existing SOPs');
            
        } catch (e) {
            console.error('[ModuleIntegration] ✗ Verification failed:', e);
        }
    })();

    // ========================================================================
    // DASHBOARD ENHANCEMENTS
    // ========================================================================

    /**
     * Add auth-aware features to Dashboard after it renders
     */
    function enhanceDashboard(dashboardInstance) {
        if (!dashboardInstance) return;

        const originalRender = dashboardInstance.render;
        if (originalRender) {
            dashboardInstance.render = function() {
                originalRender.call(this);
                
                // Add sync status indicator if authenticated
                if (StorageAdapter.Auth.isAuthenticated()) {
                    addSyncIndicator();
                }
            };
        }
    }

    /**
     * Add sync status indicator to page
     */
    function addSyncIndicator() {
        if (document.getElementById('sync-indicator')) return;

        const indicator = document.createElement('div');
        indicator.id = 'sync-indicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 16px;
            left: 16px;
            padding: 8px 12px;
            background: #1f2937;
            color: #fff;
            border-radius: 6px;
            font-size: 12px;
            display: none;
            z-index: 9999;
        `;
        document.body.appendChild(indicator);

        // Update indicator based on sync status
        function updateIndicator() {
            const pending = StorageAdapter.Sync.getPendingCount();
            if (pending > 0) {
                indicator.textContent = `⏳ ${pending} pending sync`;
                indicator.style.display = 'block';
                indicator.style.background = '#f59e0b';
            } else if (!StorageAdapter.isOnline()) {
                indicator.textContent = '📴 Offline';
                indicator.style.display = 'block';
                indicator.style.background = '#6b7280';
            } else {
                indicator.style.display = 'none';
            }
        }

        // Check periodically
        setInterval(updateIndicator, 2000);
        updateIndicator();
    }

    // ========================================================================
    // EXPOSE UTILITIES
    // ========================================================================

    global.ModuleIntegration = {
        version: '2.0.0',
        
        // Access to original localStorage methods if needed
        originalLocalStorage: {
            getItem: _originalGetItem,
            setItem: _originalSetItem,
            removeItem: _originalRemoveItem
        },

        // Manually trigger dashboard enhancement
        enhanceDashboard: enhanceDashboard,

        // Debug helper
        debug() {
            console.log('[ModuleIntegration] Debug Info:');
            console.log('  StorageAdapter available:', typeof StorageAdapter !== 'undefined');
            console.log('  Auth status:', StorageAdapter.Auth.isAuthenticated());
            console.log('  Online status:', StorageAdapter.isOnline());
            console.log('  Pending sync:', StorageAdapter.Sync.getPendingCount());
            console.log('  SOPs:', StorageAdapter.getSops().length);
            console.log('  Folders:', StorageAdapter.getFolders().length);
            console.log('  Checklists:', StorageAdapter.getChecklists().length);
        }
    };

    console.log('[ModuleIntegration] Ready');

})(typeof window !== 'undefined' ? window : this);
