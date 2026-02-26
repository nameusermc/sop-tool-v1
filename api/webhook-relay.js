/**
 * /api/webhook-relay.js
 * Phase 12G — Webhook Relay for Team Completions
 *
 * Receives INSERT events from Supabase Database Webhook on team_completions,
 * looks up owner's webhook URL from user_metadata, and POSTs completion data.
 *
 * Flow: Supabase trigger → this function → owner's external URL (Zapier, Make, etc.)
 *
 * Env vars: WEBHOOK_RELAY_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RELAY_SECRET = process.env.WEBHOOK_RELAY_SECRET;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify shared secret
    const authHeader = req.headers['x-webhook-secret'] || req.headers['authorization'];
    if (!RELAY_SECRET || authHeader !== RELAY_SECRET) {
        console.warn('[webhook-relay] Unauthorized request');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('[webhook-relay] Missing env vars');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    try {
        const body = req.body;
        // Supabase Database Webhooks send { type, table, record, schema, old_record }
        const record = body?.record;
        if (!record || !record.team_id) {
            console.warn('[webhook-relay] No valid record in payload');
            return res.status(200).json({ skipped: true, reason: 'no record' });
        }

        console.log(`[webhook-relay] Completion for team ${record.team_id}: ${record.sop_title}`);

        // Look up team owner's webhook URL
        // 1. Get owner_id from teams table
        const teamRes = await fetch(
            `${SUPABASE_URL}/rest/v1/teams?id=eq.${record.team_id}&select=owner_id`,
            {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                }
            }
        );
        if (!teamRes.ok) {
            console.error('[webhook-relay] Failed to fetch team:', await teamRes.text());
            return res.status(200).json({ skipped: true, reason: 'team lookup failed' });
        }

        const teams = await teamRes.json();
        if (!teams?.[0]?.owner_id) {
            return res.status(200).json({ skipped: true, reason: 'no team owner' });
        }

        const ownerId = teams[0].owner_id;

        // 2. Get owner's user_metadata.webhook_url via admin API
        const userRes = await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users/${ownerId}`,
            {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                }
            }
        );
        if (!userRes.ok) {
            console.error('[webhook-relay] Failed to fetch user:', await userRes.text());
            return res.status(200).json({ skipped: true, reason: 'user lookup failed' });
        }

        const user = await userRes.json();
        const webhookUrl = user?.user_metadata?.webhook_url;

        if (!webhookUrl) {
            return res.status(200).json({ skipped: true, reason: 'no webhook configured' });
        }

        // 3. Build payload
        const steps = record.steps || [];
        const notes = steps
            .filter(s => s.userNote)
            .map((s, i) => ({ step: i + 1, note: s.userNote }));

        const payload = {
            event: 'checklist.completed',
            sop_id: record.sop_id,
            sop_title: record.sop_title,
            member_name: record.member_name,
            completed_at: record.completed_at,
            completed_steps: record.completed_steps,
            total_steps: record.total_steps,
            notes: notes.length > 0 ? notes : undefined,
            team_id: record.team_id
        };

        // 4. POST to owner's webhook URL (fire-and-forget style, but log result)
        console.log(`[webhook-relay] Sending to ${webhookUrl}`);
        const webhookRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (webhookRes.ok) {
            console.log(`[webhook-relay] Delivered successfully (${webhookRes.status})`);
            return res.status(200).json({ delivered: true });
        } else {
            console.warn(`[webhook-relay] Delivery failed: ${webhookRes.status}`);
            return res.status(200).json({ delivered: false, status: webhookRes.status });
        }

    } catch (e) {
        console.error('[webhook-relay] Error:', e.message);
        return res.status(200).json({ error: e.message });
    }
}
