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
 * @version 3.0.0
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
    // LOCALSTORAGE OVERRIDE - ROBUST IMPLEMENTATION
    // ========================================================================

    // Store original method references for comparison and fallback
    const _originalGetItem = Storage.prototype.getItem;
    const _originalSetItem = Storage.prototype.setItem;
    const _originalRemoveItem = Storage.prototype.removeItem;
    const _originalClear = Storage.prototype.clear;

    // Track override status
    let overrideSucceeded = false;

    /**
     * Custom getItem implementation
     */
    function customGetItem(key) {
        if (STORAGE_ROUTES[key]) {
            const data = STORAGE_ROUTES[key].get();
            if (data === null || data === undefined) {
                return null;
            }
            return JSON.stringify(data);
        }
        return _originalGetItem.call(this, key);
    }

    /**
     * Custom setItem implementation
     */
    function customSetItem(key, value) {
        if (STORAGE_ROUTES[key]) {
            try {
                const data = JSON.parse(value);
                console.log('[ModuleIntegration] Routing setItem to StorageAdapter:', key);
                STORAGE_ROUTES[key].set(data);
                return;
            } catch (e) {
                console.error('[ModuleIntegration] Failed to parse value for', key, e);
                // Fall through to native storage
            }
        }
        _originalSetItem.call(this, key, value);
    }

    /**
     * Custom removeItem implementation
     */
    function customRemoveItem(key) {
        if (key === 'sop_tool_drafts') {
            StorageAdapter.clearDraft();
            return;
        }
        _originalRemoveItem.call(this, key);
    }

    /**
     * Custom clear implementation (preserves routing behavior)
     */
    function customClear() {
        // Call original clear
        _originalClear.call(this);
    }

    /**
     * Attempt to override Storage.prototype methods using Object.defineProperty
     * Returns true if override succeeded, false otherwise
     */
    function attemptPrototypeOverride() {
        const methods = [
            { name: 'getItem', fn: customGetItem },
            { name: 'setItem', fn: customSetItem },
            { name: 'removeItem', fn: customRemoveItem },
            { name: 'clear', fn: customClear }
        ];

        let allSucceeded = true;

        for (const method of methods) {
            try {
                // Check if property is configurable
                const descriptor = Object.getOwnPropertyDescriptor(Storage.prototype, method.name);
                
                if (descriptor && !descriptor.configurable) {
                    console.log(`[ModuleIntegration] ${method.name} is non-configurable on Storage.prototype`);
                    allSucceeded = false;
                    continue;
                }

                // Attempt to define the property
                Object.defineProperty(Storage.prototype, method.name, {
                    value: method.fn,
                    writable: true,
                    configurable: true,
                    enumerable: false
                });

                // Verify it actually changed
                if (Storage.prototype[method.name] !== method.fn) {
                    console.log(`[ModuleIntegration] ${method.name} override did not stick`);
                    allSucceeded = false;
                }

            } catch (e) {
                console.log(`[ModuleIntegration] Failed to override ${method.name}:`, e.message);
                allSucceeded = false;
            }
        }

        return allSucceeded;
    }

    /**
     * Fallback: Attempt to override on localStorage object directly
     * Returns true if override succeeded, false otherwise
     */
    function attemptDirectOverride() {
        const methods = [
            { name: 'getItem', fn: customGetItem.bind(localStorage) },
            { name: 'setItem', fn: customSetItem.bind(localStorage) },
            { name: 'removeItem', fn: customRemoveItem.bind(localStorage) },
            { name: 'clear', fn: customClear.bind(localStorage) }
        ];

        let allSucceeded = true;

        for (const method of methods) {
            try {
                const originalRef = localStorage[method.name];
                localStorage[method.name] = method.fn;

                // Verify it actually changed (not just accepted and ignored)
                if (localStorage[method.name] === originalRef) {
                    console.log(`[ModuleIntegration] Direct ${method.name} override did not stick`);
                    allSucceeded = false;
                }

            } catch (e) {
                console.log(`[ModuleIntegration] Failed to directly override ${method.name}:`, e.message);
                allSucceeded = false;
            }
        }

        return allSucceeded;
    }

    /**
     * Verify override is working by checking function references
     */
    function verifyOverride() {
        // Check if localStorage.setItem is our custom function (not native)
        const currentSetItem = localStorage.setItem;
        
        // If it's native code, override failed
        const isNative = currentSetItem.toString().includes('[native code]');
        
        if (isNative) {
            return false;
        }

        // Additional check: see if it's actually our function
        // Our function should route sop_tool_sops differently
        return true;
    }

    // ========================================================================
    // APPLY OVERRIDE
    // ========================================================================

    console.log('[ModuleIntegration] Attempting localStorage override...');

    // Try prototype override first (more reliable)
    if (attemptPrototypeOverride()) {
        console.log('[ModuleIntegration] Storage.prototype override succeeded');
        overrideSucceeded = true;
    } else {
        console.log('[ModuleIntegration] Storage.prototype override failed, trying direct override...');
        
        // Fallback to direct override
        if (attemptDirectOverride()) {
            console.log('[ModuleIntegration] Direct localStorage override succeeded');
            overrideSucceeded = true;
        }
    }

    // Final verification
    if (overrideSucceeded && verifyOverride()) {
        console.log('[ModuleIntegration] ✓ localStorage override VERIFIED');
    } else {
        overrideSucceeded = false;
        console.warn('[ModuleIntegration] ⚠️ WARNING: localStorage override not supported in this browser');
        console.warn('[ModuleIntegration] Cloud sync will rely on explicit StorageAdapter calls in app.js');
    }

    // ========================================================================
    // VERIFY INTEGRATION
    // ========================================================================

    (function verifyIntegration() {
        try {
            // Test that native storage still works for non-SOP keys
            const testKey = 'sop_tool_integration_test';
            const testValue = 'test_' + Date.now();
            
            // Use original methods to test underlying storage
            _originalSetItem.call(localStorage, testKey, testValue);
            const readBack = _originalGetItem.call(localStorage, testKey);
            _originalRemoveItem.call(localStorage, testKey);
            
            if (readBack === testValue) {
                console.log('[ModuleIntegration] ✓ Native localStorage working');
            } else {
                console.warn('[ModuleIntegration] ✗ Native localStorage issue');
            }
            
            // Verify StorageAdapter connection
            const sops = StorageAdapter.getSops();
            console.log('[ModuleIntegration] ✓ StorageAdapter connected, found', sops.length, 'SOPs');
            
        } catch (e) {
            console.error('[ModuleIntegration] ✗ Integration verification failed:', e);
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
            const pending = StorageAdapter.Sync.getPendingCount?.() || 0;
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
        version: '3.0.0',
        
        // Whether localStorage override is active
        supportsOverride: overrideSucceeded,
        
        // Access to original localStorage methods if needed
        originalLocalStorage: {
            getItem: function(key) { return _originalGetItem.call(localStorage, key); },
            setItem: function(key, value) { return _originalSetItem.call(localStorage, key, value); },
            removeItem: function(key) { return _originalRemoveItem.call(localStorage, key); },
            clear: function() { return _originalClear.call(localStorage); }
        },

        // Manually trigger dashboard enhancement
        enhanceDashboard: enhanceDashboard,

        // Debug helper
        debug() {
            console.log('[ModuleIntegration] Debug Info:');
            console.log('  Version:', this.version);
            console.log('  Override supported:', this.supportsOverride);
            console.log('  StorageAdapter available:', typeof StorageAdapter !== 'undefined');
            console.log('  Auth status:', StorageAdapter.Auth?.isAuthenticated?.() || false);
            console.log('  Online status:', StorageAdapter.isOnline?.() || 'N/A');
            console.log('  SOPs:', StorageAdapter.getSops?.()?.length || 0);
            console.log('  Folders:', StorageAdapter.getFolders?.()?.length || 0);
            console.log('  Checklists:', StorageAdapter.getChecklists?.()?.length || 0);
        }
    };

    console.log('[ModuleIntegration] Ready (override:', overrideSucceeded ? 'active' : 'unsupported', ')');

})(typeof window !== 'undefined' ? window : this);
