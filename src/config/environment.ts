// Simplified environment config for standalone quiz app

export const getApiUrl = (): string => {
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    const defaultUrl = 'http://localhost:3010/api';
    const url = envUrl || defaultUrl;
    // Force HTTP for localhost to avoid SSL errors
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
        return url.replace(/^https:/, 'http:');
    }
    return url;
};
