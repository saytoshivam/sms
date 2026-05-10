package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.FileObject;
import com.myhaimi.sms.entity.enums.FileStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FileObjectRepo extends JpaRepository<FileObject, Long> {

    Optional<FileObject> findByIdAndSchoolId(Long id, Integer schoolId);

    List<FileObject> findBySchoolIdAndOwnerTypeAndOwnerIdAndStatusNot(
            Integer schoolId, String ownerType, String ownerId, FileStatus excludeStatus);
}

