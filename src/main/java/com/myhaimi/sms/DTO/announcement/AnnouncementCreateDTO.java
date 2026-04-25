package com.myhaimi.sms.DTO.announcement;

import com.myhaimi.sms.entity.AnnouncementCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AnnouncementCreateDTO {

    @NotBlank
    @Size(max = 512)
    private String title;

    @NotBlank
    @Size(max = 20000)
    private String body;

    @NotNull
    private AnnouncementCategory category;
}
