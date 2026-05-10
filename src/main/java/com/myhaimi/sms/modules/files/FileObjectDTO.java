package com.myhaimi.sms.modules.files;

import com.myhaimi.sms.entity.enums.FileCategory;
import com.myhaimi.sms.entity.enums.FileStatus;
import com.myhaimi.sms.entity.enums.FileVisibility;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class FileObjectDTO {
    private Long id;
    private Integer schoolId;
    private String ownerType;
    private String ownerId;
    private FileCategory fileCategory;
    private String originalFilename;
    private String contentType;
    private Long fileSize;
    private FileVisibility visibility;
    private FileStatus status;
    private Integer uploadedBy;
    private Instant uploadedAt;
    /** Populated only by GET /api/files/{fileId}/download-url */
    private String downloadUrl;
}

