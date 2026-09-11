export const getBaseUrl = (): string => {
  const custom = localStorage.getItem('astro_server_url');
  if (custom) return custom.replace(/\/+$/, '');
  return (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
};

export const setServerUrl = (url: string) => {
  if (url && url.trim()) {
    localStorage.setItem('astro_server_url', url.trim().replace(/\/+$/, ''));
  } else {
    localStorage.removeItem('astro_server_url');
  }
};

// Auto-detect server URL from QR code scan (?server=http://192.168.1.X:8000)
if (typeof window !== 'undefined' && window.location && window.location.search) {
  try {
    const params = new URLSearchParams(window.location.search);
    const scannedServer = params.get('server');
    if (scannedServer) {
      setServerUrl(scannedServer);
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
      console.log(`[AstroLedger] Auto-paired with server from QR code: ${scannedServer}`);
    }
  } catch (e) {
    // Ignore in non-browser environments
  }
}

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

export const getAccessToken = (): string | null => localStorage.getItem('astro_access_token');
export const getRefreshToken = (): string | null => localStorage.getItem('astro_refresh_token');

export const setTokens = (access: string, refresh: string) => {
  localStorage.setItem('astro_access_token', access);
  localStorage.setItem('astro_refresh_token', refresh);
};

export const clearTokens = () => {
  localStorage.removeItem('astro_access_token');
  localStorage.removeItem('astro_refresh_token');
};

export async function apiRequest<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { requiresAuth = true, headers = {}, ...rest } = options;
  const baseUrl = getBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (requiresAuth) {
    const token = getAccessToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  let response = await fetch(url, {
    ...rest,
    headers: requestHeaders,
  });

  // Token refresh logic if 401 received
  if (response.status === 401 && requiresAuth) {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        const refreshResponse = await fetch(`${baseUrl}/api/auth/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setTokens(data.access, refresh);
          requestHeaders['Authorization'] = `Bearer ${data.access}`;
          response = await fetch(url, { ...rest, headers: requestHeaders });
        } else {
          clearTokens();
        }
      } catch (err) {
        clearTokens();
      }
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let errorMessage = errorData.detail || errorData.message;
    if (!errorMessage && typeof errorData === 'object' && Object.keys(errorData).length > 0) {
      errorMessage = Object.entries(errorData)
        .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(', ') : errs}`)
        .join(' | ');
    }
    throw new Error(errorMessage || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export interface DuplicateMatch {
  client: any;
  confidence_score: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  matched_fields: string[];
  match_reasons: string[];
}

export interface DuplicateCheckResult {
  total_potential_duplicates: number;
  matches: DuplicateMatch[];
}

export async function checkClientDuplicates(
  candidate: Record<string, any> & { exclude_client_id?: string }
): Promise<DuplicateCheckResult> {
  return apiRequest<DuplicateCheckResult>('/api/clients/check-duplicates/', {
    method: 'POST',
    body: JSON.stringify(candidate),
  });
}

export async function toggleFollowUp(consultationId: string): Promise<any> {
  return apiRequest(`/api/consultations/${consultationId}/toggle-follow-up/`, {
    method: 'POST',
  });
}

export async function deleteConsultation(consultationId: string): Promise<void> {
  return apiRequest(`/api/consultations/${consultationId}/`, {
    method: 'DELETE',
  });
}

/**
 * Wraps a write mutation with offline fallback.
 * If the network request fails due to connectivity, the mutation is
 * enqueued in IndexedDB for later sync. Returns true if queued offline.
 */
export async function apiMutationWithOfflineFallback(
  endpoint: string,
  options: RequestOptions,
  offlineEvent: {
    entity_type: 'client' | 'consultation';
    entity_id: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    version: number;
    payload: any;
  },
): Promise<{ data: any; queuedOffline: boolean }> {
  const { enqueueOfflineEvent } = await import('../storage/indexedDB');
  const { getDeviceId } = await import('../sync/syncEngine');

  try {
    const data = await apiRequest(endpoint, options);
    return { data, queuedOffline: false };
  } catch (err: any) {
    // If offline, queue the mutation
    if (!navigator.onLine || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      const idempotencyKey = `${getDeviceId()}_${offlineEvent.entity_type}_${offlineEvent.entity_id}_${Date.now()}`;
      await enqueueOfflineEvent({
        id: offlineEvent.entity_id,
        device_id: getDeviceId(),
        entity_type: offlineEvent.entity_type,
        entity_id: offlineEvent.entity_id,
        operation: offlineEvent.operation,
        version: offlineEvent.version,
        idempotency_key: idempotencyKey,
        payload: offlineEvent.payload,
        timestamp: new Date().toISOString(),
      });
      return { data: null, queuedOffline: true };
    }
    throw err;
  }
}
