// Authentication Logic: Email/Password, Student ID, Phone OTP, Google Auth
import { 
  auth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  updateProfile, 
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber 
} from './firebase-init.js';
import { 
  saveUserProfile, 
  fetchUserProfile, 
  getLocalUserProfile, 
  getLocalStudents, 
  saveStudentRecord,
  saveLocalUserProfile 
} from './db.js';

let phoneConfirmationResult = null;
let recaptchaVerifierInstance = null;

// Helper to check whether a student profile is complete
export function isProfileComplete(profile) {
  if (!profile) return false;
  // If explicitly flagged as complete
  if (profile.profileCompleted === true) return true;
  
  // Mandatory fields for student portal access
  const hasId = Boolean(profile.studentId && profile.studentId.trim());
  const hasName = Boolean(profile.name && profile.name.trim());
  const hasCollege = Boolean(profile.college && profile.college.trim());
  const hasCourse = Boolean(profile.course && profile.course.trim());
  const hasSemester = Boolean(profile.semester && profile.semester.trim());
  const hasContact = Boolean(profile.contact || profile.phone);
  const hasFaq = Boolean(profile.faqQuestion && profile.faqAnswer);

  return hasId && hasName && hasCollege && hasCourse && hasSemester && hasContact && hasFaq;
}

// Initialize Recaptcha for Phone Authentication
export function initPhoneRecaptcha(buttonId = 'btn-send-phone-otp') {
  if (recaptchaVerifierInstance) {
    try {
      recaptchaVerifierInstance.clear();
    } catch (e) {}
  }
  try {
    recaptchaVerifierInstance = new RecaptchaVerifier(auth, buttonId, {
      'size': 'invisible',
      'callback': () => {
        // reCAPTCHA solved
      }
    });
  } catch (err) {
    console.warn("Recaptcha initialization notice:", err.message);
  }
}

// 1. SIGN IN with Email/Password OR Student ID + Password
export async function loginWithEmailOrStudentId(identifier, password) {
  const cleanId = identifier.trim();
  let emailToUse = cleanId;

  // Check if identifier is not an email (i.e. is a Student ID or Roll Number)
  if (!cleanId.includes('@')) {
    const students = getLocalStudents();
    const match = students.find(s => s.studentId.toLowerCase() === cleanId.toLowerCase());
    if (match && match.email) {
      emailToUse = match.email;
    } else {
      // Check user profile stored locally
      const localProfile = getLocalUserProfile();
      if (localProfile && localProfile.studentId && localProfile.studentId.toLowerCase() === cleanId.toLowerCase() && localProfile.email) {
        emailToUse = localProfile.email;
      } else {
        // Synthesize institutional fallback email or prompt
        throw new Error(`Student ID "${cleanId}" not found in active academic registry. Please enter your registered email address.`);
      }
    }
  }

  const credential = await signInWithEmailAndPassword(auth, emailToUse, password);
  const profile = await fetchUserProfile(credential.user.uid);
  return { user: credential.user, profile };
}

// 2. SIGN UP with Complete Student Registration Form
export async function registerStudentWithEmailPassword(formData) {
  const {
    studentId,
    name,
    college,
    course,
    semester,
    email,
    contact,
    faqQuestion,
    faqAnswer,
    password
  } = formData;

  // Create Auth user in Firebase
  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;

  // Update display name
  await updateProfile(user, { displayName: name });

  // Build complete institutional profile
  const profileData = {
    uid: user.uid,
    studentId: studentId.trim(),
    name: name.trim(),
    college: college.trim(),
    course: course.trim(),
    semester: semester.trim(),
    email: email.trim().toLowerCase(),
    contact: contact.trim(),
    faqQuestion: faqQuestion.trim(),
    faqAnswer: faqAnswer.trim().toLowerCase(),
    profileCompleted: true,
    authProvider: "password",
    createdAt: new Date().toISOString()
  };

  await saveUserProfile(user.uid, profileData);
  await saveStudentRecord({
    studentId: profileData.studentId,
    name: profileData.name,
    college: profileData.college,
    course: profileData.course,
    section: formData.section || "A",
    semester: profileData.semester,
    email: profileData.email,
    contact: profileData.contact,
    gender: formData.gender || "Not Specified",
    fatherName: formData.fatherName || "—",
    dob: formData.dob || "",
    address: formData.address || "",
    status: "Active"
  });

  return { user, profile: profileData };
}

// 3. SIGN IN / UP with Google
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  // Fetch existing profile or create initial placeholder
  let profile = await fetchUserProfile(user.uid);
  if (!profile) {
    profile = {
      uid: user.uid,
      name: user.displayName || "Student",
      email: user.email,
      photoURL: user.photoURL,
      studentId: "",
      college: "",
      course: "",
      semester: "",
      contact: "",
      faqQuestion: "",
      faqAnswer: "",
      profileCompleted: false, // Disables other tabs until completed
      authProvider: "google",
      createdAt: new Date().toISOString()
    };
    await saveUserProfile(user.uid, profile);
  } else {
    // Check completion status
    profile.profileCompleted = isProfileComplete(profile);
    saveLocalUserProfile(profile);
  }

  return { user, profile };
}

// 4. PHONE NUMBER AUTHENTICATION
export async function sendPhoneVerificationCode(phoneNumber) {
  if (!recaptchaVerifierInstance) {
    initPhoneRecaptcha();
  }
  const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifierInstance);
  phoneConfirmationResult = confirmationResult;
  return confirmationResult;
}

export async function confirmPhoneVerificationCode(otp) {
  if (!phoneConfirmationResult) {
    throw new Error("No active verification request. Please request a new verification code.");
  }
  const result = await phoneConfirmationResult.confirm(otp);
  const user = result.user;
  let profile = await fetchUserProfile(user.uid);
  if (!profile) {
    profile = {
      uid: user.uid,
      name: "Student",
      email: "",
      contact: user.phoneNumber,
      studentId: "",
      college: "",
      course: "",
      semester: "",
      faqQuestion: "",
      faqAnswer: "",
      profileCompleted: false,
      authProvider: "phone",
      createdAt: new Date().toISOString()
    };
    await saveUserProfile(user.uid, profile);
  }
  return { user, profile };
}

// 5. FORGOT PASSWORD
export async function resetPasswordViaEmail(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function verifyStudentFaq(studentId, faqAnswer) {
  const students = getLocalStudents();
  const profile = getLocalUserProfile();

  let targetEmail = null;
  let storedAnswer = null;

  if (profile && profile.studentId && profile.studentId.toLowerCase() === studentId.trim().toLowerCase()) {
    targetEmail = profile.email;
    storedAnswer = profile.faqAnswer;
  }

  if (!targetEmail) {
    const student = students.find(s => s.studentId.toLowerCase() === studentId.trim().toLowerCase());
    if (student) {
      targetEmail = student.email;
    }
  }

  if (!targetEmail) {
    throw new Error("No student record found with Student ID: " + studentId);
  }

  if (storedAnswer && storedAnswer.toLowerCase() !== faqAnswer.trim().toLowerCase()) {
    throw new Error("Security verification answer did not match student institutional records.");
  }

  // Trigger official reset email
  await sendPasswordResetEmail(auth, targetEmail);
  return targetEmail;
}

// 6. SIGN OUT
export async function logoutStudent() {
  await signOut(auth);
}

// 7. AUTH STATE LISTENER
export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const profile = await fetchUserProfile(user.uid);
      callback(user, profile);
    } else {
      callback(null, null);
    }
  });
}
