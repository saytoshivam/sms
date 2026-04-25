package com.myhaimi.sms.service;

import com.myhaimi.sms.DTO.LoginDTO;
import com.myhaimi.sms.DTO.UserDTO;
import com.myhaimi.sms.entity.User;
import org.springframework.http.ResponseEntity;

public interface IUserService {
    void createUser(UserDTO user);
    UserDTO findByUsernameOrEmail(String usernameOrEmail);
    User getUserById(int id);
    UserDTO updateUser(UserDTO user, String username);
    ResponseEntity<String>  Login(LoginDTO user);
}
