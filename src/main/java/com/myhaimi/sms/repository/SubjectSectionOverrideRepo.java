package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.SubjectSectionOverride;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SubjectSectionOverrideRepo extends JpaRepository<SubjectSectionOverride, Long> {

    List<SubjectSectionOverride> findBySubject_School_Id(Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from SubjectSectionOverride sso where sso.subject.school.id = :schoolId")
    void deleteBySubjectSchool_Id(@Param("schoolId") Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from SubjectSectionOverride sso where sso.subject.id = :subjectId")
    void deleteBySubject_Id(@Param("subjectId") Integer subjectId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SubjectSectionOverride sso set sso.room = null where sso.classGroup.school.id = :schoolId")
    int clearRoomsBySchool_Id(@Param("schoolId") Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SubjectSectionOverride sso set sso.room = null where sso.classGroup.school.id = :schoolId and sso.room.id = :roomId")
    int clearRoomsBySchool_IdAndRoom_Id(@Param("schoolId") Integer schoolId, @Param("roomId") Integer roomId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from SubjectSectionOverride sso where sso.classGroup.school.id = :schoolId and sso.classGroup.id = :classGroupId")
    int deleteBySchool_IdAndClassGroup_Id(@Param("schoolId") Integer schoolId, @Param("classGroupId") Integer classGroupId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SubjectSectionOverride sso set sso.staff = null where sso.classGroup.school.id = :schoolId and sso.staff.id = :staffId")
    int clearStaffBySchool_IdAndStaff_Id(@Param("schoolId") Integer schoolId, @Param("staffId") Integer staffId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SubjectSectionOverride sso set sso.staff = null where sso.classGroup.school.id = :schoolId")
    int clearStaffBySchool_Id(@Param("schoolId") Integer schoolId);
}

