// Check URL query, localStorage, and sessionStorage so user stays logged in permanently
const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const urlToken = urlParams?.get('token') ?? '';

let token =
  urlToken ||
  (typeof window !== 'undefined'
    ? (localStorage.getItem('opendots-token') ??
       sessionStorage.getItem('opendots-token') ??
       '')
    : '');

// If token came from URL, save to localStorage and clean up URL parameter
if (urlToken && typeof window !== 'undefined') {
  localStorage.setItem('opendots-token', urlToken);
  sessionStorage.setItem('opendots-token', urlToken);
  const cleanUrl = window.location.pathname + window.location.hash;
  window.history.replaceState({}, document.title, cleanUrl);
}

export function setToken(value: string) {
  token = value;
  if (typeof window !== 'undefined') {
    if (value) {
      localStorage.setItem('opendots-token', value);
      sessionStorage.setItem('opendots-token', value);
    } else {
      localStorage.removeItem('opendots-token');
      sessionStorage.removeItem('opendots-token');
    }
  }
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    signal,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(['GET', 'HEAD'].includes(method)
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = (await response.json().catch(() => ({
    error:
      response.status >= 500
        ? 'Server is temporarily restarting or updating...'
        : 'Server returned an unreadable response.',
  }))) as {
    error?: string;
  };
  if (!response.ok)
    throw new ApiError(
      data.error ?? `Request failed (${response.status}).`,
      response.status,
    );
  return data as T;
}
export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
