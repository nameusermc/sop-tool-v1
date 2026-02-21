/**
 * AI Endpoint — Vercel Serverless Function
 * 
 * Combined handler for both "suggest" and "improve" actions.
 * Uses Claude Haiku 4.5 for fast, cheap responses.
 * 
 * Deployed at: https://withoutme.app/api/ai
 * 
 * POST body: { action: "suggest" | "improve", title, description?, steps? }
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://withoutme.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
        console.error('[ai] Missing ANTHROPIC_API_KEY');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    const { action, title, description, steps } = req.body || {};

    if (action === 'suggest') {
        return handleSuggest(req, res, ANTHROPIC_API_KEY, title, description);
    } else if (action === 'improve') {
        return handleImprove(req, res, ANTHROPIC_API_KEY, title, steps);
    } else {
        return res.status(400).json({ error: 'Invalid action. Use "suggest" or "improve".' });
    }
}

async function handleSuggest(req, res, apiKey, title, description) {
    if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Title is required' });
    }

    const cleanTitle = title.trim().slice(0, 200);
    const cleanDescription = (description || '').trim().slice(0, 500);

    const systemPrompt = `You are a Standard Operating Procedure assistant for small service businesses (HVAC, plumbing, cleaning, landscaping, electrical, pest control).

Given an SOP title and optional description, generate 5-8 clear, actionable steps that a team member could follow without supervision.

Rules:
- Each step should be one clear action, written as a direct instruction
- Use simple language — assume the reader is a field technician, not a manager
- Steps should be in logical order
- Keep each step to 1-2 sentences maximum
- Do not include numbering — just the step text
- Do not include any preamble, explanation, or commentary
- Return ONLY the steps, one per line, separated by newlines`;

    const userMessage = cleanDescription
        ? `SOP Title: ${cleanTitle}\nDescription: ${cleanDescription}`
        : `SOP Title: ${cleanTitle}`;

    return callAnthropic(res, apiKey, systemPrompt, userMessage);
}

async function handleImprove(req, res, apiKey, title, steps) {
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

    const systemPrompt = `You are a Standard Operating Procedure editor for small service businesses (HVAC, plumbing, cleaning, landscaping, electrical, pest control).

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

    return callAnthropic(res, apiKey, systemPrompt, userMessage);
}

async function callAnthropic(res, apiKey, systemPrompt, userMessage) {
    try {
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
            return res.status(502).json({ error: 'AI service unavailable' });
        }

        const data = await response.json();
        const text = data.content?.[0]?.text || '';

        const steps = text
            .split('\n')
            .map(line => line.replace(/^\d+[\.\)\-]\s*/, '').replace(/^[-•*]\s*/, '').trim())
            .filter(line => line.length > 0);

        return res.status(200).json({ steps });
    } catch (e) {
        console.error('[ai] Exception:', e);
        return res.status(500).json({ error: 'Failed to process request' });
    }
}
