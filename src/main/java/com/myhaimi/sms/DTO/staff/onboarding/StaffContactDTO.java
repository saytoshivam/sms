package com.myhaimi.sms.DTO.staff.onboarding;

import lombok.Data;

/** Current residential address and emergency contact. */
@Data
public class StaffContactDTO {

    // ── Current address ────────────────────────────────────────────────────────
    private String currentAddressLine1;
    private String currentAddressLine2;
    private String city;
    private String state;
    private String pincode;

    // ── Emergency contact ─────────────────────────────────────────────────────
    private String emergencyContactName;
    private String emergencyContactPhone;
    private String emergencyContactRelation;
}
