package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.StaffTeachableSubject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StaffTeachableSubjectRepository extends JpaRepository<StaffTeachableSubject, Integer> {

    List<StaffTeachableSubject> findByStaff_School_Id(Integer schoolId);

    List<StaffTeachableSubject> findByStaff_Id(Integer staffId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from StaffTeachableSubject s where s.staff.id = :staffId")
    void deleteByStaff_Id(@Param("staffId") Integer staffId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from StaffTeachableSubject s where s.subject.id = :subjectId")
    void deleteBySubject_Id(@Param("subjectId") Integer subjectId);
}
