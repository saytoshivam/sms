package com.myhaimi.sms.DTO.room.importdto;

import lombok.Builder; import lombok.Data; import java.util.List;

@Data @Builder
public class RoomImportCommitResultDto {
    private int importedCount, skippedCount;
    private List<RoomImportRowResultDto> failedRows;
}

