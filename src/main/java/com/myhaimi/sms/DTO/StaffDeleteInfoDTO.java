package com.myhaimi.sms.DTO;

import java.util.List;

public record StaffDeleteInfoDTO(boolean canDelete, List<String> reasons) {}

