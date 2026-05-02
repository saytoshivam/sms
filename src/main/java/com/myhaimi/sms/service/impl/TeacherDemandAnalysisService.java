package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.OnboardingAcademicAllocationItemDTO;
import com.myhaimi.sms.DTO.OnboardingAcademicStaffItemDTO;
import com.myhaimi.sms.DTO.OnboardingAcademicStructureViewDTO;
import com.myhaimi.sms.DTO.OnboardingAcademicSubjectItemDTO;
import com.myhaimi.sms.DTO.OnboardingBasicInfoDTO;
import com.myhaimi.sms.DTO.TeacherDemandSubjectRowDTO;
import com.myhaimi.sms.DTO.TeacherDemandSummaryDTO;
import com.myhaimi.sms.security.RoleNames;
import com.myhaimi.sms.utils.TeachableSlotsMath;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Aggregates weekly subject demand vs qualified teacher capacity for Smart Assignment and timetable checks.
 * Reuses {@link SchoolOnboardingService#listAcademicStructure()} so subject-code normalization matches the UI.
 */
@Service
public class TeacherDemandAnalysisService {

    private static final String S_OK = "OK";
    private static final String S_WARN = "WARN";
    private static final String S_CRITICAL = "CRITICAL";

    private final SchoolOnboardingService schoolOnboardingService;

    @Autowired
    public TeacherDemandAnalysisService(@Lazy SchoolOnboardingService schoolOnboardingService) {
        this.schoolOnboardingService = schoolOnboardingService;
    }

    @Transactional(readOnly = true)
    public TeacherDemandSummaryDTO summarize() {
        OnboardingAcademicStructureViewDTO v = schoolOnboardingService.listAcademicStructure();
        OnboardingBasicInfoDTO bi = schoolOnboardingService.basicInfo();
        Integer schoolSlotsPerWeek = TeachableSlotsMath.estimateSlotsPerWeek(bi);

        Map<Integer, Integer> requiredBySubject = new HashMap<>();
        for (OnboardingAcademicAllocationItemDTO a : v.allocations()) {
            if (a == null) continue;
            int freq = a.weeklyFrequency();
            if (freq <= 0) continue;
            requiredBySubject.merge(a.subjectId(), freq, Integer::sum);
        }

        List<TeacherDemandSubjectRowDTO> rows = new ArrayList<>();
        boolean severe = false;

        List<OnboardingAcademicSubjectItemDTO> subjects =
                v.subjects() == null ? List.of() : v.subjects();
        List<OnboardingAcademicStaffItemDTO> staff =
                v.staff() == null ? List.of() : v.staff();

        for (OnboardingAcademicSubjectItemDTO sub : subjects) {
            if (sub == null) continue;
            int sid = sub.id();
            int req = requiredBySubject.getOrDefault(sid, 0);

            int qualified = 0;
            int capacity = 0;
            for (OnboardingAcademicStaffItemDTO st : staff) {
                if (st == null) continue;
                if (!eligibleForAuto(st, sid)) continue;
                qualified++;
                capacity += effectiveMaxLoad(st, schoolSlotsPerWeek);
            }

            Double avgCap = qualified > 0 ? ((double) capacity) / qualified : null;
            Integer teachersNeeded = null;
            if (qualified > 0 && avgCap != null && avgCap > 0.0001) {
                teachersNeeded = (int) Math.ceil(req / avgCap);
            }

            int periodShortfall = Math.max(0, req - capacity);
            int tn = teachersNeeded == null ? qualified : teachersNeeded;
            int teacherShortfall = Math.max(0, tn - qualified);

            String status = classify(req, qualified, capacity);
            if (S_CRITICAL.equals(status) && req > 0) {
                severe = true;
            }

            String detail = describeStatus(status, req, qualified, capacity, periodShortfall, teacherShortfall);
            boolean feasible = req <= 0 || capacity >= req;

            rows.add(new TeacherDemandSubjectRowDTO(
                    sid,
                    Objects.toString(sub.code(), ""),
                    Objects.toString(sub.name(), ""),
                    req,
                    qualified,
                    capacity,
                    avgCap == null ? null : Math.round(avgCap * 100.0) / 100.0,
                    teachersNeeded,
                    periodShortfall,
                    teacherShortfall,
                    status,
                    detail,
                    feasible));
        }

        rows.sort(Comparator.comparing(TeacherDemandSubjectRowDTO::subjectName, String.CASE_INSENSITIVE_ORDER));

        return new TeacherDemandSummaryDTO(schoolSlotsPerWeek, severe, rows);
    }

    private static boolean isStaffTeacher(OnboardingAcademicStaffItemDTO s) {
        List<String> roles = s.roleNames();
        return roles != null && roles.contains(RoleNames.TEACHER);
    }

    /** Matches frontend smart-assign eligibility (TEACH role + explicit teachables containing the subject). */
    private static boolean eligibleForAuto(OnboardingAcademicStaffItemDTO s, int subjectId) {
        if (!isStaffTeacher(s)) return false;
        List<Integer> t = s.teachableSubjectIds();
        return t != null && !t.isEmpty() && t.contains(subjectId);
    }

    private static int effectiveMaxLoad(OnboardingAcademicStaffItemDTO s, Integer schoolSlotsPerWeek) {
        Integer m = s.maxWeeklyLectureLoad();
        if (m != null && m > 0) return m;
        if (schoolSlotsPerWeek != null && schoolSlotsPerWeek > 0) return schoolSlotsPerWeek;
        return TeachableSlotsMath.DEFAULT_MAX_WEEKLY_LECTURE_LOAD;
    }

    private static String classify(int required, int qualified, int capacity) {
        if (required <= 0) return S_OK;
        if (qualified <= 0) return S_CRITICAL;
        if (capacity >= required) return S_OK;
        double thresh = 0.9 * required;
        if (capacity >= thresh) return S_WARN;
        return S_CRITICAL;
    }

    private static String describeStatus(
            String status,
            int required,
            int qualified,
            int capacity,
            int periodShortfall,
            int teacherShortfall) {
        if (required <= 0) return "No weekly demand";
        if (qualified <= 0) return "No qualified teachers";
        if (S_OK.equals(status)) return "Capacity meets demand";
        if (S_WARN.equals(status)) return "Near capacity (within 90%)";
        if (teacherShortfall > 0) {
            return "Short by "
                    + teacherShortfall
                    + " teacher"
                    + (teacherShortfall == 1 ? "" : "s");
        }
        if (periodShortfall > 0) {
            return "Short by " + periodShortfall + " period" + (periodShortfall == 1 ? "" : "s");
        }
        return "Insufficient capacity";
    }
}
