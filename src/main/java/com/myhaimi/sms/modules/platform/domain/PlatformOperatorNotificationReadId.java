package com.myhaimi.sms.modules.platform.domain;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class PlatformOperatorNotificationReadId implements Serializable {
    private Long notificationId;
    private Integer userId;
}
