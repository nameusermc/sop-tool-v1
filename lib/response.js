/**
 * API Response Helpers
 * Consistent response formatting for all endpoints
 */

/**
 * Success response
 */
export function success(res, data, status = 200) {
    return res.status(status).json({
        success: true,
        data
    });
}

/**
 * Created response (201)
 */
export function created(res, data) {
    return success(res, data, 201);
}

/**
 * No content response (204)
 */
export function noContent(res) {
    return res.status(204).end();
}

/**
 * Error response
 */
export function error(res, message, status = 400, details = null) {
    const response = {
        success: false,
        error: message
    };
    
    if (details) {
        response.details = details;
    }
    
    return res.status(status).json(response);
}

/**
 * Validation error (400)
 */
export function validationError(res, message, details = null) {
    return error(res, message, 400, details);
}

/**
 * Unauthorized error (401)
 */
export function unauthorized(res, message = 'Unauthorized') {
    return error(res, message, 401);
}

/**
 * Forbidden error (403)
 */
export function forbidden(res, message = 'Forbidden') {
    return error(res, message, 403);
}

/**
 * Not found error (404)
 */
export function notFound(res, message = 'Not found') {
    return error(res, message, 404);
}

/**
 * Method not allowed (405)
 */
export function methodNotAllowed(res, allowed = []) {
    res.setHeader('Allow', allowed.join(', '));
    return error(res, `Method not allowed. Use: ${allowed.join(', ')}`, 405);
}

/**
 * Server error (500)
 */
export function serverError(res, err) {
    console.error('Server error:', err);
    return error(res, 'Internal server error', 500);
}

/**
 * Handle OPTIONS request for CORS
 */
export function handleCors(req, res) {
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true;
    }
    return false;
}

/**
 * Parse JSON body safely
 */
export async function parseBody(req) {
    if (req.body) return req.body;
    
    return new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch {
                resolve({});
            }
        });
    });
}

export default {
    success,
    created,
    noContent,
    error,
    validationError,
    unauthorized,
    forbidden,
    notFound,
    methodNotAllowed,
    serverError,
    handleCors,
    parseBody
};
