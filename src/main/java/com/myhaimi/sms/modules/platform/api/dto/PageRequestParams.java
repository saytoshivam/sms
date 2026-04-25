package com.myhaimi.sms.modules.platform.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

public record PageRequestParams(
        @Min(0) int page,
        @Min(1) @Max(100) int size
) {
    public Pageable toPageable() {
        return PageRequest.of(page, size);
    }
}
