package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.SubjectAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SubjectAllocationRepo extends JpaRepository<SubjectAllocation, Integer> {

    Optional<SubjectAllocation> findBySchool_IdAndClassGroup_IdAndSubject_Id(Integer schoolId, Integer classGroupId, Integer subjectId);

    List<SubjectAllocation> findBySchool_IdAndClassGroup_Id(Integer schoolId, Integer classGroupId);

    List<SubjectAllocation> findBySchool_Id(Integer schoolId);

    List<SubjectAllocation> findBySchool_IdAndStaff_Id(Integer schoolId, Integer staffId);

    long countBySchool_IdAndSubject_Id(Integer schoolId, Integer subjectId);

    long countBySchool_IdAndStaff_Id(Integer schoolId, Integer staffId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SubjectAllocation a set a.staff = null where a.school.id = :schoolId and a.staff.id = :staffId")
    int clearStaffBySchool_IdAndStaff_Id(@Param("schoolId") Integer schoolId, @Param("staffId") Integer staffId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SubjectAllocation a set a.staff = null where a.school.id = :schoolId")
    int clearStaffBySchool_Id(@Param("schoolId") Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from SubjectAllocation a where a.school.id = :schoolId")
    void deleteBySchool_Id(@Param("schoolId") Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from SubjectAllocation a where a.school.id = :schoolId and a.classGroup.id = :classGroupId")
    int deleteBySchool_IdAndClassGroup_Id(@Param("schoolId") Integer schoolId, @Param("classGroupId") Integer classGroupId);
}

