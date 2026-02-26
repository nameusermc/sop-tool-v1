/**
 * Daily Digest Email — Vercel Serverless Function (Cron)
 * 
 * Runs daily at 12:00 UTC (~7 AM ET) via Vercel Cron.
 * Queries yesterday's team completions and sends a summary email to each team owner.
 * Only sends if there were actual completions. Owners can opt out in account settings.
 * 
 * Email provider: Postmark (CNAME-only DNS verification, no MX record needed).
 * 
 * Deployed at: https://withoutme.app/api/daily-digest
 * 
 * SETUP:
 * 1. In Vercel dashboard → Settings → Environment Variables, add:
 *    - CRON_SECRET              (generate a random string — Vercel uses this to auth cron calls)
 *    - POSTMARK_SERVER_TOKEN    (from Postmark → API Tokens → Server API token)
 *    - SUPABASE_URL             (https://zzsndvvaihnflrglvtnj.supabase.co)
 *    - SUPABASE_SERVICE_KEY     (service_role key from Supabase → Settings → API)
 *    - DIGEST_FROM_EMAIL        (e.g. "team@withoutme.app" — must match a verified domain/sender in Postmark)
 * 
 * 2. In Postmark dashboard → Sender Signatures → verify withoutme.app domain (DKIM + Return-Path CNAME records).
 * 
 * 3. vercel.json cron entry handles scheduling — no external cron needed.
 * 
 * NOTE: Uses SUPABASE_SERVICE_KEY (service_role) to call RPC that reads auth.users
 *       and POSTMARK_SERVER_TOKEN to send emails. Neither must be exposed to the browser.
 */

// ========================================================================
// MAIN HANDLER
// ========================================================================

export default async function handler(req, res) {
    // Only accept GET (Vercel cron sends GET requests)
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ---- Auth: verify this is a legitimate cron call ----
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = req.headers['authorization'];
        if (authHeader !== `Bearer ${cronSecret}`) {
            console.warn('[daily-digest] Unauthorized cron call');
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const POSTMARK_TOKEN = process.env.POSTMARK_SERVER_TOKEN;
    const FROM_EMAIL = process.env.DIGEST_FROM_EMAIL || 'team@withoutme.app';

    // Validate env vars
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !POSTMARK_TOKEN) {
        console.error('[daily-digest] Missing environment variables');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    // ---- Determine yesterday's date (UTC) ----
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`[daily-digest] Fetching digest data for ${dateStr}`);

    try {
        // ---- Call Supabase RPC to get digest data ----
        const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/get_daily_digest_data`;
        const rpcRes = await fetch(rpcUrl, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ p_date: dateStr })
        });

        if (!rpcRes.ok) {
            const errText = await rpcRes.text();
            console.error('[daily-digest] Supabase RPC error:', rpcRes.status, errText);
            return res.status(500).json({ error: 'Failed to fetch digest data' });
        }

        const digestData = await rpcRes.json();

        if (!Array.isArray(digestData) || digestData.length === 0) {
            console.log('[daily-digest] No team activity yesterday — no emails to send');
            return res.status(200).json({ sent: 0, date: dateStr });
        }

        console.log(`[daily-digest] ${digestData.length} team(s) with activity`);

        // ---- Send emails ----
        let sent = 0;
        let errors = 0;

        for (const team of digestData) {
            const completions = team.completions || [];
            if (completions.length === 0) continue;

            const subject = buildSubject(completions);
            const html = buildEmailHtml(team, completions, dateStr);

            try {
                const emailRes = await fetch('https://api.postmarkapp.com/email', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Postmark-Server-Token': POSTMARK_TOKEN
                    },
                    body: JSON.stringify({
                        From: FROM_EMAIL,
                        To: team.owner_email,
                        Subject: subject,
                        HtmlBody: html,
                        MessageStream: 'outbound'
                    })
                });

                if (emailRes.ok) {
                    sent++;
                    console.log(`[daily-digest] Sent to ${team.owner_email} (${completions.length} completions)`);
                } else {
                    errors++;
                    const errBody = await emailRes.text();
                    console.error(`[daily-digest] Postmark error for ${team.owner_email}:`, emailRes.status, errBody);
                }
            } catch (emailErr) {
                errors++;
                console.error(`[daily-digest] Postmark send failed for ${team.owner_email}:`, emailErr);
            }
        }

        console.log(`[daily-digest] Done: ${sent} sent, ${errors} errors`);
        return res.status(200).json({ sent, errors, date: dateStr });

    } catch (e) {
        console.error('[daily-digest] Unhandled error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// ========================================================================
// EMAIL BUILDING
// ========================================================================

/**
 * Build the email subject line.
 */
function buildSubject(completions) {
    const count = completions.length;
    return `Your team completed ${count} checklist${count !== 1 ? 's' : ''} yesterday`;
}

/**
 * Build the HTML email body.
 * Lightweight, scannable, links back to the app dashboard.
 */
function buildEmailHtml(team, completions, dateStr) {
    // Group completions by employee
    const byEmployee = {};
    const employeeOrder = [];

    completions.forEach(c => {
        const name = c.member_name || 'Unknown';
        if (!byEmployee[name]) {
            byEmployee[name] = [];
            employeeOrder.push(name);
        }
        byEmployee[name].push(c);
    });

    // Format the date for display
    const displayDate = new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });

    // Build employee sections
    const employeeSections = employeeOrder.map(name => {
        const items = byEmployee[name];
        const itemsHtml = items.map(c => {
            const time = new Date(c.completed_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'America/New_York'
            });
            return `<li style="padding:4px 0;color:#374151;font-size:14px;">
                ✅ ${escapeHtml(c.sop_title)} <span style="color:#9ca3af;font-size:12px;">— ${time} ET</span>
            </li>`;
        }).join('');

        return `
            <div style="margin-bottom:16px;">
                <div style="font-weight:600;font-size:15px;color:#1f2937;margin-bottom:4px;">
                    ${escapeHtml(name)} <span style="font-weight:400;color:#9ca3af;font-size:13px;">— ${items.length} checklist${items.length !== 1 ? 's' : ''}</span>
                </div>
                <ul style="margin:0;padding-left:20px;list-style:none;">${itemsHtml}</ul>
            </div>
        `;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
        
        <!-- Header -->
        <div style="margin-bottom:24px;">
            <div style="font-size:20px;font-weight:700;color:#1f2937;">📋 Team Activity</div>
            <div style="font-size:14px;color:#6b7280;margin-top:4px;">${displayDate}</div>
        </div>

        <!-- Summary -->
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px;">
            <div style="font-size:28px;font-weight:700;color:#4f46e5;margin-bottom:4px;">${completions.length}</div>
            <div style="font-size:14px;color:#6b7280;">checklist${completions.length !== 1 ? 's' : ''} completed by ${employeeOrder.length} team member${employeeOrder.length !== 1 ? 's' : ''}</div>
        </div>

        <!-- Breakdown -->
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px;">
            ${employeeSections}
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:32px;">
            <a href="https://withoutme.app" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
                View full activity →
            </a>
        </div>

        <!-- Footer -->
        <div style="text-align:center;font-size:12px;color:#9ca3af;line-height:1.5;">
            <p>This is your daily team activity digest from <a href="https://withoutme.app" style="color:#6366f1;text-decoration:none;">WithoutMe</a>.</p>
            <p>To turn off these emails, open your account settings in the app.</p>
            <p style="margin-top:12px;">support@withoutme.app</p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

/**
 * HTML-escape a string for safe rendering in email.
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
