/**
 * Supabase Client (Browser)
 * 
 * Client-side Supabase instance for auth and data sync.
 * Reads config from window.SUPABASE_CONFIG.
 * 
 * @version 2.0.0
 */

(function(global) {
    'use strict';

    // Check for Supabase library
    if (typeof supabase === 'undefined') {
        console.warn('[SupabaseClient] Supabase JS library not loaded. Auth/sync disabled.');
        global.SupabaseClient = null;
        return;
    }

    // Get config from window
    const config = global.SUPABASE_CONFIG || {};
    
    if (!config.url || !config.anonKey) {
        console.warn('[SupabaseClient] Missing SUPABASE_CONFIG. Cloud sync disabled.');
        global.SupabaseClient = null;
        return;
    }

    console.log('[SupabaseClient] Initializing...');

    // Create the client with session persistence
    let client;
    try {
        client = supabase.createClient(config.url, config.anonKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                storage: localStorage,
                storageKey: 'sop_tool_supabase_auth',
                detectSessionInUrl: false
            }
        });
    } catch (e) {
        console.error('[SupabaseClient] Failed to create client:', e);
        global.SupabaseClient = null;
        return;
    }

    // ========================================================================
    // SUPABASE CLIENT API
    // ========================================================================

    const SupabaseClient = {
        /**
         * Raw Supabase client
         */
        client,

        /**
         * Sign up with email/password (instant access, no email confirmation)
         */
        async signUp(email, password) {
            try {
                const { data, error } = await client.auth.signUp({
                    email,
                    password
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
            } catch (e) {
                console.error('[SupabaseClient] Sign up exception:', e);
                return { user: null, session: null, error: e.message };
            }
        },

        /**
         * Sign in with email/password
         */
        async signIn(email, password) {
            try {
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
            } catch (e) {
                console.error('[SupabaseClient] Sign in exception:', e);
                return { user: null, session: null, error: e.message };
            }
        },

        /**
         * Sign out
         */
        async signOut() {
            try {
                const { error } = await client.auth.signOut();
                if (error) {
                    console.error('[SupabaseClient] Sign out error:', error.message);
                }
                return { error: error?.message || null };
            } catch (e) {
                console.error('[SupabaseClient] Sign out exception:', e);
                return { error: e.message };
            }
        },

        /**
         * Update the current user's password
         */
        async updatePassword(newPassword) {
            try {
                const { error } = await client.auth.updateUser({ password: newPassword });
                if (error) {
                    console.error('[SupabaseClient] Update password error:', error.message);
                    return { success: false, error: error.message };
                }
                return { success: true, error: null };
            } catch (e) {
                console.error('[SupabaseClient] Update password exception:', e);
                return { success: false, error: e.message };
            }
        },

        /**
         * Save business type to Supabase user metadata
         */
        async setBusinessType(businessType) {
            try {
                const { error } = await client.auth.updateUser({
                    data: { business_type: businessType || '' }
                });
                if (error) {
                    console.error('[SupabaseClient] Set business type error:', error.message);
                    return { success: false, error: error.message };
                }
                return { success: true, error: null };
            } catch (e) {
                console.error('[SupabaseClient] Set business type exception:', e);
                return { success: false, error: e.message };
            }
        },

        /**
         * Get business type from Supabase user metadata
         */
        async getBusinessType() {
            try {
                const { data: { user }, error } = await client.auth.getUser();
                if (error || !user) return '';
                return user.user_metadata?.business_type || '';
            } catch (e) {
                return '';
            }
        },

        /**
         * Check subscription status for a given email.
         * Calls the SECURITY DEFINER function in Supabase.
         * Returns: { status, plan, subscriptionId } or null if no subscription.
         */
        async checkSubscription(email) {
            try {
                if (!email) {
                    console.warn('[SupabaseClient] checkSubscription: no email provided');
                    return null;
                }

                const { data, error } = await client.rpc('check_subscription_status', {
                    lookup_email: email.toLowerCase().trim()
                });

                if (error) {
                    console.error('[SupabaseClient] checkSubscription error:', error.message);
                    return null;
                }

                if (!data || data.length === 0) {
                    console.log('[SupabaseClient] No subscription found for:', email);
                    return null;
                }

                const sub = data[0];
                console.log('[SupabaseClient] Subscription found:', sub.status, sub.plan);
                return {
                    status: sub.status,
                    plan: sub.plan,
                    subscriptionId: sub.paddle_subscription_id,
                    updatedAt: sub.updated_at
                };
            } catch (e) {
                console.error('[SupabaseClient] checkSubscription exception:', e);
                return null;
            }
        },

        /**
         * Get current session
         */
        async getSession() {
            try {
                const { data, error } = await client.auth.getSession();
                if (error) {
                    console.warn('[SupabaseClient] Get session error:', error.message);
                    return { user: null, session: null };
                }
                return { 
                    user: data.session?.user || null, 
                    session: data.session 
                };
            } catch (e) {
                console.warn('[SupabaseClient] Get session exception:', e);
                return { user: null, session: null };
            }
        },

        /**
         * Listen for auth state changes
         */
        onAuthStateChange(callback) {
            try {
                const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
                    console.log('[SupabaseClient] Auth state changed:', event);
                    callback(event, session);
                });
                return () => subscription.unsubscribe();
            } catch (e) {
                console.error('[SupabaseClient] Auth listener error:', e);
                return () => {};
            }
        },

        // ====================================================================
        // DATA OPERATIONS
        // ====================================================================

        /**
         * Fetch user's SOPs from Supabase
         */
        async fetchSOPs() {
            try {
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
            } catch (e) {
                console.error('[SupabaseClient] Fetch SOPs exception:', e);
                return [];
            }
        },

        /**
         * Fetch user's folders from Supabase
         */
        async fetchFolders() {
            try {
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
            } catch (e) {
                console.error('[SupabaseClient] Fetch folders exception:', e);
                return [];
            }
        },

        /**
         * Fetch user's checklists from Supabase
         */
        async fetchChecklists() {
            try {
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
            } catch (e) {
                console.error('[SupabaseClient] Fetch checklists exception:', e);
                return [];
            }
        },

        /**
         * Check if user has any cloud data
         */
        async hasCloudData() {
            try {
                const { count, error } = await client
                    .from('sops')
                    .select('id', { count: 'exact', head: true });
                
                if (error) {
                    console.warn('[SupabaseClient] Check cloud data error:', error.message);
                    return false;
                }
                return (count || 0) > 0;
            } catch (e) {
                console.warn('[SupabaseClient] Check cloud data exception:', e);
                return false;
            }
        },

        /**
         * Upload local data to Supabase (initial sync on login)
         */
        async uploadLocalData(localData) {
            try {
                const { data: { user } } = await client.auth.getUser();
                if (!user) {
                    return { success: false, error: 'Not authenticated' };
                }

                const userId = user.id;
                let errors = [];

                // Upload folders first (SOPs may reference them)
                if (localData.folders?.length > 0) {
                    for (const f of localData.folders) {
                        if (f.id === 'general' || f.id?.startsWith('folder_default_')) continue;
                        
                        const { error } = await client.from('folders').insert({
                            user_id: userId,
                            name: f.name,
                            icon: f.icon || '📁',
                            color: f.color || '#6b7280',
                            sort_order: f.order || 0
                        });
                        if (error && !error.message.includes('duplicate')) {
                            errors.push('folder: ' + error.message);
                        }
                    }
                }

                // Upload SOPs
                if (localData.sops?.length > 0) {
                    for (const sop of localData.sops) {
                        const { error } = await client.from('sops').insert({
                            user_id: userId,
                            folder_id: null, // Can't map local folder IDs to cloud
                            title: sop.title,
                            description: sop.description || '',
                            status: sop.status || 'draft',
                            tags: sop.tags || [],
                            steps: sop.steps || []
                        });
                        if (error && !error.message.includes('duplicate')) {
                            errors.push('sop: ' + error.message);
                        }
                    }
                }

                // Upload checklists
                if (localData.checklists?.length > 0) {
                    for (const cl of localData.checklists) {
                        const { error } = await client.from('checklists').insert({
                            user_id: userId,
                            sop_id: null,
                            sop_title: cl.sopTitle,
                            steps: cl.steps || [],
                            status: cl.status || 'in_progress',
                            completed_steps: cl.completedSteps || 0,
                            total_steps: cl.totalSteps || 0,
                            completed_at: cl.completedAt ? new Date(cl.completedAt).toISOString() : null
                        });
                        if (error && !error.message.includes('duplicate')) {
                            errors.push('checklist: ' + error.message);
                        }
                    }
                }

                if (errors.length > 0) {
                    console.warn('[SupabaseClient] Upload had errors:', errors);
                    return { success: true, error: errors.join('; '), partial: true };
                }

                return { success: true, error: null };
            } catch (e) {
                console.error('[SupabaseClient] Upload exception:', e);
                return { success: false, error: e.message };
            }
        },

        /**
         * Save a single SOP to Supabase
         */
        async saveSOP(sop) {
            console.log('[SupabaseClient] saveSOP called:', { title: sop.title, id: sop.id });
            
            try {
                const { data: { user }, error: userError } = await client.auth.getUser();
                
                if (userError) {
                    console.error('[SupabaseClient] getUser error:', userError);
                    return { success: false, error: userError.message };
                }
                
                if (!user) {
                    console.error('[SupabaseClient] No user found');
                    return { success: false, error: 'Not authenticated' };
                }
                
                console.log('[SupabaseClient] User authenticated:', user.id.substring(0, 8) + '...');

                // Try to find existing SOP by title (since local IDs don't map to cloud)
                // Use maybeSingle() instead of single() to avoid error when no match
                const { data: existing, error: selectError } = await client
                    .from('sops')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('title', sop.title)
                    .maybeSingle();

                if (selectError) {
                    console.error('[SupabaseClient] Select error:', selectError);
                }

                console.log('[SupabaseClient] Existing SOP check:', existing ? `found id=${existing.id}` : 'not found');

                if (existing) {
                    // Update existing
                    console.log('[SupabaseClient] Updating existing SOP:', existing.id);
                    const { error } = await client.from('sops').update({
                        description: sop.description || '',
                        status: sop.status || 'draft',
                        tags: sop.tags || [],
                        steps: sop.steps || [],
                        updated_at: new Date().toISOString()
                    }).eq('id', existing.id);

                    if (error) {
                        console.error('[SupabaseClient] Update SOP error:', error.message, error);
                        return { success: false, error: error.message };
                    }
                    console.log('[SupabaseClient] SOP updated successfully');
                } else {
                    // Insert new
                    console.log('[SupabaseClient] Inserting new SOP:', sop.title);
                    const insertData = {
                        user_id: user.id,
                        folder_id: null,
                        title: sop.title,
                        description: sop.description || '',
                        status: sop.status || 'draft',
                        tags: sop.tags || [],
                        steps: sop.steps || []
                    };
                    console.log('[SupabaseClient] Insert data:', insertData);
                    
                    const { data: insertedData, error } = await client.from('sops').insert(insertData).select();

                    if (error) {
                        console.error('[SupabaseClient] Insert SOP error:', error.message, error);
                        return { success: false, error: error.message };
                    }
                    console.log('[SupabaseClient] SOP inserted successfully:', insertedData);
                }

                return { success: true, error: null };
            } catch (e) {
                console.error('[SupabaseClient] Save SOP exception:', e);
                return { success: false, error: e.message };
            }
        },

        /**
         * Delete a SOP from Supabase (by title match, since local IDs don't map to cloud)
         */
        async deleteSOP(sop) {
            console.log('[SupabaseClient] deleteSOP called:', { title: sop.title, id: sop.id });
            
            try {
                const { data: { user }, error: userError } = await client.auth.getUser();
                
                if (userError || !user) {
                    console.warn('[SupabaseClient] Cannot delete SOP — not authenticated');
                    return { success: false, error: 'Not authenticated' };
                }

                // Delete by user_id + title (same matching strategy as saveSOP)
                const { error, count } = await client
                    .from('sops')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('title', sop.title);

                if (error) {
                    console.error('[SupabaseClient] Delete SOP error:', error.message);
                    return { success: false, error: error.message };
                }

                console.log('[SupabaseClient] SOP deleted from cloud:', sop.title);
                return { success: true, error: null };
            } catch (e) {
                console.error('[SupabaseClient] Delete SOP exception:', e);
                return { success: false, error: e.message };
            }
        },
        async saveFolder(folder) {
            try {
                const { data: { user } } = await client.auth.getUser();
                if (!user) return { success: false, error: 'Not authenticated' };

                // Skip default folders
                if (folder.id === 'general' || folder.id?.startsWith('folder_default_')) {
                    return { success: true, error: null };
                }

                const { data: existing } = await client
                    .from('folders')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('name', folder.name)
                    .single();

                if (existing) {
                    const { error } = await client.from('folders').update({
                        icon: folder.icon || '📁',
                        color: folder.color || '#6b7280',
                        sort_order: folder.order || 0
                    }).eq('id', existing.id);

                    if (error) return { success: false, error: error.message };
                } else {
                    const { error } = await client.from('folders').insert({
                        user_id: user.id,
                        name: folder.name,
                        icon: folder.icon || '📁',
                        color: folder.color || '#6b7280',
                        sort_order: folder.order || 0
                    });

                    if (error) return { success: false, error: error.message };
                }

                return { success: true, error: null };
            } catch (e) {
                return { success: false, error: e.message };
            }
        },

        /**
         * Save a checklist to Supabase
         */
        async saveChecklist(checklist) {
            try {
                const { data: { user } } = await client.auth.getUser();
                if (!user) return { success: false, error: 'Not authenticated' };

                // For checklists, use sopTitle + createdAt as identifier
                const { data: existing } = await client
                    .from('checklists')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('sop_title', checklist.sopTitle)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (existing) {
                    const { error } = await client.from('checklists').update({
                        steps: checklist.steps || [],
                        status: checklist.status || 'in_progress',
                        completed_steps: checklist.completedSteps || 0,
                        total_steps: checklist.totalSteps || 0,
                        completed_at: checklist.completedAt ? new Date(checklist.completedAt).toISOString() : null
                    }).eq('id', existing.id);

                    if (error) return { success: false, error: error.message };
                } else {
                    const { error } = await client.from('checklists').insert({
                        user_id: user.id,
                        sop_id: null,
                        sop_title: checklist.sopTitle,
                        steps: checklist.steps || [],
                        status: checklist.status || 'in_progress',
                        completed_steps: checklist.completedSteps || 0,
                        total_steps: checklist.totalSteps || 0,
                        completed_at: checklist.completedAt ? new Date(checklist.completedAt).toISOString() : null
                    });

                    if (error) return { success: false, error: error.message };
                }

                return { success: true, error: null };
            } catch (e) {
                return { success: false, error: e.message };
            }
        },

        // ====================================================================
        // TEAM MANAGEMENT
        // ====================================================================

        /**
         * Ensure a team exists for the current user, create one if not.
         * Returns team id or null.
         */
        async _ensureTeam() {
            const { data: { user } } = await client.auth.getUser();
            if (!user) return null;

            const { data: existing } = await client
                .from('teams')
                .select('id')
                .eq('owner_id', user.id)
                .limit(1)
                .maybeSingle();

            if (existing) return existing.id;

            const { data: created, error } = await client
                .from('teams')
                .insert({ owner_id: user.id })
                .select('id')
                .single();

            if (error) {
                console.error('[SupabaseClient] Failed to create team:', error);
                return null;
            }

            return created.id;
        },

        /**
         * Create an invite link for the current user's team.
         * Returns { success, inviteCode } or { success, error }.
         */
        async createInvite() {
            try {
                const teamId = await this._ensureTeam();
                if (!teamId) return { success: false, error: 'Not authenticated' };

                const inviteCode = Array.from(crypto.getRandomValues(new Uint8Array(6)))
                    .map(b => b.toString(36).padStart(2, '0'))
                    .join('')
                    .slice(0, 10);

                const { error } = await client.from('team_members').insert({
                    team_id: teamId,
                    invite_code: inviteCode,
                    role: 'member',
                    status: 'pending'
                });

                if (error) return { success: false, error: error.message };

                return { success: true, inviteCode };
            } catch (e) {
                return { success: false, error: e.message };
            }
        },

        /**
         * Fetch all team members/invites for the current user's team.
         * Returns array of { id, email, role, status, invite_code }.
         */
        async fetchTeamMembers() {
            try {
                const { data: { user } } = await client.auth.getUser();
                if (!user) return [];

                const { data: team } = await client
                    .from('teams')
                    .select('id')
                    .eq('owner_id', user.id)
                    .limit(1)
                    .maybeSingle();

                if (!team) return [];

                const { data: members, error } = await client
                    .from('team_members')
                    .select('id, email, role, status, invite_code, created_at')
                    .eq('team_id', team.id)
                    .order('created_at', { ascending: true });

                if (error) {
                    console.error('[SupabaseClient] Failed to fetch team members:', error);
                    return [];
                }

                return members || [];
            } catch (e) {
                console.error('[SupabaseClient] fetchTeamMembers error:', e);
                return [];
            }
        },

        /**
         * Remove a team member or revoke a pending invite.
         * Returns { success } or { success, error }.
         */
        async removeTeamMember(memberId) {
            try {
                const { error } = await client
                    .from('team_members')
                    .delete()
                    .eq('id', memberId);

                if (error) return { success: false, error: error.message };

                return { success: true };
            } catch (e) {
                return { success: false, error: e.message };
            }
        },

        /**
         * Fetch SOPs by invite code — calls SECURITY DEFINER RPC function.
         * No auth required. Team members click a link and see SOPs immediately.
         * Returns { success, sops, teamName, teamId } or { success, error }.
         */
        async fetchSOPsByInviteCode(inviteCode) {
            try {
                const { data, error } = await client.rpc('get_sops_by_invite_code', {
                    code: inviteCode
                });

                if (error) {
                    console.error('[SupabaseClient] fetchSOPsByInviteCode error:', error);
                    return { success: false, error: error.message };
                }

                if (!data || data.length === 0) {
                    return { success: false, error: 'Invalid or expired invite code' };
                }

                // RPC returns array of SOPs with team info embedded
                // Extract team info from first result
                const firstRow = data[0];
                const sops = data.map(row => ({
                    id: row.id,
                    title: row.title,
                    description: row.description,
                    steps: row.steps || [],
                    tags: row.tags || [],
                    status: row.status,
                    folderId: row.folder_id,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                }));

                return {
                    success: true,
                    sops,
                    teamName: firstRow.team_name || 'Team',
                    teamId: firstRow.team_id
                };
            } catch (e) {
                console.error('[SupabaseClient] fetchSOPsByInviteCode exception:', e);
                return { success: false, error: e.message };
            }
        },

        /**
         * Get current user's team role.
         * Returns { role: 'owner'|'member'|'solo', teamId, teamName, ownerId }.
         */
        async getUserRole() {
            try {
                const { data: { user } } = await client.auth.getUser();
                if (!user) return { role: 'solo', teamId: null, teamName: null, ownerId: null };

                // Check if user is a team owner
                const { data: ownedTeam } = await client
                    .from('teams')
                    .select('id, name')
                    .eq('owner_id', user.id)
                    .limit(1)
                    .maybeSingle();

                if (ownedTeam) {
                    return {
                        role: 'owner',
                        teamId: ownedTeam.id,
                        teamName: ownedTeam.name || 'My Team',
                        ownerId: user.id
                    };
                }

                // Check if user is a team member
                const { data: membership } = await client
                    .from('team_members')
                    .select('team_id, role, teams(id, name, owner_id)')
                    .eq('email', user.email)
                    .eq('status', 'active')
                    .limit(1)
                    .maybeSingle();

                if (membership) {
                    return {
                        role: membership.role || 'member',
                        teamId: membership.team_id,
                        teamName: membership.teams?.name || 'Team',
                        ownerId: membership.teams?.owner_id || null
                    };
                }

                return { role: 'solo', teamId: null, teamName: null, ownerId: null };
            } catch (e) {
                console.warn('[SupabaseClient] getUserRole error:', e);
                return { role: 'solo', teamId: null, teamName: null, ownerId: null };
            }
        },

        /**
         * Fetch team SOPs for an authenticated team member.
         * Returns array of SOPs from the team owner.
         */
        async fetchTeamSOPs() {
            try {
                const { data: { user } } = await client.auth.getUser();
                if (!user) return [];

                // Find which team this user belongs to
                const { data: membership } = await client
                    .from('team_members')
                    .select('team_id, teams(owner_id)')
                    .eq('email', user.email)
                    .eq('status', 'active')
                    .limit(1)
                    .maybeSingle();

                if (!membership || !membership.teams?.owner_id) return [];

                // Fetch owner's active SOPs
                const { data: sops, error } = await client
                    .from('sops')
                    .select('*')
                    .eq('user_id', membership.teams.owner_id)
                    .eq('status', 'active')
                    .order('updated_at', { ascending: false });

                if (error) {
                    console.error('[SupabaseClient] fetchTeamSOPs error:', error);
                    return [];
                }

                return (sops || []).map(row => ({
                    id: row.id,
                    title: row.title,
                    description: row.description,
                    steps: row.steps || [],
                    tags: row.tags || [],
                    status: row.status,
                    folderId: row.folder_id,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                }));
            } catch (e) {
                console.error('[SupabaseClient] fetchTeamSOPs exception:', e);
                return [];
            }
        }
    };

    // Export
    global.SupabaseClient = SupabaseClient;

    console.log('[SupabaseClient] Ready');

})(typeof window !== 'undefined' ? window : this);
