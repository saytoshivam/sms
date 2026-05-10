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
 * Centralises ALL file-level permission decisions.
 *
 * Rules:
 *  - SCHOOL_ADMIN / PRINCIPAL  → full access within their school
 *  - VICE_PRINCIPAL            → view SCHOOL_INTERNAL; delete only own uploads
 *  - CLASS_TEACHER / TEACHER   → view SCHOOL_INTERNAL; denied STUDENT_DOCUMENT / GUARDIAN_DOCUMENT
 *  - PARENT                    → own children's files with PARENT_VISIBLE/STUDENT_VISIBLE/PUBLIC
 *  - STUDENT                   → own files only (ownerType=STUDENT, ownerId==linkedStudentId)
 *  - Generic upload             → SCHOOL_ADMIN / PRINCIPAL only
 */
@Service
@RequiredArgsConstructor
public class FileAccessService {

    private final StudentGuardianRepo studentGuardianRepo;

    // ── upload ────────────────────────────────────────────────────────────────

    /** Generic /api/files/upload — SCHOOL_ADMIN or PRINCIPAL only. */
    public void assertCanUploadGeneric(FileCallerContext caller) {
        if (caller.isSchoolLeadership()) return;
        throw new AccessDeniedException(
                "Only school administrators may use the generic file upload endpoint.");
    }

    // ── view metadata ─────────────────────────────────────────────────────────

    public void assertCanViewMetadata(FileObject fo, FileCallerContext caller) {
        assertCanRead(fo, caller, "view metadata for");
    }

    // ── download ──────────────────────────────────────────────────────────────

    public void assertCanDownload(FileObject fo, FileCallerContext caller) {
        assertCanRead(fo, caller, "download");
    }

    // ── delete ────────────────────────────────────────────────────────────────

    /** School leadership OR original uploader may soft-delete. */
    public void assertCanDelete(FileObject fo, FileCallerContext caller) {
        if (caller.isSchoolLeadership()) return;
        if (caller.userId() != null && caller.userId().equals(fo.getUploadedBy())) return;
        throw new AccessDeniedException(
                "Only school administrators or the file's original uploader may delete files.");
    }

    // ── shared read check ─────────────────────────────────────────────────────

    private void assertCanRead(FileObject fo, FileCallerContext caller, String action) {
        // 1. School leadership — full access
        if (caller.isSchoolLeadership()) return;

        // 2. PUBLIC files — any authenticated caller
        if (fo.getVisibility() == FileVisibility.PUBLIC) return;

        // 3. VICE_PRINCIPAL — SCHOOL_INTERNAL only
        if (caller.isVicePrincipal()) {
            if (fo.getVisibility() == FileVisibility.SCHOOL_INTERNAL) return;
            deny(action, fo);
        }

        // 4. CLASS_TEACHER / TEACHER — SCHOOL_INTERNAL but NOT student/guardian docs
        if (caller.isTeacher()) {
            if (fo.getFileCategory() == FileCategory.STUDENT_DOCUMENT
                    || fo.getFileCategory() == FileCategory.GUARDIAN_DOCUMENT) {
                throw new AccessDeniedException(
                        "Teachers do not have access to student or guardian documents.");
            }
            if (fo.getVisibility() == FileVisibility.SCHOOL_INTERNAL) return;
            deny(action, fo);
        }

        // 5. STUDENT — own files only
        if (caller.isStudent()) {
            if ("STUDENT".equals(fo.getOwnerType())
                    && caller.linkedStudentId() != null
                    && caller.linkedStudentId().toString().equals(fo.getOwnerId())
                    && fo.getVisibility() != FileVisibility.PRIVATE) {
                return;
            }
            throw new AccessDeniedException("Students may only access their own files.");
        }

        // 6. PARENT — linked children's files with allowed visibility
        if (caller.isParent()) {
            assertParentCanRead(fo, caller, action);
            return;
        }

        deny(action, fo);
    }

    private void assertParentCanRead(FileObject fo, FileCallerContext caller, String action) {
        if (caller.linkedGuardianId() == null) {
            throw new AccessDeniedException("Parent account has no linked guardian record.");
        }
        if (!"STUDENT".equals(fo.getOwnerType())) {
            throw new AccessDeniedException("Parents may only access files belonging to their linked children.");
        }

        Set<String> linkedStudentIds = studentGuardianRepo
                .findByGuardian_Id(caller.linkedGuardianId())
                .stream()
                .map(sg -> String.valueOf(sg.getStudent().getId()))
                .collect(Collectors.toSet());

        if (!linkedStudentIds.contains(fo.getOwnerId())) {
            throw new AccessDeniedException("This file does not belong to any of your linked children.");
        }

        if (fo.getVisibility() == FileVisibility.PARENT_VISIBLE
                || fo.getVisibility() == FileVisibility.STUDENT_VISIBLE
                || fo.getVisibility() == FileVisibility.PUBLIC) {
            return;
        }

        throw new AccessDeniedException("This file's visibility does not allow parent access.");
    }

    private static void deny(String action, FileObject fo) {
        throw new AccessDeniedException(
                "You do not have permission to " + action + " this file.");
    }
}
