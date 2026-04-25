package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Staff;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StaffRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class StaffService {
    private final StaffRepo staffRepo;
    private final SchoolRepo schoolRepo;

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getSchoolId();
        if (schoolId == null) throw new IllegalStateException("Missing school context");
        return schoolId;
    }

    public Page<Staff> list(Pageable pageable) {
        return staffRepo.findBySchool_IdAndIsDeletedFalse(requireSchoolId(), pageable);
    }

    public Staff create(Staff staff) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        staff.setId(null);
        staff.setSchool(school);
        return staffRepo.save(staff);
    }
}

