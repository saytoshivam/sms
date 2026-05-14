package com.myhaimi.sms.DTO.room.importdto;

import lombok.Builder; import lombok.Data; import java.util.List;

@Data @Builder
public class RoomImportPreviewDto {
    private String importToken;
    private int totalRows, validRows, invalidRows, duplicateRows;
    private List<RoomImportRowResultDto> rows;
}

