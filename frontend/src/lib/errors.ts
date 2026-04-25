/** Turn axios / API error payloads into readable text (avoids `[object Object]`). */
export function formatApiError(err: unknown): string {
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;
  const ax = err as { response?: { data?: unknown }; message?: string };
  const data = ax.response?.data;
  if (typeof data === 'string') return data;
  if (data != null && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    if (typeof o.error === 'string') return o.error;
    if (Array.isArray(o.errors) && o.errors.length) {
      try {
        return JSON.stringify(o.errors);
      } catch {
        /* fall through */
      }
    }
    try {
      return JSON.stringify(data);
    } catch {
      return ax.message ?? 'Request failed';
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
