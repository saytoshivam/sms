/**
 * Generates:
 *   1. students-template.csv  — 60 students per section (6,120 total)
 *   2. staff-template.csv     — complete teacher list with subject groupings
 *
 * Run: node scripts/gen_students_staff.mjs
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'docs', 'dummy-csvs', 'paramount-academy-kasrawad');

// ── Name pools ────────────────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Aarav','Aditya','Akash','Alok','Ananya','Anil','Anita','Anjali','Ankita','Ankit',
  'Arjun','Arnav','Arun','Aryan','Asha','Ashish','Ayesha','Bhavna','Dev','Deepika',
  'Dhruv','Disha','Divya','Farhan','Fatima','Gaurav','Geeta','Harsh','Heena','Ishaan',
  'Isha','Jatin','Jaya','Kabir','Kajal','Karan','Kavita','Keerat','Komal','Krishna',
  'Lakshmi','Lalit','Manav','Manisha','Meera','Mihir','Mohan','Mona','Muskan','Naman',
  'Namrata','Nandini','Naveen','Neha','Nikhil','Nilesh','Nisha','Om','Palak','Parth',
  'Pinkesh','Pooja','Poonam','Prachi','Pranav','Priya','Punit','Rahul','Raj','Rajat',
  'Rakesh','Ramesh','Ravi','Riya','Rohit','Rohan','Sakshi','Saloni','Sanaya','Sanjay',
  'Sanskriti','Sara','Sarika','Shivam','Shruti','Siddharth','Simran','Sneha','Sonam',
  'Sonali','Sonia','Sunil','Sunita','Supriya','Swati','Tanvi','Tarun','Tushar','Uday',
  'Uma','Vaishnavi','Varun','Vidya','Vikram','Vipin','Vishal','Vivek','Yash','Yogesh',
  'Zara','Zaid','Nidhi','Tina','Rita','Vinita','Madhur','Aakash','Abhinav','Chetan',
  'Harsha','Jagdish','Kishan','Lalita','Madan','Narendra','Omkar','Prakash','Radha',
  'Samarth','Tanmay','Ujjwal','Vandana','Wasim','Yadav','Zahir','Asmita','Bhumika',
];

const LAST_NAMES = [
  'Sharma','Verma','Patel','Gupta','Singh','Kumar','Joshi','Yadav','Mishra','Tiwari',
  'Agrawal','Srivastava','Pandey','Dwivedi','Chaurasia','Soni','Mehta','Shah','Trivedi',
  'Dubey','Chauhan','Rana','Kapoor','Malhotra','Bose','Nair','Menon','Reddy','Rao',
  'Iyer','Pillai','Choudhary','Saxena','Gautam','Rajput','Desai','Jain','Bansal','Garg',
  'Arora','Sethi','Khanna','Bhatia','Chopra','Anand','Bhatt','Dixit','Shukla','Naik',
  'Patil','More','Jadhav','Sawant','Kulkarni','Pawar','Deshmukh','Gaikwad','Salve','Thakur',
  'Kaur','Grewal','Brar','Sandhu','Gill','Dhillon','Bajwa','Sidhu','Mann','Khatri',
  'Ansari','Siddiqui','Khan','Sheikh','Qureshi','Malik','Mirza','Hashmi','Farooqui','Naqvi',
  'Jaiswal','Rajak','Sahu','Koshal','Baghel','Bundela','Chandel','Bhardwaj','Upadhyay','Tripathi',
];

const GUARDIAN_NAMES_FIRST = [
  'Ajay','Anil','Arvind','Ashok','Bharat','Deepak','Gopal','Harish','Jagdish','Kishore',
  'Mahesh','Naresh','Pankaj','Rajesh','Ramesh','Sanjeev','Satish','Suresh','Umesh','Vinod',
  'Priya','Sunita','Kavita','Seema','Geeta','Rekha','Anita','Savita','Nirmala','Meena',
];

const RELATIONS = ['Father','Mother','Guardian','Parent','Father','Father','Mother'];

// ── Section layout ────────────────────────────────────────────────────────────
const SECTIONS_BY_GRADE = {
  1:  ['RUBY','DIAMOND','EMERALD','SAPPHIRE','TOPAZ','OPAL'],
  2:  ['RUBY','DIAMOND','EMERALD','SAPPHIRE','TOPAZ','OPAL'],
  3:  ['RUBY','DIAMOND','EMERALD','SAPPHIRE','TOPAZ','OPAL','AMETHYST','PEARL'],
  4:  ['RUBY','DIAMOND','EMERALD','SAPPHIRE','TOPAZ','OPAL','AMETHYST','PEARL'],
  5:  ['RUBY','DIAMOND','EMERALD','SAPPHIRE','TOPAZ','OPAL','AMETHYST','PEARL'],
  6:  ['RUBY','DIAMOND','EMERALD','SAPPHIRE','TOPAZ','OPAL','AMETHYST','PEARL','JADE','ONYX'],
  7:  ['RUBY','DIAMOND','EMERALD','SAPPHIRE','TOPAZ','OPAL','AMETHYST','PEARL','JADE','ONYX'],
  8:  ['RUBY','DIAMOND','EMERALD','SAPPHIRE','TOPAZ','OPAL','AMETHYST','PEARL','JADE','ONYX'],
  9:  ['RUBY','DIAMOND','EMERALD','SAPPHIRE','TOPAZ','OPAL','AMETHYST','PEARL','JADE','ONYX'],
  10: ['RUBY','DIAMOND','EMERALD','SAPPHIRE','TOPAZ','OPAL','AMETHYST','PEARL','JADE','ONYX'],
  11: ['RUBY','DIAMOND','EMERALD','SAPPHIRE','TOPAZ','OPAL','AMETHYST','PEARL'],
  12: ['RUBY','DIAMOND','EMERALD','SAPPHIRE','TOPAZ','OPAL','AMETHYST','PEARL'],
};

const PER_SECTION = 60;

function pick(arr, seed) { return arr[seed % arr.length]; }
function pad(n, len=5) { return String(n).padStart(len,'0'); }
function phone(base) { return String(base); }

// ── 1. STUDENTS CSV ───────────────────────────────────────────────────────────
const studentRows = ['admissionNo,firstName,lastName,classCode,guardianName,guardianRelation,guardianPhone,guardianEmail,academicYear'];
let seq = 1;
for (const [gradeStr, sections] of Object.entries(SECTIONS_BY_GRADE)) {
  const grade = Number(gradeStr);
  for (const section of sections) {
    const classCode = `${grade}-${section}`;
    for (let s = 0; s < PER_SECTION; s++) {
      const admNo = `PAK${pad(seq)}`;
      const fnIdx = (seq * 7 + s * 3) % FIRST_NAMES.length;
      const lnIdx = (seq * 11 + s * 5) % LAST_NAMES.length;
      const firstName = FIRST_NAMES[fnIdx];
      const lastName  = LAST_NAMES[lnIdx];
      const gfIdx = (seq * 13) % GUARDIAN_NAMES_FIRST.length;
      const glnIdx = (seq * 17) % LAST_NAMES.length;
      const guardianFirst = GUARDIAN_NAMES_FIRST[gfIdx];
      const guardianLast  = LAST_NAMES[glnIdx];
      const guardianName  = `${guardianFirst} ${guardianLast}`;
      const relation      = RELATIONS[seq % RELATIONS.length];
      const phoneNo       = `97650${pad(seq, 5)}`;
      const emailLocal    = `${guardianFirst.toLowerCase()}.${guardianLast.toLowerCase()}.${seq}`;
      const guardianEmail = `${emailLocal}@paramountkasrawad.edu`;
      studentRows.push(`${admNo},${firstName},${lastName},${classCode},${guardianName},${relation},${phoneNo},${guardianEmail},2025-2026`);
      seq++;
    }
  }
}
const studentsCsvPath = join(OUT, 'students-template.csv');
writeFileSync(studentsCsvPath, studentRows.join('\n'), 'utf8');
console.log(`✓ students-template.csv — ${seq-1} students across ${studentRows.length-1} rows`);

// ── 2. STAFF CSV ──────────────────────────────────────────────────────────────
const HEADER = 'fullName,email,phone,employeeNo,designation,staffType,department,employmentType,joiningDate,roles,subjects,maxWeeklyLectureLoad,maxDailyLectureLoad,canBeClassTeacher,canTakeSubstitution,address,emergencyContactName,emergencyContactPhone,emergencyContactRelation,highestQualification,previousInstitution,bankName,bankAccount,ifscCode,panNumber,createLoginAccount';

// Teacher definitions: [fullName, emailLocal, phone, empNo, designation, dept, subjects, maxWeekly, maxDaily, qual]
// subjects uses | separator as seen in existing CSVs
const TEACHERS = [
  // ── ENGLISH ────────────────────────────────────────────────────────────────
  ['Sunita Sharma',     'sunita.sharma',     '9876501001','TCH1001','Senior Teacher','English',   'ENG001|ENG002|ENG003|ENG004|ENG005', 30,6,'M.A. English'],
  ['Kavita Verma',      'kavita.verma',      '9876501002','TCH1002','Teacher',       'English',   'ENG006|ENG007|ENG008',               30,6,'M.A. English'],
  ['Aarav Patel',       'aarav.patel',       '9876501003','TCH1003','Teacher',       'English',   'ENG009|ENG010',                      30,6,'M.Ed. English'],   // USER REQUIREMENT
  ['Priya Joshi',       'priya.joshi',       '9876501004','TCH1004','Senior Teacher','English',   'ENG011|ENG012',                      28,5,'M.A. English'],
  // ── HINDI ─────────────────────────────────────────────────────────────────
  ['Diya Patel',        'diya.patel',        '9876501005','TCH1005','Teacher',       'Hindi',     'HIN001|HIN002|HIN003|HIN004|HIN005', 30,6,'M.A. Hindi'],
  ['Rohan Sharma',      'rohan.sharma',      '9876501006','TCH1006','Teacher',       'Hindi',     'HIN006|HIN007|HIN008',               30,6,'M.A. Hindi'],
  ['Ananya Singh',      'ananya.singh',      '9876501007','TCH1007','Teacher',       'Hindi',     'HIN009|HIN010',                      30,6,'M.A. Hindi'],
  ['Meera Gupta',       'meera.gupta',       '9876501008','TCH1008','Senior Teacher','Hindi',     'HIN011|HIN012',                      28,5,'M.A. Hindi'],
  // ── SANSKRIT ──────────────────────────────────────────────────────────────
  ['Riya Iyer',         'riya.iyer',         '9876501009','TCH1009','Teacher',       'Sanskrit',  'SNK006|SNK007|SNK008',               28,5,'M.A. Sanskrit'],
  ['Vishnu Trivedi',    'vishnu.trivedi',    '9876501010','TCH1010','Teacher',       'Sanskrit',  'SNK009|SNK010',                      28,5,'M.A. Sanskrit'],
  ['Lakshmi Pandey',    'lakshmi.pandey',    '9876501011','TCH1011','Senior Teacher','Sanskrit',  'SNK011|SNK012',                      25,5,'M.A. Sanskrit'],
  // ── URDU ──────────────────────────────────────────────────────────────────
  ['Fatima Ansari',     'fatima.ansari',     '9876501012','TCH1012','Teacher',       'Urdu',      'URD006|URD007|URD008',               28,5,'M.A. Urdu'],
  ['Zara Khan',         'zara.khan',         '9876501013','TCH1013','Teacher',       'Urdu',      'URD009|URD010',                      28,5,'M.A. Urdu'],
  ['Ayesha Siddiqui',   'ayesha.siddiqui',   '9876501014','TCH1014','Senior Teacher','Urdu',      'URD011|URD012',                      25,5,'M.A. Urdu'],
  // ── PUNJABI ───────────────────────────────────────────────────────────────
  ['Seema Sharma',      'seema.sharma',      '9876501015','TCH1015','Teacher',       'Punjabi',   'PNJ006|PNJ007|PNJ008|PNJ009|PNJ010', 25,5,'M.A. Punjabi'],
  ['Harpreet Kaur',     'harpreet.kaur',     '9876501016','TCH1016','Teacher',       'Punjabi',   'PNJ011|PNJ012',                      25,5,'M.A. Punjabi'],
  // ── FRENCH ────────────────────────────────────────────────────────────────
  ['Neha Kapoor',       'neha.kapoor',       '9876501017','TCH1017','Teacher',       'French',    'FRE006|FRE007|FRE008|FRE009|FRE010', 25,5,'M.A. French'],
  ['Divya Malhotra',    'divya.malhotra',    '9876501018','TCH1018','Teacher',       'French',    'FRE011|FRE012',                      25,5,'M.A. French'],
  // ── GERMAN ────────────────────────────────────────────────────────────────
  ['Rahul Bose',        'rahul.bose',        '9876501019','TCH1019','Teacher',       'German',    'GER006|GER007|GER008|GER009|GER010', 25,5,'M.A. German'],
  ['Sonam Arora',       'sonam.arora',       '9876501020','TCH1020','Teacher',       'German',    'GER011|GER012',                      25,5,'M.A. German'],
  // ── MATHEMATICS ───────────────────────────────────────────────────────────
  ['Arjun Kumar',       'arjun.kumar',       '9876501021','TCH1021','Senior Teacher','Mathematics','MTH001|MTH002|MTH003|MTH004|MTH005',35,7,'M.Sc. Mathematics'],
  ['Vivek Agrawal',     'vivek.agrawal',     '9876501022','TCH1022','Teacher',       'Mathematics','MTH006|MTH007|MTH008',              35,7,'M.Sc. Mathematics'],
  ['Siddharth Reddy',   'siddharth.reddy',   '9876501023','TCH1023','Teacher',       'Mathematics','MTH009|MTH010|BMT009|BMT010',       35,7,'M.Sc. Mathematics'],
  ['Pooja Rao',         'pooja.rao',         '9876501024','TCH1024','Senior Teacher','Mathematics','MTH011|MTH012',                     32,6,'M.Sc. Mathematics'],
  // ── EVS + GK ──────────────────────────────────────────────────────────────
  ['Sakshi Nair',       'sakshi.nair',       '9876501025','TCH1025','Teacher',       'Science',   'EVS001|EVS002|EVS003|EVS004|EVS005', 30,6,'B.Sc. Environmental Science'],
  ['Manisha Menon',     'manisha.menon',     '9876501026','TCH1026','Teacher',       'General',   'GKE001|GKE002|GKE003|GKE004|GKE005|GKE006|GKE007|GKE008',30,6,'B.Ed.'],
  // ── SCIENCE ───────────────────────────────────────────────────────────────
  ['Kabir Desai',       'kabir.desai',       '9876501027','TCH1027','Teacher',       'Science',   'SCI006|SCI007|SCI008',               30,6,'M.Sc. Science'],
  ['Simran Jain',       'simran.jain',       '9876501028','TCH1028','Teacher',       'Science',   'SCI009|SCI010',                      30,6,'M.Sc. Biology'],
  // ── SOCIAL SCIENCE ────────────────────────────────────────────────────────
  ['Yash Bansal',       'yash.bansal',       '9876501029','TCH1029','Teacher',       'Social Science','SSC006|SSC007|SSC008',           28,5,'M.A. Social Science'],
  ['Ravi Garg',         'ravi.garg',         '9876501030','TCH1030','Teacher',       'Social Science','SSC009|SSC010',                  28,5,'M.A. Social Science'],
  // ── HISTORY ───────────────────────────────────────────────────────────────
  ['Deepika Saxena',    'deepika.saxena',    '9876501031','TCH1031','Senior Teacher','History',   'HIS009|HIS010|HIS011|HIS012',        28,5,'M.A. History'],
  // ── GEOGRAPHY ─────────────────────────────────────────────────────────────
  ['Nikhil Chaurasia',  'nikhil.chaurasia',  '9876501032','TCH1032','Teacher',       'Geography', 'GEO009|GEO010|GEO011|GEO012',        28,5,'M.A. Geography'],
  // ── POLITICAL SCIENCE ─────────────────────────────────────────────────────
  ['Poonam Dubey',      'poonam.dubey',      '9876501033','TCH1033','Teacher',       'Political Science','POL009|POL010|POL011|POL012', 28,5,'M.A. Political Science'],
  // ── ECONOMICS + CIVICS ─────────────────────────────────────��──────────────
  ['Gaurav Tiwari',     'gaurav.tiwari',     '9876501034','TCH1034','Senior Teacher','Economics', 'ECO009|ECO010|ECO011|ECO012',        28,5,'M.A. Economics'],
  ['Pallavi Dixit',     'pallavi.dixit',     '9876501035','TCH1035','Teacher',       'Social Science','CIV009|CIV010',                  28,5,'M.A. Political Science'],
  // ── COMPUTER / IT ─────────────────────────────────────────────────────────
  ['Akash Shah',        'akash.shah',        '9876501036','TCH1036','Teacher',       'Computer',  'CAP006|CAP007|CAP008',               28,5,'MCA'],
  ['Tanvi Sethi',       'tanvi.sethi',       '9876501037','TCH1037','Senior Teacher','Computer',  'AI0009|AI0010|AI0011|AI0012',         28,5,'M.Tech. AI'],
  ['Dhruv Khanna',      'dhruv.khanna',      '9876501038','TCH1038','Teacher',       'Computer',  'ITO009|ITO010|ITO011|ITO012',         28,5,'MCA'],
  ['Aditya Bhatia',     'aditya.bhatia',     '9876501039','TCH1039','Senior Teacher','Computer',  'CSC011|CSC012',                       28,5,'M.Tech. CS'],
  ['Komal Chopra',      'komal.chopra',      '9876501040','TCH1040','Teacher',       'Computer',  'IPR011|IPR012',                       28,5,'MCA'],
  // ── PHYSICS + CHEMISTRY + BIOLOGY ────────────────────────────────────────
  ['Harsh Anand',       'harsh.anand',       '9876501041','TCH1041','Senior Teacher','Physics',   'PHY011|PHY012',                       30,6,'M.Sc. Physics'],
  ['Geeta Bhatt',       'geeta.bhatt',       '9876501042','TCH1042','Senior Teacher','Chemistry', 'CHE011|CHE012',                       30,6,'M.Sc. Chemistry'],
  ['Ishaan Naik',       'ishaan.naik',       '9876501043','TCH1043','Senior Teacher','Biology',   'BIO011|BIO012',                       30,6,'M.Sc. Biology'],
  ['Vandana Patil',     'vandana.patil',     '9876501044','TCH1044','Teacher',       'Biology',   'BTN011|BTN012',                       28,5,'M.Sc. Biotechnology'],
  // ── COMMERCE ──────────────────────────────────────────────────────────────
  ['Om Kulkarni',       'om.kulkarni',       '9876501045','TCH1045','Senior Teacher','Commerce',  'ACT011|ACT012',                       28,5,'M.Com. Accountancy'],
  ['Swati Pawar',       'swati.pawar',       '9876501046','TCH1046','Teacher',       'Commerce',  'BST011|BST012',                       28,5,'M.B.A.'],
  ['Parth Deshmukh',    'parth.deshmukh',    '9876501047','TCH1047','Teacher',       'Commerce',  'ENT011|ENT012',                       25,5,'M.B.A.'],
  // ── HUMANITIES ────────────────────────────────────────────────────────────
  ['Namrata Thakur',    'namrata.thakur',    '9876501048','TCH1048','Teacher',       'Humanities','PSY011|PSY012',                       28,5,'M.A. Psychology'],
  ['Sneha Grewal',      'sneha.grewal',      '9876501049','TCH1049','Teacher',       'Humanities','SOC011|SOC012',                       28,5,'M.A. Sociology'],
  ['Palak Sandhu',      'palak.sandhu',      '9876501050','TCH1050','Teacher',       'Humanities','LST011|LST012',                       25,5,'LL.M.'],
  ['Mona Gill',         'mona.gill',         '9876501051','TCH1051','Teacher',       'Humanities','HSC011|HSC012',                       25,5,'M.Sc. Home Science'],
  // ── PE / YOGA / SPORTS ────────────────────────────────────────────────────
  ['Vikram Rajput',     'vikram.rajput',     '9876501052','TCH1052','PE Teacher',    'Sports',    'HPE001|HPE002|HPE003|HPE004|HPE005',  30,6,'B.P.Ed.'],
  ['Jatin Mehta',       'jatin.mehta',       '9876501053','TCH1053','Yoga Teacher',  'Sports',    'YOG006|YOG007|YOG008|YOG009|YOG010|YOG011|YOG012',28,5,'Yoga Acharya'],
  ['Tushar Singh',      'tushar.singh',      '9876501054','TCH1054','PE Teacher',    'Sports',    'PED011|PED012',                       28,5,'M.P.Ed.'],
  // ── ARTS ──────────────────────────────────────────────────────────────────
  ['Nandini Joshi',     'nandini.joshi',     '9876501055','TCH1055','Arts Teacher',  'Arts',      'FAR011|FAR012',                       25,5,'M.F.A.'],
  ['Shreya Kaur',       'shreya.kaur',       '9876501056','TCH1056','Music Teacher', 'Arts',      'MUS011|MUS012',                       25,5,'B.Mus.'],
  ['Pankaj Khatri',     'pankaj.khatri',     '9876501057','TCH1057','Dance Teacher', 'Arts',      'DAN011|DAN012',                       25,5,'B.A. Performing Arts'],
  ['Preeti Baghel',     'preeti.baghel',     '9876501058','TCH1058','Arts Teacher',  'Arts',      'PNT011|PNT012',                       25,5,'B.F.A.'],
  // ── WORK & VALUE EDUCATION ────────────────────────────────────────────────
  ['Sarika Soni',       'sarika.soni',       '9876501059','TCH1059','Teacher',       'Vocational','WED006|WED007|WED008|WED009|WED010',  28,5,'B.Ed.'],
  ['Hemant Chaurasia',  'hemant.chaurasia',  '9876501060','TCH1060','Teacher',       'Vocational','VED006|VED007|VED008|VED009|VED010',  28,5,'B.Ed. Value Education'],
];

const BANK_CODES = ['SBI','HDFC','ICICI','BOI','PNB'];
const IFSC_ROOTS = ['SBIN0030001','HDFC0009999','ICIC0001234','BKID0005678','PUNB0012345'];
const PAN_SUFFIX = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function panLike(i) {
  const letters = PAN_SUFFIX[i % 26] + PAN_SUFFIX[(i+3)%26] + PAN_SUFFIX[(i+7)%26];
  const nums = String(1000 + (i % 9000));
  const last = PAN_SUFFIX[(i+11)%26];
  return `${letters}P${nums}${last}`;
}

const staffRows = [HEADER];
TEACHERS.forEach(([fullName, emailLocal, ph, empNo, designation, dept, subjects, maxW, maxD, qual], i) => {
  const email = `${emailLocal}@paramountkasrawad.edu`;
  const bankIdx = i % BANK_CODES.length;
  const bank = BANK_CODES[bankIdx];
  const ifsc = IFSC_ROOTS[bankIdx];
  const account = `${(i+1)*100000000000 + 10001000}`;
  const pan = panLike(i+1);
  const addrNum = 10 + i * 2;
  const address = `${addrNum} School Colony Kasrawad`;
  const ecName = `${GUARDIAN_NAMES_FIRST[i % GUARDIAN_NAMES_FIRST.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`;
  const ecPhone = `98765${pad(i+100, 5)}`;
  const ecRel = ['Spouse','Father','Mother','Sibling'][i%4];
  const prevInst = ['Kendriya Vidyalaya Barwani','Govt. HS Kasrawad','Navodaya Vidyalaya','Delhi Public School','St. Mary School'][i%5];
  staffRows.push(
    `${fullName},${email},${ph},${empNo},${designation},TEACHING,${dept},FULL_TIME,2024-06-01,TEACHER,${subjects},${maxW},${maxD},true,true,"${address}",${ecName},${ecPhone},${ecRel},${qual},${prevInst},${bank},${account},${ifsc},${pan},true`
  );
});

const staffCsvPath = join(OUT, 'staff-template.csv');
writeFileSync(staffCsvPath, staffRows.join('\n'), 'utf8');
console.log(`✓ staff-template.csv — ${TEACHERS.length} teachers`);
console.log('Done.');

