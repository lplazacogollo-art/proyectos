const SESSION_STORAGE_KEY = 'vs_session_token';

let inMemoryToken: string | null = null;

export function setSessionToken(token: string | null): void {
  inMemoryToken = token;
  try {
    if (token) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // sessionStorage puede estar restringido en algunos contextos
  }
}

export function getSessionToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      inMemoryToken = stored;
      return stored;
    }
  } catch {
    // ignorar
  }
  return null;
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getSessionToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has('X-Session-Token')) {
    headers.set('X-Session-Token', token);
  }
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}

export async function downloadAuthenticatedFile(url: string, filename: string): Promise<void> {
  const res = await apiFetch(url);
  if (!res.ok) {
    let errMsg = 'No se pudo descargar el archivo.';
    try {
      const json = await res.json();
      if (json?.error) errMsg = json.error;
    } catch {
      // ignorar
    }
    throw new Error(errMsg);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
