# Debugging Login Issue (Status: In Progress)

## Summary

The application is currently experiencing an authentication issue where login fails with "Incorrect username or password" even with valid credentials that are confirmed to exist in the database.

## What We Know

### ✅ Database Setup is Correct
- MySQL is running on port 3307
- Database `newdb` exists with `users` table
- Users are properly seeded:
  ```
  superadmin / superadmin@myhaimi.com
  schooladmin / schooladmin@gmail.com
  teacher1 / teacher1@gmail.com
  ```
- Passwords are stored as BCrypt hashes:
  ```
  superadmin password: $2a$10$B0v3hy53.cKFja9s6Gkz6uV7VJe/.qOBop/yIPwEMQZiAPhYe7QKS
  ```

### ✅ Backend is Running Correctly
- Spring Boot application starts successfully
- MySQL connection is established
- Health endpoint responds: `{"status":"UP","groups":["liveness","readiness"]}`

### ✅ Fixes Already Applied
1. **UserDetailsServiceImpl**: Changed username loading from email to actual username (line 28)
2. **PublicController**: Enhanced logging for authentication attempts
3. **Frontend Error Handling**: Improved error message display for validation errors
4. **README.md**: Added comprehensive debugging guide

## Remaining Issue

Authentication is failing at the `authenticationManager.authenticate()` call despite:
- User existing in database
- Password being properly encoded with BCrypt
- UserDetailsService configured to use BCryptPasswordEncoder
- All configuration appearing correct

## Investigation Steps Completed

1. ✅ Verified users exist in database with correct usernames
2. ✅ Verified passwords are BCrypt encoded
3. ✅ Checked UserDetailsServiceImpl implementation
4. ✅ Reviewed SpringSecurity configuration
5. ✅ Verified DaoAuthenticationProvider is configured with BCryptPasswordEncoder
6. ✅ Fixed UserDetailsServiceImpl to use username instead of email

## Next Steps to Debug

### Step 1: Enable Debug Logging
Add to `src/main/resources/application.properties`:
```properties
logging.level.org.springframework.security=DEBUG
logging.level.com.myhaimi.sms=DEBUG
logging.level.org.springframework.security.crypto=DEBUG
```

Then restart backend and check logs for:
- User lookup details
- Password encoding/comparison steps
- Why authentication is failing

### Step 2: Verify Role Loading
```bash
docker exec sms-mysql mysql -u root -proot -e \
  "USE newdb; SELECT u.id, u.username, u.email, COUNT(r.id) role_count FROM users u LEFT JOIN user_roles ur ON u.id=ur.user_id LEFT JOIN roles r ON ur.role_id=r.id GROUP BY u.id HAVING u.username='superadmin';"
```

Check if:
- User has at least one role assigned
- Roles table is properly populated
- user_roles junction table has proper records

### Step 3: Test Password Hash Directly
Use an online BCrypt validator:
- Password to test: `abc`
- Hash from database: `$2a$10$B0v3hy53.cKFja9s6Gkz6uV7VJe/.qOBop/yIPwEMQZiAPhYe7QKS`

### Step 4: Create Test Endpoint
Create a temporary debugging endpoint in PublicController:
```java
@GetMapping("/debug/password-check")
public ResponseEntity<?> debugPassword(@RequestParam String username, @RequestParam String password) {
    User u = userRepo.findFirstWithSchoolByUsernameOrEmail(username).orElse(null);
    if (u == null) return ResponseEntity.status(404).body("User not found");
    
    PasswordEncoder pe = new BCryptPasswordEncoder();
    boolean matches = pe.matches(password, u.getPassword());
    return ResponseEntity.ok(Map.of(
        "userFound", true,
        "passwordMatches", matches,
        "storedHash", u.getPassword()
    ));
}
```

Then test: `curl http://localhost:8080/public/debug/password-check?username=superadmin&password=abc`

### Step 5: Check LazyInitializationException
The UserDetailsService fetches user with LEFT JOIN FETCH for school, but roles might require separate query. Check logs for:
```
org.hibernate.LazyInitializationException
```

If found, ensure roles are eagerly loaded:
```java
@Query("SELECT u FROM User u LEFT JOIN FETCH u.roles WHERE LOWER(u.username) = LOWER(:q) OR LOWER(u.email) = LOWER(:q)")
Optional<User> findFirstWithSchoolByUsernameOrEmail(@Param("q") String usernameOrEmail);
```

## Configuration Review

### SpringSecurity.java
- ✅ BCryptPasswordEncoder configured as @Bean
- ✅ DaoAuthenticationProvider correctly set up
- ✅ AuthenticationManager obtained from AuthenticationConfiguration
- Missing: Debug SecurityFilterChain?

### UserDetailsServiceImpl.java  
- ✅ Fixed to use username (not email)
- ✅ Logs added for debugging
- Missing: Eager loading of roles?

### DatabaseUser Entity.java
- Check: Are roles properly @ManyToMany mapped?
- Check: Is FetchType set correctly?

## Possible Root Causes

1. **Lazy Initialization**: Roles not loaded when UserDetails is built
   - Solution: Add `LEFT JOIN FETCH u.roles` to query

2. **Transaction Boundary**: UserDetailsService called outside transaction
   - Solution: Add `@Transactional(readOnly=true)` to method

3. **Password Encoder Mismatch**: Different encoder instance used
   - Solution: Ensure same BCryptPasswordEncoder bean used everywhere

4. **Schema Mismatch**: Column names or types don't match entity
   - Solution: Run schema inspection query

5. **User State**: User marked as disabled in database
   - Solution: Check `is_active` or similar column in users table

## Commands to Run for Debugging

```bash
# Check all users and their details
docker exec sms-mysql mysql -u root -proot -e \
  "USE newdb; SELECT u.id, u.username, u.email, u.password FROM users LIMIT 5;"

# Check user roles mapping
docker exec sms-mysql mysql -u root -proot -e \
  "USE newdb; SELECT u.username, r.name FROM users u JOIN user_roles ur ON u.id=ur.user_id JOIN roles r ON ur.role_id=r.id WHERE u.username IN ('superadmin','schooladmin');"

# Check database schema for users table
docker exec sms-mysql mysql -u root -proot -e \
  "USE newdb; DESCRIBE users;"

# Check application logs
tail -f /tmp/backend_fresh.log | grep -E "Loading|superadmin|credentials|Authentication|ERROR"
```

## Files Modified

1. `/Users/shivamjaiswal/Desktop/sms/src/main/java/com/myhaimi/sms/service/impl/UserDetailsServiceImpl.java`
   - Changed username from `u.getEmail()` to `u.getUsername()`
   - Added @Slf4j and logging statements

2. `/Users/shivamjaiswal/Desktop/sms/src/main/java/com/myhaimi/sms/controllers/PublicController.java`
   - Enhanced error logging in login method

3. `/Users/shivamjaiswal/Desktop/sms/frontend/src/pages/LoginPage.tsx`
   - Improved error message handling

4. `/Users/shivamjaiswal/Desktop/sms/README.md`
   - Added debugging section with next steps

## Instructions for Next Developer

1. First, enable DEBUG logging in application.properties
2. Run one of the debug commands above 
3. Attempt login and check logs  
4. If you see "User not found" → roles/schema issue
5. If you see password mismatch → encoder issue
6. Create the debug endpoint if needed to isolate the problem
7. Run through the Next Steps checklist systematically

The issue is isolation-based - we know the data exists, so it's configuration/code logic.

