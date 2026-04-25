package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.StudentAttendance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StudentAttendanceRepo extends JpaRepository<StudentAttendance, Integer> {
    List<StudentAttendance> findByAttendanceSession_Id(Integer attendanceSessionId);

    Optional<StudentAttendance> findByAttendanceSession_IdAndStudent_Id(Integer attendanceSessionId, Integer studentId);

    List<StudentAttendance> findByStudent_Id(Integer studentId);

    List<StudentAttendance> findByStudent_IdIn(Collection<Integer> studentIds);
}

