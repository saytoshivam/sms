package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.TimetableSlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TimetableSlotRepo extends JpaRepository<TimetableSlot, Integer> {

    List<TimetableSlot> findBySchool_IdAndActiveIsTrueOrderByDayOfWeekAscStartTimeAsc(Integer schoolId);

    Optional<TimetableSlot> findByIdAndSchool_Id(Integer id, Integer schoolId);

    boolean existsBySchool_IdAndStaff_IdAndClassGroup_IdAndActiveIsTrue(
            Integer schoolId, Integer staffId, Integer classGroupId);

    boolean existsBySchool_IdAndClassGroup_IdAndSubjectAndActiveIsTrue(
            Integer schoolId, Integer classGroupId, String subject);
}
