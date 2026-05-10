package com.myhaimi.sms.modules.files;

import com.myhaimi.sms.entity.FileObject;
import com.myhaimi.sms.entity.enums.FileCategory;
import com.myhaimi.sms.entity.enums.FileVisibility;
import com.myhaimi.sms.repository.StudentGuardianRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.stream.Collectors;

/**
 * Centralises all file permission decisions for the ERP.
 * Every public entry-point that reads, writes, or deletes a FileObject
 * must invoke the appropriate assert* method before proceeding.
 *
 * <p>Rules summary:
 * <ul>
 *   <li>SCHOOL_ADMIN / PRINCIPAL — full access within their school</li>
 *   <li>VICE_PRINCIPAL — view/download SCHOOL_INTERNAL; delete only own uploads</li>
 *   <li>CLASS_TEACHER / TEACHER — view/download SCHOOL_INTERNAL non-student-document files;
 *       explicitly denied STUDENT_DOCUMENT; delete only own uploads</li>
 *   <li>PARENT — view/download only files of linked children with
 *       PARENT_VISIBLE or PUBLIC visibility; no delete</li>
 *   <li>STUDENT — view/download only own files; no delete</li>
 *   <li>Generic upload (POST /api/files/upload) — SCHOOL_ADMIN / PRINCIPAL only</li>
 *   <li>Module-specific upload (e.g. student doc upload) — enforced by the calling module service</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class FileAccessService {

    private final StudentGuardianRepo studentGuardianRepo;

    // ── upload ────────────────────────────────────────────────────────────────

    /**
     * Asserts the caller may use the generic upload endpoint.
     * Module-specific endpoints (student doc, profile photo) do their own checks.
     */
    public void assertCanUploadGeneric(FileCallerContext caller) {
        if (caller.isSchoolLeadership()) return;
        throw new AccessDeniedException(
                "Only school administrators may use the generic file upload endpoint.");
    }

    // ── view metadata ─────────────────────────────────────────────────────────

    /**
     * Asserts the caller may view the metadata of this file.
     * Applies the same visibility rules as download.
     */
    public void assertCanViewMetadata(FileObject fo, FileCallerContext caller) {
        assertCanRead(fo, caller, "view metadata for");
    }

    // ── download ──────────────────────────────────────────────────────────────

    /** Asserts the caller may obtain a download URL or stream for this file. */
    public void assertCanDownload(FileObject fo, FileCallerContext caller) {
        assertCanRead(fo, caller, "download");
    }

    // ── delete ────────────────────────────────────────────────────────────────

    /**
     * Asserts the caller may soft-delete this file.
     * Allowed for: school leadership, or the original uploader.
     */
    public void assertCanDelete(FileObject fo, FileCallerContext caller) {
        if (caller.isSchoolLeadership()) return;
        if (caller.userId() != null && caller.userId().equals(fo.getUploadedBy())) return;
        throw new AccessDeniedException(
                "Only school administrators or the file's original uploader may delete files.");
    }

    // ── internal shared read check ────────────────────────────────────────────

    private void assertCanRead(FileObject fo, FileCallerContext caller, String action) {
        // 1. School leadership — full access
        if (caller.isSchoolLeadership()) return;

        // 2. Anyone can read PUBLIC files
        if (fo.getVisibility() == FileVisibility.PUBLIC) return;

        // 3. VICE_PRINCIPAL — SCHOOL_INTERNAL, but not PRIVATE
        if (caller.isVicePrincipal()) {
            if (fo.getVisibility() == FileVisibility.SCHOOL_INTERNAL) return;
            deny(action, fo);
        }

        // 4. CLASS_TEACHER / TEACHER — SCHOOL_INTERNAL only AND not student documents
        if (caller.isTeacher()) {
            if (fo.getFileCategory() == FileCategory.STUDENT_DOCUMENT
                    || fo.getFileCategory() == FileCategory.GUARDIAN_DOCUMENT) {
                throw new AccessDeniedException(
                        "Teachers do not have access to student/guardian document files.");
            }
            if (fo.getVisibility() == FileVisibility.SCHOOL_INTERNAL) return;
            deny(action, fo);
        }

        // 5. STUDENT — own files only (by ownerType=STUDENT and ownerId == linked student id)
        if (caller.isStudent()) {
            if ("STUDENT".equals(fo.getOwnerType())
                    && caller.linkedStudentId() != null
                    && caller.linkedStudentId().toString().equals(fo.getOwnerId())) {
                // Student can see own files if not PRIVATE
                if (fo.getVisibility() != FileVisibility.PRIVATE) return;
            }
            throw new AccessDeniedException("Students may only access their own files.");
        }

        // 6. PARENT — linked children's files with appropriate visibility
        if (caller.isParent()) {
            assertParentCanRead(fo, caller, action);
            return;
        }

        // Any other role — deny
        deny(action, fo);
    }

    /**
     * Parent-specific read rule:
     * Parent may access the file only if:
     * <ol>
     *   <li>The file belongs to one of the parent's linked children (ownerType=STUDENT, ownerId in linked students)</li>
     *   <li>AND the file's visibility is PARENT_VISIBLE, STUDENT_VISIBLE, or PUBLIC</li>
     * </ol>
     */
    private void assertParentCanRead(FileObject fo, FileCallerContext caller, String action) {
        if (caller.linkedGuardianId() == null) {
            throw new AccessDeniedException("Parent account has no linked guardian record.");
        }
        if (!"STUDENT".equals(fo.getOwnerType())) {
            // Parents can only access STUDENT-owned files
            throw new AccessDeniedException("Parents may only access files belonging to their linked children.");
        }

        // Gather student ids linked to this guardian
        Set<String> linkedStudentIds = studentGuardianRepo
                .findByGuardian_Id(caller.linkedGuardianId())
                .stream()
                .map(sg -> String.valueOf(sg.getStudent().getId()))
                .collect(Collectors.toSet());

        if (!linkedStudentIds.contains(fo.getOwnerId())) {
            throw new AccessDeniedException("This file does not belong to any of your linked children.");
        }

        // Visibility must allow parent
        if (fo.getVisibility() == FileVisibility.PARENT_VISIBLE
                || fo.getVisibility() == FileVisibility.STUDENT_VISIBLE
                || fo.getVisibility() == FileVisibility.PUBLIC) {
            return;
        }

        throw new AccessDeniedException(
                "This file's visibility does not allow parent access.");
    }

    private static void deny(String action, FileObject fo) {
        throw new AccessDeniedException(
                "You do not have permission to " + action + " this file.");
    }
}

