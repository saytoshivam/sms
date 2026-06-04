package com.myhaimi.sms.modules.exam.entity.enums;

/**
 * Controls who is authorised to schedule an assessment component.
 *
 * CENTRALIZED  – only central roles (ADMIN, PRINCIPAL, EXAM_CONTROLLER) may schedule.
 * DELEGATED    – subject teachers confirmed via the published timetable may schedule.
 * HYBRID       – teacher proposes; admin/exam-controller approves.
 */
public enum SchedulingMode {
    CENTRALIZED,
    DELEGATED,
    HYBRID
}

