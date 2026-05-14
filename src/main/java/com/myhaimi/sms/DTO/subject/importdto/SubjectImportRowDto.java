package com.myhaimi.sms.DTO.subject.importdto;

import lombok.Data;

/** Raw parsed row from the subjects CSV. */
@Data
public class SubjectImportRowDto {
    private int    rowNumber;
    private String name;
    private String code;
    private String type;                    // CORE | OPTIONAL
    private String weeklyFrequency;
    private String allocationVenueRequirement; // STANDARD_CLASSROOM | LAB_REQUIRED | ACTIVITY_SPACE | SPORTS_AREA | SPECIALIZED_ROOM | FLEXIBLE
}


