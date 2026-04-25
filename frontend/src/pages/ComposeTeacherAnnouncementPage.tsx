import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatApiError } from '../lib/errors';
import type { AnnouncementCategory } from './StudentAnnouncementsPage';

type Cg = { id: number; code: string; displayName: string };

export function ComposeTeacherAnnouncementPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<AnnouncementCategory>('ACADEMIC');
  const [selected, setSelected] = useState<number[]>([]);

  const classes = useQuery({
    queryKey: ['teacher-my-class-groups'],
    queryFn: async () => (await api.get<Cg[]>('/api/v1/teacher/my-class-groups')).data,
  });

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const m = useMutation({
    mutationFn: async () =>
      (
        await api.post('/api/v1/teacher/announcements', {
          title,
          body,
          category,
          classGroupIds: selected,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-announcements'] });
      qc.invalidateQueries({ queryKey: ['student-announcements-unread-count'] });
      navigate('/app');
    },
  });

  const canSubmit = useMemo(() => title.trim() && body.trim() && selected.length > 0, [title, body, selected]);

  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Post for my classes</h2>
        <Link className="btn secondary" to="/app">
          Cancel
        </Link>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Only students in the classes you teach on the timetable will see this.
      </p>
      <div className="card stack">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={512} />
        <label>Body</label>
        <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        <label>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}>
          <option value="ACADEMIC">Academic</option>
          <option value="PLACEMENT">Placement</option>
          <option value="EXAMINATION">Examination</option>
          <option value="GENERAL">General</option>
        </select>
        <strong style={{ fontSize: 14 }}>Classes</strong>
        {classes.isLoading ? (
          <div className="muted">Loading your classes…</div>
        ) : classes.error ? (
          <div style={{ color: '#b91c1c' }}>{formatApiError(classes.error)}</div>
        ) : (classes.data ?? []).length === 0 ? (
          <div className="muted">No classes found on your timetable. Ask admin to assign you to slots.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
            {(classes.data ?? []).map((c) => (
              <li key={c.id}>
                <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                  <span>
                    <strong>{c.displayName}</strong> <span className="muted">({c.code})</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn" disabled={m.isPending || !canSubmit} onClick={() => m.mutate()}>
          {m.isPending ? 'Publishing…' : 'Publish to selected classes'}
        </button>
        {m.isError ? (
          <div style={{ color: '#b91c1c', fontSize: 14 }}>{formatApiError(m.error)}</div>
        ) : null}
      </div>
    </div>
  );
}
