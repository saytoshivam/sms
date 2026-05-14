package com.myhaimi.sms.DTO.room.importdto;

import lombok.Data;

@Data
public class RoomImportCommitDto {
    private String importToken;
    private boolean strictMode = false;
}

