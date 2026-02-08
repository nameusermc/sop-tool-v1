/**
 * POST /api/auth/register
 * Create new user account
 */

import { supabase } from '../../lib/supabase.js';
import { setAuthCookies } from '../../lib/auth.js';
import { success, validationError, serverError, handleCors, parseBody } from '../../lib/response.js';

export default async function handler(req, res) {
    // Handle CORS
    if (handleCors(req, res)) return;
    
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const body = await parseBody(req);
        const { email, password, displayName } = body;
        
        // Validate input
        if (!email || !password) {
            return validationError(res, 'Email and password are required');
        }
        
        if (password.length < 8) {
            return validationError(res, 'Password must be at least 8 characters');
        }
        
        // Create user
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName || email.split('@')[0]
                }
            }
        });
        
        if (error) {
            // Handle specific errors
            if (error.message.includes('already registered')) {
                return validationError(res, 'An account with this email already exists');
            }
            return validationError(res, error.message);
        }
        
        // Check if email confirmation is required
        if (data.user && !data.session) {
            return success(res, {
                message: 'Please check your email to confirm your account',
                requiresConfirmation: true
            });
        }
        
        // Set cookies if session exists (email confirmation disabled)
        if (data.session) {
            setAuthCookies(res, data.session);
        }
        
        return success(res, {
            user: {
                id: data.user.id,
                email: data.user.email,
                displayName: data.user.user_metadata?.display_name
            },
            session: data.session ? {
                accessToken: data.session.access_token,
                expiresAt: data.session.expires_at
            } : null
        }, 201);
        
    } catch (err) {
        return serverError(res, err);
    }
}
