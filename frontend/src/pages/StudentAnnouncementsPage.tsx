import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export type AnnouncementCategory = 'ACADEMIC' | 'PLACEMENT' | 'EXAMINATION' | 'GENERAL';

const CAT_LABEL: Record<AnnouncementCategory, string> = {
  ACADEMIC: 'Academic',
  PLACEMENT: 'Placement',
  EXAMINATION: 'Examination',
  GENERAL: 'General',
};

export type AnnouncementListItem = {
  id: number;
  title: string;
  category: AnnouncementCategory;
  referenceCode: string;
  createdAt: string;
  audience: 'SCHOOL_WIDE' | 'CLASS_TARGETS';
};

const TABS: { key: 'ALL' | AnnouncementCategory; label: string }[] = [
  { key: 'ALL', label: 'ALL' },
  { key: 'PLACEMENT', label: 'Placement' },
  { key: 'ACADEMIC', label: 'Academic' },
  { key: 'EXAMINATION', label: 'Examination' },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function categoryClass(c: AnnouncementCategory) {
  if (c === 'PLACEMENT') return 'ann-pill ann-pill--placement';
  if (c === 'ACADEMIC') return 'ann-pill ann-pill--academic';
  if (c === 'EXAMINATION') return 'ann-pill ann-pill--exam';
  return 'ann-pill ann-pill--general';
}

export function StudentAnnouncementsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('ALL');
  const [categorySelect, setCategorySelect] = useState<string>('');

  const list = useQuery({
    queryKey: ['student-announcements', tab],
    queryFn: async () => {
      const q =
        tab === 'ALL'
          ? ''
          : `?category=${encodeURIComponent(tab)}`;
      return (await api.get<AnnouncementListItem[]>(`/api/v1/student/me/announcements${q}`)).data;
    },
  });

  const filtered = useMemo(() => {
    const rows = list.data ?? [];
    if (!categorySelect) return rows;
    return rows.filter((r) => r.category === categorySelect);
  }, [list.data, categorySelect]);

  return (
    <div className="student-mobile-page">
      <header className="student-m-subheader">
        <Link to="/app" className="student-m-back">
          ← Back
        </Link>
        <h1 className="student-m-title">Announcement</h1>
      </header>

      <div className="stack" style={{ gap: 14 }}>
        <select
          className="ann-category-select"
          value={categorySelect}
          onChange={(e) => setCategorySelect(e.target.value)}
          aria-label="Category filter"
        >
          <option value="">Category</option>
          <option value="ACADEMIC">Academic</option>
          <option value="PLACEMENT">Placement</option>
          <option value="EXAMINATION">Examination</option>
          <option value="GENERAL">General</option>
        </select>

        <div className="ann-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={tab === t.key ? 'ann-tab ann-tab--active' : 'ann-tab'}
              onClick={() => {
                setTab(t.key);
                setCategorySelect('');
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {list.isLoading ? (
          <div className="muted">Loading…</div>
        ) : list.error ? (
          <div style={{ color: '#b91c1c' }}>{String((list.error as any)?.response?.data ?? list.error)}</div>
        ) : filtered.length === 0 ? (
          <div className="muted">No announcements in this view.</div>
        ) : (
          <ul className="ann-list">
            {filtered.map((a) => (
              <li key={a.id}>
                <Link to={`/app/student/announcements/${a.id}`} className="ann-card">
                  <div className="ann-card-top">
                    <span className={categoryClass(a.category)}>{CAT_LABEL[a.category]}</span>
                    <span className="ann-card-date">{formatDate(a.createdAt)}</span>
                  </div>
                  <div className="ann-card-title">{a.title}</div>
                  <div className="ann-card-ref">{a.referenceCode}</div>
                  <span className="ann-card-chevron" aria-hidden>
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
