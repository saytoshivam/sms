package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.ClassSubjectConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ClassSubjectConfigRepo extends JpaRepository<ClassSubjectConfig, Long> {
    List<ClassSubjectConfig> findBySchool_Id(Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from ClassSubjectConfig c where c.school.id = :schoolId")
    void deleteBySchool_Id(@Param("schoolId") Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from ClassSubjectConfig c where c.school.id = :schoolId and c.subject.id = :subjectId")
    void deleteBySchool_IdAndSubject_Id(@Param("schoolId") Integer schoolId, @Param("subjectId") Integer subjectId);

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("update ClassSubjectConfig c set c.room = null where c.school.id = :schoolId")
  int clearRoomsBySchool_Id(@Param("schoolId") Integer schoolId);

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("update ClassSubjectConfig c set c.room = null where c.school.id = :schoolId and c.room.id = :roomId")
  int clearRoomsBySchool_IdAndRoom_Id(@Param("schoolId") Integer schoolId, @Param("roomId") Integer roomId);

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("update ClassSubjectConfig c set c.staff = null where c.school.id = :schoolId and c.staff.id = :staffId")
  int clearStaffBySchool_IdAndStaff_Id(@Param("schoolId") Integer schoolId, @Param("staffId") Integer staffId);
}

