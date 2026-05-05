# Product Vision — Multi-Tenant Academic ERP

**Product:** School / College Management System (SMS)  
**Audience:** Executive sponsors, Product, Engineering, Customer Success  
**Version:** 1.0  
**Status:** Approved for engineering alignment  

---

## 1. Vision statement

**Enable every accredited school and college to run day-to-day academic and administrative operations on one secure, multi-tenant platform**—from onboarding and academic structure through timetables, attendance, assessments, fees, and family-facing portals—**with clear automation for high-friction workflows** (teacher assignment, homerooms, class teachers, timetable scaffolding) and **enterprise-grade isolation, auditability, and entitlements**.

---

## 2. Problem we solve

| Stakeholder | Pain |
|-------------|------|
| **Institution** | Fragmented spreadsheets, opaque staffing fit, timetable drift, fee reconciliation gaps, weak parent communication. |
| **Leadership** | No single source of truth across sections, subjects, staff load, and compliance reporting. |
| **Teachers** | Context switching across attendance, marks, schedules; unclear section ownership. |
| **Families** | Opaque fee status, scattered announcements, limited visibility into attendance and results. |
| **Platform operator** | Costly bespoke deployments; need standardized tenants with plan-based features and safe upgrades. |

---

## 3. Product principles

1. **Tenant-first:** Every school’s data is isolated; platform features never leak across tenants.  
2. **Server-authoritative security:** UI reflects roles; **API and services enforce** permissions and subscription entitlements.  
3. **Progressive complexity:** Core flows work with defaults; advanced automation (smart assign, bulk rules) is opt-in and explainable.  
4. **Operational honesty:** Surfaces shortages (teachers, rooms, capacity) early with actionable copy, not silent failure.  
5. **Extensibility without chaos:** Modular monolith, versioned schema (Flyway), feature flags and plan codes for gradual rollout.

---

## 4. Target outcomes (12–24 months)

- **Onboarding:** New tenant can reach “first timetable-ready week” with guided setup and validation gates.  
- **Automation:** Academic structure reduces manual teacher/room assignment effort measurably vs. baseline spreadsheet schools.  
- **Engagement:** Students/parents consume schedules, fees, and announcements in-product.  
- **Trust:** Audit trails and role clarity suitable for **ISO-aligned** school procurement.

---

## 5. Strategic non-goals (current horizon)

- Full **LMS** (content authoring, deep learning analytics marketplace).  
- **Payroll / HR** as system of record (integrations may come later).  
- **Transport GPS** and **biometric hardware** as first-party devices (integrate later if needed).  
- **Multi-campus legal entity** billing splits beyond tenant-scoped reporting (roadmap candidate).

---

## 6. Success metrics (north star + supporting)

| Metric | Definition |
|--------|------------|
| **North star** | Weekly active **structured academic actions** (timetable views, attendance sessions, fee payments recorded, graded rows) per active tenant. |
| **Supporting** | Time-to-complete onboarding; % tenants with conflict-free recurring timetable; teacher demand “critical” subjects count; parent/student portal WAU; NPS from leadership admins. |

---

## 7. Guiding architecture (one paragraph)

A **modular monolith** hosts REST APIs, **JWT** tenant context, **subscription-backed feature gates**, and relational persistence with **migratory schema evolution**; the SPA provides role-specific shells (platform, school leadership, teacher, student, parent). Notifications and payments start **in-process** with clear extension points for external channels and gateways.

*(Detail: [`../SAAS_ARCHITECTURE.md`](../SAAS_ARCHITECTURE.md).)*

---

## 8. Document handoff

- **PRD** translates this vision into **scoped requirements** for engineering.  
- Subsequent specs (roles, workflows, validations, APIs, data model, UI behavior) **decompose** PRD requirements into implementable contracts.
