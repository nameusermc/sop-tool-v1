/**
 * AI Endpoint — Vercel Serverless Function
 * 
 * Combined handler for both "suggest" and "improve" actions.
 * Uses Claude Haiku 4.5 for fast, cheap responses.
 * 
 * Deployed at: https://withoutme.app/api/ai
 * 
 * POST body: { action: "suggest" | "improve", title, description?, steps?, businessType? }
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://withoutme.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (!ANTHROPIC_API_KEY) {
        console.error('[ai] Missing ANTHROPIC_API_KEY');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    // ---- Auth: verify Supabase JWT and Pro subscription ----
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('[ai] Missing Supabase env vars for auth check');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    const token = authHeader.slice(7);
    let userEmail;
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
        userEmail = userData.email;
        if (!userEmail) {
            return res.status(401).json({ error: 'Could not resolve user' });
        }
    } catch (e) {
        console.error('[ai] Auth verification failed:', e);
        return res.status(401).json({ error: 'Authentication failed' });
    }

    // Check Pro subscription
    try {
        const subRes = await fetch(
            `${SUPABASE_URL}/rest/v1/subscriptions?customer_email=eq.${encodeURIComponent(userEmail.toLowerCase().trim())}&status=eq.active&select=id`,
            {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                }
            }
        );
        if (subRes.ok) {
            const subs = await subRes.json();
            if (!subs || subs.length === 0) {
                return res.status(403).json({ error: 'Pro subscription required' });
            }
        } else {
            console.error('[ai] Subscription check failed:', subRes.status);
            return res.status(500).json({ error: 'Subscription check failed' });
        }
    } catch (e) {
        console.error('[ai] Subscription check error:', e);
        return res.status(500).json({ error: 'Subscription check failed' });
    }

    const { action, title, description, steps, businessType } = req.body || {};
    const cleanBizType = (businessType || '').trim().slice(0, 100) || 'small service business';

    if (action === 'suggest') {
        return handleSuggest(res, ANTHROPIC_API_KEY, title, description, cleanBizType);
    } else if (action === 'improve') {
        return handleImprove(res, ANTHROPIC_API_KEY, title, steps, cleanBizType);
    } else {
        return res.status(400).json({ error: 'Invalid action. Use "suggest" or "improve".' });
    }
}

async function handleSuggest(res, apiKey, title, description, businessType) {
    if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Title is required' });
    }

    const cleanTitle = title.trim().slice(0, 200);
    const cleanDescription = (description || '').trim().slice(0, 500);

    const systemPrompt = `You are a Standard Operating Procedure assistant for a ${businessType}.

Given an SOP title and optional description, generate 5-8 clear, actionable steps that a team member could follow without supervision. Tailor the steps to this specific type of business.

After the steps, suggest 2-3 short keyword tags that would help someone search for this SOP later.

Rules for steps:
- Each step should be one clear action, written as a direct instruction
- Use simple language — assume the reader is a field technician or new employee, not a manager
- Include specific details relevant to this type of business where appropriate
- Steps should be in logical order
- Keep each step to 1-2 sentences maximum
- Start each step with a strong verb

Rules for tags:
- 2-3 single-word or short-phrase tags, all lowercase
- Relevant to the procedure and business type
- Useful for searching/filtering

Output format (follow exactly):
STEPS
[one step per line, no numbers]
TAGS
[comma-separated tags]`;

    let userMessage = `SOP Title: ${cleanTitle}`;
    if (cleanDescription) userMessage += `\nDescription: ${cleanDescription}`;

    try {
        const text = await callAnthropic(apiKey, systemPrompt, userMessage);
        
        // Parse structured response
        let steps = [];
        let tags = [];

        if (text.includes('STEPS') && text.includes('TAGS')) {
            const stepsSection = text.split('TAGS')[0].replace('STEPS', '').trim();
            const tagsSection = text.split('TAGS')[1].trim();

            steps = stepsSection
                .split('\n')
                .map(line => line.replace(/^\d+[\.\)\-]\s*/, '').replace(/^[-•*]\s*/, '').trim())
                .filter(line => line.length > 0);

            tags = tagsSection
                .split(',')
                .map(t => t.trim().toLowerCase().replace(/^#/, ''))
                .filter(t => t.length > 0 && t.length < 30)
                .slice(0, 5);
        } else {
            // Fallback: treat entire response as steps
            steps = text
                .split('\n')
                .map(line => line.replace(/^\d+[\.\)\-]\s*/, '').replace(/^[-•*]\s*/, '').trim())
                .filter(line => line.length > 0);
        }

        return res.status(200).json({ steps, tags });
    } catch (e) {
        console.error('[ai] Suggest error:', e);
        return res.status(500).json({ error: 'Failed to generate steps' });
    }
}

async function handleImprove(res, apiKey, title, steps, businessType) {
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ error: 'Steps array is required' });
    }

    const cleanTitle = (title || 'Untitled SOP').trim().slice(0, 200);
    const cleanSteps = steps
        .slice(0, 30)
        .map(s => (typeof s === 'string' ? s : s.text || '').trim().slice(0, 500))
        .filter(s => s.length > 0);

    if (cleanSteps.length === 0) {
        return res.status(400).json({ error: 'No valid steps provided' });
    }

    const systemPrompt = `You are a Standard Operating Procedure editor for a ${businessType}.

Given a list of SOP steps, rewrite each one so a brand-new employee on their first day could follow it with zero help. The reader has no context about the business.

Rules:
- Keep the same number of steps in the same order
- Rewrite each step to be specific and actionable — replace vague instructions with concrete ones
- Add missing details: what tool to use, where to find things, what "done" looks like
- If a step combines two actions, keep it as one step but make both actions explicit
- Start each step with a strong verb (Check, Open, Turn, Set, Confirm, Wipe, Lock, etc.)
- Cut filler words — no "make sure to", "be sure to", "please", "remember to"
- Use plain English a high schooler would understand
- Keep each step to 1-2 sentences maximum
- Do not add new steps or remove any
- Do not include numbering — just the step text
- Do not include any preamble, explanation, or commentary
- Return ONLY the improved steps, one per line, in the same order`;

    const numberedSteps = cleanSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const userMessage = `SOP: ${cleanTitle}\n\nCurrent steps:\n${numberedSteps}`;

    try {
        const text = await callAnthropic(apiKey, systemPrompt, userMessage);

        const improved = text
            .split('\n')
            .map(line => line.replace(/^\d+[\.\)\-]\s*/, '').replace(/^[-•*]\s*/, '').trim())
            .filter(line => line.length > 0);

        return res.status(200).json({ steps: improved });
    } catch (e) {
        console.error('[ai] Improve error:', e);
        return res.status(500).json({ error: 'Failed to improve steps' });
    }
}

async function callAnthropic(apiKey, systemPrompt, userMessage) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2048,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }]
        })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error('[ai] Anthropic API error:', response.status, err);
        throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
}
