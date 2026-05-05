# Edge Cases & Negative Paths

**Audience:** Engineering, QA  
**Version:** 1.0  

---

## 1. Purpose

Catalog **edge cases**, **race conditions**, and **failure modes** for regression suites and design reviews.

---

## 2. Multi-tenancy & security

| ID | Scenario | Expected behavior |
|----|----------|---------------------|
| EC-TNT-01 | User copies API URL with another school’s id | 403 or empty; never leak foreign payload |
| EC-TNT-02 | JWT expired mid-session | 401; SPA refresh or re-login |
| EC-TNT-03 | User loses role while UI open | Next API 403; UI shows access denied |
| EC-TNT-04 | `SUPER_ADMIN` edits school A while UI still shows B | Path param wins; audit trail |

---

## 3. Subscription / features

| ID | Scenario | Expected |
|----|----------|----------|
| EC-SUB-01 | Plan downgraded mid-session; user on exam page | Next gated call 403 + friendly message |
| EC-SUB-02 | Feature on but permission matrix says no (future) | Stricter of the two when unified |

---

## 4. Academic structure

| ID | Scenario | Expected |
|----|----------|----------|
| EC-ACAD-01 | Delete subject still referenced by template | Block or cascade per policy; migration doc |
| EC-ACAD-02 | All teachers removed for subject with positive periods | Smart assign conflict rows; demand CRITICAL |
| EC-ACAD-03 | Two admins edit same override | Last-write-wins unless optimistic versioning added |
| EC-ACAD-04 | `slotsPerWeek` lowered below sum of section periods | Soft warnings + highlight rows |
| EC-ACAD-05 | Homeroom room deleted while assigned as default | Validation on delete or orphan fallback |

---

## 5. Smart teacher assignment

| ID | Scenario | Expected |
|----|----------|----------|
| EC-STA-01 | All eligible teachers at max load | Assign best-effort with CAPACITY_OVERFLOW meta |
| EC-STA-02 | Single teacher, two sections, capacity only for one | Partial assignment + warnings |
| EC-STA-03 | Reset to auto with no qualified teachers | Rebalance leaves conflict / empty |
| EC-STA-04 | Manual teacher lock + rebalance | Locked slot unchanged |
| EC-STA-05 | Teacher loses teachable after assignment | Next full assign warns; row may show conflict until fixed |

---

## 6. Timetable

| ID | Scenario | Expected |
|----|----------|----------|
| EC-TT-01 | DST boundary on recurring slot | Store wall-clock or UTC consistently; document |
| EC-TT-02 | Teacher sick—swap two slots | Manual edit or future workflow |
| EC-TT-03 | Room double-book published | Conflict list; severity per product |
| EC-TT-04 | Version 2 published while teacher views v1 | UI shows active version badge |

---

## 7. Attendance

| ID | Scenario | Expected |
|----|----------|----------|
| EC-ATT-01 | Student transfers mid-day between sections | Marks belong to session’s roster snapshot |
| EC-ATT-02 | Two teachers open same session | Concurrent save policy: last write or 409 |
| EC-ATT-03 | Mark attendance for holiday | Optional block by calendar |
| EC-ATT-04 | Lecture cancelled after marks started | Session voided per policy |

---

## 8. Fees & payments

| ID | Scenario | Expected |
|----|----------|----------|
| EC-FEE-01 | Double webhook delivery | Idempotent no double credit |
| EC-FEE-02 | Partial payment then refund | Ledger entries balanced |
| EC-FEE-03 | Invoice deleted with pending intent | Block or cancel intent |
| EC-FEE-04 | Currency mismatch in gateway | Reject at intent creation |

---

## 9. Student / parent portal

| ID | Scenario | Expected |
|----|----------|----------|
| EC-PRT-01 | Student unlinked from user mid-session | Next API 403 on `/student/me/*` |
| EC-PRT-02 | Parent with two children; one leaves school | Child list updates; no stale ids |
| EC-PRT-03 | Deep link to another student’s performance | 403 |

---

## 10. Announcements

| ID | Scenario | Expected |
|----|----------|----------|
| EC-ANN-01 | Target class deleted after publish | Announcement history retained; target orphaned handled |
| EC-ANN-02 | Very large body | Max size validation |

---

## 11. Imports & bulk

| ID | Scenario | Expected |
|----|----------|----------|
| EC-IMP-01 | CSV duplicate rows | Row-level errors; partial import |
| EC-IMP-02 | UTF-8 BOM in CSV | Parser tolerates |

---

## 12. Observability

| ID | Scenario | Expected |
|----|----------|----------|
| EC-OPS-01 | DB slow; attendance save times out | 504 vs 408 policy; client retry idempotent keys where applicable |

---

## 13. QA checklist snippet

- [ ] EC-TNT-01 unauthorized cross-tenant  
- [ ] EC-STA-04 lock + rebalance  
- [ ] EC-FEE-01 webhook replay  
- [ ] EC-PRT-03 student A cannot open B’s marks  
