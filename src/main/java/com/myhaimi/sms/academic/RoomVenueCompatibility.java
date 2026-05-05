package com.myhaimi.sms.academic;

import com.myhaimi.sms.entity.RoomType;
import com.myhaimi.sms.entity.SubjectAllocationVenueRequirement;

import java.util.EnumSet;
import java.util.Set;

/**
 * Single source of truth: which {@link RoomType} values are valid for a subject's
 * {@link SubjectAllocationVenueRequirement}. No name-based inference.
 */
public final class RoomVenueCompatibility {

    private RoomVenueCompatibility() {}

    public static Set<RoomType> compatibleRoomTypes(
            SubjectAllocationVenueRequirement subjectRequirement,
            RoomType specializedVenueType
    ) {
        if (subjectRequirement == null) {
            subjectRequirement = SubjectAllocationVenueRequirement.STANDARD_CLASSROOM;
        }
        return switch (subjectRequirement) {
            case STANDARD_CLASSROOM -> EnumSet.of(RoomType.STANDARD_CLASSROOM);
            case LAB_REQUIRED -> EnumSet.of(RoomType.SCIENCE_LAB, RoomType.COMPUTER_LAB, RoomType.MULTIPURPOSE);
            case ACTIVITY_SPACE -> EnumSet.of(RoomType.ART_ROOM, RoomType.MUSIC_ROOM, RoomType.MULTIPURPOSE);
            case SPORTS_AREA -> EnumSet.of(RoomType.SPORTS_AREA);
            case SPECIALIZED_ROOM -> {
                EnumSet<RoomType> s = EnumSet.of(RoomType.MULTIPURPOSE);
                if (specializedVenueType != null) {
                    s.add(specializedVenueType);
                }
                yield s;
            }
            case FLEXIBLE -> EnumSet.allOf(RoomType.class);
        };
    }

    public static boolean isRoomTypeCompatible(
            SubjectAllocationVenueRequirement subjectRequirement,
            RoomType specializedVenueType,
            RoomType roomType
    ) {
        return compatibleRoomTypes(subjectRequirement, specializedVenueType).contains(roomType);
    }

    /**
     * Lab-like subjects prefer a dedicated lab over multipurpose when multiple options exist.
     */
    public static int labRoomPreferenceRank(RoomType t) {
        if (t == RoomType.SCIENCE_LAB) return 0;
        if (t == RoomType.COMPUTER_LAB) return 1;
        if (t == RoomType.MULTIPURPOSE) return 2;
        return 99;
    }
}
