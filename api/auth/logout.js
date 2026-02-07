/**
 * POST /api/auth/logout
 * End user session
 */

import { supabase } from '../../lib/supabase.js';
import { getAccessToken, clearAuthCookies } from '../../lib/auth.js';
import { success, serverError, handleCors } from '../../lib/response.js';

export default async function handler(req, res) {
    // Handle CORS
    if (handleCors(req, res)) return;
    
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // Get current token (if any)
        const accessToken = getAccessToken(req);
        
        // Attempt to sign out from Supabase (best effort)
        if (accessToken) {
            try {
                await supabase.auth.signOut();
            } catch {
                // Ignore errors - we'll clear cookies anyway
            }
        }
        
        // Clear auth cookies
        clearAuthCookies(res);
        
        return success(res, {
            message: 'Logged out successfully'
        });
        
    } catch (err) {
        return serverError(res, err);
    }
}
