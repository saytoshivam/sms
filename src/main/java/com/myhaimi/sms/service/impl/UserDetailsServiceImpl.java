package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.entity.Role;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.UserRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepo userRepo;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User u = userRepo
                .findFirstWithSchoolByUsernameOrEmail(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        boolean isSuperAdmin =
                u.getRoles().stream().anyMatch(r -> "SUPER_ADMIN".equals(r.getName()));
        boolean tenantArchived =
                !isSuperAdmin && u.getSchool() != null && u.getSchool().isArchived();
        return org.springframework.security.core.userdetails.User.builder()
                .username(u.getEmail())
                .password(u.getPassword())
                .disabled(!u.isEnabled() || tenantArchived)
                .roles(u.getRoles().stream().map(Role::getName).toArray(String[]::new))
                .build();
    }
}
