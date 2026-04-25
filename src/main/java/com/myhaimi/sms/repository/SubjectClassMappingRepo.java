package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.SubjectClassMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SubjectClassMappingRepo extends JpaRepository<SubjectClassMapping, Long> {

    List<SubjectClassMapping> findBySubject_School_Id(Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from SubjectClassMapping scm where scm.subject.school.id = :schoolId")
    void deleteBySubjectSchool_Id(@Param("schoolId") Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from SubjectClassMapping scm where scm.subject.id = :subjectId")
    void deleteBySubject_Id(@Param("subjectId") Integer subjectId);
}

