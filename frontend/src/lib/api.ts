const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/live-monitor';

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const token = localStorage.getItem('access_token');
  if (token) {
    defaultOptions.headers = {
      ...defaultOptions.headers,
      Authorization: `Bearer ${token}`
    };
  }

  if (options.body instanceof FormData) {
    const headers = new Headers(options.headers || {});
    headers.delete('Content-Type');
    
    const rawHeaders: Record<string, string> = {};
    headers.forEach((value, key) => {
      rawHeaders[key] = value;
    });
    
    defaultOptions.headers = { ...defaultOptions.headers, ...rawHeaders };
  }

  const finalOptions: RequestInit = {
    ...defaultOptions,
    ...options,
    headers: defaultOptions.headers,
  };

  const response = await fetch(url, finalOptions);

  // Automatic Silent Token Refresh Interceptor
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            localStorage.setItem('access_token', data.access_token);
            if (data.refresh_token) {
              localStorage.setItem('refresh_token', data.refresh_token);
            }
            isRefreshing = false;
            onRefreshed(data.access_token);
            
            // Replay original request with new token
            finalOptions.headers = {
              ...finalOptions.headers,
              Authorization: `Bearer ${data.access_token}`
            };
            const retryRes = await fetch(url, finalOptions);
            if (!retryRes.ok) {
              const errData = await retryRes.json().catch(() => ({}));
              throw new Error(errData.detail || `API Error: ${retryRes.status}`);
            }
            return retryRes.json();
          } else {
            throw new Error('Refresh failed');
          }
        } catch (err) {
          isRefreshing = false;
          refreshSubscribers = [];
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          throw new Error('Session expired.');
        }
      } else {
        // Queue request while refresh is in progress
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(async (newToken) => {
            try {
              finalOptions.headers = {
                ...finalOptions.headers,
                Authorization: `Bearer ${newToken}`
              };
              const retryRes = await fetch(url, finalOptions);
              if (!retryRes.ok) {
                const errData = await retryRes.json().catch(() => ({}));
                reject(new Error(errData.detail || `API Error: ${retryRes.status}`));
              } else {
                resolve(await retryRes.json());
              }
            } catch (e) {
              reject(e);
            }
          });
        });
      }
    } else {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      throw new Error('Session expired.');
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.status}`);
  }

  return response.json();
}
