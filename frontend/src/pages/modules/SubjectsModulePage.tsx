import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { toast } from '../../lib/toast';
import { ModulePage, type StatusLevel } from '../../components/module/ModulePage';
import { SmartSelect } from '../../components/SmartSelect';
import { useApiTags } from '../../lib/apiTags';
import { useImpactStore } from '../../lib/impactStore';
import { onboardingStepHref } from '../../lib/onboardingWizardMeta';
import { SavedSubjectsCatalogPanel } from '../../components/catalog/SavedSubjectsCatalogPanel';
import { formatCompatibleRoomTypesList, schoolHasAnyCompatibleRoom } from '../../lib/roomVenueCompatibility';
import { parseSubjectVenueRequirement, SUBJECT_VENUE_LABELS, SUBJECT_VENUE_REQUIREMENTS } from '../../lib/subjectVenueRequirement';

type Subject = {
  id: number;
  code: string;
  name: string;
  type?: 'CORE' | 'OPTIONAL';
  weeklyFrequency?: number | null;
  allocationVenueRequirement?: string | null;
  specializedVenueType?: string | null;
};

type Page<T> = { content: T[]; totalElements?: number };

type AcademicStructure = {
  allocations?: { classGroupId: number; subjectId: number; weeklyFrequency: number; staffId: number | null; roomId: number | null }[];
};

const SUBJECT_CODE_RE = /^[A-Z0-9]{3,32}$/;
function normalizeCode(s: string): string {
  return String(s ?? '').trim().toUpperCase();
}
function isValidCode(s: string): boolean {
  return SUBJECT_CODE_RE.test(s);
}

type CreateDraft = {
  name: string;
  code: string;
  type: 'CORE' | 'OPTIONAL';
  weeklyFrequency: number;
  allocationVenueRequirement: string;
};

const EMPTY_DRAFT: CreateDraft = {
  name: '',
  code: '',
  type: 'CORE',
  weeklyFrequency: 4,
  allocationVenueRequirement: 'STANDARD_CLASSROOM',
};

export function SubjectsModulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = (searchParams.get('tab') ?? 'browse') as 'browse' | 'add';
  const [tab, setTab] = useState<'browse' | 'add'>(tabFromUrl);
  useEffect(() => setTab(tabFromUrl), [tabFromUrl]);

  const [createDraft, setCreateDraft] = useState<CreateDraft>(EMPTY_DRAFT);

  const invalidate = useApiTags();
  const recordChange = useImpactStore((s) => s.recordChange);

  const subjects = useQuery({
    queryKey: ['subjects-catalog'],
    queryFn: async () => (await api.get<Page<Subject>>('/api/subjects?size=1000&sort=name,asc')).data,
  });

  const academic = useQuery({
    queryKey: ['onboarding-academic-structure'],
    queryFn: async () => (await api.get<AcademicStructure>('/api/v1/onboarding/academic-structure')).data,
    staleTime: 60_000,
  });

  const roomsForVenue = useQuery({
    queryKey: ['rooms-venue-check'],
    queryFn: async () => (await api.get<{ content?: Array<{ type?: string | null }> }>('/api/rooms?size=500')).data,
    staleTime: 120_000,
  });

  const list: Subject[] = useMemo(() => subjects.data?.content ?? [], [subjects.data]);

  const orphanCount = useMemo(() => {
    if (!academic.data) return 0;
    const valid = new Set(list.map((s) => s.id));
    return (academic.data.allocations ?? []).filter((a) => !valid.has(a.subjectId)).length;
  }, [academic.data, list]);

  const status: { level: StatusLevel; label: string } = useMemo(() => {
    if (subjects.isLoading) return { level: 'idle', label: 'Loading' };
    if (subjects.isError) return { level: 'error', label: 'Load failed' };
    if (orphanCount > 0) return { level: 'error', label: `${orphanCount} orphan ref${orphanCount === 1 ? '' : 's'}` };
    if (list.length === 0) return { level: 'idle', label: 'Empty' };
    return { level: 'ok', label: `${list.length} subject${list.length === 1 ? '' : 's'}` };
  }, [subjects.isLoading, subjects.isError, orphanCount, list.length]);

  const createOne = useMutation({
    mutationFn: async (draft: CreateDraft) => {
      const code = normalizeCode(draft.code);
      if (!isValidCode(code)) throw new Error('Subject code must be uppercase A–Z/0–9, 3–32 chars.');
      if (!draft.name.trim()) throw new Error('Subject name is required.');
      const freq = Math.trunc(Number(draft.weeklyFrequency));
      if (!Number.isFinite(freq) || freq <= 0) throw new Error('Weekly frequency must be > 0.');
      const body = {
        name: draft.name.trim(),
        code,
        type: draft.type,
        weeklyFrequency: freq,
        allocationVenueRequirement: draft.allocationVenueRequirement,
      };
      return (await api.post<Subject>('/api/subjects', body)).data;
    },
    onSuccess: async (s) => {
      toast.success('Subject added', `${s.code} — ${s.name}`);
      setCreateDraft(EMPTY_DRAFT);
      recordChange({
        id: `subject:add:${s.id}`,
        scope: 'subjects',
        severity: 'soft',
        message: `Added subject ${s.code}`,
        refs: { subjectIds: [s.id] },
      });
      await invalidate(['subjects']);
    },
    onError: (e) => toast.error('Could not add subject', formatApiError(e)),
  });

  const setTabUrl = (next: 'browse' | 'add') => {
    const sp = new URLSearchParams(searchParams);
    if (next === 'browse') sp.delete('tab');
    else sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };

  const headerActions = (
    <>
      <Link to="/app" className="btn secondary">
        Back to hub
      </Link>
      <button type="button" className="btn" onClick={() => setTabUrl('add')}>
        + Add subject
      </button>
    </>
  );

  return (
    <ModulePage
      title="Subjects"
      subtitle="Catalog of subjects taught at this school. Edit weekly frequency or rename codes; the timetable will flag affected sections."
      status={status}
      headerActions={headerActions}
      tabs={[
        { id: 'browse', label: 'Browse', badge: list.length || null },
        { id: 'add', label: 'Add new' },
      ]}
      activeTabId={tab}
      tabHrefBase="/app/subjects"
    >
      {tab === 'add' ? (
        <AddSubjectCard
          draft={createDraft}
          setDraft={setCreateDraft}
          onSave={() => createOne.mutate(createDraft)}
          busy={createOne.isPending}
          roomTypesForCheck={(roomsForVenue.data?.content ?? []).map((r) => r.type)}
        />
      ) : null}

      {tab === 'browse' ? (
        <div
          className="card"
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: '1px solid rgba(37,99,235,0.22)',
            background: 'rgba(239,246,255,0.75)',
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontWeight: 950, marginBottom: 4 }}>Bulk CSV & templates</div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
            Multi-subject CSV upload and batch tools live in the setup wizard (unchanged).{' '}
            <Link to={onboardingStepHref('SUBJECTS')} style={{ fontWeight: 900, color: 'var(--color-primary, #ea580c)' }}>
              Open wizard — Subjects step
            </Link>
            .
          </div>
        </div>
      ) : null}

      {tab === 'browse' ? (
        <div className="card stack" style={{ gap: 12, padding: 12, marginTop: 12, border: '1px solid rgba(15,23,42,0.10)', borderRadius: 12 }}>
          {orphanCount > 0 ? (
            <div className="sms-alert sms-alert--error" style={{ margin: 0 }}>
              <div>
                <div className="sms-alert__title">Orphan references</div>
                <div className="sms-alert__msg">
                  {orphanCount} allocation{orphanCount === 1 ? '' : 's'} point to subjects that no longer exist. Open Academic structure to clean up.
                </div>
              </div>
            </div>
          ) : null}
          <SavedSubjectsCatalogPanel />
        </div>
      ) : null}
    </ModulePage>
  );
}

