package com.myhaimi.sms.modules.platform.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PlatformAnnouncementWriteRequest(
        @NotBlank @Size(max = 512) String title,
        @NotBlank String body,
        boolean published) {}
