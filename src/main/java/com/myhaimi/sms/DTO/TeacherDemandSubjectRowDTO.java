package com.myhaimi.sms.DTO;

/**
 * Per-subject aggregate used by Smart Teacher Assignment demand summary.
 *
 * @param avgTeacherCapacity null when there are no qualified teachers (avg undefined).
 * @param teachersNeeded ceil(required / avg) when avg &gt; 0; null when no qualified teachers.
 */
public record TeacherDemandSubjectRowDTO(
        int subjectId,
        String subjectCode,
        String subjectName,
        int requiredPeriods,
        int qualifiedTeacherCount,
        int availableCapacity,
        Double avgTeacherCapacity,
        Integer teachersNeeded,
        int periodShortfall,
        int teacherShortfall,
        String status,
        String statusDetail,
        boolean assignmentFeasible) {}
