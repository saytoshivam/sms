package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.LoginDTO;
import com.myhaimi.sms.DTO.UserDTO;
import com.myhaimi.sms.utils.CommonUtil;
import com.myhaimi.sms.service.IUserService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.security.RoleNames;

@RestController
@RequestMapping("/public")
@Slf4j
public class PublicController {

    @Autowired
    private IUserService userService;

    @Autowired
    private UserRepo userRepo;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${spring.security.oauth2.client.registration.google.client-id:}")
    private String googleClientId;

    @Value("${sms.oauth.google.redirect-uri}")
    private String googleOauthRedirectUri;

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@Valid @RequestBody UserDTO user, BindingResult result){
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;

        try {
             userService.createUser(user);
            return new ResponseEntity<>(HttpStatus.CREATED);
        } catch (DataIntegrityViolationException e) {
            return new ResponseEntity<>("email or username already exists",HttpStatus.CONFLICT);
        } catch (Exception e) {
            return new ResponseEntity<>("unexpected error occurred", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Public metadata for the SPA to build the Google authorization URL (no secrets).
     */
    @GetMapping("/oauth/google-config")
    public ResponseEntity<Map<String, String>> googleOAuthConfig() {
        return ResponseEntity.ok(Map.of(
                "clientId", googleClientId == null ? "" : googleClientId,
                "redirectUri", googleOauthRedirectUri == null ? "" : googleOauthRedirectUri
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginDTO user,BindingResult result){
        ResponseEntity<?> res = CommonUtil.dtoBindingResults(result);
        if (res.getStatusCode().is4xxClientError()) return res;
        String principal = user.getUsername() == null ? "" : user.getUsername().trim();
        try {
            User u = userRepo
                    .findFirstWithSchoolByUsernameOrEmail(principal)
                    .orElse(null);
            boolean pwOk = u != null && u.getPassword() != null && passwordEncoder.matches(user.getPassword(), u.getPassword());
            log.info("Public login attempt principal={}, userFound={}, pwOk={}", principal, u != null, pwOk);
            if (!pwOk) {
                return new ResponseEntity<>("Incorrect username or password", HttpStatus.BAD_REQUEST);
            }

            boolean isSuperAdmin = u.getRoles() != null && u.getRoles().stream().anyMatch(r -> RoleNames.SUPER_ADMIN.equals(r.getName()));
            boolean tenantArchived = !isSuperAdmin && u.getSchool() != null && u.getSchool().isArchived();
            if (tenantArchived) {
                log.warn("Login disabled for principal={}", principal);
                return new ResponseEntity<>("This account is disabled (e.g. archived school tenant).", HttpStatus.FORBIDDEN);
            }

            LoginDTO forJwt = new LoginDTO();
            forJwt.setUsername(principal);
            forJwt.setPassword(user.getPassword());
            return userService.Login(forJwt);
        } catch (Exception e) {
            log.error("Exception occurred while createAuthenticationToken", e);
            return new ResponseEntity<>("Incorrect username or password", HttpStatus.BAD_REQUEST);
        }
    }

}
