package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.ClassGroup;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.List;

public interface ClassGroupRepo extends JpaRepository<ClassGroup, Integer> {

    long countBySchool_Id(Integer schoolId);
    Page<ClassGroup> findBySchool_IdAndIsDeletedFalse(Integer schoolId, Pageable pageable);
    Optional<ClassGroup> findByIdAndSchool_Id(Integer id, Integer schoolId);
    Optional<ClassGroup> findByCodeAndSchool_Id(String code, Integer schoolId);

    List<ClassGroup> findBySchool_IdAndGradeLevelAndIsDeletedFalse(Integer schoolId, Integer gradeLevel);

    List<ClassGroup> findAllBySchool_IdAndIsDeletedFalseOrderByGradeLevelAscCodeAsc(Integer schoolId);

    List<ClassGroup> findBySchool_IdAndClassTeacher_IdAndIsDeletedFalseOrderByDisplayNameAsc(
            Integer schoolId, Integer staffId);

    @Query("select cg from ClassGroup cg where cg.isDeleted = true")
    List<ClassGroup> findAllSoftDeleted();

    long countBySchool_IdAndDefaultRoom_Id(Integer schoolId, Integer defaultRoomId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ClassGroup cg set cg.defaultRoom = null where cg.school.id = :schoolId")
    int clearDefaultRoomsBySchool_Id(@Param("schoolId") Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ClassGroup cg set cg.defaultRoom = null where cg.school.id = :schoolId and cg.defaultRoom.id = :roomId")
    int clearDefaultRoomBySchool_IdAndRoom_Id(@Param("schoolId") Integer schoolId, @Param("roomId") Integer roomId);
}

