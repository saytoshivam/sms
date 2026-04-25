package com.myhaimi.sms.service.impl;

import com.myhaimi.sms.DTO.LoginDTO;
import com.myhaimi.sms.DTO.UserDTO;
import com.myhaimi.sms.entity.User;
import com.myhaimi.sms.repository.UserRepo;
import com.myhaimi.sms.service.IUserService;
import com.myhaimi.sms.utils.JwtUtil;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@AllArgsConstructor
@Slf4j
public class UserService implements IUserService {
    private UserRepo userRepo;
    private static final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Autowired
    private ModelMapper modelMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserDetailsServiceImpl userDetailsService;

    public UserDTO toDTO(User user) {
        return modelMapper.map(user, UserDTO.class);
    }

    public User toEntity(UserDTO dto) {
        return modelMapper.map(dto, User.class);
    }

    @Override
    public void createUser(UserDTO userDTO) {
        userDTO.setPassword(passwordEncoder.encode(userDTO.getPassword()));
        //userDTO.setRoles(Set.of("USER"));
        userRepo.save(this.toEntity(userDTO));
    }

    @Override
    public UserDTO findByUsernameOrEmail(String usernameOrEmail){
        User user = userRepo
                .findFirstByUsernameIgnoreCaseOrEmailIgnoreCase(usernameOrEmail, usernameOrEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return this.toDTO(user);
    }

    @Override
    public User getUserById(int id){
        return userRepo.findById(id).get();
    }

    @Override
    public ResponseEntity<String> Login(LoginDTO user) {
        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
        // Must load school in the same query so JWT gets tenant id (schoolId) for tenant-scoped APIs.
        User userEntity = userRepo
                .findFirstWithSchoolByUsernameOrEmail(user.getUsername())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Integer schoolId = userEntity.getSchool() != null ? userEntity.getSchool().getId() : null;
        String jwt = jwtUtil.generateToken(userDetails.getUsername(), schoolId);
        return new ResponseEntity<>(jwt, HttpStatus.OK);
    }

    @Override
    public UserDTO updateUser(UserDTO user, String username) {
        UserDTO userInDb= findByUsernameOrEmail(username);
        userInDb.setUsername(user.getUsername());
        userInDb.setPassword(passwordEncoder.encode(user.getPassword()));
        return this.toDTO(userRepo.save(this.toEntity(userInDb)));
    }
}
