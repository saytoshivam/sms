package com.myhaimi.sms.config;

/**
 * Canonical emails for the Greenwood demo tenant (school code {@link #CODE}). Staff rows match login users where
 * applicable so runners can resolve staff by email.
 */
public final class GreenwoodDemoAccounts {

    public static final String CODE = "greenwood-demo";

    /** Staff / directory (also used for timetable & augment runners). */
    public static final String STAFF_PRINCIPAL = "principal@gmail.com";

    public static final String STAFF_RAHUL = "teacher1@gmail.com";
    public static final String STAFF_SNEHA = "teacher2@gmail.com";
    public static final String STAFF_PRIYA = "teacher3@gmail.com";
    public static final String STAFF_VIKRAM = "teacher4@gmail.com";
    public static final String STAFF_LIBRARIAN = "librarian@gmail.com";

    /** Login users (password: {@code sms.seed.demo-school.password}, default {@code demo123}). */
    public static final String SCHOOL_ADMIN = "schooladmin@gmail.com";

    public static final String SCHOOL_OWNER = "schoolowner@gmail.com";
    public static final String PRINCIPAL = "principal@gmail.com";
    public static final String TEACHER1 = "teacher1@gmail.com";
    public static final String TEACHER2 = "teacher2@gmail.com";
    public static final String LIBRARIAN = "librarian@gmail.com";

    public static String studentEmail(int n) {
        return "student" + n + "@gmail.com";
    }

    public static final String PARENT1 = "parent1@gmail.com";
    public static final String GRADE8 = "grade8@gmail.com";

    public static String guardianEmail(String admissionNoLower) {
        return "parent." + admissionNoLower + "@gmail.com";
    }

    private GreenwoodDemoAccounts() {}
}
