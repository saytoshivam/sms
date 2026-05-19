package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.FeeInvoiceCreateDTO;
import com.myhaimi.sms.DTO.FeeSchoolSummaryDTO;
import com.myhaimi.sms.entity.FeeInvoice;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.entity.enums.StudentFeeDemandStatus;
import com.myhaimi.sms.repository.FeeInvoiceRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.StudentFeeDemandRepository;
import com.myhaimi.sms.repository.StudentRepo;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FeeService {

    private final FeeInvoiceRepo feeInvoiceRepo;
    private final StudentFeeDemandRepository demandRepo;
    private final SchoolRepo schoolRepo;
    private final StudentRepo studentRepo;

    private Integer requireSchoolId() {
        Integer schoolId = TenantContext.getTenantId();
        if (schoolId == null) {
            schoolId = TenantContext.getSchoolId();
        }
        if (schoolId == null) throw new IllegalStateException("Missing school context");
        return schoolId;
    }

    public Page<FeeInvoice> listInvoices(Pageable pageable) {
        return feeInvoiceRepo.findBySchool_Id(requireSchoolId(), pageable);
    }

    /** Aggregate fee and enrollment stats for the current school (tenant). */
    public FeeSchoolSummaryDTO getSchoolSummary() {
        Integer schoolId = requireSchoolId();
        BigDecimal totalInvoiced = demandRepo.sumPayableAmount(schoolId, null);
        BigDecimal totalCollected = demandRepo.sumPaidAmount(schoolId, null);
        BigDecimal outstanding = totalInvoiced.subtract(totalCollected);
        if (outstanding.compareTo(BigDecimal.ZERO) < 0) {
            outstanding = BigDecimal.ZERO;
        }
        long students = studentRepo.countBySchool_Id(schoolId);
        long demandCount = demandRepo.countBySchoolId(schoolId);
        long openDemandCount = demandRepo.countOpenBySchoolId(schoolId,
                List.of(StudentFeeDemandStatus.UNPAID, StudentFeeDemandStatus.PARTIAL));
        return new FeeSchoolSummaryDTO(students, totalInvoiced, totalCollected, outstanding, demandCount, openDemandCount);
    }

    @Transactional
    public FeeInvoice createInvoice(FeeInvoiceCreateDTO dto) {
        Integer schoolId = requireSchoolId();
        School school = schoolRepo.findById(schoolId).orElseThrow();
        Student student = studentRepo.findByIdAndSchool_Id(dto.getStudentId(), schoolId).orElseThrow();

        FeeInvoice inv = new FeeInvoice();
        inv.setSchool(school);
        inv.setStudent(student);
        inv.setAmountDue(dto.getAmountDue());
        inv.setDueDate(dto.getDueDate());
        inv.setStatus("DUE");
        return feeInvoiceRepo.save(inv);
    }
}

