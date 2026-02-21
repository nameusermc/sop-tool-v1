/**
 * AI Improve Steps — Vercel Serverless Function
 * 
 * Given existing SOP steps, returns clearer/improved versions.
 * Uses Claude Haiku 4.5 for fast, cheap responses.
 * 
 * Deployed at: https://withoutme.app/api/ai-improve
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
        console.error('[ai-improve] Missing ANTHROPIC_API_KEY');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    // Parse and validate input
    const { steps, title } = req.body || {};

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ error: 'Steps array is required' });
    }

    // Input guardrails
    const cleanTitle = (title || 'Untitled SOP').trim().slice(0, 200);
    const cleanSteps = steps
        .slice(0, 30)  // Max 30 steps
        .map(s => (typeof s === 'string' ? s : s.text || '').trim().slice(0, 500))
        .filter(s => s.length > 0);

    if (cleanSteps.length === 0) {
        return res.status(400).json({ error: 'No valid steps provided' });
    }

    // Build the prompt — locked server-side, user cannot modify
    const systemPrompt = `You are a Standard Operating Procedure editor for small service businesses (HVAC, plumbing, cleaning, landscaping, electrical, pest control).

Given a list of SOP steps, improve each one for clarity and simplicity. The reader is a field technician or new employee.

Rules:
- Keep the same number of steps in the same order
- Make each step shorter and clearer where possible
- Use direct, simple language — no jargon
- Each step should be one clear action
- Keep each step to 1-2 sentences maximum
- Do not add new steps or remove any
- Do not include numbering — just the step text
- Do not include any preamble, explanation, or commentary
- Return ONLY the improved steps, one per line, in the same order`;

    const numberedSteps = cleanSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const userMessage = `SOP: ${cleanTitle}\n\nCurrent steps:\n${numberedSteps}`;

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
                max_tokens: 2048,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[ai-improve] Anthropic API error:', response.status, err);
            return res.status(502).json({ error: 'AI service unavailable' });
        }

        const data = await response.json();
        const text = data.content?.[0]?.text || '';

        // Parse improved steps
        const improved = text
            .split('\n')
            .map(line => line.replace(/^\d+[\.\)\-]\s*/, '').replace(/^[-•*]\s*/, '').trim())
            .filter(line => line.length > 0);

        return res.status(200).json({ steps: improved });
    } catch (e) {
        console.error('[ai-improve] Exception:', e);
        return res.status(500).json({ error: 'Failed to improve steps' });
    }
}
