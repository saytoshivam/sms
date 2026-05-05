# FR-ASM — Assessment, Exams, Fees

---

## FR-ASM-001 — Student marks (internal)

| Block | Content |
|-------|---------|
| **Purpose** | Record continuous assessment / class marks. |
| **User story** | As **teacher**, I enter unit test scores for my subject. |
| **Inputs** | Student id, subject, assessment key, score, max. |
| **Outputs** | `StudentMark` persistence. |
| **Validations** | Score ≤ max; student in teacher’s scope. |
| **Business rules** | BL-MRK-* |
| **Automation** | None. |
| **UI states** | Grid with validation per cell. |
| **Failure handling** | 403 for student role on staff APIs. |

---

## FR-ASM-002 — Exams module (licensed)

| Block | Content |
|-------|---------|
| **Purpose** | Exam scheduling and academic exam APIs. |
| **User story** | As **student**, I view my exam timetable when plan includes academics.exams. |
| **Inputs** | CRUD payloads per `ExamAcademicV1Controller`. |
| **Outputs** | Exam entities / DTOs. |
| **Validations** | `@RequireFeature(ACADEMICS_EXAMS)` |
| **Business rules** | Publish workflow states in roadmap. |
| **Automation** | Seat assignment when implemented. |
| **UI states** | 403 upgrade prompt if unlicensed. |
| **Failure handling** | Stable error code for SPA routing. |

---

## FR-ASM-003 — Fee invoices

| Block | Content |
|-------|---------|
| **Purpose** | Bill students per fee head and period. |
| **User story** | As **accountant**, I generate annual tuition invoice for a class. |
| **Inputs** | Fee structure, student selection, amounts, due date. |
| **Outputs** | `fee_invoices` rows / line items per schema. |
| **Validations** | VAL-FEE-* |
| **Business rules** | Currency consistency. |
| **Automation** | Recurring generation (roadmap). |
| **UI states** | Draft invoice preview. |
| **Failure handling** | Partial generation report. |

---

## FR-ASM-004 — Payments (offline)

| Block | Content |
|-------|---------|
| **Purpose** | Record cash/bank receipts. |
| **User story** | As **accountant**, I record ₹5000 partial payment against invoice. |
| **Inputs** | Invoice id, amount, method, reference. |
| **Outputs** | `fee_payments`; balance updated. |
| **Validations** | Amount ≤ outstanding unless policy allows credit. |
| **Business rules** | Double-entry depth TBD; operational balance first. |
| **Automation** | None. |
| **UI states** | Receipt confirmation modal. |
| **Failure handling** | Optimistic locking on invoice version. |

---

## FR-ASM-005 — Online payment intent

| Block | Content |
|-------|---------|
| **Purpose** | Start gateway checkout for guardian/student. |
| **User story** | As **parent**, I pay online when school enables gateway. |
| **Inputs** | `POST /api/v1/fees/invoices/{id}/online-intent`, optional body, `Idempotency-Key`. |
| **Outputs** | Client secret / redirect URL per gateway abstraction. |
| **Validations** | `@RequireFeature(FEES_ONLINE_PAYMENTS)` |
| **Business rules** | BL-FEE-* |
| **Automation** | Webhook completes order in-process demo mode. |
| **UI states** | Spinner → redirect → return handler pending/success/fail. |
| **Failure handling** | EC-FEE-01 replay; user message on decline. |

---

## FR-ASM-006 — Student fee statement

| Block | Content |
|-------|---------|
| **Purpose** | Read-only balance for portal. |
| **User story** | As **student**, I see dues and history. |
| **Inputs** | Linked student id. |
| **Outputs** | `/api/v1/student/me/fee-statement` DTO. |
| **Validations** | VAL-STU-* |
| **Business rules** | No other student’s data. |
| **Automation** | None. |
| **UI states** | Empty “All clear” vs list. |
| **Failure handling** | 401/403 graceful screen. |
