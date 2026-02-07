/**
 * /api/sops/[id]
 * GET    - Get single SOP
 * PUT    - Update SOP
 * DELETE - Delete SOP
 */

import { requireAuth } from '../../lib/auth.js';
import { success, noContent, validationError, notFound, serverError, methodNotAllowed, handleCors, parseBody } from '../../lib/response.js';

export default async function handler(req, res) {
    // Handle CORS
    if (handleCors(req, res)) return;
    
    // Require authentication
    const auth = await requireAuth(req, res);
    if (!auth) return;
    
    const { user, client } = auth;
    
    // Get SOP ID from URL
    const { id } = req.query;
    
    if (!id) {
        return validationError(res, 'SOP ID is required');
    }
    
    try {
        switch (req.method) {
            case 'GET':
                return await getSop(client, user, id, res);
            case 'PUT':
                return await updateSop(client, user, id, req, res);
            case 'DELETE':
                return await deleteSop(client, user, id, res);
            default:
                return methodNotAllowed(res, ['GET', 'PUT', 'DELETE']);
        }
    } catch (err) {
        return serverError(res, err);
    }
}

/**
 * GET /api/sops/:id
 * Get a single SOP by ID
 */
async function getSop(client, user, id, res) {
    const { data, error } = await client
        .from('sops')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') {
            return notFound(res, 'SOP not found');
        }
        console.error('Get SOP error:', error);
        return serverError(res, error);
    }
    
    return success(res, { sop: transformSop(data) });
}

/**
 * PUT /api/sops/:id
 * Update an existing SOP
 */
async function updateSop(client, user, id, req, res) {
    const body = await parseBody(req);
    const { title, description, folderId, steps, tags, status } = body;
    
    // Build update object (only include provided fields)
    const updates = {};
    
    if (title !== undefined) {
        if (!title?.trim()) {
            return validationError(res, 'Title cannot be empty');
        }
        updates.title = title.trim();
    }
    
    if (description !== undefined) {
        updates.description = description?.trim() || null;
    }
    
    if (folderId !== undefined) {
        updates.folder_id = folderId === 'general' ? null : folderId;
    }
    
    if (steps !== undefined) {
        if (!Array.isArray(steps)) {
            return validationError(res, 'Steps must be an array');
        }
        updates.steps = steps;
    }
    
    if (tags !== undefined) {
        updates.tags = Array.isArray(tags) ? tags : [];
    }
    
    if (status !== undefined) {
        if (!['draft', 'active', 'archived'].includes(status)) {
            return validationError(res, 'Invalid status');
        }
        updates.status = status;
    }
    
    // Perform update
    const { data, error } = await client
        .from('sops')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') {
            return notFound(res, 'SOP not found');
        }
        console.error('Update SOP error:', error);
        return serverError(res, error);
    }
    
    return success(res, { sop: transformSop(data) });
}

/**
 * DELETE /api/sops/:id
 * Delete an SOP
 */
async function deleteSop(client, user, id, res) {
    const { error } = await client
        .from('sops')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
    
    if (error) {
        console.error('Delete SOP error:', error);
        return serverError(res, error);
    }
    
    return noContent(res);
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
