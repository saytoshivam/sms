import { TimeKeeper } from '../TimeKeeper';
import { SelectKeeper } from '../SelectKeeper';
import type { BasicSetupDraft } from '../../lib/schoolBasicSetup';

const DAY_OPTIONS = [
  { code: 'MON', label: 'Mon' },
  { code: 'TUE', label: 'Tue' },
  { code: 'WED', label: 'Wed' },
  { code: 'THU', label: 'Thu' },
  { code: 'FRI', label: 'Fri' },
  { code: 'SAT', label: 'Sat' },
  { code: 'SUN', label: 'Sun' },
] as const;

export function SchoolBasicSetupForm({
  value,
  onChange,
}: {
  value: BasicSetupDraft;
  onChange: (next: BasicSetupDraft) => void;
}) {
  const toggleDay = (code: string) => {
    const set = new Set(value.workingDays);
    if (set.has(code)) set.delete(code);
    else set.add(code);
    const ordered = DAY_OPTIONS.map((o) => o.code).filter((c) => set.has(c));
    onChange({ ...value, workingDays: ordered });
  };

  return (
    <>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="stack" style={{ flex: '1 1 220px' }}>
          <label>Academic year</label>
          <input
            value={value.academicYear}
            onChange={(e) => onChange({ ...value, academicYear: e.target.value })}
            placeholder="2026-27"
          />
        </div>
        <div className="stack" style={{ flex: '1 1 220px' }}>
          <label>Start month</label>
          <SelectKeeper
            value={String(value.startMonth)}
            onChange={(v) =>
              onChange({ ...value, startMonth: Math.max(1, Math.min(12, Number(v || 4))) })
            }
            options={Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
              value: String(m),
              label: `${new Date(2020, m - 1, 1).toLocaleString('en', { month: 'long' })} (${m})`,
            }))}
          />
        </div>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <label>Working days</label>
        <div className="onboarding-pill-group" role="group" aria-label="Working days">
          {DAY_OPTIONS.map((d) => {
            const active = value.workingDays.includes(d.code);
            return (
              <button
                key={d.code}
                type="button"
                className="onboarding-pill"
                aria-pressed={active}
                onClick={() => toggleDay(d.code)}
              >
                <span className="onboarding-pill__dot" aria-hidden />
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="onboarding-inline-help">Choose the days your school runs. This impacts timetable and attendance.</p>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <label>Attendance strategy</label>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="stack" style={{ minWidth: 260 }}>
            <SelectKeeper
              value={value.attendanceMode}
              onChange={(v) =>
                onChange({
                  ...value,
                  attendanceMode: ((v || 'LECTURE_WISE') as 'DAILY' | 'LECTURE_WISE') ?? 'LECTURE_WISE',
                })
              }
              options={[
                { value: 'LECTURE_WISE', label: 'Lecture-wise (per period / subject teacher)' },
                { value: 'DAILY', label: 'Daily (once per day / per class)' },
              ]}
            />
          </div>
        </div>
        <p className="onboarding-inline-help" style={{ margin: 0 }}>
          This controls how attendance is recorded in the app. You can change it later in School Management.
        </p>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <label>School open timings</label>
        <div className="stack" style={{ gap: 10 }}>
          {value.openWindows.map((w, idx) => (
            <div key={idx} className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="stack" style={{ minWidth: 160 }}>
                <label className="muted" style={{ fontSize: 12 }}>
                  Start
                </label>
                <TimeKeeper
                  id={`school-basic-open-start-${idx}`}
                  value={w.startTime}
                  onChange={(v) =>
                    onChange({
                      ...value,
                      openWindows: value.openWindows.map((x, i) => (i === idx ? { ...x, startTime: v } : x)),
                    })
                  }
                />
              </div>
              <div className="stack" style={{ minWidth: 160 }}>
                <label className="muted" style={{ fontSize: 12 }}>
                  End
                </label>
                <TimeKeeper
                  id={`school-basic-open-end-${idx}`}
                  value={w.endTime}
                  onChange={(v) =>
                    onChange({
                      ...value,
                      openWindows: value.openWindows.map((x, i) => (i === idx ? { ...x, endTime: v } : x)),
                    })
                  }
                />
              </div>
              <button
                type="button"
                className="btn secondary"
                disabled={value.openWindows.length <= 1}
                onClick={() =>
                  onChange({
                    ...value,
                    openWindows: value.openWindows.filter((_, i) => i !== idx),
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() =>
                onChange({
                  ...value,
                  openWindows: [...value.openWindows, { startTime: '14:00', endTime: '17:00' }],
                })
              }
            >
              + Add window
            </button>
            <span className="muted" style={{ fontSize: 12 }}>
              Example: 09:00–13:00 and 14:00–17:00
            </span>
          </div>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="stack" style={{ minWidth: 220 }}>
            <label className="muted" style={{ fontSize: 12 }}>
              Default lecture duration (minutes)
            </label>
            <input
              type="number"
              min={10}
              max={240}
              value={value.lectureDurationMinutes}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') onChange({ ...value, lectureDurationMinutes: '' });
                else onChange({ ...value, lectureDurationMinutes: Number(v) });
              }}
              placeholder="45"
            />
          </div>
        </div>
        <p className="onboarding-inline-help" style={{ margin: 0 }}>
          Consecutive timetable slots of this duration are generated inside each open window (no gaps). You can still add or
          edit time slots later under Time slots → Slots.
        </p>
        {value.openWindows.some((w) => w.startTime && w.endTime && w.startTime >= w.endTime) ? (
          <div className="sms-alert sms-alert--warn">
            <div>
              <div className="sms-alert__title">Check timings</div>
              <div className="sms-alert__msg">Each window must have End after Start.</div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
