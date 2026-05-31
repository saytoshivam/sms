package com.myhaimi.sms.modules.exam.seeder;

import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.modules.exam.entity.GradingBand;
import com.myhaimi.sms.modules.exam.entity.GradingScheme;
import com.myhaimi.sms.modules.exam.entity.enums.GradeResultType;
import com.myhaimi.sms.modules.exam.entity.enums.GradingSchemeStatus;
import com.myhaimi.sms.modules.exam.repository.GradingSchemeRepository;
import com.myhaimi.sms.repository.SchoolRepo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Seeds a default CBSE-style grading scheme for every school that does not yet have one.
 * Idempotent: does nothing if the school already has at least one grading scheme.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DefaultGradingSchemeSeeder implements ApplicationRunner {

    private static final String DEFAULT_SCHEME_NAME = "Default Grading Scheme";

    // grade, minPercent, maxPercent, label, resultType, gradePoint
    private static final Object[][] DEFAULT_BANDS = {
            {"A1", 91, 100, "Outstanding", GradeResultType.PASS, 10.0},
            {"A2", 81,  90, "Excellent", GradeResultType.PASS, 9.0},
            {"B1", 71,  80, "Very Good", GradeResultType.PASS, 8.0},
            {"B2", 61,  70, "Good", GradeResultType.PASS, 7.0},
            {"C1", 51,  60, "Average", GradeResultType.PASS, 6.0},
            {"C2", 41,  50, "Below Average", GradeResultType.PASS, 5.0},
            {"D",  33,  40, "Pass", GradeResultType.PASS, 4.0},
            {"E",   0,  32, "Fail", GradeResultType.FAIL, 0.0},
    };

    private final SchoolRepo schoolRepo;
    private final GradingSchemeRepository gradingSchemeRepo;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<School> schools = schoolRepo.findAll();
        int seeded = 0;
        for (School school : schools) {
            if (gradingSchemeRepo.existsBySchool_Id(school.getId())) {
                continue; // already has a scheme — don't touch
            }
            seedDefaultScheme(school);
            seeded++;
        }
        if (seeded > 0) {
            log.info("DefaultGradingSchemeSeeder: seeded default grading scheme for {} school(s)", seeded);
        }
    }

    private void seedDefaultScheme(School school) {
        GradingScheme gs = new GradingScheme();
        gs.setSchool(school);
        gs.setName(DEFAULT_SCHEME_NAME);
        gs.setStatus(GradingSchemeStatus.ACTIVE);
        gs.setActive(true);
        gs = gradingSchemeRepo.save(gs);

        int seq = 1;
        for (Object[] row : DEFAULT_BANDS) {
            GradingBand band = new GradingBand();
            band.setGradingScheme(gs);
            band.setGrade((String) row[0]);
            band.setMinPercent(BigDecimal.valueOf(((Number) row[1]).doubleValue()));
            band.setMaxPercent(BigDecimal.valueOf(((Number) row[2]).doubleValue()));
            band.setLabel((String) row[3]);
            band.setResultType((GradeResultType) row[4]);
            band.setGradePoint(BigDecimal.valueOf(((Number) row[5]).doubleValue()));
            band.setSequence(seq++);
            gs.getBands().add(band);
        }
        gradingSchemeRepo.save(gs);
    }
}
