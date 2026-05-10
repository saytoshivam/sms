package com.myhaimi.sms.modules.files;

import com.myhaimi.sms.entity.FileObject;
import com.myhaimi.sms.entity.enums.FileCategory;
import com.myhaimi.sms.entity.enums.FileStatus;
import com.myhaimi.sms.entity.enums.FileVisibility;
import com.myhaimi.sms.repository.FileObjectRepo;
import com.myhaimi.sms.modules.files.storage.FileStorageProvider;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

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
 * Central service for all file operations in the ERP.
 * Upload logic, permission checks, and URL generation live here —
 * individual modules delegate to this service.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileService {

    // ── allowed types & size limits by category ───────────────────────────────
    private static final Map<FileCategory, Set<String>> ALLOWED_TYPES = Map.of(
            FileCategory.PROFILE_PHOTO,          Set.of("image/jpeg", "image/png", "image/webp"),
            FileCategory.STUDENT_DOCUMENT,       Set.of("application/pdf", "image/jpeg", "image/png"),
            FileCategory.TEACHER_DOCUMENT,       Set.of("application/pdf", "image/jpeg", "image/png"),
            FileCategory.ASSIGNMENT_ATTACHMENT,  Set.of("application/pdf",
                    "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/vnd.ms-powerpoint",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    "image/jpeg", "image/png"),
            FileCategory.ASSIGNMENT_SUBMISSION,  Set.of("application/pdf",
                    "application/msword",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "image/jpeg", "image/png"),
            FileCategory.LECTURE_NOTE,           Set.of("application/pdf",
                    "application/vnd.ms-powerpoint",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    "image/jpeg", "image/png"),
            FileCategory.CIRCULAR_ATTACHMENT,    Set.of("application/pdf", "image/jpeg", "image/png"),
            FileCategory.FEE_RECEIPT,            Set.of("application/pdf"),
            FileCategory.REPORT_CARD,            Set.of("application/pdf"),
            FileCategory.PAYROLL_SLIP,           Set.of("application/pdf"),
            FileCategory.TRANSFER_CERTIFICATE,   Set.of("application/pdf", "image/jpeg", "image/png")
    );

    /** Max file size in bytes per category. */
    private static final Map<FileCategory, Long> MAX_SIZE_BYTES = Map.of(
            FileCategory.PROFILE_PHOTO,         2L  * 1024 * 1024,  //  2 MB
            FileCategory.STUDENT_DOCUMENT,      10L * 1024 * 1024,  // 10 MB
            FileCategory.TEACHER_DOCUMENT,      10L * 1024 * 1024,
            FileCategory.ASSIGNMENT_ATTACHMENT, 25L * 1024 * 1024,  // 25 MB
            FileCategory.ASSIGNMENT_SUBMISSION, 25L * 1024 * 1024,
            FileCategory.LECTURE_NOTE,          25L * 1024 * 1024,
            FileCategory.FEE_RECEIPT,           5L  * 1024 * 1024,
            FileCategory.REPORT_CARD,           5L  * 1024 * 1024,
            FileCategory.PAYROLL_SLIP,          5L  * 1024 * 1024,
            FileCategory.CIRCULAR_ATTACHMENT,   10L * 1024 * 1024,
            FileCategory.TRANSFER_CERTIFICATE,  10L * 1024 * 1024
    );

    private static final long DEFAULT_MAX_BYTES = 10L * 1024 * 1024; // 10 MB fallback
    private static final long DOWNLOAD_URL_TTL_SECONDS = 3600L;       // 1 hour

    private static final DateTimeFormatter YEAR_MONTH = DateTimeFormatter.ofPattern("yyyy/MM")
            .withZone(ZoneOffset.UTC);

    private final FileObjectRepo fileObjectRepo;
    private final FileStorageProvider storageProvider;

    // ── upload ────────────────────────────────────────────────────────────────

    /**
     * Upload a file and persist a {@link FileObject} row.
     *
     * @param file        Incoming multipart file
     * @param category    Logical category (determines allowed types + size limit)
     * @param ownerType   e.g. "STUDENT", "TEACHER"
     * @param ownerId     PK of the owning entity (as string)
     * @param visibility  Who may access this file
     * @param uploadedBy  User.id who is uploading
     * @return persisted FileObject metadata DTO
     */
    @Transactional
    public FileObjectDTO upload(MultipartFile file,
                                FileCategory category,
                                String ownerType,
                                String ownerId,
                                FileVisibility visibility,
                                Integer uploadedBy) {
        Integer schoolId = requireSchoolId();
        validateFile(file, category);

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new RuntimeException("Failed to read uploaded file bytes.", e);
        }

        String checksum     = md5Hex(bytes);
        String safeFilename = sanitiseFilename(file.getOriginalFilename());
        String uuid         = UUID.randomUUID().toString();
        String storedName   = uuid + "-" + safeFilename;
        String yearMonth    = YEAR_MONTH.format(Instant.now());
        String storageKey   = "schools/" + schoolId + "/" + category.name()
                + "/" + ownerType + "/" + ownerId
                + "/" + yearMonth + "/" + storedName;

        storageProvider.upload(storageKey, file.getResource().getInputStream() != null
                ? new java.io.ByteArrayInputStream(bytes)
                : null != null ? null : new java.io.ByteArrayInputStream(bytes),
                file.getContentType(), bytes.length);

        FileObject fo = new FileObject();
        fo.setSchoolId(schoolId);
        fo.setOwnerType(ownerType);
        fo.setOwnerId(ownerId);
        fo.setFileCategory(category);
        fo.setOriginalFilename(file.getOriginalFilename() != null ? file.getOriginalFilename() : safeFilename);
        fo.setStoredFilename(storedName);
        fo.setStorageProvider(storageProvider.providerName());
        fo.setBucketName(null); // set by S3 provider if needed — kept null for local
        fo.setStorageKey(storageKey);
        fo.setContentType(file.getContentType());
        fo.setFileSize((long) bytes.length);
        fo.setChecksum(checksum);
        fo.setVisibility(visibility);
        fo.setStatus(FileStatus.ACTIVE);
        fo.setUploadedBy(uploadedBy);

        FileObject saved = fileObjectRepo.save(fo);
        log.info("Uploaded file id={} key={} by userId={}", saved.getId(), storageKey, uploadedBy);
        return toDTO(saved, null);
    }

    // ── download URL ──────────────────────────────────────────────────────────

    /**
     * Generate a temporary read URL for the given file after permission checks.
     * The {@code callerUserId} and {@code callerRoles} are used to enforce access control.
     */
    @Transactional(readOnly = true)
    public FileObjectDTO getDownloadUrl(Long fileId,
                                        Integer callerUserId,
                                        Set<String> callerRoles,
                                        Integer callerStudentId,
                                        Integer callerGuardianId) {
        Integer schoolId = requireSchoolId();
        FileObject fo = fileObjectRepo.findByIdAndSchoolId(fileId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("File not found."));

        if (fo.getStatus() == FileStatus.DELETED) {
            throw new IllegalArgumentException("File has been deleted.");
        }

        checkReadPermission(fo, callerUserId, callerRoles, callerStudentId, callerGuardianId);

        String url = storageProvider.generateReadUrl(fo.getStorageKey(), DOWNLOAD_URL_TTL_SECONDS);
        return toDTO(fo, url);
    }

    // ── metadata ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public FileObjectDTO getMetadata(Long fileId) {
        Integer schoolId = requireSchoolId();
        FileObject fo = fileObjectRepo.findByIdAndSchoolId(fileId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("File not found."));
        return toDTO(fo, null);
    }

    // ── soft delete ───────────────────────────────────────────────────────────

    @Transactional
    public void softDelete(Long fileId, Integer deletedByUserId) {
        Integer schoolId = requireSchoolId();
        FileObject fo = fileObjectRepo.findByIdAndSchoolId(fileId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("File not found."));
        fo.setStatus(FileStatus.DELETED);
        fo.setDeletedAt(Instant.now());
        fileObjectRepo.save(fo);
        log.info("Soft-deleted file id={} by userId={}", fileId, deletedByUserId);
    }

    // ── list by owner ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<FileObjectDTO> listByOwner(String ownerType, String ownerId) {
        Integer schoolId = requireSchoolId();
        return fileObjectRepo
                .findBySchoolIdAndOwnerTypeAndOwnerIdAndStatusNot(schoolId, ownerType, ownerId, FileStatus.DELETED)
                .stream()
                .map(fo -> toDTO(fo, null))
                .toList();
    }

    // ── internal: used by student integration ────────────────────────────────

    /**
     * Lookup a FileObject by id within the current school tenant. Throws if not found.
     */
    @Transactional(readOnly = true)
    public FileObject requireFileObject(Long fileId) {
        Integer schoolId = requireSchoolId();
        return fileObjectRepo.findByIdAndSchoolId(fileId, schoolId)
                .orElseThrow(() -> new IllegalArgumentException("File not found."));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void validateFile(MultipartFile file, FileCategory category) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No file provided.");
        }
        String ct = file.getContentType();
        Set<String> allowed = ALLOWED_TYPES.get(category);
        if (allowed != null && (ct == null || !allowed.contains(ct.toLowerCase()))) {
            throw new IllegalArgumentException(
                    "File type '" + ct + "' is not allowed for category " + category + ". Allowed: " + allowed);
        }
        long maxBytes = MAX_SIZE_BYTES.getOrDefault(category, DEFAULT_MAX_BYTES);
        if (file.getSize() > maxBytes) {
            throw new IllegalArgumentException(
                    "File size " + (file.getSize() / 1024) + " KB exceeds the limit of "
                            + (maxBytes / 1024 / 1024) + " MB for category " + category + ".");
        }
    }

    private void checkReadPermission(FileObject fo,
                                     Integer callerUserId,
                                     Set<String> callerRoles,
                                     Integer callerStudentId,
                                     Integer callerGuardianId) {
        if (callerRoles.contains("SCHOOL_ADMIN") || callerRoles.contains("PRINCIPAL")) return;

        if (fo.getVisibility() == FileVisibility.PUBLIC) return;

        if (callerRoles.contains("STUDENT")) {
            if ("STUDENT".equals(fo.getOwnerType())
                    && callerStudentId != null
                    && callerStudentId.toString().equals(fo.getOwnerId())) return;
            throw new AccessDeniedException("You may only access your own files.");
        }

        if (callerRoles.contains("PARENT")) {
            // Parent may access files of linked children (ownerId check done at controller level)
            if (fo.getVisibility() == FileVisibility.PARENT_VISIBLE
                    || fo.getVisibility() == FileVisibility.SCHOOL_INTERNAL) return;
            throw new AccessDeniedException("Access denied to this file.");
        }

        if (callerRoles.contains("TEACHER") || callerRoles.contains("CLASS_TEACHER")) {
            if (fo.getVisibility() == FileVisibility.SCHOOL_INTERNAL) return;
            throw new AccessDeniedException("Access denied to this file.");
        }

        // fallback deny
        throw new AccessDeniedException("You do not have permission to access this file.");
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
        } catch (Exception e) {
            return "unknown";
        }
    }

    FileObjectDTO toDTO(FileObject fo, String downloadUrl) {
        return FileObjectDTO.builder()
                .id(fo.getId())
                .schoolId(fo.getSchoolId())
                .ownerType(fo.getOwnerType())
                .ownerId(fo.getOwnerId())
                .fileCategory(fo.getFileCategory())
                .originalFilename(fo.getOriginalFilename())
                .contentType(fo.getContentType())
                .fileSize(fo.getFileSize())
                .visibility(fo.getVisibility())
                .status(fo.getStatus())
                .uploadedBy(fo.getUploadedBy())
                .uploadedAt(fo.getUploadedAt())
                .downloadUrl(downloadUrl)
                .build();
    }
}

