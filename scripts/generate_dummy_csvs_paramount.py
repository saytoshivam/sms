import csv
import os
import random
from dataclasses import dataclass


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(ROOT, "docs", "dummy-csvs", "paramount-academy-kasrawad")
DOCS_STUDENTS = os.path.join(ROOT, "docs", "students.csv")


SCHOOL_NAME = "Paramount Academy Kasrawad"
EMAIL_DOMAIN = "paramountkasrawad.edu"


def ensure_dir(p: str) -> None:
    os.makedirs(p, exist_ok=True)


def write_csv(path: str, header: list[str], rows: list[list[str]]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


# Matches UI template header exactly.
SUBJECTS_HEADER = ["name", "code", "weeklyFrequency"]


def cbse_subjects() -> list[tuple[str, str]]:
    """
    Broad CBSE-style subject catalog (school-level + senior secondary streams).
    Codes are uppercase A–Z/0–9 only, 3–32 chars (UI validation).
    """
    subjects: list[tuple[str, str]] = [
        ("English", "ENG"),
        ("Hindi", "HIN"),
        ("Sanskrit", "SNK"),
        ("Urdu", "URD"),
        ("Mathematics", "MTH"),
        ("Basic Mathematics", "BMT"),
        ("Science", "SCI"),
        ("Social Science", "SSC"),
        ("History", "HIS"),
        ("Geography", "GEO"),
        ("Political Science", "POL"),
        ("Economics", "ECO"),
        ("Civics", "CIV"),
        ("Environmental Studies", "EVS"),
        ("General Knowledge", "GKE"),
        ("Computer Applications", "CAP"),
        ("Artificial Intelligence", "AI0"),
        ("Information Technology", "ITO"),
        ("Computer Science", "CSC"),
        ("Informatics Practices", "IPR"),
        ("Physics", "PHY"),
        ("Chemistry", "CHE"),
        ("Biology", "BIO"),
        ("Biotechnology", "BTN"),
        ("Accounts", "ACC"),
        ("Accountancy", "ACT"),
        ("Business Studies", "BST"),
        ("Entrepreneurship", "ENT"),
        ("Legal Studies", "LST"),
        ("Psychology", "PSY"),
        ("Sociology", "SOC"),
        ("Home Science", "HSC"),
        ("Physical Education", "PED"),
        ("Health & Physical Education", "HPE"),
        ("Yoga", "YOG"),
        ("Fine Arts", "FAR"),
        ("Music", "MUS"),
        ("Dance", "DAN"),
        ("Painting", "PNT"),
        ("Work Education", "WED"),
        ("Value Education", "VED"),
        ("French", "FRE"),
        ("German", "GER"),
        ("Punjabi", "PNJ"),
    ]
    # De-dupe by code while preserving order
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for name, code in subjects:
        code = code.strip().upper()
        if code in seen:
            continue
        seen.add(code)
        out.append((name, code))
    return out


# Rooms header matches UI template exactly.
ROOMS_HEADER = ["building", "floorNumber", "floorName", "room", "type", "capacity", "labType"]


def rooms_rows() -> list[list[str]]:
    """
    Create a richer infrastructure list:
    - Multiple classrooms per classGroupCode (grade-stone) so a 10k-student school has enough rooms.
    - A few common facilities (labs/library/auditorium/etc).
    """
    rows: list[list[str]] = []

    # Classroom allocation across two academic buildings
    academic_buildings = [
        ("Academic Block A", 0, "Ground"),
        ("Academic Block A", 1, "First"),
        ("Academic Block A", 2, "Second"),
        ("Academic Block B", 0, "Ground"),
        ("Academic Block B", 1, "First"),
        ("Academic Block B", 2, "Second"),
    ]
    cap_by_grade = {1: 35, 2: 35, 3: 38, 4: 38, 5: 40, 6: 42, 7: 42, 8: 44, 9: 46, 10: 46, 11: 48, 12: 48}
    classroom_suffixes = ["A", "B", "C"]  # 3 rooms/section (no numeric suffixes)

    i = 0
    for grade in range(1, 13):
        sections = sections_for_grade(grade)
        for sec in sections:
            for suf in classroom_suffixes:
                bld, floor_no, floor_name = academic_buildings[i % len(academic_buildings)]
                # One section maps to multiple physical rooms (e.g. "6-RUBY-A")
                room = f"{grade}-{sec}-{suf}"
                rows.append([bld, str(floor_no), floor_name, room, "CLASSROOM", str(cap_by_grade.get(grade, 40)), ""])
                i += 1

    # Facilities
    rows.extend(
        [
            ["Science Wing", "0", "Ground", "LAB-PHY", "LAB", "30", "PHYSICS"],
            ["Science Wing", "0", "Ground", "LAB-CHE", "LAB", "30", "CHEMISTRY"],
            ["Science Wing", "1", "First", "LAB-BIO", "LAB", "30", "OTHER"],
            ["IT Wing", "1", "First", "LAB-COMP", "LAB", "32", "COMPUTER"],
            ["Library Block", "0", "Ground", "LIB", "LIBRARY", "60", ""],
            ["Sports", "0", "Ground", "SPORTS", "SPORTS_ROOM", "80", ""],
            ["Auditorium", "0", "Ground", "AUD", "AUDITORIUM", "200", ""],
            ["Admin Block", "0", "Ground", "OFFICE-1", "OFFICE", "10", ""],
            ["Admin Block", "0", "Ground", "STAFF-ROOM", "STAFF_ROOM", "18", ""],
        ]
    )

    return rows


# Staff header matches UI template exactly.
STAFF_HEADER = [
    "fullName",
    "email",
    "phone",
    "employeeNo",
    "designation",
    "roles",
    "subjects",
    "createLoginAccount",
]


FIRST_NAMES = [
    "Aarav",
    "Diya",
    "Rohan",
    "Ananya",
    "Arjun",
    "Meera",
    "Kabir",
    "Simran",
    "Yash",
    "Riya",
    "Ishaan",
    "Sara",
    "Vihaan",
    "Aditi",
    "Kunal",
    "Nisha",
    "Rahul",
    "Pooja",
    "Imran",
    "Seema",
    "Neha",
    "Sanjay",
    "Priya",
    "Vikram",
    "Sonia",
]

LAST_NAMES = [
    "Patel",
    "Sharma",
    "Verma",
    "Singh",
    "Reddy",
    "Iyer",
    "Khan",
    "Kaur",
    "Malhotra",
    "Kapoor",
    "Joshi",
    "Nair",
    "Gupta",
    "Mehta",
    "Choudhary",
    "Yadav",
    "Prajapati",
    "Bansal",
    "Saxena",
]


def slug_email(full_name: str) -> str:
    s = "".join(ch.lower() if ch.isalnum() else "." for ch in full_name).strip(".")
    while ".." in s:
        s = s.replace("..", ".")
    return f"{s}@{EMAIL_DOMAIN}"

def unique_person_name(idx: int) -> str:
    """
    Deterministic unique-ish full names by indexing into FIRST_NAMES × LAST_NAMES.
    Guarantees uniqueness for hundreds of rows (enough for our dummy staff).
    """
    fn = FIRST_NAMES[idx % len(FIRST_NAMES)]
    ln = LAST_NAMES[(idx // len(FIRST_NAMES)) % len(LAST_NAMES)]
    return f"{fn} {ln}"


def teachers_rows(subject_codes: list[str], teacher_count: int = 60) -> list[list[str]]:
    """
    More realistic distribution:
    - Many teachers teach only 1 subject (but can teach it across many classes/sections in the app).
    - Guarantee every subject code has at least 1 teacher.
    - Add extra teachers for common high-load subjects.
    """
    subject_codes = [s for s in subject_codes if s]
    if teacher_count < len(subject_codes):
        teacher_count = len(subject_codes)

    common_heavy = [
        "ENG",
        "HIN",
        "MTH",
        "SCI",
        "SSC",
        "PHY",
        "CHE",
        "BIO",
        "CSC",
        "EVS",
    ]

    # Build subject assignment list (length == teacher_count)
    assignments: list[str] = []
    assignments.extend(subject_codes)  # coverage pass
    remaining = teacher_count - len(assignments)
    heavy_available = [c for c in common_heavy if c in set(subject_codes)]
    if not heavy_available:
        heavy_available = subject_codes[:]

    # Fill remaining slots preferring heavy subjects, then random fallback
    for i in range(remaining):
        if i < len(heavy_available) * 2:
            assignments.append(heavy_available[i % len(heavy_available)])
        else:
            assignments.append(rng.choice(subject_codes))

    rows: list[list[str]] = []
    used_emails: set[str] = set()
    for i in range(1, teacher_count + 1):
        full = unique_person_name(i - 1)
        email = slug_email(full)
        if email in used_emails:
            email = f"{email.split('@')[0]}.{i}@{EMAIL_DOMAIN}"
        used_emails.add(email)
        phone = f"98{76500000 + i:08d}"
        emp = f"TCH{i:04d}"
        designation = "Teacher"
        roles = "TEACHER"
        subjects = assignments[i - 1]  # single subject code
        create_login = "true"
        rows.append([full, email, phone, emp, designation, roles, subjects, create_login])
    return rows


def non_teaching_staff_rows(start_index: int, count: int = 12) -> list[list[str]]:
    """
    Add non-teaching roles present in the onboarding UI role catalog.
    Do NOT assign subjects to these roles.
    """
    roles_cycle = [
        ("PRINCIPAL", "Principal"),
        ("VICE_PRINCIPAL", "Vice principal"),
        ("SCHOOL_ADMIN", "School admin"),
        ("ACCOUNTANT", "Accountant"),
        ("HOD", "HOD"),
    ]
    rows: list[list[str]] = []
    used_emails: set[str] = set()
    for i in range(count):
        idx = start_index + i
        role_code, designation = roles_cycle[i % len(roles_cycle)]
        # Offset into the name space so we don't collide with teacher names.
        full = unique_person_name(10_000 + idx)
        email = slug_email(full)
        if email in used_emails:
            email = f"{email.split('@')[0]}.{idx}@{EMAIL_DOMAIN}"
        used_emails.add(email)
        phone = f"98{76400000 + idx:08d}"
        emp = f"EMP{idx:04d}"
        roles = role_code
        subjects = ""  # IMPORTANT: non-teaching staff should not have subject codes
        create_login = "true" if role_code in {"PRINCIPAL", "VICE_PRINCIPAL", "SCHOOL_ADMIN", "ACCOUNTANT", "HOD"} else "false"
        rows.append([full, email, phone, emp, designation, roles, subjects, create_login])
    return rows


# Fees header matches UI template exactly.
FEES_HEADER = ["class", "tuition", "transport", "lab", "activity", "exam", "sports", "development"]


def fees_rows() -> list[list[str]]:
    # Still compatible with UI's "sum numeric columns" logic: all numeric columns are summed (except class).
    rows: list[list[str]] = []
    for grade in range(1, 13):
        tuition = 10000 + grade * 1400
        transport = 2200 + max(0, grade - 1) * 300
        lab = 0 if grade <= 5 else (400 + (grade - 6) * 250)
        activity = 600 + grade * 90
        exam = 300 + grade * 60
        sports = 250 + grade * 40
        development = 500 + grade * 70
        rows.append(
            [
                str(grade),
                str(tuition),
                str(transport),
                str(max(0, lab)),
                str(activity),
                str(exam),
                str(sports),
                str(development),
            ]
        )
    return rows


# Students header matches UI template and existing docs/students.csv exactly.
STUDENTS_HEADER = [
    "admissionNo",
    "firstName",
    "lastName",
    "classGroupCode",
    "guardianName",
    "guardianRelation",
    "guardianPhone",
    "guardianEmail",
]


def sections_for_grade(grade: int) -> list[str]:
    """
    Stone-based section names (no numeric suffixes).
    Keeps labels alphanumeric (A–Z only) so they work well in classGroupCode and room names.

    With 10k students, only ~25 sections total is too few; this generates ~100+ sections total
    so the average students/section is much lower.
    """
    target_sections_by_grade: dict[int, int] = {
        1: 6,
        2: 6,
        3: 8,
        4: 8,
        5: 8,
        6: 10,
        7: 10,
        8: 10,
        9: 10,
        10: 10,
        11: 8,
        12: 8,
    }
    n = target_sections_by_grade.get(int(grade), 6)

    # Stable base (so equal section-count grades share identical names)
    common = ["RUBY", "DIAMOND", "EMERALD", "SAPPHIRE", "TOPAZ", "OPAL"]
    if n <= len(common):
        return common[:n]

    # Extra names only when a grade needs "more than common".
    extras_pool = [
        "AMETHYST",
        "PEARL",
        "JADE",
        "ONYX",
        "GARNET",
        "AQUAMARINE",
        "TURQUOISE",
        "CITRINE",
        "PERIDOT",
        "MOONSTONE",
        "QUARTZ",
        "ZIRCON",
        "SPINEL",
        "TANZANITE",
    ]
    need = n - len(common)
    extras = extras_pool[: min(need, len(extras_pool))]
    return common + extras


def class_group_code(grade: int, section: str) -> str:
    # Match existing sample `6-EMERALD` style (grade-stone)
    return f"{grade}-{section}"


def students_10k() -> list[list[str]]:
    rng = random.Random(2026)
    rows: list[list[str]] = []
    per_grade_i: dict[int, int] = {g: 0 for g in range(1, 13)}
    for n in range(1, 10001):
        grade = (n % 12) + 1
        sections = sections_for_grade(grade)
        k = per_grade_i.get(grade, 0)
        section = sections[k % len(sections)]
        per_grade_i[grade] = k + 1
        fn = rng.choice(FIRST_NAMES)
        ln = rng.choice(LAST_NAMES)
        admission = f"PAK{n:05d}"
        guardian_fn = rng.choice(["Sanjay", "Neha", "Rajesh", "Priya", "Amit", "Sunita", "Rakesh", "Kavita", "Imran", "Seema"])
        guardian_ln = ln
        guardian = f"{guardian_fn} {guardian_ln}"
        relation = rng.choice(["Father", "Mother", "Parent", "Guardian"])
        phone = f"97{65000000 + (n % 1000000):08d}"
        g_email_local = f"{guardian_fn.lower()}.{guardian_ln.lower()}.{n}"
        guardian_email = f"{g_email_local}@{EMAIL_DOMAIN}"
        rows.append(
            [
                admission,
                fn,
                ln,
                class_group_code(grade, section),
                guardian,
                relation,
                phone,
                guardian_email,
            ]
        )
    return rows


def main() -> None:
    ensure_dir(OUT_DIR)

    # Subjects
    subjects = cbse_subjects()
    write_csv(
        os.path.join(OUT_DIR, "subjects-template.csv"),
        SUBJECTS_HEADER,
        [[name, code, "5"] for name, code in subjects],
    )

    # Rooms
    write_csv(os.path.join(OUT_DIR, "rooms-template.csv"), ROOMS_HEADER, rooms_rows())

    # Staff (teachers + non-teaching roles)
    subject_codes = [code for _, code in subjects]
    teacher_rows = teachers_rows(subject_codes, teacher_count=60)
    other_rows = non_teaching_staff_rows(start_index=61, count=12)
    write_csv(os.path.join(OUT_DIR, "staff-template.csv"), STAFF_HEADER, teacher_rows + other_rows)

    # Fees
    write_csv(os.path.join(OUT_DIR, "fees-template.csv"), FEES_HEADER, fees_rows())

    # Classes & sections template (for Step 2 CSV upload)
    with open(os.path.join(OUT_DIR, "classes-sections-template.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["gradeLevel", "sections"])
        for grade in range(1, 13):
            w.writerow([str(grade), "|".join(sections_for_grade(grade))])

    # Students (10k) written to both locations
    students = students_10k()
    write_csv(os.path.join(OUT_DIR, "students-template.csv"), STUDENTS_HEADER, students)
    write_csv(DOCS_STUDENTS, STUDENTS_HEADER, students)

    print(f"Wrote dummy CSVs for {SCHOOL_NAME}")
    print(f"- {OUT_DIR}")
    print(f"- {DOCS_STUDENTS}")


if __name__ == "__main__":
    main()

