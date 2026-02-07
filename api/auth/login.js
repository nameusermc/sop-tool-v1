/**
 * POST /api/auth/login
 * Authenticate user and return session
 */

import { supabase } from '../../lib/supabase.js';
import { setAuthCookies } from '../../lib/auth.js';
import { success, validationError, unauthorized, serverError, handleCors, parseBody } from '../../lib/response.js';

export default async function handler(req, res) {
    // Handle CORS
    if (handleCors(req, res)) return;
    
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const body = await parseBody(req);
        const { email, password } = body;
        
        // Validate input
        if (!email || !password) {
            return validationError(res, 'Email and password are required');
        }
        
        // Authenticate
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            // Generic error message for security
            return unauthorized(res, 'Invalid email or password');
        }
        
        // Set auth cookies
        setAuthCookies(res, data.session);
        
        return success(res, {
            user: {
                id: data.user.id,
                email: data.user.email,
                displayName: data.user.user_metadata?.display_name
            },
            session: {
                accessToken: data.session.access_token,
                expiresAt: data.session.expires_at
            }
        });
        
    } catch (err) {
        return serverError(res, err);
    }
}
