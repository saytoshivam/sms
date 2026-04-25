package com.myhaimi.sms.DTO;

import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class SchoolThemeUpdateDTO {
    /**
     * Optional: SUPER_ADMIN may update branding for a specific school by id.
     * School-scoped admins should omit this and rely on JWT schoolId.
     */
    private Integer schoolId;

    @Pattern(regexp = "^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$", message = "Must be a hex color like #2563eb")
    private String primaryColor;

    @Pattern(regexp = "^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$", message = "Must be a hex color like #22c55e")
    private String accentColor;

    @Pattern(regexp = "^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$", message = "Must be a hex color like #f8fafc")
    private String backgroundColor;

    @Pattern(regexp = "^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$", message = "Must be a hex color like #0f172a")
    private String textColor;

    @Pattern(regexp = "^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$", message = "Must be a hex color like #ffffff")
    private String navTextColor;
}
