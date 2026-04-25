package com.myhaimi.sms.DTO.announcement;

import com.myhaimi.sms.entity.AnnouncementCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class TeacherAnnouncementCreateDTO {

    @NotBlank
    @Size(max = 512)
    private String title;

    @NotBlank
    @Size(max = 20000)
    private String body;

    @NotNull
    private AnnouncementCategory category;

    /** Class groups this teacher teaches (via timetable); students in these classes will see the post. */
    @NotEmpty
    private List<Integer> classGroupIds;
}
