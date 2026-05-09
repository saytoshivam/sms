import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { REQUIRED_STEPS, WIZARD_STEPS, type WizardStepId } from '../../lib/onboardingWizardMeta';

type OnboardingProgress = {
  /** Slug of current step (server enum). */
  status?: string;
  /** Steps the school has finished. */
  completedSteps?: string[];
};

const HUB_ROUTE: Record<WizardStepId, string> = {
  BASIC_INFO: '/app/time',
  CLASSES: '/app/classes-sections',
  SUBJECTS: '/app/subjects',
  ROOMS: '/app/rooms',
  STAFF: '/app/teachers',
  ACADEMIC_STRUCTURE: '/app/academic',
  TIMETABLE: '/app/timetable',
  STUDENTS: '/app/students',
  FEES: '/app/fees',
};

const STEP_DESCRIPTION: Record<WizardStepId, string> = {
  BASIC_INFO: 'Working days, school hours, lecture duration.',
  CLASSES: 'Classes, sections, class teachers.',
  SUBJECTS: 'Subject catalog and weekly frequency.',
  ROOMS: 'Rooms, types, and homeroom defaults.',
  STAFF: 'Teachers, roles, and teachable subjects.',
  ACADEMIC_STRUCTURE: 'Map subjects to sections and assign teachers.',
  TIMETABLE: 'Generate, review conflicts, and publish.',
  STUDENTS: 'Student records and section placements.',
  FEES: 'Fee structure and installments.',
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SetupChecklistPanel({ open, onClose }: Props) {
  const progress = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: async () => (await api.get<OnboardingProgress>('/api/v1/onboarding/progress')).data,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const completed = new Set(progress.data?.completedSteps ?? []);
  const requiredDone = REQUIRED_STEPS.filter((s) => completed.has(s)).length;
  const requiredTotal = REQUIRED_STEPS.length;
  const checklistOptional = WIZARD_STEPS.filter((s) => s.optional);
  const optionalDone = checklistOptional.filter((s) => completed.has(s.id)).length;
  const optionalTotal = checklistOptional.length;
  const pct = Math.round((requiredDone / Math.max(1, requiredTotal)) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Setup checklist"
      onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(15,23,42,0.42)', display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(440px, 96vw)',
          height: '100%',
          background: '#fff',
          padding: 18,
          overflow: 'auto',
          boxShadow: '-12px 0 32px rgba(15,23,42,0.18)',
        }}
      >
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Setup checklist</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {requiredDone}/{requiredTotal} required
              {optionalTotal > 0 ? ` · ${optionalDone}/${optionalTotal} optional` : ''}
            </div>
          </div>
          <button type="button" className="btn secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            height: 8,
            borderRadius: 999,
            background: 'rgba(15,23,42,0.08)',
            overflow: 'hidden',
          }}
          aria-label={`Setup ${pct}% complete`}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: pct === 100 ? '#16a34a' : 'var(--color-primary, #f97316)',
              transition: 'width 200ms ease',
            }}
          />
        </div>

        {progress.isLoading ? (
          <div className="muted" style={{ marginTop: 14, fontSize: 13 }}>
            Loading progress…
          </div>
        ) : null}

        <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'grid', gap: 8 }}>
          {WIZARD_STEPS.map((step) => {
            const done = completed.has(step.id);
            const route = HUB_ROUTE[step.id];
            return (
              <li key={step.id}>
                <Link
                  to={route}
                  onClick={onClose}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    padding: 10,
                    borderRadius: 12,
                    border: '1px solid rgba(15,23,42,0.10)',
                    textDecoration: 'none',
                    color: '#0f172a',
                    background: done ? 'rgba(22,163,74,0.05)' : '#fff',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 950,
                      background: done ? '#16a34a' : 'rgba(15,23,42,0.08)',
                      color: done ? '#fff' : '#475569',
                    }}
                  >
                    {done ? '✓' : ''}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {step.title}
                      {step.optional ? (
                        <span className="muted" style={{ fontSize: 11, fontWeight: 800 }}>
                          (optional)
                        </span>
                      ) : null}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {STEP_DESCRIPTION[step.id]}
                    </div>
                  </div>
                  <span aria-hidden style={{ fontSize: 16, color: '#94a3b8' }}>
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="muted" style={{ marginTop: 14, fontSize: 12, lineHeight: 1.5 }}>
          You can do these steps in any order. Fields you’ve already filled will pick up where you left off.
        </div>
      </div>
    </div>
  );
}
