import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';

type Row = {
  id: number;
  createdAt: string;
  kind: string;
  title: string;
  body: string | null;
  tenantId: number | null;
  actorEmail: string | null;
  detail: string | null;
  read: boolean;
};

type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function PlatformOperatorNotificationsPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['platform-operator-notifications'],
    queryFn: async () =>
      (await api.get<Page<Row>>('/api/v1/platform/operator-notifications?size=50')).data,
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/api/v1/platform/operator-notifications/${id}/read`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['platform-operator-notifications'] });
      await qc.invalidateQueries({ queryKey: ['platform-operator-notifications-unread'] });
    },
  });

  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Operator notifications</h2>
        <Link className="muted" to="/app">
          ← Platform dashboard
        </Link>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Alerts for platform operators — e.g. when a school requests a subscription plan change. Unread items show a badge
        in the header.
      </p>
      {list.isLoading ? (
        <div className="muted">Loading…</div>
      ) : list.isError ? (
        <div style={{ color: '#b91c1c' }}>{formatApiError(list.error)}</div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {(list.data?.content ?? []).length === 0 ? (
            <div className="workspace-placeholder">
              <strong>No notifications yet</strong>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                When a school admin submits a plan change request, it will appear here.
              </p>
            </div>
          ) : (
            (list.data?.content ?? []).map((r) => (
              <article
                key={r.id}
                className={`card stack platform-op-notif-card${r.read ? '' : ' platform-op-notif-card--unread'}`}
                style={{ gap: 8 }}
              >
                <div className="row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: r.read ? 600 : 800 }}>{r.title}</div>
                  <div className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {formatWhen(r.createdAt)}
                  </div>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>{r.body ?? '—'}</div>
                <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
                  <span className="muted">
                    <code>{r.kind}</code>
                    {r.actorEmail ? (
                      <>
                        {' '}
                        · From <strong>{r.actorEmail}</strong>
                      </>
                    ) : null}
                  </span>
                  {r.tenantId != null ? (
                    <Link className="btn secondary" style={{ padding: '6px 12px', fontSize: 13 }} to={`/app/admin/schools/${r.tenantId}`}>
                      Open school
                    </Link>
                  ) : null}
                  {!r.read ? (
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ padding: '6px 12px', fontSize: 13 }}
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(r.id)}
                    >
                      Mark read
                    </button>
                  ) : (
                    <span className="muted">Read</span>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
