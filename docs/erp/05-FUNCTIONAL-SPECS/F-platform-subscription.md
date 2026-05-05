# FR-PLT — Platform & Subscription

---

## FR-PLT-001 — Register and manage schools

| Block | Content |
|-------|---------|
| **Purpose** | Platform operators create tenants and manage lifecycle. |
| **User story** | As **SUPER_ADMIN**, I register a school so leadership can sign in and configure. |
| **Inputs** | School name, unique `code`, optional domain, initial admin credentials. |
| **Outputs** | `schools` row, bootstrap subscription, admin `users` + roles. |
| **Validations** | Unique `code`; email format; password policy. |
| **Business rules** | Default plan assignment per bootstrap service. |
| **Automation** | `TenantSubscriptionBootstrap` assigns BASIC if missing. |
| **UI states** | Form → submitting → success redirect / error inline. |
| **Failure handling** | Duplicate code 409; transactional rollback on partial create. |

---

## FR-PLT-002 — Plans and entitlements

| Block | Content |
|-------|---------|
| **Purpose** | Map commercial plans to feature codes. |
| **User story** | As **SUPER_ADMIN**, I attach features to PREMIUM so tenants upgrade into exams/online fees. |
| **Inputs** | Plan code, feature code, enabled flag. |
| **Outputs** | `subscription_plan_features` rows. |
| **Validations** | FK to catalog codes. |
| **Business rules** | One active subscription row per tenant (`tenant_subscriptions`). |
| **Automation** | None. |
| **UI states** | Matrix editor with dirty state. |
| **Failure handling** | Optimistic lock if concurrent edit. |

---

## FR-PLT-003 — Tenant feature discovery

| Block | Content |
|-------|---------|
| **Purpose** | SPA loads enabled features to hide/disable modules. |
| **User story** | As **school user**, I only see navigation for features my plan includes. |
| **Inputs** | JWT tenant. |
| **Outputs** | `GET /api/v1/tenant/features` list of codes. |
| **Validations** | Authenticated. |
| **Business rules** | Super admin without tenant may bypass gates on platform routes only. |
| **Automation** | Cache client-side with TTL optional. |
| **UI states** | Loading → chips or nav filtered. |
| **Failure handling** | Default deny UI for unknown feature state. |

---

## FR-PLT-004 — Audit and operator notifications

| Block | Content |
|-------|---------|
| **Purpose** | Compliance and operator visibility. |
| **User story** | As **SUPER_ADMIN**, I search audit by tenant and action. |
| **Inputs** | Filters, pagination. |
| **Outputs** | Audit rows / operator notification feed. |
| **Validations** | Super admin only on platform endpoints. |
| **Business rules** | PII minimization in log payload. |
| **Automation** | Domain events append audit where implemented. |
| **UI states** | Empty search vs results table. |
| **Failure handling** | Timeout → retry. |
