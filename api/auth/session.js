/**
 * GET /api/auth/session
 * Check current session status
 */

import { getAuthUser } from '../../lib/auth.js';
import { success, unauthorized, serverError, handleCors } from '../../lib/response.js';

export default async function handler(req, res) {
    // Handle CORS
    if (handleCors(req, res)) return;
    
    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const auth = await getAuthUser(req);
        
        if (!auth) {
            return unauthorized(res, 'No active session');
        }
        
        return success(res, {
            user: {
                id: auth.user.id,
                email: auth.user.email,
                displayName: auth.user.user_metadata?.display_name
            },
            authenticated: true
        });
        
    } catch (err) {
        return serverError(res, err);
    }
}
