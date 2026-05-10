package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.FileObject;
import com.myhaimi.sms.entity.enums.FileCategory;
import com.myhaimi.sms.entity.enums.FileStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FileObjectRepo extends JpaRepository<FileObject, Long> {

    Optional<FileObject> findByIdAndSchoolId(Long id, Integer schoolId);

    /** Find file by id, school and exact status (e.g. ACTIVE). */
    Optional<FileObject> findByIdAndSchoolIdAndStatus(Long id, Integer schoolId, FileStatus status);

    /** Find file by id and school, excluding the given status (e.g. exclude DELETED). */
    Optional<FileObject> findByIdAndSchoolIdAndStatusNot(Long id, Integer schoolId, FileStatus excludeStatus);

    /** Used by FileServeController to look up by storage path without findAll(). */
    Optional<FileObject> findByStorageKeyAndSchoolId(String storageKey, Integer schoolId);

    /** Safe lookup by storage key excluding files with the given status (e.g. exclude DELETED). */
    Optional<FileObject> findByStorageKeyAndSchoolIdAndStatusNot(
            String storageKey, Integer schoolId, FileStatus excludeStatus);

    List<FileObject> findBySchoolIdAndOwnerTypeAndOwnerIdAndStatusNot(
            Integer schoolId, String ownerType, String ownerId, FileStatus excludeStatus);

    List<FileObject> findBySchoolIdAndOwnerTypeAndOwnerIdAndFileCategoryAndStatusNot(
            Integer schoolId, String ownerType, String ownerId,
            FileCategory fileCategory, FileStatus excludeStatus);
}
