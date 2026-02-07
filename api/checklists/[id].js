/**
 * /api/checklists/[id]
 * GET    - Get single checklist
 * PUT    - Update checklist (progress, completion)
 * DELETE - Delete checklist
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
    
    // Get checklist ID from URL
    const { id } = req.query;
    
    if (!id) {
        return validationError(res, 'Checklist ID is required');
    }
    
    try {
        switch (req.method) {
            case 'GET':
                return await getChecklist(client, user, id, res);
            case 'PUT':
                return await updateChecklist(client, user, id, req, res);
            case 'DELETE':
                return await deleteChecklist(client, user, id, res);
            default:
                return methodNotAllowed(res, ['GET', 'PUT', 'DELETE']);
        }
    } catch (err) {
        return serverError(res, err);
    }
}

/**
 * GET /api/checklists/:id
 * Get a single checklist by ID
 */
async function getChecklist(client, user, id, res) {
    const { data, error } = await client
        .from('checklists')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') {
            return notFound(res, 'Checklist not found');
        }
        console.error('Get checklist error:', error);
        return serverError(res, error);
    }
    
    return success(res, { checklist: transformChecklist(data) });
}

/**
 * PUT /api/checklists/:id
 * Update checklist progress
 */
async function updateChecklist(client, user, id, req, res) {
    const body = await parseBody(req);
    const { steps, status } = body;
    
    // Build update object
    const updates = {};
    
    if (steps !== undefined) {
        if (!Array.isArray(steps)) {
            return validationError(res, 'Steps must be an array');
        }
        updates.steps = steps;
        
        // Calculate completed steps count
        const completedCount = steps.filter(s => s.completed).length;
        updates.completed_steps = completedCount;
        updates.total_steps = steps.length;
        
        // Auto-complete if all steps done
        if (completedCount === steps.length && steps.length > 0) {
            updates.status = 'completed';
            updates.completed_at = new Date().toISOString();
        }
    }
    
    if (status !== undefined) {
        if (!['in_progress', 'completed'].includes(status)) {
            return validationError(res, 'Invalid status');
        }
        updates.status = status;
        
        if (status === 'completed' && !updates.completed_at) {
            updates.completed_at = new Date().toISOString();
        }
    }
    
    // Perform update
    const { data, error } = await client
        .from('checklists')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') {
            return notFound(res, 'Checklist not found');
        }
        console.error('Update checklist error:', error);
        return serverError(res, error);
    }
    
    return success(res, { checklist: transformChecklist(data) });
}

/**
 * DELETE /api/checklists/:id
 * Delete a checklist
 */
async function deleteChecklist(client, user, id, res) {
    const { error } = await client
        .from('checklists')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
    
    if (error) {
        console.error('Delete checklist error:', error);
        return serverError(res, error);
    }
    
    return noContent(res);
}

/**
 * Transform database record to frontend format
 */
function transformChecklist(record) {
    return {
        id: record.id,
        sopId: record.sop_id,
        sopTitle: record.sop_title,
        sopSnapshotAt: new Date(record.sop_snapshot_at).getTime(),
        steps: record.steps || [],
        status: record.status,
        completedSteps: record.completed_steps,
        totalSteps: record.total_steps,
        createdAt: new Date(record.created_at).getTime(),
        updatedAt: new Date(record.updated_at).getTime(),
        completedAt: record.completed_at ? new Date(record.completed_at).getTime() : null
    };
}
