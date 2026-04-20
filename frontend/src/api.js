// Centralized API client wrapper
const API_BASE = '/api';

export const getAuthToken = () => localStorage.getItem('cortex_token');

/**
 * Custom fetch wrapper that automatically injects the auth token
 * @param {string} endpoint - The API endpoint (e.g. '/items', '/terminal')
 * @param {RequestInit} options - Standard fetch options
 * @returns {Promise<Response>}
 */
export const fetchApi = async (endpoint, options = {}) => {
    const token = getAuthToken();
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Support both absolute and relative endpoints
    const url = endpoint.startsWith('http') || endpoint.startsWith('/') 
        ? endpoint.startsWith('/api') ? endpoint : `${API_BASE}${endpoint}`
        : `${API_BASE}/${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers,
    });

    // GLOBAL INTERCEPTOR: Jika token kadaluarsa atau tidak valid (401)
    if (response.status === 401) {
        console.warn("[SECURITY] Token tidak valid atau kosong. Mengalihkan ke Login...");
        localStorage.removeItem('cortex_token');
        
        // Hanya redirect jika kita tidak sedang berada di halaman login
        if (window.location.pathname !== '/') {
            window.location.href = '/';
        }
    }

    return response;
};

// Convenience methods for common API calls
export const api = {
    get: (endpoint, options = {}) => fetchApi(endpoint, { ...options, method: 'GET' }),
    post: (endpoint, data, options = {}) => fetchApi(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) }),
    put: (endpoint, data, options = {}) => fetchApi(endpoint, { ...options, method: 'PUT', body: JSON.stringify(data) }),
    delete: (endpoint, options = {}) => fetchApi(endpoint, { ...options, method: 'DELETE' }),
    // CORTEX Vision — kirim foto (base64) + perintah teks ke OCR endpoint
    postVision: (image, command, options = {}) => fetchApi('/terminal/vision', {
        ...options,
        method: 'POST',
        body: JSON.stringify({ image, command }),
    }),
};

export default api;
