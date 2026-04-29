package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.AnnouncementTargetClass;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnnouncementTargetClassRepo extends JpaRepository<AnnouncementTargetClass, Integer> {

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from AnnouncementTargetClass atc where atc.classGroup.school.id = :schoolId")
    void deleteBySchool_Id(@Param("schoolId") Integer schoolId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from AnnouncementTargetClass atc where atc.classGroup.school.id = :schoolId and atc.classGroup.id = :classGroupId")
    int deleteBySchool_IdAndClassGroup_Id(@Param("schoolId") Integer schoolId, @Param("classGroupId") Integer classGroupId);
}

