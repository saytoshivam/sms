package com.myhaimi.sms.DTO.student;

import com.myhaimi.sms.entity.enums.GuardianLoginStatus;
import lombok.Data;

@Data
public class GuardianSummaryDTO {
    private Integer id;
    private String name;
    private String relation;
    private String phone;
    private String email;
    private boolean primaryGuardian;
    private boolean canLogin;
    private boolean receivesNotifications;

    /** ID of the linked parent User account, null if no account exists. */
    private Integer parentUserId;

    /** Login account status for this guardian. */
    private GuardianLoginStatus loginStatus = GuardianLoginStatus.NOT_CREATED;
}
