package com.myhaimi.sms.service.impl;

/**
 * Tunable weights for the timetable generator scoring.
 * Higher = more important (soft constraints only). Hard constraints are enforced separately.
 */
public record TimetableGeneratorWeights(
        /**
         * Scales same-period and off-modal penalties in {@link TimetableGeneratorService} (80 = default “1×” baseline).
         */
        int preferConsistentPeriod,
        int preferNearPeriod,
        /**
         * Multiplier for penalizing stacking the same subject on the same day:
         * penalty = spreadSameSubjectSameDay × (existingCountOnThatDay)².
         */
        int spreadSameSubjectSameDay,
        /**
         * Bonus when the slot falls on the round-robin target day for this weekly occurrence
         * (occurrence i → workingDays[i mod workingDays.size()]).
         */
        int preferSpreadDay,
        int preferClassTeacherFirstPeriod
) {
    public static TimetableGeneratorWeights balancedDefaults() {
        return new TimetableGeneratorWeights(
                80,
                24,
                48,
                95,
                12
        );
    }
}
