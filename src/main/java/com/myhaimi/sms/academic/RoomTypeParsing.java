package com.myhaimi.sms.academic;

import com.myhaimi.sms.entity.LabType;
import com.myhaimi.sms.entity.RoomType;

/**
 * Parses client/CSV room type strings, including legacy synonyms.
 */
public final class RoomTypeParsing {

    private RoomTypeParsing() {}

    public static RoomType parseRoomType(String raw, LabType labType) {
        if (raw == null || raw.isBlank()) {
            return RoomType.STANDARD_CLASSROOM;
        }
        String u = raw.trim().toUpperCase();
        return switch (u) {
            case "CLASSROOM", "STANDARD_CLASSROOM" -> RoomType.STANDARD_CLASSROOM;
            case "LAB" -> labType == LabType.COMPUTER ? RoomType.COMPUTER_LAB : RoomType.SCIENCE_LAB;
            case "SCIENCE_LAB" -> RoomType.SCIENCE_LAB;
            case "COMPUTER_LAB" -> RoomType.COMPUTER_LAB;
            case "MULTIPURPOSE" -> RoomType.MULTIPURPOSE;
            case "ART_ROOM" -> RoomType.ART_ROOM;
            case "MUSIC_ROOM" -> RoomType.MUSIC_ROOM;
            case "SPORTS_ROOM", "SPORTS_AREA" -> RoomType.SPORTS_AREA;
            case "LIBRARY" -> RoomType.LIBRARY;
            case "AUDITORIUM" -> RoomType.AUDITORIUM;
            case "STAFF_ROOM" -> RoomType.STAFF_ROOM;
            case "OFFICE" -> RoomType.OFFICE;
            default -> {
                try {
                    yield RoomType.valueOf(u);
                } catch (IllegalArgumentException e) {
                    yield RoomType.OTHER;
                }
            }
        };
    }

    public static RoomType parseRoomTypeNullable(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return parseRoomType(raw, null);
    }
}
