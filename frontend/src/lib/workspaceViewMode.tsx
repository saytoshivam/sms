import { Link } from 'react-router-dom';

/** When set to `1`, module pages open in browse/view-only mode (sidebar & dashboard launcher). Full editing stays in Operations hub routes without this flag. */
export const WORKSPACE_VIEW_READONLY_PARAM = 'view';

export function isWorkspaceReadOnly(searchParams: URLSearchParams): boolean {
  return searchParams.get(WORKSPACE_VIEW_READONLY_PARAM) === '1';
}

/** Merge `view=1` into a pathname + optional query string. */
export function withWorkspaceReadOnly(pathOrHref: string): string {
  const q = pathOrHref.indexOf('?');
  const pathname = q === -1 ? pathOrHref : pathOrHref.slice(0, q);
  const existing = q === -1 ? '' : pathOrHref.slice(q + 1);
  const sp = new URLSearchParams(existing);
  sp.set(WORKSPACE_VIEW_READONLY_PARAM, '1');
  return `${pathname}?${sp.toString()}`;
}

export function WorkspaceReadOnlyRibbon({ title = 'View only — browse mode' }: { title?: string }) {
  return (
    <div
      role="status"
      style={{
        marginBottom: 12,
        padding: '10px 12px',
        borderRadius: 12,
        border: '1px solid rgba(15,23,42,0.10)',
        background: 'rgba(254,249,239,0.95)',
        fontSize: 13,
        lineHeight: 1.45,
        color: '#0f172a',
      }}
    >
      <strong style={{ fontWeight: 950 }}>{title}</strong>
      <span className="muted" style={{ display: 'block', marginTop: 4, fontSize: 12, fontWeight: 650 }}>
        Add, publish, invoice, or assign from the Operations hub Modules section.{' '}
        <Link to="/app/operations-hub" style={{ fontWeight: 900, color: 'var(--color-primary, #ea580c)' }}>
          Open Operations hub →
        </Link>
      </span>
    </div>
  );
}
