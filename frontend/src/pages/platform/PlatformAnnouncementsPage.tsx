import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';

type Ann = { id: number; title: string; body: string; published: boolean; createdAt: string; updatedAt: string };

export function PlatformAnnouncementsPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['platform-announcements'],
    queryFn: async () => (await api.get<Ann[]>('/api/v1/platform/announcements')).data,
  });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [published, setPublished] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/api/v1/platform/announcements', { title, body, published });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-announcements'] });
      setTitle('');
      setBody('');
      setPublished(false);
      toast.success('Saved', 'Announcement created.');
    },
    onError: (e) => toast.error('Save failed', formatApiError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/v1/platform/announcements/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-announcements'] });
      toast.success('Deleted', 'Announcement deleted.');
    },
    onError: (e) => toast.error('Delete failed', formatApiError(e)),
  });

  return (
    <div className="stack" style={{ maxWidth: 800 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Platform announcements</h2>
        <Link className="muted" to="/app">
          ← Platform dashboard
        </Link>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Broadcast messages to all authenticated users (shown in feeds when published).
      </p>

      <div className="card stack">
        <strong>New announcement</strong>
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        <label>Body</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
        <label className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published
        </label>
        <button className="btn" type="button" disabled={create.isPending || !title.trim()} onClick={() => create.mutate()}>
          {create.isPending ? 'Saving…' : 'Create'}
        </button>
      </div>

      <div className="card stack">
        <strong>Existing</strong>
        {list.isLoading ? (
          <div className="muted">Loading…</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {(list.data ?? []).map((a) => (
              <li key={a.id} style={{ marginBottom: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <strong>{a.title}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {a.published ? 'published' : 'draft'}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
                  {a.body}
                </div>
                <button className="btn secondary" type="button" style={{ marginTop: 8 }} onClick={() => remove.mutate(a.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
