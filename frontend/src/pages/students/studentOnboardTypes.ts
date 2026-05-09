export const ONBOARDING_DRAFT_KEY = 'sms-student-manual-onboard-v1';
export const DRAFT_SCHEMA_VERSION = 1 as const;

export type AdmissionCategory = 'NEW_ADMISSION' | 'PROMOTED' | 'TRANSFER_IN' | 'READMISSION';

export type GuardianDraft = {
  name: string;
  relation: string;
  phone: string;
  email: string;
  occupation: string;
  primaryGuardian: boolean;
  canLogin: boolean;
  receivesNotifications: boolean;
};

export type ResidenceDraft = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
};

export type MedicalDraft = {
  allergies: string;
  medicalConditions: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  doctorContact: string;
  medicationNotes: string;
};

export type StudentOnboardingDraft = {
  version: typeof DRAFT_SCHEMA_VERSION;
  stepIndex: number;
  completedSteps: number[];
  student: {
    admissionNo: string;
    firstName: string;
    middleName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    bloodGroup: string;
    photoPlaceholderNote: string;
  };
  enrollment: {
    academicYearId: string;
    gradeLevel: string;
    section: string;
    classGroupId: string;
    rollNo: string;
    admissionDate: string;
    joiningDate: string;
    admissionCategory: string;
  };
  guardians: GuardianDraft[];
  residence: ResidenceDraft;
  medical: MedicalDraft;
};

export const ADMISSION_CATEGORY_OPTIONS: { value: AdmissionCategory; label: string }[] = [
  { value: 'NEW_ADMISSION', label: 'New admission' },
  { value: 'PROMOTED', label: 'Promoted' },
  { value: 'TRANSFER_IN', label: 'Transfer in' },
  { value: 'READMISSION', label: 'Readmission' },
];

export const STEP_DEF = [
  { id: 'details', title: 'Student details' },
  { id: 'academic', title: 'Academic placement' },
  { id: 'guardian', title: 'Guardian details' },
  { id: 'address_medical', title: 'Address & medical' },
  { id: 'documents', title: 'Documents' },
  { id: 'accounts', title: 'Account setup' },
  { id: 'review', title: 'Review & submit' },
] as const;

export function emptyGuardian(primary: boolean): GuardianDraft {
  return {
    name: '',
    relation: 'Parent',
    phone: '',
    email: '',
    occupation: '',
    primaryGuardian: primary,
    canLogin: false,
    receivesNotifications: true,
  };
}

export function defaultDraft(): StudentOnboardingDraft {
  return {
    version: DRAFT_SCHEMA_VERSION,
    stepIndex: 0,
    completedSteps: [],
    student: {
      admissionNo: '',
      firstName: '',
      middleName: '',
      lastName: '',
      dateOfBirth: '',
      gender: '',
      bloodGroup: '',
      photoPlaceholderNote: '',
    },
    enrollment: {
      academicYearId: '',
      gradeLevel: '',
      section: '',
      classGroupId: '',
      rollNo: '',
      admissionDate: '',
      joiningDate: '',
      admissionCategory: '',
    },
    guardians: [emptyGuardian(true)],
    residence: {
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      pincode: '',
    },
    medical: {
      allergies: '',
      medicalConditions: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      doctorContact: '',
      medicationNotes: '',
    },
  };
}
