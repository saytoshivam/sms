package com.myhaimi.sms.modules.exam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Request body for smart schedule candidate generation.
 * The backend resolves applicable assessment schemes automatically using the override hierarchy.
 */
public record ScheduleGenerateCandidatesRequestDTO(

        /** Academic year in which to generate schedules. */
        @NotNull Integer academicYearId,

        /**
         * Component type to generate schedules for.
         * Must be a valid {@link com.myhaimi.sms.modules.exam.entity.enums.ComponentType} name.
         * Examples: MID_TERM, END_TERM, CONTINUOUS_ASSESSMENT
         */
        @NotBlank String componentType,

        /**
         * Coverage mode.
         * ALL_APPLICABLE = all non-deleted class-sections in the school.
         * SELECTED = only the class-sections in {@code selectedClassSectionIds}.
         */
        @NotBlank String coverageMode,

        /** Required when coverageMode = SELECTED. */
        List<Integer> selectedClassSectionIds,

        /**
         * Subject resolution mode.
         * ALL_MAPPED = subjects mapped to each class-section via Academic Structure (SubjectClassGroup).
         * SELECTED = only the subjects in {@code selectedSubjectIds}.
         */
        @NotBlank String subjectMode,

        /** Required when subjectMode = SELECTED. */
        List<Integer> selectedSubjectIds,

        /** Optional start of the date window for schedule distribution. */
        LocalDate dateWindowFrom,

        /** Optional end of the date window for schedule distribution. */
        LocalDate dateWindowTo,

        /** Default exam start time (HH:mm). */
        String defaultStartTime,

        /** Default exam end time (HH:mm). */
        String defaultEndTime,

        /**
         * Room strategy.
         * LEAVE_BLANK = no room assigned (admin fills manually).
         * USE_HOMEROOM = use class homeroom if available.
         */
        @NotBlank String roomStrategy,

        /**
         * Max marks strategy.
         * USE_COMPONENT = take max marks from the component definition.
         * MANUAL = use {@code manualMaxMarks}.
         */
        @NotBlank String maxMarksStrategy,

        /** Required when maxMarksStrategy = MANUAL. */
        BigDecimal manualMaxMarks,

        /**
         * Date distribution mode.
         * LEAVE_BLANK = all candidates get null date.
         * AUTO_DISTRIBUTE = distribute candidates across date window cyclically.
         * SAME_SUBJECT_DATE = all sections for the same subject share the same date.
         */
        String dateDistributionMode
) {}

