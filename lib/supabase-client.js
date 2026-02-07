/**
 * Supabase Client (Browser)
 * 
 * Client-side Supabase instance for auth and data sync.
 * Reads config from window.SUPABASE_CONFIG or falls back to defaults.
 * 
 * SETUP: Add this before loading this script:
 *   <script>
 *     window.SUPABASE_CONFIG = {
 *       url: 'https://your-project.supabase.co',
 *       anonKey: 'your-anon-key'
 *     };
 *   </script>
 * 
 * @version 1.0.0
 */

(function(global) {
    'use strict';

    // Check for Supabase library
    if (typeof supabase === 'undefined' && typeof window.supabase === 'undefined') {
        console.warn('[SupabaseClient] Supabase JS library not loaded. Auth/sync disabled.');
        global.SupabaseClient = null;
        return;
    }

    const { createClient } = window.supabase || supabase;

    // Get config from window or use empty (will be set later)
    const config = global.SUPABASE_CONFIG || {};
    
    if (!config.url || !config.anonKey) {
        console.warn('[SupabaseClient] Missing SUPABASE_CONFIG. Set window.SUPABASE_CONFIG = { url, anonKey }');
        global.SupabaseClient = null;
        return;
    }

    console.log('[SupabaseClient] Initializing with URL:', config.url);

    // Create the client with session persistence
    const client = createClient(config.url, config.anonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            storage: localStorage,
            storageKey: 'sop_tool_supabase_auth',
            detectSessionInUrl: false
        }
    });

    // ========================================================================
    // AUTH HELPERS
    // ========================================================================

    const SupabaseClient = {
        /**
         * Raw Supabase client (for direct queries)
         */
        client,

        /**
         * Sign up with email/password
         * @param {string} email 
         * @param {string} password 
         * @param {string} displayName 
         * @returns {Promise<{user, session, error}>}
         */
        async signUp(email, password, displayName = '') {
            const { data, error } = await client.auth.signUp({
                email,
                password,
                options: {
                    data: { display_name: displayName || email.split('@')[0] }
                }
            });

            if (error) {
                console.error('[SupabaseClient] Sign up error:', error.message);
                return { user: null, session: null, error: error.message };
            }

            return { 
                user: data.user, 
                session: data.session, 
                error: null 
            };
        },

        /**
         * Sign in with email/password
         * @param {string} email 
         * @param {string} password 
         * @returns {Promise<{user, session, error}>}
         */
        async signIn(email, password) {
            const { data, error } = await client.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('[SupabaseClient] Sign in error:', error.message);
                return { user: null, session: null, error: error.message };
            }

            return { 
                user: data.user, 
                session: data.session, 
                error: null 
            };
        },

        /**
         * Sign out
         * @returns {Promise<{error}>}
         */
        async signOut() {
            const { error } = await client.auth.signOut();
            if (error) {
                console.error('[SupabaseClient] Sign out error:', error.message);
            }
            return { error: error?.message || null };
        },

        /**
         * Get current session
         * @returns {Promise<{user, session}>}
         */
        async getSession() {
            const { data, error } = await client.auth.getSession();
            if (error) {
                console.warn('[SupabaseClient] Get session error:', error.message);
                return { user: null, session: null };
            }
            return { 
                user: data.session?.user || null, 
                session: data.session 
            };
        },

        /**
         * Get current user (synchronous from memory)
         * @returns {Object|null}
         */
        getUser() {
            return client.auth.getUser ? null : null; // Async only in v2
        },

        /**
         * Listen for auth state changes
         * @param {Function} callback - (event, session) => void
         * @returns {Function} Unsubscribe function
         */
        onAuthStateChange(callback) {
            const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
                console.log('[SupabaseClient] Auth state changed:', event);
                callback(event, session);
            });
            return () => subscription.unsubscribe();
        },

        // ====================================================================
        // DATA OPERATIONS
        // ====================================================================

        /**
         * Fetch user's SOPs from Supabase
         * @returns {Promise<Array>}
         */
        async fetchSOPs() {
            const { data, error } = await client
                .from('sops')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[SupabaseClient] Fetch SOPs error:', error.message);
                return [];
            }

            // Transform from DB format to app format
            return (data || []).map(sop => ({
                id: sop.id,
                title: sop.title,
                description: sop.description,
                folderId: sop.folder_id || 'general',
                status: sop.status,
                tags: sop.tags || [],
                steps: sop.steps || [],
                createdAt: new Date(sop.created_at).getTime(),
                updatedAt: new Date(sop.updated_at).getTime()
            }));
        },

        /**
         * Fetch user's folders from Supabase
         * @returns {Promise<Array>}
         */
        async fetchFolders() {
            const { data, error } = await client
                .from('folders')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) {
                console.error('[SupabaseClient] Fetch folders error:', error.message);
                return [];
            }

            return (data || []).map(folder => ({
                id: folder.id,
                name: folder.name,
                icon: folder.icon || '📁',
                color: folder.color || '#6b7280',
                order: folder.sort_order || 0,
                createdAt: new Date(folder.created_at).getTime(),
                updatedAt: new Date(folder.updated_at).getTime()
            }));
        },

        /**
         * Fetch user's checklists from Supabase
         * @returns {Promise<Array>}
         */
        async fetchChecklists() {
            const { data, error } = await client
                .from('checklists')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[SupabaseClient] Fetch checklists error:', error.message);
                return [];
            }

            return (data || []).map(cl => ({
                id: cl.id,
                sopId: cl.sop_id,
                sopTitle: cl.sop_title,
                steps: cl.steps || [],
                status: cl.status,
                completedSteps: cl.completed_steps || 0,
                totalSteps: cl.total_steps || 0,
                createdAt: new Date(cl.created_at).getTime(),
                updatedAt: new Date(cl.updated_at).getTime(),
                completedAt: cl.completed_at ? new Date(cl.completed_at).getTime() : null
            }));
        },

        /**
         * Upload local data to Supabase (initial sync)
         * @param {Object} localData - { sops, folders, checklists }
         * @returns {Promise<{success, error}>}
         */
        async uploadLocalData(localData) {
            const { data: { user } } = await client.auth.getUser();
            if (!user) {
                return { success: false, error: 'Not authenticated' };
            }

            const userId = user.id;
            let errors = [];

            // Upload folders first (SOPs reference them)
            if (localData.folders?.length > 0) {
                const foldersToInsert = localData.folders
                    .filter(f => f.id !== 'general') // Skip default folder
                    .map(f => ({
                        id: f.id.startsWith('folder_') ? undefined : f.id, // Let DB generate ID for local IDs
                        user_id: userId,
                        name: f.name,
                        icon: f.icon || '📁',
                        color: f.color || '#6b7280',
                        sort_order: f.order || 0
                    }));

                if (foldersToInsert.length > 0) {
                    const { error } = await client.from('folders').upsert(foldersToInsert, {
                        onConflict: 'id',
                        ignoreDuplicates: false
                    });
                    if (error) errors.push('folders: ' + error.message);
                }
            }

            // Upload SOPs
            if (localData.sops?.length > 0) {
                const sopsToInsert = localData.sops.map(sop => ({
                    id: sop.id.startsWith('sop_') ? undefined : sop.id,
                    user_id: userId,
                    folder_id: sop.folderId === 'general' ? null : sop.folderId,
                    title: sop.title,
                    description: sop.description || '',
                    status: sop.status || 'draft',
                    tags: sop.tags || [],
                    steps: sop.steps || []
                }));

                const { error } = await client.from('sops').upsert(sopsToInsert, {
                    onConflict: 'id',
                    ignoreDuplicates: false
                });
                if (error) errors.push('sops: ' + error.message);
            }

            // Upload checklists
            if (localData.checklists?.length > 0) {
                const checklistsToInsert = localData.checklists.map(cl => ({
                    id: cl.id.startsWith('cl_') ? undefined : cl.id,
                    user_id: userId,
                    sop_id: cl.sopId?.startsWith('sop_') ? null : cl.sopId,
                    sop_title: cl.sopTitle,
                    steps: cl.steps || [],
                    status: cl.status || 'in_progress',
                    completed_steps: cl.completedSteps || 0,
                    total_steps: cl.totalSteps || 0,
                    completed_at: cl.completedAt ? new Date(cl.completedAt).toISOString() : null
                }));

                const { error } = await client.from('checklists').upsert(checklistsToInsert, {
                    onConflict: 'id',
                    ignoreDuplicates: false
                });
                if (error) errors.push('checklists: ' + error.message);
            }

            if (errors.length > 0) {
                console.error('[SupabaseClient] Upload errors:', errors);
                return { success: false, error: errors.join('; ') };
            }

            return { success: true, error: null };
        },

        /**
         * Save a single SOP to Supabase
         * @param {Object} sop 
         * @returns {Promise<{success, error}>}
         */
        async saveSOP(sop) {
            const { data: { user } } = await client.auth.getUser();
            if (!user) return { success: false, error: 'Not authenticated' };

            const { error } = await client.from('sops').upsert({
                id: sop.id.startsWith('sop_') ? undefined : sop.id,
                user_id: user.id,
                folder_id: sop.folderId === 'general' ? null : sop.folderId,
                title: sop.title,
                description: sop.description || '',
                status: sop.status || 'draft',
                tags: sop.tags || [],
                steps: sop.steps || []
            });

            if (error) {
                console.error('[SupabaseClient] Save SOP error:', error.message);
                return { success: false, error: error.message };
            }
            return { success: true, error: null };
        },

        /**
         * Delete a SOP from Supabase
         * @param {string} sopId 
         * @returns {Promise<{success, error}>}
         */
        async deleteSOP(sopId) {
            const { error } = await client.from('sops').delete().eq('id', sopId);
            if (error) {
                console.error('[SupabaseClient] Delete SOP error:', error.message);
                return { success: false, error: error.message };
            }
            return { success: true, error: null };
        },

        /**
         * Save a folder to Supabase
         * @param {Object} folder 
         * @returns {Promise<{success, error}>}
         */
        async saveFolder(folder) {
            const { data: { user } } = await client.auth.getUser();
            if (!user) return { success: false, error: 'Not authenticated' };

            const { error } = await client.from('folders').upsert({
                id: folder.id.startsWith('folder_') ? undefined : folder.id,
                user_id: user.id,
                name: folder.name,
                icon: folder.icon || '📁',
                color: folder.color || '#6b7280',
                sort_order: folder.order || 0
            });

            if (error) {
                console.error('[SupabaseClient] Save folder error:', error.message);
                return { success: false, error: error.message };
            }
            return { success: true, error: null };
        },

        /**
         * Delete a folder from Supabase
         * @param {string} folderId 
         * @returns {Promise<{success, error}>}
         */
        async deleteFolder(folderId) {
            const { error } = await client.from('folders').delete().eq('id', folderId);
            if (error) {
                console.error('[SupabaseClient] Delete folder error:', error.message);
                return { success: false, error: error.message };
            }
            return { success: true, error: null };
        },

        /**
         * Save a checklist to Supabase
         * @param {Object} checklist 
         * @returns {Promise<{success, error}>}
         */
        async saveChecklist(checklist) {
            const { data: { user } } = await client.auth.getUser();
            if (!user) return { success: false, error: 'Not authenticated' };

            const { error } = await client.from('checklists').upsert({
                id: checklist.id.startsWith('cl_') ? undefined : checklist.id,
                user_id: user.id,
                sop_id: checklist.sopId?.startsWith('sop_') ? null : checklist.sopId,
                sop_title: checklist.sopTitle,
                steps: checklist.steps || [],
                status: checklist.status || 'in_progress',
                completed_steps: checklist.completedSteps || 0,
                total_steps: checklist.totalSteps || 0,
                completed_at: checklist.completedAt ? new Date(checklist.completedAt).toISOString() : null
            });

            if (error) {
                console.error('[SupabaseClient] Save checklist error:', error.message);
                return { success: false, error: error.message };
            }
            return { success: true, error: null };
        },

        /**
         * Delete a checklist from Supabase
         * @param {string} checklistId 
         * @returns {Promise<{success, error}>}
         */
        async deleteChecklist(checklistId) {
            const { error } = await client.from('checklists').delete().eq('id', checklistId);
            if (error) {
                console.error('[SupabaseClient] Delete checklist error:', error.message);
                return { success: false, error: error.message };
            }
            return { success: true, error: null };
        },

        /**
         * Check if user has any cloud data
         * @returns {Promise<boolean>}
         */
        async hasCloudData() {
            const { count, error } = await client
                .from('sops')
                .select('id', { count: 'exact', head: true });
            
            if (error) {
                console.warn('[SupabaseClient] Check cloud data error:', error.message);
                return false;
            }
            return (count || 0) > 0;
        }
    };

    // Export
    global.SupabaseClient = SupabaseClient;

    console.log('[SupabaseClient] Ready');

})(typeof window !== 'undefined' ? window : this);
