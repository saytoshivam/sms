package com.myhaimi.sms.academic;

import com.myhaimi.sms.entity.RoomType;
import com.myhaimi.sms.entity.SubjectAllocationVenueRequirement;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RoomVenueCompatibilityTest {

    @Test
    void scienceNamedStandardClassroomUsesStandardRoomOnly() {
        var allowed = RoomVenueCompatibility.compatibleRoomTypes(SubjectAllocationVenueRequirement.STANDARD_CLASSROOM, null);
        assertTrue(allowed.contains(RoomType.STANDARD_CLASSROOM));
        assertFalse(allowed.contains(RoomType.SCIENCE_LAB));
    }

    @Test
    void logicNamedSubjectWithLabRequiredAllowsLabs() {
        var allowed = RoomVenueCompatibility.compatibleRoomTypes(SubjectAllocationVenueRequirement.LAB_REQUIRED, null);
        assertTrue(allowed.contains(RoomType.SCIENCE_LAB));
        assertTrue(allowed.contains(RoomType.COMPUTER_LAB));
        assertFalse(allowed.contains(RoomType.STANDARD_CLASSROOM));
    }

    @Test
    void manualIncompatibleStillDetectable() {
        assertFalse(
                RoomVenueCompatibility.isRoomTypeCompatible(
                        SubjectAllocationVenueRequirement.LAB_REQUIRED,
                        null,
                        RoomType.STANDARD_CLASSROOM
                )
        );
    }

    @Test
    void flexibleAllowsAll() {
        assertTrue(
                RoomVenueCompatibility.isRoomTypeCompatible(
                        SubjectAllocationVenueRequirement.FLEXIBLE,
                        null,
                        RoomType.STANDARD_CLASSROOM
                )
        );
    }
}
