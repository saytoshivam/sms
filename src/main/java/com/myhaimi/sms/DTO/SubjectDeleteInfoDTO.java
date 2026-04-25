package com.myhaimi.sms.DTO;

import java.util.List;

public record SubjectDeleteInfoDTO(
        boolean canDelete,
        List<String> reasons
) {}

