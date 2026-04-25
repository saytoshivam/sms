package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.SubjectClassGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SubjectClassGroupRepo extends JpaRepository<SubjectClassGroup, Long> {
    List<SubjectClassGroup> findBySubject_Id(Integer subjectId);

    long countBySubject_Id(Integer subjectId);

    @Query("select scg.subject.id from SubjectClassGroup scg where scg.classGroup.id = :classGroupId")
    List<Integer> findSubjectIdsByClassGroup_Id(@Param("classGroupId") Integer classGroupId);

    long countBySubject_School_Id(Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from SubjectClassGroup scg where scg.subject.school.id = :schoolId")
    void deleteBySubjectSchool_Id(@Param("schoolId") Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from SubjectClassGroup scg where scg.subject.id = :subjectId")
    void deleteBySubject_Id(@Param("subjectId") Integer subjectId);
}

