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
}

