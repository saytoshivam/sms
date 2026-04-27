package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.TimetableSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TimetableSlotRepo extends JpaRepository<TimetableSlot, Integer> {

    List<TimetableSlot> findBySchool_IdAndActiveIsTrueOrderByDayOfWeekAscStartTimeAsc(Integer schoolId);

    Optional<TimetableSlot> findByIdAndSchool_Id(Integer id, Integer schoolId);

    boolean existsBySchool_IdAndStaff_IdAndClassGroup_IdAndActiveIsTrue(
            Integer schoolId, Integer staffId, Integer classGroupId);

    boolean existsBySchool_IdAndClassGroup_IdAndSubjectAndActiveIsTrue(
            Integer schoolId, Integer classGroupId, String subject);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from TimetableSlot s where s.school.id = :schoolId")
    void deleteBySchool_Id(@Param("schoolId") Integer schoolId);
}
