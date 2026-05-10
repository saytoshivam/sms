package com.myhaimi.sms.modules.files;

import com.myhaimi.sms.entity.FileObject;
import com.myhaimi.sms.entity.enums.FileCategory;
import com.myhaimi.sms.entity.enums.FileStatus;
import com.myhaimi.sms.entity.enums.FileVisibility;
import com.myhaimi.sms.modules.files.storage.FileStorageProvider;
import com.myhaimi.sms.repository.FileObjectRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Central service for all file operations.
 * Permission decisions are fully delegated to {@link FileAccessService}.
 * Storage operations are fully delegated to {@link FileStorageProvider}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileService {

    private static final Map<FileCategory, Set<String>> ALLOWED_TYPES = Map.ofEntries(
            Map.entry(FileCategory.PROFILE_PHOTO,          Set.of("image/jpeg", "image/png", "image/webp")),
            Map.entry(FileCategory.STUDENT_DOCUMENT,       Set.of("application/pdf", "image/jpeg", "image/png")),
            Map.entry(FileCategory.GUARDIAN_DOCUMENT,      Set.of("application/pdf", "image/jpeg", "image/png")),
            Map.entry(FileCategory.TEACHER_DOCUMENT,       Set.of("application/pdf", "image/jpeg", "image/png")),
            Map.entry(FileCategory.ASSIGNMENT_ATTACHMENT,  Set.of("application/pdf",
                    "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/vnd.ms-powerpoint",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    "image/jpeg", "image/png")),
            Map.entry(FileCategory.ASSIGNMENT_SUBMISSION,  Set.of("application/pdf",
                    "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "image/jpeg", "image/png")),
            Map.entry(FileCategory.LECTURE_NOTE,           Set.of("application/pdf",
                    "application/vnd.ms-powerpoint",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    "image/jpeg", "image/png")),
            Map.entry(FileCategory.CIRCULAR_ATTACHMENT,   Set.of("application/pdf", "image/jpeg", "image/png")),
            Map.entry(FileCategory.FEE_RECEIPT,            Set.of("application/pdf")),
            Map.entry(FileCategory.REPORT_CARD,            Set.of("application/pdf")),
            Map.entry(FileCategory.PAYROLL_SLIP,           Set.of("application/pdf")),
            Map.entry(FileCategory.TRANSFER_CERTIFICATE,   Set.of("application/pdf", "image/jpeg", "image/png"))
    );

    private static final Map<FileCategory, Long> MAX_SIZE_BYTES = Map.ofEntries(
            Map.entry(FileCategory.PROFILE_PHOTO,          2L  * 1024 * 1024),
            Map.entry(FileCategory.STUDENT_DOCUMENT,       10L * 1024 * 1024),
            Map.entry(FileCategory.GUARDIAN_DOCUMENT,      10L * 1024 * 1024),
            Map.entry(FileCategory.TEACHER_DOCUMENT,       10L * 1024 * 1024),
            Map.entry(FileCategory.ASSIGNMENT_ATTACHMENT,  25L * 1024 * 1024),
            Map.entry(FileCategory.ASSIGNMENT_SUBMISSION,  25L * 1024 * 1024),
            Map.entry(FileCategory.LECTURE_NOTE,           25L * 1024 * 1024),
            Map.entry(FileCategory.FEE_RECEIPT,            5L  * 1024 * 1024),
            Map.entry(FileCategory.REPORT_CARD,            5L  * 1024 * 1024),
            Map.entry(FileCategory.PAYROLL_SLIP,           5L  * 1024 * 1024),
            Map.entry(FileCategory.CIRCULAR_ATTACHMENT,    10L * 1024 * 1024),
            Map.entry(FileCategory.TRANSFER_CERTIFICATE,   10L * 1024 * 1024)
    );

    private static final long DEFAULT_MAX_BYTES = 10L * 1024 * 1024;
    private static final DateTimeFormatter YEAR_MONTH =
            DateTimeFormatter.ofPattern("yyyy/MM").withZone(ZoneOffset.UTC);

    private final FileObjectRepo      fileObjectRepo;
    private final FileStorageProvider storageProvider;
    private final FileAccessService   fileAccessService;

    @Value("${storage.s3.presigned-url-ttl-minutes:60}")
    private long presignedUrlTtlMinutes;

    // ── generic upload (admin-only) ───────────────────────────────────────────

    @Transactional
    public FileObjectDTO upload(MultipartFile file, FileCategory category,
                                String ownerType, String ownerId,
                                FileVisibility visibility, Integer uploadedBy) {
        return doUpload(file, category, ownerType, ownerId, visibility, uploadedBy);
    }

    /**
     * Module-specific upload — permission enforced by the calling module before invoking this.
     */
    @Transactional
    public FileObjectDTO uploadForModule(MultipartFile file, FileCategory category,
                                         String ownerType, String ownerId,
                                         FileVisibility visibility, Integer uploadedBy) {
        return doUpload(file, category, ownerType, ownerId, visibility, uploadedBy);
    }

    // ── download URL ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public FileObjectDTO getDownloadUrl(Long fileId, FileCallerContext caller) {
        FileObject fo = requireActive(fileId, caller.schoolId());
        fileAccessService.assertCanDownload(fo, caller);
        String url = storageProvider.generateReadUrl(fo.getStorageKey(), presignedUrlTtlMinutes * 60L);
        return toDTO(fo, url);
    }

    // ── metadata ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public FileObjectDTO getMetadata(Long fileId, FileCallerContext caller) {
        FileObject fo = requireActive(fileId, caller.schoolId());
        fileAccessService.assertCanViewMetadata(fo, caller);
        return toDTO(fo, null);
    }

    // ── soft delete ───────────────────────────────────────────────────────────

    @Transactional
    public void softDelete(Long fileId, FileCallerContext caller) {
        Integer schoolId = requireSchoolId();
        FileObject fo = requireActive(fileId, schoolId);
        fileAccessService.assertCanDelete(fo, caller);
        fo.setStatus(FileStatus.DELETED);
        fo.setDeletedAt(Instant.now());
        fileObjectRepo.save(fo);
        log.info("Soft-deleted file id={} by userId={}", fileId, caller.userId());
    }

    // ── list by owner ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<FileObjectDTO> listByOwner(String ownerType, String ownerId) {
        Integer schoolId = requireSchoolId();
        return fileObjectRepo
                .findBySchoolIdAndOwnerTypeAndOwnerIdAndStatusNot(schoolId, ownerType, ownerId, FileStatus.DELETED)
                .stream().map(fo -> toDTO(fo, null)).toList();
    }

    // ── internal helpers for modules ──────────────────────────────────────────

    @Transactional(readOnly = true)
    public FileObject requireFileObject(Long fileId) {
        return requireActive(fileId, requireSchoolId());
    }

    @Transactional(readOnly = true)
    public FileObject requireByStorageKey(String storageKey, Integer schoolId) {
        return fileObjectRepo.findByStorageKeyAndSchoolId(storageKey, schoolId)
                .filter(fo -> fo.getStatus() != FileStatus.DELETED)
                .orElseThrow(() -> new IllegalArgumentException("File not found."));
    }

    // ── private helpers ───────────────────────────────────────────────────────

    private FileObjectDTO doUpload(MultipartFile file, FileCategory category,
                                   String ownerType, String ownerId,
                                   FileVisibility visibility, Integer uploadedBy) {
        Integer schoolId = requireSchoolId();
        validateFile(file, category);

        byte[] bytes;
        try { bytes = file.getBytes(); }
        catch (IOException e) { throw new RuntimeException("Failed to read uploaded file bytes.", e); }

        String checksum   = md5Hex(bytes);
        String safeName   = sanitiseFilename(file.getOriginalFilename());
        String uuid       = UUID.randomUUID().toString();
        String storedName = uuid + "-" + safeName;
        String yearMonth  = YEAR_MONTH.format(Instant.now());
        String storageKey = "schools/" + schoolId + "/" + category.name()
                + "/" + ownerType + "/" + ownerId
                + "/" + yearMonth + "/" + storedName;

        storageProvider.upload(storageKey, new ByteArrayInputStream(bytes),
                file.getContentType(), bytes.length);

        FileObject fo = new FileObject();
        fo.setSchoolId(schoolId);
        fo.setOwnerType(ownerType);
        fo.setOwnerId(ownerId);
        fo.setFileCategory(category);
        fo.setOriginalFilename(file.getOriginalFilename() != null ? file.getOriginalFilename() : safeName);
        fo.setStoredFilename(storedName);
        fo.setStorageProvider(storageProvider.providerName());
        fo.setBucketName(null);
        fo.setStorageKey(storageKey);
        fo.setContentType(file.getContentType());
        fo.setFileSize((long) bytes.length);
        fo.setChecksum(checksum);
        fo.setVisibility(visibility);
        fo.setStatus(FileStatus.ACTIVE);
        fo.setUploadedBy(uploadedBy);

        FileObject saved = fileObjectRepo.save(fo);
        log.info("Uploaded file id={} category={} key={} by userId={}", saved.getId(), category, storageKey, uploadedBy);
        return toDTO(saved, null);
    }

    private FileObject requireActive(Long fileId, Integer schoolId) {
        return fileObjectRepo.findByIdAndSchoolIdAndStatus(fileId, schoolId, FileStatus.ACTIVE)
                .orElseThrow(() -> new IllegalArgumentException("File not found or has been deleted."));
    }

    private void validateFile(MultipartFile file, FileCategory category) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("No file provided.");
        String ct = file.getContentType();
        Set<String> allowed = ALLOWED_TYPES.get(category);
        if (allowed != null && (ct == null || !allowed.contains(ct.toLowerCase()))) {
            throw new IllegalArgumentException(
                    "File type '" + ct + "' is not allowed for category " + category + ". Allowed: " + allowed);
        }
        long maxBytes = MAX_SIZE_BYTES.getOrDefault(category, DEFAULT_MAX_BYTES);
        if (file.getSize() > maxBytes) {
            throw new IllegalArgumentException(
                    "File size " + (file.getSize() / 1024) + " KB exceeds the "
                            + (maxBytes / 1024 / 1024) + " MB limit for category " + category + ".");
        }
    }

    private Integer requireSchoolId() {
        Integer id = TenantContext.getSchoolId();
        if (id == null) throw new IllegalStateException("Missing school context.");
        return id;
    }

    private static String sanitiseFilename(String original) {
        if (original == null || original.isBlank()) return "file";
        String name = original.replaceAll("[^A-Za-z0-9._-]", "_");
        return name.length() > 200 ? name.substring(name.length() - 200) : name;
    }

    private static String md5Hex(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            return HexFormat.of().formatHex(md.digest(data));
        } catch (Exception e) { return "unknown"; }
    }

    FileObjectDTO toDTO(FileObject fo, String downloadUrl) {
        return FileObjectDTO.builder()
                .id(fo.getId()).schoolId(fo.getSchoolId())
                .ownerType(fo.getOwnerType()).ownerId(fo.getOwnerId())
                .fileCategory(fo.getFileCategory()).originalFilename(fo.getOriginalFilename())
                .contentType(fo.getContentType()).fileSize(fo.getFileSize())
                .visibility(fo.getVisibility()).status(fo.getStatus())
                .uploadedBy(fo.getUploadedBy()).uploadedAt(fo.getUploadedAt())
                .downloadUrl(downloadUrl).build();
    }
}
