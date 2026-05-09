import {
  ONBOARDING_DRAFT_KEY,
  DRAFT_SCHEMA_VERSION,
  defaultDraft,
  emptyGuardian,
  type GuardianDraft,
  type StudentOnboardingDraft,
} from './studentOnboardTypes';

function normalizeGuardians(list: GuardianDraft[] | undefined): GuardianDraft[] {
  if (!list?.length) return [emptyGuardian(true)];
  const rows = list.map((g) => ({
    name: String(g.name ?? ''),
    relation: String(g.relation ?? 'Parent').trim() || 'Parent',
    phone: String(g.phone ?? ''),
    email: String(g.email ?? ''),
    occupation: String(g.occupation ?? ''),
    primaryGuardian: Boolean(g.primaryGuardian),
    canLogin: Boolean(g.canLogin),
    receivesNotifications: g.receivesNotifications !== false,
  }));
  let primaries = rows.filter((g) => g.primaryGuardian).length;
  if (primaries !== 1) {
    return rows.map((g, idx) => ({ ...g, primaryGuardian: idx === 0 }));
  }
  return rows;
}

export function loadOnboardingDraft(): StudentOnboardingDraft {
  try {
    const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!raw) return defaultDraft();
    const parsed = JSON.parse(raw) as Partial<StudentOnboardingDraft>;
    if (parsed?.version !== DRAFT_SCHEMA_VERSION) return defaultDraft();
    const base = defaultDraft();
    const merged: StudentOnboardingDraft = {
      ...base,
      ...parsed,
      version: DRAFT_SCHEMA_VERSION,
      student: { ...base.student, ...(parsed.student ?? {}) },
      enrollment: { ...base.enrollment, ...(parsed.enrollment ?? {}) },
      residence: { ...base.residence, ...(parsed.residence ?? {}) },
      medical: { ...base.medical, ...(parsed.medical ?? {}) },
      guardians: normalizeGuardians(parsed.guardians),
      completedSteps: Array.isArray(parsed.completedSteps) ? [...parsed.completedSteps] : [],
    };
    merged.stepIndex = Math.min(Math.max(0, merged.stepIndex ?? 0), 6);
    return merged;
  } catch {
    return defaultDraft();
  }
}

export function saveOnboardingDraft(draft: StudentOnboardingDraft) {
  try {
    localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function clearOnboardingDraft() {
  try {
    localStorage.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
