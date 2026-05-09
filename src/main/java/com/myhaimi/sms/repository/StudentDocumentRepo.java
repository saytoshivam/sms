package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.StudentDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface StudentDocumentRepo extends JpaRepository<StudentDocument, Integer> {
    List<StudentDocument> findByStudent_IdOrderByCreatedAtDesc(Integer studentId);

    List<StudentDocument> findByStudent_IdIn(Collection<Integer> studentIds);
}
