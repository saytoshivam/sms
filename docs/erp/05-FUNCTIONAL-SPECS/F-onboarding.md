# FR-ONB — School Onboarding

---

## FR-ONB-001 — Wizard persistence

| Block | Content |
|-------|---------|
| **Purpose** | Persist partial progress for tenant setup. |
| **User story** | As **school leadership**, I save step 2 and return tomorrow without losing data. |
| **Inputs** | Step id, payload fragments (`/api/v1/onboarding/**`). |
| **Outputs** | Updated onboarding snapshot / status enums. |
| **Validations** | Tenant scope; step prerequisites (e.g. class groups before allocations). |
| **Business rules** | Critical path order documented in checklist component. |
| **Automation** | None mandatory. |
| **UI states** | Stepper with completed ticks; blocked steps disabled. |
| **Failure handling** | Retry save; offline banner if network lost. |

---

## FR-ONB-002 — Basic school profile

| Block | Content |
|-------|---------|
| **Purpose** | Capture legal/display info and academic meta (e.g. slots/week). |
| **User story** | As **leadership**, I set weekly slot count so validations can warn on over-allocation. |
| **Inputs** | Name, address fields, `slotsPerWeek`, locale. |
| **Outputs** | `schools` + onboarding extension columns. |
| **Validations** | Numeric slots when set; ranges per VAL doc. |
| **Business rules** | Slots drive demand and overload UI. |
| **Automation** | None. |
| **UI states** | Inline validation on slots field. |
| **Failure handling** | Revert local state from server error payload. |

---

## FR-ONB-003 — Readiness checklist

| Block | Content |
|-------|---------|
| **Purpose** | Guide user to minimum viable operations. |
| **User story** | As **leadership**, I see what blocks “go live” for attendance. |
| **Inputs** | Derived from existing entities (counts). |
| **Outputs** | Checklist DTO with done/pending + deep links. |
| **Validations** | N/A read model. |
| **Business rules** | Check definitions versioned with product. |
| **Automation** | Recompute on navigation focus. |
| **UI states** | All green vs blocking red items. |
| **Failure handling** | Partial data → show what’s available + “syncing”. |
