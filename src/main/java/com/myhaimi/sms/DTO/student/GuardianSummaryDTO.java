package com.myhaimi.sms.DTO.student;

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
}
