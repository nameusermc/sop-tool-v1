/**
 * AI Suggest Steps — Vercel Serverless Function
 * 
 * Given an SOP title and optional description, generates suggested steps.
 * Uses Claude Haiku 4.5 for fast, cheap responses.
 * 
 * Deployed at: https://withoutme.app/api/ai-suggest
 * 
 * SETUP: Add ANTHROPIC_API_KEY to Vercel environment variables.
 */

export default async function handler(req, res) {
    // CORS headers for same-origin requests
    res.setHeader('Access-Control-Allow-Origin', 'https://withoutme.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
        console.error('[ai-suggest] Missing ANTHROPIC_API_KEY');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    // Parse and validate input
    const { title, description } = req.body || {};

    if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Title is required' });
    }

    // Input guardrails
    const cleanTitle = title.trim().slice(0, 200);
    const cleanDescription = (description || '').trim().slice(0, 500);

    // Build the prompt — locked server-side, user cannot modify
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

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1024,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[ai-suggest] Anthropic API error:', response.status, err);
            return res.status(502).json({ error: 'AI service unavailable' });
        }

        const data = await response.json();
        const text = data.content?.[0]?.text || '';

        // Parse steps — split by newlines, clean up
        const steps = text
            .split('\n')
            .map(line => line.replace(/^\d+[\.\)\-]\s*/, '').replace(/^[-•*]\s*/, '').trim())
            .filter(line => line.length > 0);

        return res.status(200).json({ steps });
    } catch (e) {
        console.error('[ai-suggest] Exception:', e);
        return res.status(500).json({ error: 'Failed to generate steps' });
    }
}
