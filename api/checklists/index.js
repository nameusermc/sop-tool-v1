/**
 * /api/checklists
 * GET  - List user's checklists
 * POST - Create new checklist
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
                return await listChecklists(client, user, req, res);
            case 'POST':
                return await createChecklist(client, user, req, res);
            default:
                return methodNotAllowed(res, ['GET', 'POST']);
        }
    } catch (err) {
        return serverError(res, err);
    }
}

/**
 * GET /api/checklists
 * List all checklists for the authenticated user
 * Query params: status (in_progress|completed), sopId
 */
async function listChecklists(client, user, req, res) {
    let query = client
        .from('checklists')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
    
    // Optional filters
    const { status, sopId } = req.query || {};
    
    if (status) {
        query = query.eq('status', status);
    }
    
    if (sopId) {
        query = query.eq('sop_id', sopId);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('List checklists error:', error);
        return serverError(res, error);
    }
    
    // Transform to match frontend format
    const checklists = data.map(transformChecklist);
    
    return success(res, { checklists });
}

/**
 * POST /api/checklists
 * Create a new checklist from an SOP
 */
async function createChecklist(client, user, req, res) {
    const body = await parseBody(req);
    const { sopId, sopTitle, steps } = body;
    
    // Validate required fields
    if (!sopTitle?.trim()) {
        return validationError(res, 'SOP title is required');
    }
    
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
        return validationError(res, 'Steps are required');
    }
    
    // Transform steps to checklist format
    const checklistSteps = steps.map(step => ({
        text: step.text || step,
        note: step.note || null,
        completed: false,
        completedAt: null,
        userNote: null
    }));
    
    // Create checklist
    const { data, error } = await client
        .from('checklists')
        .insert({
            user_id: user.id,
            sop_id: sopId || null,
            sop_title: sopTitle.trim(),
            sop_snapshot_at: new Date().toISOString(),
            steps: checklistSteps,
            status: 'in_progress',
            completed_steps: 0,
            total_steps: checklistSteps.length
        })
        .select()
        .single();
    
    if (error) {
        console.error('Create checklist error:', error);
        return serverError(res, error);
    }
    
    return created(res, { checklist: transformChecklist(data) });
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
