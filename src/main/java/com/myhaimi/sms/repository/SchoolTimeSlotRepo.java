package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.SchoolTimeSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SchoolTimeSlotRepo extends JpaRepository<SchoolTimeSlot, Integer> {
    List<SchoolTimeSlot> findBySchool_IdAndActiveIsTrueOrderBySlotOrderAsc(Integer schoolId);
    Optional<SchoolTimeSlot> findByIdAndSchool_Id(Integer id, Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from SchoolTimeSlot s where s.school.id = :schoolId")
    void deleteBySchool_Id(@Param("schoolId") Integer schoolId);
}

