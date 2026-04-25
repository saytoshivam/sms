package com.myhaimi.sms.DTO.studentportal;

import java.time.LocalDate;

/**
 * Subject-wise attendance for the student’s current academic year (Apr–Mar), aligned with lecture days for that
 * subject. Legacy fields {@code presentOrLateDays} and {@code countedDays} mirror {@code attendedSessions} and
 * {@code deliveredSessions} for older clients.
 */
public record StudentSubjectAttendanceDTO(
        String subjectCode,
        String subjectName,
        int presentOrLateDays,
        int countedDays,
        double attendancePercent,
        String termName,
        String courseTypeTag,
        String groupLabel,
        String facultyName,
        String facultySeating,
        LocalDate lastAttendedDate,
        int deliveredSessions,
        int attendedSessions,
        int dutyLeaveCount,
        String sectionCode,
        String rollNo) {}
