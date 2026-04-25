package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.ClassSubjectConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ClassSubjectConfigRepo extends JpaRepository<ClassSubjectConfig, Long> {
    List<ClassSubjectConfig> findBySchool_Id(Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from ClassSubjectConfig c where c.school.id = :schoolId")
    void deleteBySchool_Id(@Param("schoolId") Integer schoolId);
}

