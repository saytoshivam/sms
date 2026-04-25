package com.myhaimi.sms.DTO;

import java.util.List;

public record RoomDeleteInfoDTO(boolean canDelete, List<String> reasons) {}