function AddSubjectCard({
  draft,
  setDraft,
  onSave,
  busy,
  roomTypesForCheck,
}: {
  draft: CreateDraft;
  setDraft: (d: CreateDraft) => void;
  onSave: () => void;
  busy: boolean;
  roomTypesForCheck: Array<string | null | undefined>;
}) {
  const code = normalizeCode(draft.code);
  const codeOk = isValidCode(code);
  const nameOk = draft.name.trim().length > 0;
  const freqOk = Number.isFinite(draft.weeklyFrequency) && draft.weeklyFrequency > 0;
  const req = parseSubjectVenueRequirement(draft.allocationVenueRequirement);
  const noCompatRoom =
    req !== 'FLEXIBLE' && !schoolHasAnyCompatibleRoom(roomTypesForCheck, req, null);

  return (
    <div className="card stack" style={{ gap: 12, padding: 12, border: '1px solid rgba(15,23,42,0.10)', borderRadius: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 14 }}>Add a subject</div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="stack" style={{ gap: 6, flex: '2 1 240px' }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
            Name
          </span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Mathematics"
          />
        </label>
        <label className="stack" style={{ gap: 6, flex: '1 1 160px' }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
            Code (A–Z/0–9, 3–32)
          </span>
          <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: normalizeCode(e.target.value) })} placeholder="MATH" />
        </label>
        <label className="stack" style={{ gap: 6, flex: '0 0 140px' }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
            Type
          </span>
          <SmartSelect
            value={draft.type}
            onChange={(v) => setDraft({ ...draft, type: v as 'CORE' | 'OPTIONAL' })}
            options={[
              { value: 'CORE', label: 'Core' },
              { value: 'OPTIONAL', label: 'Optional' },
            ]}
          />
        </label>
        <label className="stack" style={{ gap: 6, flex: '0 0 130px' }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
            Periods/week
          </span>
          <input
            type="number"
            min={1}
            max={20}
            value={draft.weeklyFrequency}
            onChange={(e) =>
              setDraft({ ...draft, weeklyFrequency: Math.max(1, Math.trunc(Number(e.target.value || 0))) })
            }
          />
        </label>
        <label className="stack" style={{ gap: 6, flex: '1 1 220px', minWidth: 200 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
            Room allocation need
          </span>
          <SmartSelect
            value={draft.allocationVenueRequirement}
            onChange={(v) => setDraft({ ...draft, allocationVenueRequirement: v || 'STANDARD_CLASSROOM' })}
            options={SUBJECT_VENUE_REQUIREMENTS.map((k) => ({ value: k, label: SUBJECT_VENUE_LABELS[k] }))}
            ariaLabel="Subject venue requirement"
          />
        </label>
        <button type="button" className="btn" disabled={busy || !nameOk || !codeOk || !freqOk} onClick={onSave}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
      {noCompatRoom ? (
        <div
          className="sms-alert sms-alert--info"
          style={{ margin: 0, fontSize: 12 }}
          title="Configured via Subject Type (room allocation need) in Subject setup."
        >
          <div className="sms-alert__title">No compatible room yet</div>
          <div className="sms-alert__msg">
            No room in this school matches types required for <strong>{SUBJECT_VENUE_LABELS[req]}</strong> (
            {formatCompatibleRoomTypesList(req)}). Manual timetable assignment may be needed. You can still save.
          </div>
        </div>
      ) : null}
      <div className="muted" style={{ fontSize: 12 }}>
        After saving, map this subject to sections in <Link to="/app/academic">Academic structure</Link>. Editing weekly frequency on existing subjects will mark the timetable as affected.
      </div>
    </div>
  );
}
