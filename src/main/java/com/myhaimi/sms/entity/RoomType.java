package com.myhaimi.sms.entity;

/**
 * Physical venue category for a room. Drives compatibility with {@link SubjectAllocationVenueRequirement}.
 * Legacy CSV/API values (CLASSROOM, LAB, SPORTS_ROOM) are normalized at parse / migration time.
 */
public enum RoomType {
    STANDARD_CLASSROOM,
    SCIENCE_LAB,
    COMPUTER_LAB,
    MULTIPURPOSE,
    ART_ROOM,
    MUSIC_ROOM,
    SPORTS_AREA,
    LIBRARY,
    AUDITORIUM,
    STAFF_ROOM,
    OFFICE,
    OTHER
}
