interface ApiOptions {
  method?: string;
  body?: any;
  token?: string | null;
}

export async function api(path: string, options: ApiOptions = {}) {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

export function useApiClient(token: string | null) {
  return {
    get: (path: string) => api(path, { token }),
    post: (path: string, body?: any) => api(path, { method: 'POST', body, token }),
    put: (path: string, body?: any) => api(path, { method: 'PUT', body, token }),
    del: (path: string) => api(path, { method: 'DELETE', token }),
  };
}
