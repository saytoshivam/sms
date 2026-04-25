package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.SchoolRegistrationDTO;
import com.myhaimi.sms.DTO.SchoolBrandingDTO;
import com.myhaimi.sms.DTO.SchoolThemeUpdateDTO;
import com.myhaimi.sms.entity.Role;
import com.myhaimi.sms.entity.School;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.modules.subscription.domain.SubscriptionPlan;
import com.myhaimi.sms.modules.subscription.domain.TenantSubscription;
import com.myhaimi.sms.modules.subscription.repository.SubscriptionPlanRepository;
import com.myhaimi.sms.modules.subscription.repository.TenantSubscriptionRepository;
import com.myhaimi.sms.repository.RoleRepo;
import com.myhaimi.sms.repository.SchoolRepo;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.service.ISchoolService;
import com.myhaimi.sms.theme.AppThemeDefaults;
import com.myhaimi.sms.utils.PlatformEmailPolicy;
import com.myhaimi.sms.utils.TenantContext;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;

@Service
@RequiredArgsConstructor
public class SchoolService implements ISchoolService {
    private static final Logger log = LoggerFactory.getLogger(SchoolService.class);

    private final SchoolRepo schoolRepo;
    private final UserRepo userRepo;
    private final RoleRepo roleRepo;
    private final PasswordEncoder passwordEncoder;
    private final PlatformEmailPolicy platformEmailPolicy;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final TenantSubscriptionRepository tenantSubscriptionRepository;

    @Override
    @Transactional
    public School registerSchoolForMyHaimiPlatform(SchoolRegistrationDTO dto, String actorEmail) {
        platformEmailPolicy.requireMyHaimiOwnerEmail(actorEmail);

        if (schoolRepo.existsByCode(dto.getSchoolCode())) {
            throw new DataIntegrityViolationException("School code already exists");
        }

        SubscriptionPlan plan = subscriptionPlanRepository
                .findByPlanCodeIgnoreCase(dto.getPlanCode())
                .orElseThrow(() -> new IllegalArgumentException("Unknown plan: " + dto.getPlanCode()));

        School school = new School();
        school.setName(dto.getSchoolName());
        school.setCode(dto.getSchoolCode());
        if (dto.getDomain() != null && !dto.getDomain().isBlank()) {
            school.setDomain(dto.getDomain().trim());
        }
        // Theme: same defaults as {@link AppThemeDefaults} / frontend src/theme/appTheme.ts
        school.setPrimaryColor(AppThemeDefaults.PRIMARY);
        school.setAccentColor(AppThemeDefaults.ACCENT);
        school.setBackgroundColor(AppThemeDefaults.BACKGROUND);
        school.setTextColor(AppThemeDefaults.TEXT);
        school.setNavTextColor(AppThemeDefaults.NAV_TEXT);
        school = schoolRepo.save(school);

        TenantSubscription sub = tenantSubscriptionRepository.findByTenantId(school.getId()).orElseGet(TenantSubscription::new);
        sub.setTenantId(school.getId());
        sub.setPlan(plan);
        tenantSubscriptionRepository.save(sub);

        Role schoolAdminRole = roleRepo.findByName("SCHOOL_ADMIN")
                .stream()
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Missing role: SCHOOL_ADMIN"));

        User admin = new User();
        admin.setUsername(dto.getAdminUsername());
        admin.setEmail(dto.getAdminEmail());
        admin.setPassword(passwordEncoder.encode(dto.getAdminPassword()));
        admin.setSchool(school);
        admin.setRoles(new HashSet<>());
        admin.getRoles().add(schoolAdminRole);

        userRepo.save(admin);

        // Email integration is intentionally a stub for now (future SMTP provider).
        log.info(
                "Onboarding email (stub): school={} ({}) adminEmail={} plan={}",
                school.getName(),
                school.getCode(),
                admin.getEmail(),
                plan.getPlanCode());
        return school;
    }

    @Override
    @Transactional(readOnly = true)
    public SchoolBrandingDTO getBrandingByCode(String schoolCode) {
        School school = schoolRepo.findByCode(schoolCode).orElseThrow();
        SchoolBrandingDTO dto = new SchoolBrandingDTO();
        dto.setName(school.getName());
        dto.setCode(school.getCode());
        dto.setPrimaryColor(school.getPrimaryColor());
        dto.setAccentColor(school.getAccentColor());
        dto.setBackgroundColor(school.getBackgroundColor());
        dto.setTextColor(school.getTextColor());
        dto.setNavTextColor(school.getNavTextColor());
        return dto;
    }

    @Override
    @Transactional
    public School updateTheme(SchoolThemeUpdateDTO dto, boolean superAdmin) {
        School school = resolveSchoolForThemeUpdate(dto, superAdmin);

        if (dto.getPrimaryColor() != null) school.setPrimaryColor(dto.getPrimaryColor());
        if (dto.getAccentColor() != null) school.setAccentColor(dto.getAccentColor());
        if (dto.getBackgroundColor() != null) school.setBackgroundColor(dto.getBackgroundColor());
        if (dto.getTextColor() != null) school.setTextColor(dto.getTextColor());
        if (dto.getNavTextColor() != null) school.setNavTextColor(dto.getNavTextColor());

        return schoolRepo.save(school);
    }

    private School resolveSchoolForThemeUpdate(SchoolThemeUpdateDTO dto, boolean superAdmin) {
        if (superAdmin) {
            if (dto.getSchoolId() == null) {
                throw new IllegalArgumentException("schoolId is required for platform theme updates");
            }
            return schoolRepo.findById(dto.getSchoolId()).orElseThrow();
        }

        Integer schoolId = TenantContext.getSchoolId();
        if (schoolId == null) throw new IllegalStateException("Missing school context");
        return schoolRepo.findById(schoolId).orElseThrow();
    }

    public static boolean isSuperAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        for (GrantedAuthority ga : auth.getAuthorities()) {
            if ("ROLE_SUPER_ADMIN".equals(ga.getAuthority())) return true;
        }
        return false;
    }
}

