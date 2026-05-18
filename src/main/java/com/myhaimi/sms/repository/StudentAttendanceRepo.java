package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.StudentAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StudentAttendanceRepo extends JpaRepository<StudentAttendance, Integer> {
    List<StudentAttendance> findByAttendanceSession_Id(Integer attendanceSessionId);

    Optional<StudentAttendance> findByAttendanceSession_IdAndStudent_Id(Integer attendanceSessionId, Integer studentId);

    List<StudentAttendance> findByStudent_Id(Integer studentId);

    List<StudentAttendance> findByStudent_IdIn(Collection<Integer> studentIds);

    @Modifying
    @Query("DELETE FROM StudentAttendance a WHERE a.student.id IN :ids")
    void deleteByStudent_IdIn(@Param("ids") Collection<Integer> ids);
}
