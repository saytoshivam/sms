package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.Announcement;
import com.myhaimi.sms.entity.AnnouncementAudience;
import com.myhaimi.sms.entity.AnnouncementCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AnnouncementRepo extends JpaRepository<Announcement, Integer> {

    long countBySchool_Id(Integer schoolId);

    boolean existsBySchool_IdAndTitle(Integer schoolId, String title);

    List<Announcement> findBySchool_IdAndAudienceOrderByCreatedAtDesc(Integer schoolId, AnnouncementAudience audience);

    @Query(
            """
            SELECT DISTINCT a FROM Announcement a
            JOIN a.targetClasses t
            WHERE a.school.id = :schoolId
            AND a.audience = :classTargets
            AND t.classGroup.id = :classGroupId
            ORDER BY a.createdAt DESC
            """
    )
    List<Announcement> findClassTargetedForStudent(
            @Param("schoolId") Integer schoolId,
            @Param("classGroupId") Integer classGroupId,
            @Param("classTargets") AnnouncementAudience classTargets);

    @Query(
            """
            SELECT DISTINCT a FROM Announcement a
            LEFT JOIN FETCH a.author
            LEFT JOIN FETCH a.targetClasses t
            LEFT JOIN FETCH t.classGroup
            WHERE a.id = :id AND a.school.id = :schoolId
            """
    )
    Optional<Announcement> findByIdAndSchool_IdWithGraph(@Param("id") Integer id, @Param("schoolId") Integer schoolId);
}
