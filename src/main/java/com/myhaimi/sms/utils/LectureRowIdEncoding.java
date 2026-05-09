package com.myhaimi.sms.utils;

/**
 * Encodes virtual “lecture row” ids returned by timetable UIs ({@link com.myhaimi.sms.DTO.LectureDayRowDTO}) and attendance flows.
 */
public final class LectureRowIdEncoding {

    /** Same base as {@code LectureService}: legacy weekly {@link com.myhaimi.sms.entity.TimetableSlot} surrogate ids. */
    public static final int WEEKLY_SLOT_ID_BASE = 1_000_000_000;

    private LectureRowIdEncoding() {}

    public static int publishedEntrySurrogate(int timetableEntryId) {
        return -timetableEntryId;
    }

    public static int legacyWeeklySlotSurrogate(int timetableSlotPk) {
        return -(WEEKLY_SLOT_ID_BASE + timetableSlotPk);
    }

    public static boolean isPublishedEntrySurrogate(int rowId) {
        return rowId < 0 && Math.abs(rowId) < WEEKLY_SLOT_ID_BASE;
    }

    public static boolean isLegacyWeeklySlotSurrogate(int rowId) {
        return rowId < 0 && Math.abs(rowId) >= WEEKLY_SLOT_ID_BASE;
    }

    public static int timetableEntryIdFromSurrogate(int rowId) {
        return -rowId;
    }

    public static int legacySlotIdFromSurrogate(int rowId) {
        return Math.abs(rowId) - WEEKLY_SLOT_ID_BASE;
    }
}
