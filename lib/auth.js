/**
 * Auth Helpers
 * Middleware and utilities for authentication
 */

import { supabase, createUserClient } from './supabase.js';

/**
 * Extract access token from request
 * Supports: Authorization header (Bearer token) or cookie
 */
export function getAccessToken(req) {
    // Check Authorization header first
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    
    // Check cookie
    const cookies = parseCookies(req.headers.cookie || '');
    return cookies['sb-access-token'] || null;
}

/**
 * Parse cookies from header string
 */
function parseCookies(cookieString) {
    const cookies = {};
    if (!cookieString) return cookies;
    
    cookieString.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
            cookies[name] = decodeURIComponent(value);
        }
    });
    
    return cookies;
}

/**
 * Get authenticated user from request
 * Returns { user, client } or null if not authenticated
 */
export async function getAuthUser(req) {
    const accessToken = getAccessToken(req);
    
    if (!accessToken) {
        return null;
    }
    
    try {
        // Verify token and get user
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);
        
        if (error || !user) {
            return null;
        }
        
        // Create a client with this user's token for RLS
        const client = createUserClient(accessToken);
        
        return { user, client, accessToken };
    } catch (err) {
        console.error('Auth error:', err);
        return null;
    }
}

/**
 * Middleware: Require authentication
 * Returns 401 if not authenticated
 */
export async function requireAuth(req, res) {
    const auth = await getAuthUser(req);
    
    if (!auth) {
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Please log in to continue'
        });
        return null;
    }
    
    return auth;
}

/**
 * Set auth cookies in response
 */
export function setAuthCookies(res, session) {
    const isProduction = process.env.NODE_ENV === 'production';
    const maxAge = 60 * 60 * 24 * 7; // 7 days
    
    const cookieOptions = [
        `Path=/`,
        `Max-Age=${maxAge}`,
        `HttpOnly`,
        `SameSite=Lax`,
        isProduction ? 'Secure' : ''
    ].filter(Boolean).join('; ');
    
    res.setHeader('Set-Cookie', [
        `sb-access-token=${session.access_token}; ${cookieOptions}`,
        `sb-refresh-token=${session.refresh_token}; ${cookieOptions}`
    ]);
}

/**
 * Clear auth cookies
 */
export function clearAuthCookies(res) {
    const cookieOptions = 'Path=/; Max-Age=0; HttpOnly; SameSite=Lax';
    
    res.setHeader('Set-Cookie', [
        `sb-access-token=; ${cookieOptions}`,
        `sb-refresh-token=; ${cookieOptions}`
    ]);
}

export default {
    getAccessToken,
    getAuthUser,
    requireAuth,
    setAuthCookies,
    clearAuthCookies
};
