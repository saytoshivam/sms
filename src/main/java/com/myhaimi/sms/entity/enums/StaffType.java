package com.myhaimi.sms.entity.enums;

/** Broad functional category of a staff member. */
public enum StaffType {
    /** Classroom or subject teacher — eligible for timetable assignment when TEACHER role is present. */
    TEACHING,
    /** Non-teaching academic / operational staff (librarian, lab assistant, counsellor, etc.). */
    NON_TEACHING,
    /** Administrative staff (principal, HOD, coordinator, registrar, accountant, etc.). */
    ADMIN,
    /** Support / ancillary staff (peon, driver, security, housekeeping, etc.). */
    SUPPORT
}
