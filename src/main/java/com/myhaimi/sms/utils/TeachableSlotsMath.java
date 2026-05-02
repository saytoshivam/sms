package com.myhaimi.sms.utils;

import com.myhaimi.sms.DTO.OnboardingBasicInfoDTO;
import com.myhaimi.sms.DTO.OnboardingBasicInfoTimeWindowDTO;

import java.util.List;

/** Mirrors frontend {@code estimateSlotsPerWeek} for weekly slot capacity fallbacks. */
public final class TeachableSlotsMath {

    public static final int DEFAULT_MAX_WEEKLY_LECTURE_LOAD = 32;

    private TeachableSlotsMath() {}

    private static Integer parseMinutes(String hm) {
        if (hm == null || hm.isBlank()) return null;
        String[] p = hm.trim().split(":");
        if (p.length < 2) return null;
        try {
            int h = Integer.parseInt(p[0].trim());
            int m = Integer.parseInt(p[1].trim());
            return h * 60 + m;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Weekly teachable lecture slots from Basic Setup (working days × periods per day).
     * Returns null when inputs are incomplete (caller falls back to {@link #DEFAULT_MAX_WEEKLY_LECTURE_LOAD}).
     */
    public static Integer estimateSlotsPerWeek(OnboardingBasicInfoDTO b) {
        if (b == null) return null;
        List<String> workingDays = b.workingDays();
        int days = workingDays == null ? 0 : workingDays.size();
        if (days < 1) return null;
        int dur = b.lectureDurationMinutes();
        if (dur < 1) return null;

        Integer perDay = null;
        List<OnboardingBasicInfoTimeWindowDTO> wins = b.openWindows();
        if (wins != null && !wins.isEmpty()) {
            int acc = 0;
            for (OnboardingBasicInfoTimeWindowDTO w : wins) {
                if (w == null) continue;
                Integer s = parseMinutes(w.startTime());
                Integer e = parseMinutes(w.endTime());
                if (s == null || e == null || e <= s) continue;
                acc += Math.max(0, (e - s) / dur);
            }
            perDay = acc;
        } else {
            Integer start = parseMinutes(b.schoolStartTime());
            Integer end = parseMinutes(b.schoolEndTime());
            if (start == null || end == null || end <= start) return null;
            perDay = Math.max(0, (end - start) / dur);
        }
        if (perDay == null || perDay < 1) return null;
        return days * Math.max(1, perDay);
    }
}
