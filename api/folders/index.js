/**
 * /api/folders
 * GET  - List user's folders
 * POST - Create new folder
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
                return await listFolders(client, user, res);
            case 'POST':
                return await createFolder(client, user, req, res);
            default:
                return methodNotAllowed(res, ['GET', 'POST']);
        }
    } catch (err) {
        return serverError(res, err);
    }
}

/**
 * GET /api/folders
 * List all folders for the authenticated user
 */
async function listFolders(client, user, res) {
    const { data, error } = await client
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });
    
    if (error) {
        console.error('List folders error:', error);
        return serverError(res, error);
    }
    
    // Transform to match frontend format
    const folders = data.map(transformFolder);
    
    return success(res, { folders });
}

/**
 * POST /api/folders
 * Create a new folder
 */
async function createFolder(client, user, req, res) {
    const body = await parseBody(req);
    const { name, icon, color, sortOrder } = body;
    
    // Validate required fields
    if (!name?.trim()) {
        return validationError(res, 'Folder name is required');
    }
    
    // Create folder
    const { data, error } = await client
        .from('folders')
        .insert({
            user_id: user.id,
            name: name.trim(),
            icon: icon || '📁',
            color: color || '#6b7280',
            sort_order: sortOrder ?? 0
        })
        .select()
        .single();
    
    if (error) {
        console.error('Create folder error:', error);
        return serverError(res, error);
    }
    
    return created(res, { folder: transformFolder(data) });
}

/**
 * Transform database record to frontend format
 */
function transformFolder(record) {
    return {
        id: record.id,
        name: record.name,
        icon: record.icon,
        color: record.color,
        sortOrder: record.sort_order,
        createdAt: new Date(record.created_at).getTime(),
        updatedAt: new Date(record.updated_at).getTime()
    };
}
