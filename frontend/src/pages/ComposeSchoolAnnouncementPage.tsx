import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { AnnouncementCategory } from './StudentAnnouncementsPage';

export function ComposeSchoolAnnouncementPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<AnnouncementCategory>('ACADEMIC');

  const m = useMutation({
    mutationFn: async () =>
      (
        await api.post('/api/v1/school/announcements', {
          title,
          body,
          category,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-announcements'] });
      qc.invalidateQueries({ queryKey: ['student-announcements-unread-count'] });
      navigate('/app');
    },
  });

  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Post school announcement</h2>
        <Link className="btn secondary" to="/app">
          Cancel
        </Link>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Visible to every student in your school (school-wide).
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
        <button
          type="button"
          className="btn"
          disabled={m.isPending || !title.trim() || !body.trim()}
          onClick={() => m.mutate()}
        >
          {m.isPending ? 'Publishing…' : 'Publish'}
        </button>
        {m.isError ? (
          <div style={{ color: '#b91c1c', fontSize: 14 }}>{String((m.error as any)?.response?.data ?? m.error)}</div>
        ) : null}
      </div>
    </div>
  );
}
