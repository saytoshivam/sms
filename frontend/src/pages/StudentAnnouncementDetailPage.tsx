import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { AnnouncementCategory } from './StudentAnnouncementsPage';

type Detail = {
  id: number;
  title: string;
  category: AnnouncementCategory;
  referenceCode: string;
  createdAt: string;
  body: string;
  audience: 'SCHOOL_WIDE' | 'CLASS_TARGETS';
  authorDisplay: string;
  targetClassLabels: string[];
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function StudentAnnouncementDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['student-announcement', id],
    queryFn: async () => (await api.get<Detail>(`/api/v1/student/me/announcements/${id}`)).data,
    enabled: id != null && !Number.isNaN(Number(id)),
  });

  useEffect(() => {
    if (!id || !q.isSuccess || !q.data) return;
    let cancelled = false;
    api.post(`/api/v1/student/me/announcements/${id}/read`).then(() => {
      if (!cancelled) {
        qc.invalidateQueries({ queryKey: ['student-announcements-unread-count'] });
        qc.invalidateQueries({ queryKey: ['student-announcements'] });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, q.isSuccess, q.data?.id, qc]);

  return (
    <div className="student-mobile-page">
      <header className="student-m-subheader">
        <Link to="/app/student/announcements" className="student-m-back">
          ← Back
        </Link>
        <h1 className="student-m-title">Announcement</h1>
      </header>

      {q.isLoading ? (
        <div className="muted">Loading…</div>
      ) : q.error || !q.data ? (
        <div style={{ color: '#b91c1c' }}>{String((q.error as any)?.response?.data ?? q.error ?? 'Not found')}</div>
      ) : (
        <article className="ann-detail">
          <div className="muted" style={{ fontSize: 13 }}>
            {formatDate(q.data.createdAt)} · {q.data.referenceCode}
          </div>
          <h2 style={{ margin: '8px 0 12px', fontSize: 20 }}>{q.data.title}</h2>
          {q.data.audience === 'CLASS_TARGETS' && q.data.targetClassLabels.length > 0 ? (
            <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              For: {q.data.targetClassLabels.join(', ')}
            </div>
          ) : null}
          <div className="ann-detail-body">{q.data.body}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 16 }}>
            Posted by {q.data.authorDisplay || 'Staff'}
          </div>
        </article>
      )}
    </div>
  );
}
