package com.myhaimi.sms.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "student_attendance", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"attendance_session_id", "student_id"})
})
public class StudentAttendance {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attendance_session_id", nullable = false)
    private AttendanceSession attendanceSession;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(nullable = false, length = 16)
    private String status; // PRESENT, ABSENT, LATE, EXCUSED

    @Column(length = 256)
    private String remark;
}

