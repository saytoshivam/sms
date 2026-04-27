package com.myhaimi.sms.config;

import com.myhaimi.sms.entity.Role;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.UserRepo;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import com.myhaimi.sms.repository.RoleRepo;
import com.myhaimi.sms.security.RoleNames;

import java.util.*;

@Component
@Order(1)
public class DataSeeder implements CommandLineRunner {
    private final RoleRepo roleRepository;
    private final UserRepo userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${sms.seed.superadmin.username}")
    private String superAdminUsername;

    @Value("${sms.seed.superadmin.email}")
    private String superAdminEmail;

    @Value("${sms.seed.superadmin.password}")
    private String superAdminPassword;

    public DataSeeder(RoleRepo roleRepository, UserRepo userRepository, PasswordEncoder passwordEncoder) {
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        // Canonical roles (see RoleNames). Idempotent insert — existing DB rows unchanged.
        List<String> roleNames = Arrays.asList(
                RoleNames.SUPER_ADMIN,
                RoleNames.SCHOOL_ADMIN,
                RoleNames.PRINCIPAL,
                RoleNames.VICE_PRINCIPAL,
                RoleNames.HOD,
                RoleNames.TEACHER,
                RoleNames.CLASS_TEACHER,
                RoleNames.STUDENT,
                RoleNames.PARENT,
                RoleNames.LIBRARIAN,
                RoleNames.ACCOUNTANT,
                RoleNames.RECEPTIONIST,
                RoleNames.TRANSPORT_MANAGER,
                RoleNames.IT_SUPPORT,
                RoleNames.COUNSELOR,
                RoleNames.EXAM_COORDINATOR,
                RoleNames.HOSTEL_WARDEN
        );

        // Insert roles if they don’t exist
        for (String roleName : roleNames) {
            Role r=new Role();
            r.setName(roleName);
            List<Role> er= roleRepository.findByName(roleName);
            if(er.isEmpty())
                roleRepository.save(r);
        }

        ensureSuperAdminUser();
    }

    private void ensureSuperAdminUser() {
        Role superAdminRole = roleRepository.findByName(RoleNames.SUPER_ADMIN).stream().findFirst().orElse(null);
        if (superAdminRole == null) {
            System.out.println("SUPER_ADMIN role missing; skipping super admin seed.");
            return;
        }

        User user = userRepository
                .findFirstByEmailIgnoreCase(superAdminEmail)
                .or(() -> userRepository.findFirstByUsernameIgnoreCase(superAdminUsername))
                .or(() -> userRepository.findFirstByEmailIgnoreCase("platform-admin@myhaimi.com"))
                .or(() -> userRepository.findFirstByUsernameIgnoreCase("Kashish"))
                .orElseGet(User::new);

        user.setEmail(superAdminEmail.trim());
        user.setUsername(superAdminUsername.trim());
        user.setPassword(passwordEncoder.encode(superAdminPassword));
        user.setSchool(null);

        if (user.getRoles() == null) user.setRoles(new HashSet<>());
        user.getRoles().clear();
        user.getRoles().add(superAdminRole);

        userRepository.save(user);
        try {
            boolean ok = passwordEncoder.matches(superAdminPassword, user.getPassword());
            System.out.println(
                    "Super admin ensured: " + superAdminEmail + " (" + superAdminUsername + "), pwMatches=" + ok
                            + ", pwLen=" + (user.getPassword() == null ? 0 : user.getPassword().length()));
        } catch (Exception e) {
            System.out.println("Super admin ensured: " + superAdminEmail + " (" + superAdminUsername + "), pwCheckError=" + e);
        }
    }
}


