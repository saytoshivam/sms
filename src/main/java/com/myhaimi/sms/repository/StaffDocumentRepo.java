package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.StaffDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StaffDocumentRepo extends JpaRepository<StaffDocument, Integer> {

    List<StaffDocument> findByStaff_IdOrderByCreatedAtAsc(Integer staffId);

    /** Batch load all documents for every staff member belonging to a school. */
    List<StaffDocument> findByStaff_School_Id(Integer schoolId);
}

