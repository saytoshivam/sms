package com.myhaimi.sms.service.impl;

/**
 * Tunable weights for the timetable generator scoring.
 * Higher = more important (soft constraints only).
 */
public record TimetableGeneratorWeights(
        int preferConsistentPeriod,
        int preferNearPeriod,
        int avoidSameSubjectConsecutive,
        int spreadAcrossWeek,
        int avoidGapsInDay,
        int preferMorningCore
) {
    public static TimetableGeneratorWeights balancedDefaults() {
        return new TimetableGeneratorWeights(
                18, // consistent period is very important
                10, // nearby period is good
                14, // avoid same subject back-to-back
                8,  // spread across days
                6,  // avoid holes in a day
                4   // morning preference (if subject type/core available)
        );
    }
}

