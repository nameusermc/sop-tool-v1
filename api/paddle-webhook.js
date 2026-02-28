/**
 * Paddle Webhook Handler — Vercel Serverless Function
 * 
 * Receives Paddle subscription events and writes status to Supabase.
 * Deployed at: https://withoutme.app/api/paddle-webhook
 * 
 * SETUP:
 * 1. In Vercel dashboard → Settings → Environment Variables, add:
 *    - PADDLE_WEBHOOK_SECRET  (from Paddle → Developer Tools → Notifications)
 *    - SUPABASE_URL           (https://zzsndvvaihnflrglvtnj.supabase.co)
 *    - SUPABASE_SERVICE_KEY   (service_role key from Supabase → Settings → API)
 * 
 * 2. In Paddle dashboard → Developer Tools → Notifications:
 *    - Add webhook URL: https://withoutme.app/api/paddle-webhook
 *    - Subscribe to: subscription.created, subscription.updated, subscription.canceled
 *    - Copy the webhook secret → add as PADDLE_WEBHOOK_SECRET in Vercel
 * 
 * NOTE: Uses SUPABASE_SERVICE_KEY (service_role) to bypass RLS.
 *       This key must NEVER be exposed to the browser.
 */

import crypto from 'crypto';

// ========================================================================
// WEBHOOK SIGNATURE VERIFICATION
// ========================================================================

/**
 * Verify Paddle webhook signature (Paddle v2 Billing).
 * Header format: ts=TIMESTAMP;h1=HASH
 */
function verifySignature(rawBody, signatureHeader, secret) {
    if (!signatureHeader || !secret) return false;

    try {
        // Parse header: ts=1234567890;h1=abc123...
        const parts = {};
        signatureHeader.split(';').forEach(part => {
            const [key, value] = part.split('=');
            parts[key] = value;
        });

        const ts = parts.ts;
        const h1 = parts.h1;

        if (!ts || !h1) return false;

        // Build signed payload: timestamp:body
        const signedPayload = `${ts}:${rawBody}`;

        // Compute HMAC-SHA256
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(signedPayload)
            .digest('hex');

        // Constant-time comparison
        return crypto.timingSafeEqual(
            Buffer.from(h1),
            Buffer.from(expectedSignature)
        );
    } catch (e) {
        console.error('[paddle-webhook] Signature verification error:', e);
        return false;
    }
}

// ========================================================================
// SUPABASE HELPERS
// ========================================================================

/**
 * Upsert subscription record in Supabase.
 * Uses the service_role key to bypass RLS.
 */
async function upsertSubscription(supabaseUrl, supabaseKey, data) {
    const url = `${supabaseUrl}/rest/v1/subscriptions`;
    
    // Check if record exists by customer email
    const checkUrl = `${url}?customer_email=eq.${encodeURIComponent(data.customer_email)}&select=id`;
    const checkRes = await fetch(checkUrl, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const existing = await checkRes.json();

    if (existing && existing.length > 0) {
        // Update existing
        const updateUrl = `${url}?customer_email=eq.${encodeURIComponent(data.customer_email)}`;
        const res = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                paddle_subscription_id: data.paddle_subscription_id,
                paddle_customer_id: data.paddle_customer_id,
                status: data.status,
                current_period_end: data.current_period_end,
                updated_at: new Date().toISOString()
            })
        });
        return { success: res.ok, action: 'updated' };
    } else {
        // Insert new
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                customer_email: data.customer_email,
                paddle_subscription_id: data.paddle_subscription_id,
                paddle_customer_id: data.paddle_customer_id,
                status: data.status,
                plan: 'pro',
                current_period_end: data.current_period_end,
                updated_at: new Date().toISOString()
            })
        });
        return { success: res.ok, action: 'inserted' };
    }
}

// ========================================================================
// RAW BODY READER
// ========================================================================

function getRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

// ========================================================================
// MAIN HANDLER
// ========================================================================

export default async function handler(req, res) {
    // Only accept POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    // Validate env vars
    if (!PADDLE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('[paddle-webhook] Missing environment variables');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    // Read raw body from stream (body parser is disabled)
    const rawBody = await getRawBody(req);
    const signature = req.headers['paddle-signature'];

    // Verify webhook signature
    if (!verifySignature(rawBody, signature, PADDLE_WEBHOOK_SECRET)) {
        console.warn('[paddle-webhook] Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse event from raw body
    const event = JSON.parse(rawBody);
    const eventType = event.event_type;
    const data = event.data;

    console.log(`[paddle-webhook] Received: ${eventType}`);

    // Handle subscription events
    const handledEvents = [
        'subscription.created',
        'subscription.updated',
        'subscription.canceled',
        'subscription.past_due',
        'subscription.paused',
        'subscription.resumed',
        'subscription.activated'
    ];

    if (!handledEvents.includes(eventType)) {
        // Acknowledge but ignore events we don't care about
        console.log(`[paddle-webhook] Ignoring event: ${eventType}`);
        return res.status(200).json({ received: true, handled: false });
    }

    // Extract subscription info
    const customerEmail = data.customer_email_address || data.customer?.email;
    const subscriptionId = data.id;
    const customerId = data.customer_id;
    const currentPeriodEnd = data.current_billing_period?.ends_at || null;

    if (!customerEmail) {
        console.error('[paddle-webhook] No customer email in event data');
        return res.status(400).json({ error: 'Missing customer email' });
    }

    // Map Paddle status to our status
    let status;
    switch (eventType) {
        case 'subscription.created':
        case 'subscription.activated':
        case 'subscription.resumed':
            status = 'active';
            break;
        case 'subscription.updated':
            // Check the actual status from the data
            status = data.status === 'active' ? 'active' : data.status || 'active';
            break;
        case 'subscription.canceled':
            status = 'canceled';
            break;
        case 'subscription.past_due':
            status = 'past_due';
            break;
        case 'subscription.paused':
            status = 'paused';
            break;
        default:
            status = 'active';
    }

    console.log(`[paddle-webhook] Processing: ${customerEmail} → ${status}`);

    // Write to Supabase
    try {
        const result = await upsertSubscription(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            customer_email: customerEmail.toLowerCase().trim(),
            paddle_subscription_id: subscriptionId,
            paddle_customer_id: customerId,
            status,
            current_period_end: currentPeriodEnd
        });

        console.log(`[paddle-webhook] Supabase ${result.action}: ${customerEmail} → ${status}`);
        return res.status(200).json({ received: true, handled: true, ...result });
    } catch (e) {
        console.error('[paddle-webhook] Supabase error:', e);
        return res.status(500).json({ error: 'Database write failed' });
    }
}

// Vercel config: disable body parser to get raw body for signature verification
export const config = {
    api: {
        bodyParser: false
    }
};
