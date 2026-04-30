package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.TimetableLock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Optional;

public interface TimetableLockRepo extends JpaRepository<TimetableLock, Integer> {

    List<TimetableLock> findBySchool_IdAndTimetableVersion_Id(Integer schoolId, Integer timetableVersionId);

    Optional<TimetableLock> findBySchool_IdAndTimetableVersion_IdAndClassGroup_IdAndDayOfWeekAndTimeSlot_Id(
            Integer schoolId,
            Integer timetableVersionId,
            Integer classGroupId,
            DayOfWeek dayOfWeek,
            Integer timeSlotId
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from TimetableLock l where l.school.id = :schoolId and l.timetableVersion.id = :versionId")
    int deleteBySchool_IdAndTimetableVersion_Id(@Param("schoolId") Integer schoolId, @Param("versionId") Integer versionId);
}

