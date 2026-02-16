# Frontend Integration - Phase 2

## Overview

This document describes the frontend integration with the Vercel/Supabase backend. The integration maintains full backward compatibility with localStorage while enabling cloud sync for authenticated users.

## File Structure

After integration, your frontend files should include:

```
sop-tool/
├── index.html              # Updated with new script tags
├── app.js                  # Updated with auth flow
├── modules/
│   ├── dashboard.js        # Unchanged (patched at runtime)
│   ├── sop-create.js       # Unchanged (patched at runtime)
│   └── checklist.js        # Unchanged (patched at runtime)
└── lib/
    ├── storage-adapter.js  # NEW: Storage abstraction layer
    ├── module-integration.js # NEW: Patches modules for backend
    └── payments.js         # NEW: Payment stubs (Paddle placeholder)
```

## Script Loading Order

The loading order in `index.html` is critical:

```html
<!-- 1. Storage adapter first (sets up global StorageAdapter) -->
<script src="lib/storage-adapter.js"></script>

<!-- 2. Original modules (unchanged) -->
<script src="modules/dashboard.js"></script>
<script src="modules/sop-create.js"></script>
<script src="modules/checklist.js"></script>

<!-- 3. Module integration (patches modules to use StorageAdapter) -->
<script src="lib/module-integration.js"></script>

<!-- 4. App controller last (orchestrates everything) -->
<script src="app.js"></script>
```

## Authentication Flow

### New Users
1. App loads → Show auth screen
2. User registers/logs in
3. App loads data from server
4. User can use the app

### Existing Users (with localStorage data)
1. App loads → Check for local data
2. If has local data: Show dashboard directly (local mode)
3. If user logs in: Show sync prompt
4. User chooses to sync or start fresh

### Returning Authenticated Users
1. App loads → Check session
2. Session valid: Load data from server, show dashboard
3. Session invalid: Show auth screen

## Data Flow

### Write Operations
```
User Action → Module → StorageAdapter
                           ↓
                    [Save to localStorage]
                           ↓
                    [Queue API call]
                           ↓
                    [If online + auth: sync to server]
                           ↓
                    [If offline: queue for later]
```

### Read Operations
```
Module Request → StorageAdapter
                      ↓
              [Return from cache/localStorage]
              
Note: Server refresh happens on login and periodically
```

## Offline Support

The app works fully offline:

1. **Authenticated + Offline**: Changes saved locally, synced when back online
2. **Unauthenticated**: Works entirely with localStorage (no sync)
3. **Online → Offline**: Seamless transition, pending changes queued
4. **Offline → Online**: Automatic sync of queued changes

### Sync Status Indicator

A small indicator appears in the bottom-left corner showing:
- "📴 Offline - changes saved locally" - when offline
- "⏳ 3 changes pending sync" - when changes are queued

## Error Handling

### API Errors

All API errors are caught and handled gracefully:

```javascript
// In StorageAdapter
async createSop(sop) {
    // Always save locally first
    this.saveSops([...this.getSops(), sop]);
    
    // Try API call
    if (shouldUseAPI()) {
        try {
            await apiFetch('/sops', { method: 'POST', body: sop });
        } catch (err) {
            // Queue for retry
            queueOp({ type: 'sop_create', data: sop });
        }
    }
}
```

### Network Failures

Network failures are handled by:
1. Saving data locally immediately
2. Queuing the operation for retry
3. Automatically retrying when back online

### Auth Failures

If a session expires:
1. API calls fail with 401
2. User is prompted to re-authenticate
3. Pending changes are preserved

## Completed Checklist Immutability

Completed checklists cannot be modified:

```javascript
// In StorageAdapter
async updateChecklist(id, updates) {
    const current = this.getChecklists().find(c => c.id === id);
    
    // Enforce immutability
    if (current?.status === 'completed' && updates.steps) {
        console.warn('Cannot modify completed checklist');
        return current;
    }
    
    // ... proceed with update
}
```

## Migration from localStorage

When an existing user creates an account:

1. **Sync Prompt**: User sees a summary of their local data
2. **Sync to Server**: All SOPs, checklists, and folders are uploaded
3. **ID Mapping**: Local IDs are mapped to server-generated UUIDs
4. **Confirmation**: User sees sync result

### Sync API Call

```javascript
const result = await StorageAdapter.Sync.syncToServer();
// result: { totalImported: 15, totalErrors: 0, ... }
```

## Payments Integration (Stub)

The `lib/payments.js` file provides stubs for future Paddle integration:

```javascript
import payments from './lib/payments.js';

// Check if user can create more SOPs
const access = payments.checkAccess('createSop', currentSopCount);
if (!access.allowed) {
    payments.showUpgradePrompt('createSop', access.reason);
    return;
}

// Open checkout (stub - shows "not configured" message)
await payments.checkout('pro_monthly');
```

### Paddle Integration Points

When ready to add Paddle:

1. Add Paddle.js to index.html
2. Update `payments.checkout()` to open Paddle checkout
3. Create `/api/payments/webhook.js` for Paddle webhooks
4. Update `payments.refreshSubscription()` to fetch from backend

## Testing

### Test Local-Only Mode
1. Remove or comment out `storage-adapter.js`
2. App should work exactly as before

### Test Offline Mode
1. Open Chrome DevTools → Network → Offline
2. Make changes (create SOPs, check items)
3. Verify sync indicator shows pending changes
4. Go back online, verify sync completes

### Test Auth Flow
1. Clear localStorage
2. Load app → should show auth screen
3. Register → should show dashboard
4. Refresh → should auto-login

### Test Sync Migration
1. Create some SOPs in local-only mode
2. Register an account
3. Verify sync prompt appears
4. Sync → verify data appears on server

## Troubleshooting

### "StorageAdapter not found"
- Ensure `storage-adapter.js` is loaded before other scripts
- Check for JavaScript errors in console

### "Cannot modify completed checklist"
- This is expected behavior (immutability)
- Create a new checklist to re-run the SOP

### "Sync failed"
- Check network connectivity
- Check Supabase service status
- Verify environment variables are set

### Data not syncing
- Check if user is authenticated: `StorageAdapter.Auth.isAuthenticated()`
- Check if online: `StorageAdapter.isOnline()`
- Check pending ops: `StorageAdapter.Sync.getPendingCount()`
