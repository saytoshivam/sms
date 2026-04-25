# MyHaimi SMS — SaaS multi-tenant architecture

This document describes the **startup-oriented** architecture: a **modular monolith** (single JVM) with in-process payment order registration and notification hooks, aligned with what is implemented in this repository.

## High-level topology

| Component | Responsibility | Tech |
|-----------|----------------|------|
| **sms** (this repo, Spring Boot) | System of record: tenants (schools), users, RBAC, subscriptions, academics, attendance, fees, lectures; **in-process** online payment orders + webhook; **in-process** notification log hooks | Java 21, Spring Boot 3.4, JPA, Flyway |

**Sync:** REST between browser ↔ monolith. Optional synthetic gateway completion posts to `POST /api/v1/integrations/payments/webhook` when `sms.payments.demo-auto-complete=true`.  
**Events:** `DomainEventPublisher` logs `DOMAIN_EVENT` JSON and calls `InProcessNotificationService` (extend for email/SMS later).

## Multi-tenancy model

- **Tenant** = `schools` row (`id`, `code`, branding, …).  
- **User** rows carry `school_id` (nullable for `SUPER_ADMIN`).  
- **JWT** carries `schoolId` and `tenantId` (same integer today) for school-scoped users.  
- **`TenantContext`** (ThreadLocal) is populated in `JWTFilter` for each request so services enforce tenant scope.  
- **Strict isolation:** repository/service layer must filter by `TenantContext.getTenantId()` (or explicit `school` association) for all tenant-owned aggregates. Platform operators use null tenant context.

### Roadmap (schema)

For full “`tenant_id` on every row” normalization, add `tenant_id` columns via Flyway to domain tables (`students`, `class_groups`, …) with composite unique indexes `(tenant_id, business_key)` and Hibernate filters or explicit predicates. The subscription tables already use `tenant_id` naming.

## Roles

| Role | Scope |
|------|--------|
| `SUPER_ADMIN` | Platform owner: onboard schools, assign plans |
| `SCHOOL_ADMIN` / `PRINCIPAL` | Tenant configuration |
| `TEACHER` | Classes, attendance, marks entry |
| `STUDENT` | Own profile, timetable, results |
| `PARENT` | Linked students, fees, messaging |

Spring Security: `@PreAuthorize` for RBAC; `@RequireFeature` + aspect for subscription feature gates.

**Full feature & access matrix (UI shells, routes, API annotations, subscription codes, attendance rules):** see [`docs/FEATURES_AND_ROLES.md`](./FEATURES_AND_ROLES.md).

## Subscription & feature flags

**Tables (Flyway):**

- `subscription_plans` — `BASIC`, `PREMIUM`, `ENTERPRISE`
- `subscription_features` — catalog (`core.students`, `academics.exams`, …)
- `subscription_plan_features` — many-to-many with `enabled`
- `tenant_subscriptions` — **one active row per tenant** (`tenant_id` UNIQUE), status `ACTIVE`

**Bootstrap:** `TenantSubscriptionBootstrap` assigns **BASIC** to any school without a row after startup.

**API enforcement:** `@RequireFeature("academics.exams")` on controllers (example: `GET /api/v1/academics/exams/health`). `SUPER_ADMIN` without tenant bypasses the gate for platform operations.

**Platform APIs:**

- `GET /api/v1/platform/plans` — list plans (`SUPER_ADMIN`)
- `PUT /api/v1/platform/tenants/{tenantId}/subscription` — body `{ "planCode": "PREMIUM" }`

**Tenant APIs:**

- `GET /api/v1/tenant/subscription/me` — current plan for JWT tenant
- `GET /api/v1/tenant/context` — tenant id/code/name for UI

## Auth module (`/api/v1/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Returns `{ accessToken, refreshToken, expiresInMs, tokenType }` |
| POST | `/api/v1/auth/refresh` | Rotates access token from opaque refresh |
| POST | `/api/v1/auth/logout` | Revokes refresh token |
| POST | `/api/v1/auth/password-reset/request` | 202 stub — extend `InProcessNotificationService` when ready |

Legacy `POST /public/login` (plain JWT string) remains for backward compatibility.

## Modular monolith — Java package map

```
com.myhaimi.sms.modules.auth        — Auth v1, refresh tokens
com.myhaimi.sms.modules.tenant     — Tenant context API
com.myhaimi.sms.modules.subscription — Plans, entitlements, platform admin APIs
com.myhaimi.sms.modules.academic   — Example feature-gated surface (exams)
com.myhaimi.sms.modules.platform   — Cross-cutting: security aspect, DTOs, global errors
```

Existing domain (`controllers`, `service`, `entity`) remains; migrate endpoints incrementally under `/api/v1/...` with Flyway-owned schema.

## Database migrations

- **Flyway** enabled: `src/main/resources/db/migration/`
- **Hibernate** `ddl-auto=update` retained for transitional dev; production should move to `validate` + full Flyway ownership.

## REST API versioning

- New externally contract-stable APIs live under **`/api/v1/**`**.  
- Internal/legacy routes (`/public`, `/admin`, resource controllers) stay until deprecated behind an API gateway.

### Tenant feature discovery (UI)

- `GET /api/v1/tenant/features` — returns `{ "features": ["core.students", ...] }` for the JWT tenant’s active plan (empty for platform users without tenant).

### Domain events (async path)

- On successful online fee settlement, the monolith publishes **`fee_paid`** via `DomainEventPublisher` (structured JSON log `DOMAIN_EVENT {...}` plus `InProcessNotificationService`).

## Docker & local dev

- `docker/docker-compose.yml` — MySQL + monolith image build.  
- Optional SaaS compose (`docker-compose.saas.yml`) may include Redpanda for future Kafka; payment/notification satellite apps were removed for cost efficiency.

## CI

GitHub Actions workflow `.github/workflows/ci.yml` runs monolith tests (H2).

## Frontend (React + TypeScript)

- **Zustand** `stores/sessionStore.ts` — persisted refresh token (pair with `/api/v1/auth` when adopted).  
- **Role dashboards** under `src/modules/dashboards/` selected by `/user/me` roles on the home dashboard.

## Example flows

1. **School onboarding:** `POST /admin/schools/register` (MyHaimi domain policy) → `TenantSubscriptionBootstrap` assigns BASIC if no row.  
2. **Plan upgrade:** Super admin `PUT /api/v1/platform/tenants/{id}/subscription` with `PREMIUM`.  
3. **Feature restriction:** Teacher on BASIC calls `GET /api/v1/academics/exams/health` → **403** (`academics.exams` not in BASIC).  
4. **Fee payment (implemented path):** Authenticated tenant user with plan feature `fees.online_payments` calls `POST /api/v1/fees/invoices/{id}/online-intent` (optional `Idempotency-Key`, optional JSON `{ "amount" }`). The monolith registers a `FeePayment` row (`gatewayStatus=PENDING`), creates an in-process gateway order (`InternalPaymentOrderService`) with `notifyUrl` pointing to `POST /api/v1/integrations/payments/webhook` (shared `X-Webhook-Secret`). On `SUCCEEDED`, the webhook marks the payment confirmed and recomputes invoice `DUE` / `PARTIAL` / `PAID`. For local demos, set `sms.payments.demo-auto-complete=true` so the app POSTs the synthetic webhook immediately. Domain events then log and flow through `InProcessNotificationService`.

## Security hardening (next)

- mTLS to external PSPs, per-tenant rate limits, WAF rules, structured audit log, secrets manager, OWASP dependency scan, SAST in CI.
