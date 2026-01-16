// Simplified API service for standalone quiz app (no authentication required)

const getApiUrl = (): string => {
    // Always use localhost when running locally (check if we're on localhost)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const defaultUrl = 'http://localhost:3010/api';
    
    if (isLocalhost) {
        console.log('[api] Running on localhost, forcing API to:', defaultUrl);
        return defaultUrl;
    }
    
    // For non-localhost, use env var or default
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    const url = envUrl || defaultUrl;
    console.log('[api] getApiUrl:', { envUrl, defaultUrl, using: url, hostname: window.location.hostname });
    return url;
};

// Generic API request function (no auth)
const apiRequest = async <T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> => {
    const headers = new Headers(options.headers);

    // Don't set Content-Type if it's already set (e.g. for FormData).
    if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    // Handle endpoints that already include /api prefix
    let fullUrl = '';
    const baseUrl = getApiUrl();
    if (endpoint.startsWith('/api/')) {
        const cleanEndpoint = endpoint.substring(4); // Remove leading /api
        fullUrl = `${baseUrl}${cleanEndpoint}`;
    } else if (endpoint.startsWith('/quiz/') || endpoint.startsWith('/quiz-assets/')) {
        // Quiz endpoints need /api prefix - add it
        fullUrl = `${baseUrl}${endpoint}`;
    } else {
        fullUrl = `${baseUrl}${endpoint}`;
    }

    console.log(`API Request URL: ${fullUrl}`);

    const response = await fetch(fullUrl, {
        ...options,
        headers,
        // No credentials needed for public quiz app
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[api] HTTP error:', response.status, errorData);
        throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
    }

    // Handle responses that might not have a body (e.g., 204 No Content).
    const responseText = await response.text();
    try {
        const parsed = JSON.parse(responseText);
        console.log('[api] Response:', { status: response.status, type: typeof parsed, isArray: Array.isArray(parsed), keys: typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : 'N/A' });
        return parsed;
    } catch (e) {
        // If parsing fails, it's likely an empty body, so return an empty object.
        console.warn('[api] Failed to parse JSON:', responseText);
        return {} as T;
    }
};

export const api = {
    get: <T>(endpoint: string): Promise<T> => apiRequest<T>(endpoint),
    post: <T>(endpoint: string, data?: any): Promise<T> => apiRequest<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
    put: <T>(endpoint: string, data?: any): Promise<T> => apiRequest<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
    delete: <T>(endpoint: string): Promise<T> => apiRequest<T>(endpoint, { method: 'DELETE' }),
    // Alias for consistency (no auth in standalone app)
    getNoAuth: <T>(endpoint: string): Promise<T> => apiRequest<T>(endpoint),
    postNoAuth: <T>(endpoint: string, data?: any): Promise<T> => apiRequest<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
};
