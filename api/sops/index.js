/**
 * /api/sops
 * GET  - List user's SOPs
 * POST - Create new SOP
 */

import { requireAuth } from '../../lib/auth.js';
import { success, created, validationError, serverError, methodNotAllowed, handleCors, parseBody } from '../../lib/response.js';

export default async function handler(req, res) {
    // Handle CORS
    if (handleCors(req, res)) return;
    
    // Require authentication
    const auth = await requireAuth(req, res);
    if (!auth) return;
    
    const { user, client } = auth;
    
    try {
        switch (req.method) {
            case 'GET':
                return await listSops(client, user, req, res);
            case 'POST':
                return await createSop(client, user, req, res);
            default:
                return methodNotAllowed(res, ['GET', 'POST']);
        }
    } catch (err) {
        return serverError(res, err);
    }
}

/**
 * GET /api/sops
 * List all SOPs for the authenticated user
 */
async function listSops(client, user, req, res) {
    const { data, error } = await client
        .from('sops')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
    
    if (error) {
        console.error('List SOPs error:', error);
        return serverError(res, error);
    }
    
    // Transform to match frontend format
    const sops = data.map(transformSop);
    
    return success(res, { sops });
}

/**
 * POST /api/sops
 * Create a new SOP
 */
async function createSop(client, user, req, res) {
    const body = await parseBody(req);
    const { title, description, folderId, steps, tags, status } = body;
    
    // Validate required fields
    if (!title?.trim()) {
        return validationError(res, 'Title is required');
    }
    
    // Validate steps
    if (steps && !Array.isArray(steps)) {
        return validationError(res, 'Steps must be an array');
    }
    
    // Create SOP
    const { data, error } = await client
        .from('sops')
        .insert({
            user_id: user.id,
            title: title.trim(),
            description: description?.trim() || null,
            folder_id: folderId || null,
            steps: steps || [],
            tags: tags || [],
            status: status || 'draft'
        })
        .select()
        .single();
    
    if (error) {
        console.error('Create SOP error:', error);
        return serverError(res, error);
    }
    
    return created(res, { sop: transformSop(data) });
}

/**
 * Transform database record to frontend format
 */
function transformSop(record) {
    return {
        id: record.id,
        title: record.title,
        description: record.description,
        folderId: record.folder_id || 'general',
        steps: record.steps || [],
        tags: record.tags || [],
        status: record.status,
        createdAt: new Date(record.created_at).getTime(),
        updatedAt: new Date(record.updated_at).getTime()
    };
}
