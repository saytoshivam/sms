package com.myhaimi.sms.controllers;

import com.myhaimi.sms.entity.AcademicYear;
import com.myhaimi.sms.repository.AcademicYearRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/academic-years")
@RequiredArgsConstructor
public class AcademicYearController {

    private final AcademicYearRepo academicYearRepo;

    @GetMapping
    public List<AcademicYear> listSchoolYears() {
        Integer schoolId = TenantContext.getSchoolId();
        if (schoolId == null) {
            throw new IllegalStateException("Missing school context");
        }
        return academicYearRepo.findBySchool_Id(
                schoolId, Sort.by(Sort.Direction.DESC, "startsOn", "id"));
    }
}
