package com.myhaimi.sms.repository;

import com.myhaimi.sms.entity.Guardian;
import com.myhaimi.sms.entity.Student;
import com.myhaimi.sms.entity.StudentGuardian;
import com.myhaimi.sms.entity.enums.StudentLifecycleStatus;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.util.Locale;
import java.util.Set;

public final class StudentSpecs {

    private StudentSpecs() {}

    public static Specification<Student> forSchool(Integer schoolId) {
        return (root, q, cb) -> cb.equal(root.get("school").get("id"), schoolId);
    }

    /**
     * Restricts results to students whose current class group is one of {@code allowedIds}.
     * If {@code allowedIds} is null → no restriction (all class groups).
     * If empty → no students match.
     */
    public static Specification<Student> restrictedToClassGroups(Set<Integer> allowedIds) {
        if (allowedIds == null) return (root, q, cb) -> cb.conjunction();
        if (allowedIds.isEmpty()) return (root, q, cb) -> cb.disjunction();
        return (root, q, cb) -> root.get("classGroup").get("id").in(allowedIds);
    }

    /** Restricts results to the specific student IDs (parent / student portal). */
    public static Specification<Student> studentIdIn(Set<Integer> ids) {
        if (ids == null || ids.isEmpty()) return (root, q, cb) -> cb.disjunction();
        return (root, q, cb) -> root.get("id").in(ids);
    }

    /** Restricts results to students with no class-section assigned. */
    public static Specification<Student> hasNoSection() {
        return (root, q, cb) -> cb.isNull(root.get("classGroup"));
    }

    /** Restricts results to students with no guardian linked. */
    public static Specification<Student> hasNoGuardian() {
        return (root, query, cb) -> {
            Subquery<Integer> sq = query.subquery(Integer.class);
            Root<StudentGuardian> sg = sq.from(StudentGuardian.class);
            sq.select(sg.get("student").get("id"));
            sq.where(cb.equal(sg.get("student").get("id"), root.get("id")));
            return cb.not(cb.exists(sq));
        };
    }

    public static Specification<Student> classGroup(Integer classGroupId) {
        if (classGroupId == null) return (root, q, cb) -> cb.conjunction();
        return (root, q, cb) -> cb.equal(root.get("classGroup").get("id"), classGroupId);
    }

    public static Specification<Student> classGroupGradeLevel(Integer gradeLevel) {
        if (gradeLevel == null) return (root, q, cb) -> cb.conjunction();
        return (root, q, cb) ->
                cb.and(
                        cb.isNotNull(root.get("classGroup")),
                        cb.equal(root.get("classGroup").get("gradeLevel"), gradeLevel));
    }

    public static Specification<Student> classGroupSection(String rawSection) {
        if (rawSection == null || rawSection.isBlank()) return (root, q, cb) -> cb.conjunction();
        String norm = rawSection.trim().toLowerCase(Locale.ROOT);
        return (root, q, cb) ->
                cb.and(
                        cb.isNotNull(root.get("classGroup")),
                        cb.equal(cb.lower(root.get("classGroup").get("section")), norm));
    }

    public static Specification<Student> lifecycleStatus(StudentLifecycleStatus status) {
        if (status == null) return (root, q, cb) -> cb.conjunction();
        return (root, q, cb) -> cb.equal(root.get("status"), status);
    }

    public static Specification<Student> admissionOrNameMatches(String raw) {
        if (raw == null || raw.isBlank()) return (root, q, cb) -> cb.conjunction();
        String t = "%" + raw.trim().toLowerCase(Locale.ROOT) + "%";
        return (root, q, cb) ->
                cb.or(
                        cb.like(cb.lower(root.get("admissionNo")), t),
                        cb.like(cb.lower(root.get("firstName")), t),
                        cb.like(cb.lower(root.get("middleName")), t),
                        cb.like(cb.lower(root.get("lastName")), t));
    }

    /**
     * Matches admission number, student name parts, or any linked guardian phone (partial, case-insensitive).
     */
    public static Specification<Student> studentListSearch(String raw) {
        if (raw == null || raw.isBlank()) return (root, q, cb) -> cb.conjunction();
        String t = "%" + raw.trim().toLowerCase(Locale.ROOT) + "%";
        return (root, query, cb) -> {
            Subquery<Integer> guardianSq = query.subquery(Integer.class);
            Root<StudentGuardian> sg = guardianSq.from(StudentGuardian.class);
            Join<StudentGuardian, Guardian> gj = sg.join("guardian", JoinType.INNER);
            guardianSq.select(sg.get("student").get("id"));
            guardianSq.where(
                    cb.and(
                            cb.equal(sg.get("student").get("id"), root.get("id")),
                            cb.like(cb.lower(gj.get("phone")), t)));
            Predicate nameOrAdm =
                    cb.or(
                            cb.like(cb.lower(root.get("admissionNo")), t),
                            cb.like(cb.lower(root.get("firstName")), t),
                            cb.like(cb.lower(root.get("middleName")), t),
                            cb.like(cb.lower(root.get("lastName")), t));
            return cb.or(nameOrAdm, cb.exists(guardianSq));
        };
    }
}
