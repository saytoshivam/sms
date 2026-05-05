# UI Behavior Specs

**Audience:** Engineering, Design, QA  
**Version:** 1.0  
**Related:** `frontend/src/pages/AppLayout.tsx`, role shells in PRD

---

## 1. Purpose

Define **shell selection**, **navigation**, **loading/error/empty states**, and **key interactive patterns** for the SPA. **Server responses remain authoritative** for permissions.

---

## 2. Shell resolution (priority order)

Match **first** rule in `AppLayout` (simplified from code):

1. **Platform** — `SUPER_ADMIN` and not student-portal mode  
2. **School leadership** — leadership role, not super admin, not student-with-link  
3. **Teacher-only** — teaching role, no leadership  
4. **Student** — `STUDENT` + linked student id  
5. **Parent** — `PARENT`  
6. **Fallback staff** — e.g. `ACCOUNTANT` (fees shortcut)  
7. **Generic** — minimal outlet  

**If user has leadership + teaching:** leadership shell (broader nav).

---

## 3. Global UI patterns

| Pattern | Behavior |
|---------|----------|
| **Loading** | Skeleton or spinner on route segment; avoid layout shift on tables |
| **Error** | Toast + inline banner; 403 feature gate → “Upgrade plan” CTA if applicable |
| **Empty** | Illustration + primary CTA (“Add class group”) |
| **Optimistic** | Only where safe; academic saves prefer server-confirmed state |
| **Confirm destructive** | Modal with consequence text (delete class, reset assignments) |

---

## 4. Platform shell

| Area | Behavior |
|------|----------|
| Register school | Multi-step or single form; success → school list or detail |
| Plans & features | Read-only table + edit guarded by super admin |
| Audit | Paginated, filter by tenant/date |

---

## 5. School leadership shell

| Area | Behavior |
|------|----------|
| Dashboard | KPI cards; drill-down links |
| Academic hub / modules | Card or nav entry to structure, subjects, rooms, teachers, timetable |
| Smart assignment | Needs attention vs healthy **`<details>`** sections; collapsed by default; row expand for slot detail |
| Smart row | Collapsed: subject, teacher select, room select, status badge |
| Smart row expanded | Load bar, teacher/room locks, Clear teacher, Reset to auto, assignment notes |
| Reset to auto | Clears slot meta + nulls override `roomId` for that class+subject; toast “Slot reset toward auto” |
| Demand summary | Sortable columns; status color (green / amber / red) |
| School management | Tabs: overview, attendance mode, users, subscription catalog |

---

## 6. Teacher shell

| Area | Behavior |
|------|----------|
| Nav | Subset: students, lectures, timetable, attendance, class progress, class announcements |
| Attendance | Class/date picker → roster grid → submit |
| Class progress | Marks entry tables with validation feedback |

---

## 7. Student portal shell

| Area | Behavior |
|------|----------|
| Bottom nav | Schedule, marks, attendance, fees, announcements (per routes) |
| Schedule | Week/day; empty → “No sessions scheduled” |
| Fee statement | Line items + balance; pay CTA if feature + gateway |
| Announcements | Unread badge; mark read on open or explicit action |

**Deep link:** If not linked student → redirect to link flow or error page.

---

## 8. Parent shell

| Area | Behavior |
|------|----------|
| Minimal nav | Phased features; “coming soon” acceptable for unmigrated flows |

---

## 9. Forms & validation

| Rule | UI |
|------|-----|
| Client validation | Inline under field; on blur for long forms |
| Server validation | Map `fieldErrors` to inputs when shape available |
| Dirty leave | Browser `beforeunload` optional; prefer in-app “unsaved changes” modal |

---

## 10. Tables

| Concern | Spec |
|---------|------|
| Large datasets | Virtualize or server pagination |
| Sort | Persist sort key in URL query where useful |
| Actions column | Icon buttons with `aria-label`; stop propagation on nested controls (smart assign row) |

---

## 11. Accessibility

| Requirement | Notes |
|---------------|-------|
| Focus order | Modals trap focus |
| Keyboard | Primary flows operable without mouse |
| Color | Status not color-only (icon/text) |

---

## 12. Theming

School `primaryColor` / `accentColor` → CSS variables applied at root; preview page for leadership/super admin.

---

## 13. Session & token refresh

On **401** from API: attempt silent refresh once; if fail → logout → login with return URL.

---

## 14. Feature flags (runtime)

Platform flags UI (super admin): toggles call backend; SPA should handle stale cached config TTL or refetch on navigation.

---

## 15. QA visual checklist

- [ ] Leadership vs teacher nav diff  
- [ ] Smart assign expand/collapse does not submit form  
- [ ] Student cannot open staff performance URL without error state  
- [ ] 403 plan message on gated fee intent  
