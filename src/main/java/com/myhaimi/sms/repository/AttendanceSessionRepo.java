package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.AttendanceSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface AttendanceSessionRepo extends JpaRepository<AttendanceSession, Integer> {
    Page<AttendanceSession> findBySchool_Id(Integer schoolId, Pageable pageable);

    @Query(
            "SELECT s FROM AttendanceSession s WHERE s.school.id = :schoolId "
                    + "AND (:classGroupId IS NULL OR s.classGroup.id = :classGroupId) "
                    + "AND (:date IS NULL OR s.date = :date)")
    Page<AttendanceSession> findBySchoolFiltered(
            @Param("schoolId") Integer schoolId,
            @Param("classGroupId") Integer classGroupId,
            @Param("date") LocalDate date,
            Pageable pageable);

    Optional<AttendanceSession> findByIdAndSchool_Id(Integer id, Integer schoolId);

    Optional<AttendanceSession> findByDedupeKey(String dedupeKey);

    Optional<AttendanceSession> findBySchool_IdAndClassGroup_IdAndDateAndLectureIsNull(
            Integer schoolId, Integer classGroupId, LocalDate date);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from AttendanceSession s where s.school.id = :schoolId")
    void deleteBySchool_Id(@Param("schoolId") Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from AttendanceSession s where s.school.id = :schoolId and s.classGroup.id = :classGroupId")
    int deleteBySchool_IdAndClassGroup_Id(@Param("schoolId") Integer schoolId, @Param("classGroupId") Integer classGroupId);
}

