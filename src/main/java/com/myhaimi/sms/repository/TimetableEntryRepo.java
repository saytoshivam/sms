package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.TimetableEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Optional;

public interface TimetableEntryRepo extends JpaRepository<TimetableEntry, Integer> {
    List<TimetableEntry> findBySchool_IdAndTimetableVersion_Id(Integer schoolId, Integer versionId);
    List<TimetableEntry> findBySchool_IdAndTimetableVersion_IdAndClassGroup_Id(Integer schoolId, Integer versionId, Integer classGroupId);

    Optional<TimetableEntry> findBySchool_IdAndTimetableVersion_IdAndClassGroup_IdAndDayOfWeekAndTimeSlot_Id(
            Integer schoolId, Integer versionId, Integer classGroupId, DayOfWeek dayOfWeek, Integer timeSlotId);

    boolean existsBySchool_IdAndTimetableVersion_IdAndStaff_IdAndDayOfWeekAndTimeSlot_Id(
            Integer schoolId, Integer versionId, Integer staffId, DayOfWeek dayOfWeek, Integer timeSlotId);

    boolean existsBySchool_IdAndTimetableVersion_IdAndRoom_IdAndDayOfWeekAndTimeSlot_Id(
            Integer schoolId, Integer versionId, Integer roomId, DayOfWeek dayOfWeek, Integer timeSlotId);

    Optional<TimetableEntry> findFirstBySchool_IdAndTimetableVersion_IdAndStaff_IdAndDayOfWeekAndTimeSlot_Id(
            Integer schoolId, Integer versionId, Integer staffId, DayOfWeek dayOfWeek, Integer timeSlotId);

    Optional<TimetableEntry> findFirstBySchool_IdAndTimetableVersion_IdAndRoom_IdAndDayOfWeekAndTimeSlot_Id(
            Integer schoolId, Integer versionId, Integer roomId, DayOfWeek dayOfWeek, Integer timeSlotId);

    long countBySchool_IdAndTimetableVersion_IdAndClassGroup_IdAndSubject_Id(
            Integer schoolId, Integer versionId, Integer classGroupId, Integer subjectId);

    long countBySchool_Id(Integer schoolId);

    long countBySchool_IdAndSubject_Id(Integer schoolId, Integer subjectId);

    long countBySchool_IdAndRoom_Id(Integer schoolId, Integer roomId);

    long countBySchool_IdAndStaff_Id(Integer schoolId, Integer staffId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from TimetableEntry e where e.school.id = :schoolId")
    void deleteBySchool_Id(@Param("schoolId") Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from TimetableEntry e where e.school.id = :schoolId and e.classGroup.id = :classGroupId")
    int deleteBySchool_IdAndClassGroup_Id(@Param("schoolId") Integer schoolId, @Param("classGroupId") Integer classGroupId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update TimetableEntry e set e.room = null where e.school.id = :schoolId")
    int clearRoomsBySchool_Id(@Param("schoolId") Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update TimetableEntry e set e.room = null where e.school.id = :schoolId and e.room.id = :roomId")
    int clearRoomsBySchool_IdAndRoom_Id(@Param("schoolId") Integer schoolId, @Param("roomId") Integer roomId);
}

