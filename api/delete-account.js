/**
 * Delete Account Endpoint — Vercel Serverless Function
 * 
 * Self-service account deletion. Deletes all user data from Supabase,
 * cancels Paddle subscription if active, and removes the auth user.
 * 
 * Deployed at: https://withoutme.app/api/delete-account
 * 
 * POST body: { confirmation: "DELETE" }
 * Header: Authorization: Bearer {access_token}
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://withoutme.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const PADDLE_API_KEY = process.env.PADDLE_API_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('[delete-account] Missing Supabase env vars');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    // ---- Auth: verify JWT ----
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    let userId, userEmail;

    try {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${token}`
            }
        });
        if (!userRes.ok) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
        const userData = await userRes.json();
        userId = userData.id;
        userEmail = userData.email;
        if (!userId || !userEmail) {
            return res.status(401).json({ error: 'Could not resolve user' });
        }
    } catch (e) {
        console.error('[delete-account] Auth verification failed:', e);
        return res.status(401).json({ error: 'Authentication failed' });
    }

    // ---- Verify confirmation ----
    const { confirmation } = req.body || {};
    if (confirmation !== 'DELETE') {
        return res.status(400).json({ error: 'Confirmation required. Send { confirmation: "DELETE" }' });
    }

    console.log(`[delete-account] Starting deletion for user ${userId.substring(0, 8)}...`);

    const errors = [];

    // ---- 1. Cancel Paddle subscription if active ----
    try {
        const subRes = await fetch(
            `${SUPABASE_URL}/rest/v1/subscriptions?customer_email=eq.${encodeURIComponent(userEmail.toLowerCase().trim())}&status=eq.active&select=paddle_subscription_id`,
            {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                }
            }
        );
        if (subRes.ok) {
            const subs = await subRes.json();
            if (subs && subs.length > 0 && subs[0].paddle_subscription_id && PADDLE_API_KEY) {
                const paddleSubId = subs[0].paddle_subscription_id;
                console.log(`[delete-account] Canceling Paddle subscription ${paddleSubId}`);
                try {
                    const cancelRes = await fetch(
                        `https://api.paddle.com/subscriptions/${paddleSubId}/cancel`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${PADDLE_API_KEY}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ effective_from: 'immediately' })
                        }
                    );
                    if (!cancelRes.ok) {
                        const errText = await cancelRes.text();
                        console.error(`[delete-account] Paddle cancel failed: ${cancelRes.status} ${errText}`);
                        errors.push('Paddle cancellation may have failed — contact support if still billed');
                    } else {
                        console.log('[delete-account] Paddle subscription canceled');
                    }
                } catch (paddleErr) {
                    console.error('[delete-account] Paddle cancel error:', paddleErr);
                    errors.push('Paddle cancellation error');
                }
            }
        }
    } catch (e) {
        console.error('[delete-account] Subscription lookup failed:', e);
        errors.push('Could not check subscription');
    }

    // ---- 2. Get user's team IDs (where they're owner) ----
    let teamIds = [];
    try {
        const teamRes = await fetch(
            `${SUPABASE_URL}/rest/v1/teams?owner_id=eq.${userId}&select=id`,
            {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                }
            }
        );
        if (teamRes.ok) {
            const teams = await teamRes.json();
            teamIds = teams.map(t => t.id);
        }
    } catch (e) {
        console.error('[delete-account] Team lookup failed:', e);
        errors.push('Team lookup failed');
    }

    // ---- 3. Delete team-related data ----
    // Helper for DELETE requests
    async function deleteFromTable(table, filter) {
        try {
            const deleteRes = await fetch(
                `${SUPABASE_URL}/rest/v1/${table}?${filter}`,
                {
                    method: 'DELETE',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Prefer': 'return=minimal'
                    }
                }
            );
            if (!deleteRes.ok && deleteRes.status !== 404) {
                console.error(`[delete-account] Delete from ${table} failed: ${deleteRes.status}`);
                errors.push(`Failed to delete from ${table}`);
            } else {
                console.log(`[delete-account] Deleted from ${table} (${filter})`);
            }
        } catch (e) {
            console.error(`[delete-account] Delete from ${table} error:`, e);
            errors.push(`Error deleting from ${table}`);
        }
    }

    // Delete team data for each owned team
    for (const teamId of teamIds) {
        await deleteFromTable('team_completions', `team_id=eq.${teamId}`);
        await deleteFromTable('sop_feedback', `team_id=eq.${teamId}`);
        await deleteFromTable('task_assignments', `team_id=eq.${teamId}`);
        await deleteFromTable('team_members', `team_id=eq.${teamId}`);
    }

    // Delete the teams themselves
    if (teamIds.length > 0) {
        await deleteFromTable('teams', `owner_id=eq.${userId}`);
    }

    // Also remove user from any teams they're a member of (not owner)
    await deleteFromTable('team_members', `user_id=eq.${userId}`);

    // ---- 4. Delete user's own data ----
    await deleteFromTable('checklists', `user_id=eq.${userId}`);
    await deleteFromTable('sops', `user_id=eq.${userId}`);
    await deleteFromTable('folders', `user_id=eq.${userId}`);

    // ---- 5. Delete subscription record ----
    await deleteFromTable('subscriptions', `customer_email=eq.${encodeURIComponent(userEmail.toLowerCase().trim())}`);

    // ---- 6. Delete auth user via Admin API ----
    try {
        const deleteUserRes = await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
            {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                }
            }
        );
        if (!deleteUserRes.ok) {
            const errText = await deleteUserRes.text();
            console.error(`[delete-account] Auth user delete failed: ${deleteUserRes.status} ${errText}`);
            errors.push('Auth user deletion failed');
        } else {
            console.log('[delete-account] Auth user deleted');
        }
    } catch (e) {
        console.error('[delete-account] Auth user delete error:', e);
        errors.push('Auth user deletion error');
    }

    // ---- Done ----
    if (errors.length > 0) {
        console.log(`[delete-account] Completed with ${errors.length} warnings:`, errors);
        return res.status(200).json({
            deleted: true,
            warnings: errors,
            message: 'Account deleted with some warnings. Contact support@withoutme.app if issues persist.'
        });
    }

    console.log(`[delete-account] Account fully deleted for ${userId.substring(0, 8)}...`);
    return res.status(200).json({ deleted: true, message: 'Account and all data permanently deleted.' });
}
