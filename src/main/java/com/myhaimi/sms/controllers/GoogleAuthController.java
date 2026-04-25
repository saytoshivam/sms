package com.myhaimi.sms.controllers;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.Collections;
import java.util.Map;

import com.myhaimi.sms.service.impl.UserDetailsServiceImpl;
import com.myhaimi.sms.utils.JwtUtil;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.UserRepo;

@RestController
@RequestMapping("/auth/google")
@Slf4j
public class GoogleAuthController {

    @Value("${spring.security.oauth2.client.registration.google.client-id}")
    private String clientId;

    @Value("${spring.security.oauth2.client.registration.google.client-secret}")
    private String clientSecret;

    @Value("${sms.oauth.google.redirect-uri}")
    private String redirectUri;

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    UserDetailsServiceImpl userDetailsService;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserRepo userRepo;

    @GetMapping("/callback")
    public ResponseEntity<?> handleGoogleCallback(@RequestParam String code) {
        try {
            String tokenEndpoint = "https://oauth2.googleapis.com/token";
            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("code", code);
            params.add("client_id", clientId);
            params.add("client_secret", clientSecret);
            params.add("redirect_uri", redirectUri);
            params.add("grant_type", "authorization_code");
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);
            ResponseEntity<Map> tokenResponse = restTemplate.postForEntity(tokenEndpoint, request, Map.class);
            Map<?, ?> tokenBody = tokenResponse.getBody();
            if (tokenBody == null) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body("Empty token response from Google");
            }
            Object idTokenObj = tokenBody.get("id_token");
            if (!(idTokenObj instanceof String idToken) || idToken.isBlank()) {
                log.warn("Google token response missing id_token: keys={}", tokenBody.keySet());
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body("Google did not return an id_token");
            }
            String userInfoUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken;
            ResponseEntity<Map> userInfoResponse = restTemplate.getForEntity(userInfoUrl, Map.class);
            if (userInfoResponse.getStatusCode() == HttpStatus.OK) {
                Map<String, Object> userInfo = userInfoResponse.getBody();
                if (userInfo == null) {
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
                }
                String email = (String) userInfo.get("email");
                try{
                    userDetailsService.loadUserByUsername(email);
                }catch (Exception e){
                    return new ResponseEntity<>("user doesn't exist. please register", HttpStatus.BAD_REQUEST);
                }
                User user = userRepo.findFirstWithSchoolByUsernameOrEmail(email).orElse(null);
                if (user != null && user.getSchool() != null && user.getSchool().isArchived()) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).body("This school tenant has been disabled.");
                }
                Integer schoolId = user != null && user.getSchool() != null ? user.getSchool().getId() : null;
                String jwtToken = jwtUtil.generateToken(email, schoolId);
                return ResponseEntity.ok(Collections.singletonMap("token", jwtToken));
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        } catch (Exception e) {
            log.error("Exception occurred while handleGoogleCallback ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }

    }
}
