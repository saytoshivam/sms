package com.myhaimi.sms.DTO;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ClassTeacherBatchAssignDTO(
        @NotNull @Valid List<Item> items
) {
    public record Item(
            @NotNull Integer classGroupId,
            /** Null clears class teacher for this section. */
            Integer staffId
    ) {}
}

