import type { AdmissionCategory, StudentOnboardingDraft } from './studentOnboardTypes';

function guardianAddressFromResidence(d: StudentOnboardingDraft) {
  const r = d.residence;
  return {
    addressLine1: r.addressLine1.trim() || null,
    addressLine2: r.addressLine2.trim() || null,
    city: r.city.trim() || null,
    state: r.state.trim() || null,
    pincode: r.pincode.trim() || null,
  };
}

function medicalPayload(d: StudentOnboardingDraft) {
  const m = d.medical;
  const allergens = String(m.allergies ?? '').trim();
  const conds = String(m.medicalConditions ?? '').trim();
  const emName = String(m.emergencyContactName ?? '').trim();
  const emPhone = String(m.emergencyContactPhone ?? '').trim();
  const doctor = String(m.doctorContact ?? '').trim();
  const meds = String(m.medicationNotes ?? '').trim();
  if (!(allergens || conds || emName || emPhone || doctor || meds)) return undefined;
  return {
    allergies: allergens || null,
    medicalConditions: conds || null,
    emergencyContactName: emName || null,
    emergencyContactPhone: emPhone || null,
    doctorContact: doctor || null,
    medicationNotes: meds || null,
  };
}

export function buildStudentOnboardPayload(d: StudentOnboardingDraft) {
  const { student, enrollment } = d;
  const ayId = Number(enrollment.academicYearId);
  const cgId = Number(enrollment.classGroupId);
  const addr = guardianAddressFromResidence(d);

  const primaryAddr =
    addr.addressLine1 || addr.addressLine2 || addr.city || addr.state || addr.pincode ? addr : null;

  const guardians = d.guardians.map((g) => ({
    name: g.name.trim(),
    relation: g.relation.trim(),
    phone: g.phone.trim(),
    email: g.email.trim() ? g.email.trim() : null,
    occupation: g.occupation.trim() ? g.occupation.trim() : null,
    primaryGuardian: g.primaryGuardian,
    canLogin: g.canLogin,
    receivesNotifications: g.receivesNotifications,
    ...(g.primaryGuardian && primaryAddr ?
      {
        addressLine1: primaryAddr.addressLine1,
        addressLine2: primaryAddr.addressLine2,
        city: primaryAddr.city,
        state: primaryAddr.state,
        pincode: primaryAddr.pincode,
      }
    : {}),
  }));

  const med = medicalPayload(d);

  const payload: Record<string, unknown> = {
    core: {
      admissionNo: student.admissionNo.trim(),
      firstName: student.firstName.trim(),
      middleName: student.middleName.trim() || null,
      lastName: student.lastName.trim() || null,
      dateOfBirth: student.dateOfBirth.trim() || null,
      gender: student.gender.trim() || null,
      bloodGroup: student.bloodGroup.trim() || null,
      photoUrl: null,
      addressLine1: d.residence.addressLine1.trim() || null,
      addressLine2: d.residence.addressLine2.trim() || null,
      city: d.residence.city.trim() || null,
      state: d.residence.state.trim() || null,
      pincode: d.residence.pincode.trim() || null,
    },
    enrollment: {
      ...(Number.isFinite(ayId) && ayId > 0 ? { academicYearId: ayId } : {}),
      classGroupId: cgId,
      rollNo: enrollment.rollNo.trim() || null,
      admissionDate: enrollment.admissionDate.trim() || null,
      joiningDate: enrollment.joiningDate.trim() || null,
      ...(enrollment.admissionCategory.trim() ?
        { admissionCategory: enrollment.admissionCategory as AdmissionCategory }
      : {}),
    },
    guardians,
  };

  if (med) payload.medical = med;

  return payload;
}
