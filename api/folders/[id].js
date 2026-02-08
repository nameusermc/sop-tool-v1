/**
 * /api/folders/[id]
 * PUT    - Update folder
 * DELETE - Delete folder
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
    
    // Get folder ID from URL
    const { id } = req.query;
    
    if (!id) {
        return validationError(res, 'Folder ID is required');
    }
    
    try {
        switch (req.method) {
            case 'PUT':
                return await updateFolder(client, user, id, req, res);
            case 'DELETE':
                return await deleteFolder(client, user, id, res);
            default:
                return methodNotAllowed(res, ['PUT', 'DELETE']);
        }
    } catch (err) {
        return serverError(res, err);
    }
}

/**
 * PUT /api/folders/:id
 * Update an existing folder
 */
async function updateFolder(client, user, id, req, res) {
    const body = await parseBody(req);
    const { name, icon, color, sortOrder } = body;
    
    // Build update object (only include provided fields)
    const updates = {};
    
    if (name !== undefined) {
        if (!name?.trim()) {
            return validationError(res, 'Folder name cannot be empty');
        }
        updates.name = name.trim();
    }
    
    if (icon !== undefined) {
        updates.icon = icon;
    }
    
    if (color !== undefined) {
        updates.color = color;
    }
    
    if (sortOrder !== undefined) {
        updates.sort_order = sortOrder;
    }
    
    // Perform update
    const { data, error } = await client
        .from('folders')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') {
            return notFound(res, 'Folder not found');
        }
        console.error('Update folder error:', error);
        return serverError(res, error);
    }
    
    return success(res, { folder: transformFolder(data) });
}

/**
 * DELETE /api/folders/:id
 * Delete a folder (SOPs in folder will have folder_id set to null)
 */
async function deleteFolder(client, user, id, res) {
    const { error } = await client
        .from('folders')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
    
    if (error) {
        console.error('Delete folder error:', error);
        return serverError(res, error);
    }
    
    return noContent(res);
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
