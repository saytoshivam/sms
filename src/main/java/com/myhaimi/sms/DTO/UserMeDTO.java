package com.myhaimi.sms.DTO;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class UserMeDTO {
    private String email;
    private String username;
    private List<String> roles = new ArrayList<>();
    private Integer schoolId;
    private String schoolCode;
    private String schoolName;

    /** {@code DAILY} or {@code LECTURE_WISE} when {@link #schoolId} is set. */
    private String schoolAttendanceMode;
    /** Populated for student portal accounts linked to a {@code Student} row. */
    private Integer linkedStudentId;

    private String linkedStudentPhotoUrl;

    private String linkedStudentDisplayName;

    private String linkedStudentAdmissionNo;

    /** Class / section label for the linked student (e.g. display name of class group). */
    private String linkedStudentClassLabel;

    /** Populated for teacher accounts linked to a {@code Staff} row. */
    private Integer linkedStaffId;

    private String linkedStaffPhotoUrl;

    private String linkedStaffDisplayName;

    private String linkedStaffEmployeeNo;
}
