package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.StudentDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface StudentDocumentRepo extends JpaRepository<StudentDocument, Integer> {
    List<StudentDocument> findByStudent_IdOrderByCreatedAtDesc(Integer studentId);

    List<StudentDocument> findByStudent_IdIn(Collection<Integer> studentIds);

    @Modifying
    @Query("DELETE FROM StudentDocument d WHERE d.student.id IN :ids")
    void deleteByStudent_IdIn(@Param("ids") Collection<Integer> ids);
}
