package com.myhaimi.sms.academic;

import com.myhaimi.sms.entity.SubjectAllocationVenueRequirement;

public final class SubjectAllocationVenueParsing {

    private SubjectAllocationVenueParsing() {}

    public static SubjectAllocationVenueRequirement parseRequirement(String raw) {
        if (raw == null || raw.isBlank()) {
            return SubjectAllocationVenueRequirement.STANDARD_CLASSROOM;
        }
        try {
            return SubjectAllocationVenueRequirement.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return SubjectAllocationVenueRequirement.STANDARD_CLASSROOM;
        }
    }
}
