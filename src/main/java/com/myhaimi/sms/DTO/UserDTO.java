package com.myhaimi.sms.DTO;

import com.myhaimi.sms.entity.Role;
import jakarta.persistence.Id;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import java.util.HashSet;
import java.util.Set;

@Data
public class UserDTO {
    @Id
    private int id;
    @NotBlank(message = "Username is required")
    private String username;
    @NotBlank(message = "Password is required")
    @NotNull
    private String password;
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    @Pattern(
            regexp = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.(com|net|org|edu|gov|mil|biz|info|io|co|in|yahoo|gmail)$",
            message = "Email must be a valid format like example@gmail.com or example@yahoo.com"
    )
    private String email;
    private Set<Role> roles = new HashSet<>();
}
