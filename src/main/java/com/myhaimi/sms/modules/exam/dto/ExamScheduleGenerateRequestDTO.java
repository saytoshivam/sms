package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/**
 * Request body for the "Generate from Scheme" bulk schedule generation.
 *
 * <p>The backend automatically resolves:
 * <ul>
 *   <li>All active class-sections for the academic year</li>
 *   <li>All subjects mapped to each class-section (Academic Structure)</li>
 *   <li>The most specific published assessment scheme per class-section × subject
 *       using the override hierarchy</li>
 *   <li>All components where {@code requiresScheduling = true}</li>
 * </ul>
 *
 * <p>Admin only provides scheduling-level inputs (date window, time defaults, room strategy).
 */
public record ExamScheduleGenerateRequestDTO(

        /** Academic year in which to generate draft schedule instances. */
        @NotNull Integer academicYearId,

        /**
         * A human-readable label for this generation batch (e.g. "Mid Term 2025-26").
         * Stored as {@code scheduleGroupId} on each generated instance.
         */
        @NotNull String scheduleName,

        /** Optional inclusive start of the date window for auto-distribution. */
        LocalDate dateWindowFrom,

        /** Optional inclusive end of the date window for auto-distribution. */
        LocalDate dateWindowTo,

        /** Default exam start time applied to all generated rows (HH:mm). */
        String defaultStartTime,

        /** Default exam end time applied to all generated rows (HH:mm). */
        String defaultEndTime,

        /**
         * Room assignment strategy.
         * LEAVE_BLANK  – no room assigned; admin fills later.
         * USE_HOMEROOM – use class homeroom if the class-group has one configured.
         */
        String roomStrategy,

        /**
         * Date distribution strategy.
         * LEAVE_BLANK       – all rows get null date.
         * AUTO_DISTRIBUTE   – distribute dates cyclically across the date window.
         * SAME_SUBJECT_DATE – same subject shares the same date across all sections.
         */
        String dateStrategy
) {}

