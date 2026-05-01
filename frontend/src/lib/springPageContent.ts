export type SpringPage<T> = { content: T[] };

/** Normalizes paginated-or-array payloads from Spring and similar APIs */
export function pageContent<T>(data: SpringPage<T> | T[] | undefined | null): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Array.isArray(data.content) ? data.content : [];
}
