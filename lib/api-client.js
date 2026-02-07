/**
 * SOP Tool API Client
 * Drop-in replacement for localStorage-based persistence
 * 
 * Usage:
 *   import { apiClient } from './lib/api-client.js';
 *   
 *   // Instead of: localStorage.getItem('sop_tool_sops')
 *   const { sops } = await apiClient.sops.list();
 *   
 *   // Instead of: localStorage.setItem('sop_tool_sops', JSON.stringify(sops))
 *   await apiClient.sops.create(newSop);
 */

const API_BASE = '/api';

/**
 * Base fetch wrapper with auth and error handling
 */
async function apiFetch(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    const config = {
        credentials: 'include', // Include cookies for auth
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };
    
    // Add body if present
    if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
    }
    
    const response = await fetch(url, config);
    
    // Handle no content
    if (response.status === 204) {
        return { success: true };
    }
    
    const data = await response.json();
    
    // Handle errors
    if (!response.ok) {
        const error = new Error(data.error || 'API request failed');
        error.status = response.status;
        error.data = data;
        throw error;
    }
    
    return data;
}

/**
 * Auth API
 */
export const auth = {
    /**
     * Register new account
     */
    async register(email, password, displayName) {
        return apiFetch('/auth/register', {
            method: 'POST',
            body: { email, password, displayName }
        });
    },
    
    /**
     * Login
     */
    async login(email, password) {
        return apiFetch('/auth/login', {
            method: 'POST',
            body: { email, password }
        });
    },
    
    /**
     * Logout
     */
    async logout() {
        return apiFetch('/auth/logout', {
            method: 'POST'
        });
    },
    
    /**
     * Check current session
     */
    async session() {
        try {
            return await apiFetch('/auth/session');
        } catch (err) {
            if (err.status === 401) {
                return { data: null, authenticated: false };
            }
            throw err;
        }
    }
};

/**
 * SOPs API
 */
export const sops = {
    /**
     * List all SOPs
     */
    async list() {
        const result = await apiFetch('/sops');
        return result.data;
    },
    
    /**
     * Get single SOP
     */
    async get(id) {
        const result = await apiFetch(`/sops/${id}`);
        return result.data.sop;
    },
    
    /**
     * Create new SOP
     */
    async create(sop) {
        const result = await apiFetch('/sops', {
            method: 'POST',
            body: sop
        });
        return result.data.sop;
    },
    
    /**
     * Update SOP
     */
    async update(id, updates) {
        const result = await apiFetch(`/sops/${id}`, {
            method: 'PUT',
            body: updates
        });
        return result.data.sop;
    },
    
    /**
     * Delete SOP
     */
    async delete(id) {
        await apiFetch(`/sops/${id}`, {
            method: 'DELETE'
        });
        return true;
    }
};

/**
 * Checklists API
 */
export const checklists = {
    /**
     * List checklists
     * @param {Object} filters - Optional filters: { status, sopId }
     */
    async list(filters = {}) {
        const params = new URLSearchParams();
        if (filters.status) params.set('status', filters.status);
        if (filters.sopId) params.set('sopId', filters.sopId);
        
        const query = params.toString();
        const result = await apiFetch(`/checklists${query ? '?' + query : ''}`);
        return result.data;
    },
    
    /**
     * Get single checklist
     */
    async get(id) {
        const result = await apiFetch(`/checklists/${id}`);
        return result.data.checklist;
    },
    
    /**
     * Create new checklist from SOP
     */
    async create(checklist) {
        const result = await apiFetch('/checklists', {
            method: 'POST',
            body: checklist
        });
        return result.data.checklist;
    },
    
    /**
     * Update checklist (progress)
     */
    async update(id, updates) {
        const result = await apiFetch(`/checklists/${id}`, {
            method: 'PUT',
            body: updates
        });
        return result.data.checklist;
    },
    
    /**
     * Delete checklist
     */
    async delete(id) {
        await apiFetch(`/checklists/${id}`, {
            method: 'DELETE'
        });
        return true;
    }
};

/**
 * Folders API
 */
export const folders = {
    /**
     * List all folders
     */
    async list() {
        const result = await apiFetch('/folders');
        return result.data;
    },
    
    /**
     * Create new folder
     */
    async create(folder) {
        const result = await apiFetch('/folders', {
            method: 'POST',
            body: folder
        });
        return result.data.folder;
    },
    
    /**
     * Update folder
     */
    async update(id, updates) {
        const result = await apiFetch(`/folders/${id}`, {
            method: 'PUT',
            body: updates
        });
        return result.data.folder;
    },
    
    /**
     * Delete folder
     */
    async delete(id) {
        await apiFetch(`/folders/${id}`, {
            method: 'DELETE'
        });
        return true;
    }
};

/**
 * User data sync API
 */
export const user = {
    /**
     * Import data from localStorage
     */
    async sync(data) {
        const result = await apiFetch('/user/sync', {
            method: 'POST',
            body: data
        });
        return result.data;
    }
};

/**
 * Combined API client
 */
export const apiClient = {
    auth,
    sops,
    checklists,
    folders,
    user
};

export default apiClient;
