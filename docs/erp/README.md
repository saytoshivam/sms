# Academic ERP — Product & Engineering Documentation Suite

This folder contains **production-oriented** product documentation for the **School / College Management System (multi-tenant academic ERP)**. Documents are written for **Product**, **Engineering**, **QA**, and **Implementation partners**.

**Related repo docs:** [`../SAAS_ARCHITECTURE.md`](../SAAS_ARCHITECTURE.md), [`../FEATURES_AND_ROLES.md`](../FEATURES_AND_ROLES.md).

---

## Document sequence (canonical order)

| # | Document | File | Status |
|---|----------|------|--------|
| 1 | Product Vision | [`01-PRODUCT-VISION.md`](./01-PRODUCT-VISION.md) | Published |
| 2 | Product Requirements (PRD) | [`02-PRD.md`](./02-PRD.md) | Published |
| 3 | User Roles & Permissions | [`03-USER-ROLES-AND-PERMISSIONS.md`](./03-USER-ROLES-AND-PERMISSIONS.md) | Published |
| 4 | Module Breakdown | [`04-MODULE-BREAKDOWN.md`](./04-MODULE-BREAKDOWN.md) | Published |
| 5 | Functional Specs (per area) | [`05-FUNCTIONAL-SPECS/README.md`](./05-FUNCTIONAL-SPECS/README.md) | Published |
| 6 | Workflow Specs | [`06-WORKFLOW-SPECS.md`](./06-WORKFLOW-SPECS.md) | Published |
| 7 | Validation Rules | [`07-VALIDATION-RULES.md`](./07-VALIDATION-RULES.md) | Published |
| 8 | Business Logic Rules | [`08-BUSINESS-LOGIC-RULES.md`](./08-BUSINESS-LOGIC-RULES.md) | Published |
| 9 | Edge Cases | [`09-EDGE-CASES.md`](./09-EDGE-CASES.md) | Published |
| 10 | API Contracts (high level) | [`10-API-CONTRACTS.md`](./10-API-CONTRACTS.md) | Published |
| 11 | Database Entity Definitions | [`11-DATA-MODEL.md`](./11-DATA-MODEL.md) | Published |
| 12 | UI Behavior Specs | [`12-UI-BEHAVIOR-SPECS.md`](./12-UI-BEHAVIOR-SPECS.md) | Published |

---

## Functional spec files (`05-FUNCTIONAL-SPECS/`)

| File | Topics |
|------|--------|
| [`F-platform-subscription.md`](./05-FUNCTIONAL-SPECS/F-platform-subscription.md) | Platform admin, plans, tenant features, audit |
| [`F-onboarding.md`](./05-FUNCTIONAL-SPECS/F-onboarding.md) | Wizard, basic profile, checklist |
| [`F-academic-structure.md`](./05-FUNCTIONAL-SPECS/F-academic-structure.md) | Class groups, templates, overrides, demand, smart assign |
| [`F-staff-students.md`](./05-FUNCTIONAL-SPECS/F-staff-students.md) | Staff, teachables, load, students, guardians, class teacher |
| [`F-scheduling.md`](./05-FUNCTIONAL-SPECS/F-scheduling.md) | Rooms, recurring slots, engine/grid, lectures |
| [`F-attendance.md`](./05-FUNCTIONAL-SPECS/F-attendance.md) | Modes, sessions, marking |
| [`F-assessment-fees.md`](./05-FUNCTIONAL-SPECS/F-assessment-fees.md) | Marks, exams, invoices, payments, student statement |
| [`F-communications-portals.md`](./05-FUNCTIONAL-SPECS/F-communications-portals.md) | Announcements, student/parent portal |

---

## How to use

1. **New engineers:** Vision → PRD → [`04-MODULE-BREAKDOWN`](./04-MODULE-BREAKDOWN.md) → SAAS architecture → roles doc.  
2. **Feature work:** PRD `REQ-*` → functional spec `FR-*` → [`10-API-CONTRACTS`](./10-API-CONTRACTS.md) + [`11-DATA-MODEL`](./11-DATA-MODEL.md).  
3. **QA:** PRD + [`07-VALIDATION-RULES`](./07-VALIDATION-RULES.md) + [`06-WORKFLOW-SPECS`](./06-WORKFLOW-SPECS.md) + [`09-EDGE-CASES`](./09-EDGE-CASES.md) + [`12-UI-BEHAVIOR-SPECS`](./12-UI-BEHAVIOR-SPECS.md).

---

## Requirement traceability (convention)

- PRD: **`REQ-{MODULE}-{NNN}`**  
- Functional specs: **`FR-{area}-{NNN}`** (see [`05-FUNCTIONAL-SPECS/README.md`](./05-FUNCTIONAL-SPECS/README.md))  
- Workflows: **`WF-{DOMAIN}-{NN}`** in [`06-WORKFLOW-SPECS.md`](./06-WORKFLOW-SPECS.md)  
- Validation: **`VAL-*`** in [`07-VALIDATION-RULES.md`](./07-VALIDATION-RULES.md)  
- Business logic: **`BL-*`** in [`08-BUSINESS-LOGIC-RULES.md`](./08-BUSINESS-LOGIC-RULES.md)  
- Edge cases: **`EC-*`** in [`09-EDGE-CASES.md`](./09-EDGE-CASES.md)

---

## Maintenance

When adding routes, entities, or roles: update **`10-API-CONTRACTS`**, **`11-DATA-MODEL`**, [`../FEATURES_AND_ROLES.md`](../FEATURES_AND_ROLES.md), and this README if the suite structure changes.
