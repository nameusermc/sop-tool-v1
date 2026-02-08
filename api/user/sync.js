/**
 * POST /api/user/sync
 * Bulk import data from localStorage to database
 * Used for migrating existing users to the new backend
 */

import { requireAuth } from '../../lib/auth.js';
import { success, validationError, serverError, methodNotAllowed, handleCors, parseBody } from '../../lib/response.js';

export default async function handler(req, res) {
    // Handle CORS
    if (handleCors(req, res)) return;
    
    // Only allow POST
    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['POST']);
    }
    
    // Require authentication
    const auth = await requireAuth(req, res);
    if (!auth) return;
    
    const { user, client } = auth;
    
    try {
        const body = await parseBody(req);
        const { folders, sops, checklists } = body;
        
        const results = {
            folders: { imported: 0, errors: 0 },
            sops: { imported: 0, errors: 0 },
            checklists: { imported: 0, errors: 0 }
        };
        
        // Map old IDs to new IDs for foreign key references
        const folderIdMap = new Map();
        const sopIdMap = new Map();
        
        // 1. Import folders first
        if (folders && Array.isArray(folders)) {
            for (const folder of folders) {
                try {
                    const { data, error } = await client
                        .from('folders')
                        .insert({
                            user_id: user.id,
                            name: folder.name || 'Unnamed Folder',
                            icon: folder.icon || '📁',
                            color: folder.color || '#6b7280',
                            sort_order: folder.sortOrder ?? 0
                        })
                        .select('id')
                        .single();
                    
                    if (error) {
                        console.error('Folder import error:', error);
                        results.folders.errors++;
                    } else {
                        folderIdMap.set(folder.id, data.id);
                        results.folders.imported++;
                    }
                } catch (err) {
                    console.error('Folder import exception:', err);
                    results.folders.errors++;
                }
            }
        }
        
        // 2. Import SOPs
        if (sops && Array.isArray(sops)) {
            for (const sop of sops) {
                try {
                    // Map folder ID to new ID
                    let newFolderId = null;
                    if (sop.folderId && sop.folderId !== 'general') {
                        newFolderId = folderIdMap.get(sop.folderId) || null;
                    }
                    
                    const { data, error } = await client
                        .from('sops')
                        .insert({
                            user_id: user.id,
                            title: sop.title || 'Untitled SOP',
                            description: sop.description || null,
                            folder_id: newFolderId,
                            steps: sop.steps || [],
                            tags: sop.tags || [],
                            status: sop.status || 'draft'
                        })
                        .select('id')
                        .single();
                    
                    if (error) {
                        console.error('SOP import error:', error);
                        results.sops.errors++;
                    } else {
                        sopIdMap.set(sop.id, data.id);
                        results.sops.imported++;
                    }
                } catch (err) {
                    console.error('SOP import exception:', err);
                    results.sops.errors++;
                }
            }
        }
        
        // 3. Import checklists
        if (checklists && Array.isArray(checklists)) {
            for (const checklist of checklists) {
                try {
                    // Map SOP ID to new ID (optional, SOP might not exist)
                    let newSopId = null;
                    if (checklist.sopId) {
                        newSopId = sopIdMap.get(checklist.sopId) || null;
                    }
                    
                    const { error } = await client
                        .from('checklists')
                        .insert({
                            user_id: user.id,
                            sop_id: newSopId,
                            sop_title: checklist.sopTitle || 'Untitled Checklist',
                            sop_snapshot_at: checklist.sopSnapshotAt 
                                ? new Date(checklist.sopSnapshotAt).toISOString()
                                : new Date().toISOString(),
                            steps: checklist.steps || [],
                            status: checklist.status || 'in_progress',
                            completed_steps: checklist.completedSteps || 0,
                            total_steps: checklist.totalSteps || (checklist.steps?.length || 0),
                            completed_at: checklist.completedAt 
                                ? new Date(checklist.completedAt).toISOString()
                                : null
                        });
                    
                    if (error) {
                        console.error('Checklist import error:', error);
                        results.checklists.errors++;
                    } else {
                        results.checklists.imported++;
                    }
                } catch (err) {
                    console.error('Checklist import exception:', err);
                    results.checklists.errors++;
                }
            }
        }
        
        return success(res, {
            message: 'Import completed',
            results,
            totalImported: results.folders.imported + results.sops.imported + results.checklists.imported,
            totalErrors: results.folders.errors + results.sops.errors + results.checklists.errors
        });
        
    } catch (err) {
        return serverError(res, err);
    }
}
