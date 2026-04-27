package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.Lecture;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface LectureRepo extends JpaRepository<Lecture, Integer> {
    Page<Lecture> findBySchool_Id(Integer schoolId, Pageable pageable);

    List<Lecture> findBySchool_IdAndDateBetweenOrderByDateAscStartTimeAsc(Integer schoolId, LocalDate from, LocalDate to);

    List<Lecture> findBySchool_IdAndClassGroup_IdAndDateBetweenOrderByDateAscStartTimeAsc(
            Integer schoolId, Integer classGroupId, LocalDate from, LocalDate to);

    List<Lecture> findBySchool_IdAndClassGroup_IdAndDateOrderByStartTimeAsc(
            Integer schoolId, Integer classGroupId, LocalDate date);

    Optional<Lecture> findByIdAndSchool_Id(Integer id, Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from Lecture l where l.school.id = :schoolId")
    void deleteBySchool_Id(@Param("schoolId") Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from Lecture l where l.school.id = :schoolId and l.classGroup.id = :classGroupId")
    int deleteBySchool_IdAndClassGroup_Id(@Param("schoolId") Integer schoolId, @Param("classGroupId") Integer classGroupId);
}


