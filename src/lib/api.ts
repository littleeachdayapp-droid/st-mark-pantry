interface ApiResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export function apiPost(path: string, body: Record<string, unknown>): Promise<ApiResult> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Request failed' };
      return { ok: true, data };
    })
    .catch(() => {
      // Silently fail — local operation already succeeded
      return { ok: false, error: 'Network error' };
    });
}
