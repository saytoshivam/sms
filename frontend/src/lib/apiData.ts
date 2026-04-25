/** Spring Data `Page<T>` or a plain array from the API. */
export type SpringPage<T> = {
  content: T[];
  totalElements: number;
  totalPages?: number;
  number?: number;
  size?: number;
};

export function pageContent<T>(data: SpringPage<T> | T[] | null | undefined): T[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  const c = (data as SpringPage<T>).content;
  return Array.isArray(c) ? c : [];
}

export function pageTotalElements(data: SpringPage<unknown> | unknown[] | null | undefined): number {
  if (data == null) return 0;
  if (Array.isArray(data)) return data.length;
  const n = (data as SpringPage<unknown>).totalElements;
  return typeof n === 'number' ? n : pageContent(data as SpringPage<unknown>).length;
}

/** Jackson may emit ISO strings, arrays [y,m,d], or (rarely) objects for dates. */
export function formatJsonDate(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length >= 3) {
    const y = value[0];
    const m = value[1];
    const d = value[2];
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    if (typeof o.year === 'number' && typeof o.month === 'number' && typeof o.day === 'number') {
      return `${o.year}-${String(o.month).padStart(2, '0')}-${String(o.day).padStart(2, '0')}`;
    }
  }
  return String(value);
}
