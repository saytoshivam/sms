package com.myhaimi.sms.entity;

/**
 * Metadata-only driver for which physical {@link RoomType} values may host this subject.
 * Must not be inferred from subject name — only this enum and optional {@link Subject#getSpecializedVenueType()}.
 */
public enum SubjectAllocationVenueRequirement {
    STANDARD_CLASSROOM,
    LAB_REQUIRED,
    ACTIVITY_SPACE,
    SPORTS_AREA,
    SPECIALIZED_ROOM,
    FLEXIBLE
}
