package com.myhaimi.sms.controllers;

import com.myhaimi.sms.DTO.UserDTO;
import com.myhaimi.sms.DTO.UserMeDTO;
import com.myhaimi.sms.entity.Role;
import com.myhaimi.sms.entity.Staff;
import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.service.IUserService;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@AllArgsConstructor
@RequestMapping("/user")
public class UserController {
    private IUserService userService;
    private UserRepo userRepo;

    private static final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public ResponseEntity<UserMeDTO> me() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String email = authentication.getName();

        User user = userRepo.findFirstByEmailIgnoreCase(email).orElseThrow();
        UserMeDTO dto = new UserMeDTO();
        dto.setEmail(user.getEmail());
        dto.setUsername(user.getUsername());
        dto.setRoles(user.getRoles().stream().map(Role::getName).sorted().toList());
        if (user.getSchool() != null) {
            dto.setSchoolId(user.getSchool().getId());
            dto.setSchoolCode(user.getSchool().getCode());
            dto.setSchoolName(user.getSchool().getName());
            if (user.getSchool().getAttendanceMode() != null) {
                dto.setSchoolAttendanceMode(user.getSchool().getAttendanceMode().name());
            }
        }
        if (user.getLinkedStudent() != null) {
            Student s = user.getLinkedStudent();
            dto.setLinkedStudentId(s.getId());
            dto.setLinkedStudentPhotoUrl(s.getPhotoUrl());
            String ln = s.getLastName();
            dto.setLinkedStudentDisplayName(
                    s.getFirstName() + (ln != null && !ln.isBlank() ? " " + ln : ""));
            dto.setLinkedStudentAdmissionNo(s.getAdmissionNo());
            if (s.getClassGroup() != null) {
                dto.setLinkedStudentClassLabel(s.getClassGroup().getDisplayName());
            }
        }
        if (user.getLinkedStaff() != null) {
            Staff st = user.getLinkedStaff();
            dto.setLinkedStaffId(st.getId());
            dto.setLinkedStaffPhotoUrl(st.getPhotoUrl());
            dto.setLinkedStaffDisplayName(st.getFullName());
            dto.setLinkedStaffEmployeeNo(st.getEmployeeNo());
        }
        return ResponseEntity.ok(dto);
    }

    @PutMapping
    public ResponseEntity<?> updateUser(@RequestBody UserDTO user){
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String userName= authentication.getName();
        userService.updateUser(user, userName);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }
}
