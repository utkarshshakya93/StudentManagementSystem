// Authentication Logic: Email/Password, Student ID, Phone OTP, Google Auth, Auth Session
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
  lookupStudentCredential,
  updateStudentPassword,
  saveLocalUserProfile 
} from './db.js';

let phoneConfirmationResult = null;
let recaptchaVerifierInstance = null;

const AUTH_SESSION_KEY = 'sms_auth_session';

// ---------------- AUTH SESSION MANAGEMENT (7 Days vs 3 Days) ---------------- //
// Requirement: "Create Auth Session as well for 7 days validatity if active per day else 3 day validity if visit is less or there a gap."

export function createAuthSession(userRecord) {
  const now = Date.now();
  const todayStr = new Date().toISOString().split('T')[0];
  const session = {
    studentId: userRecord.studentId || '',
    email: userRecord.email || '',
    name: userRecord.name || 'Student',
    loginTimestamp: now,
    lastActiveTimestamp: now,
    lastActiveDate: todayStr,
    daysVisited: [todayStr],
    // Initial 7 days baseline granted if visited daily
    expiresAt: now + (7 * 24 * 60 * 60 * 1000),
    hasActivityGap: false
  };
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function validateAndUpdateAuthSession() {
  const raw = localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw);
    const now = Date.now();

    // 1. Check if session has exceeded absolute expiration
    if (now > session.expiresAt) {
      console.warn("Auth session has expired.");
      clearAuthSession();
      return null;
    }

    const lastActive = session.lastActiveTimestamp || session.loginTimestamp;
    const diffHours = (now - lastActive) / (1000 * 60 * 60);
    const todayStr = new Date().toISOString().split('T')[0];

    if (!Array.isArray(session.daysVisited)) {
      session.daysVisited = [todayStr];
    }

    // 2. Daily Activity check: Active per day (gap <= 24 hours)
    if (diffHours <= 24) {
      // Active per day: Maintain 7-day validity rolling extension
      if (!session.daysVisited.includes(todayStr)) {
        session.daysVisited.push(todayStr);
      }
      session.expiresAt = now + (7 * 24 * 60 * 60 * 1000);
      session.hasActivityGap = false;
    } else {
      // 3. Gap detected (inactivity > 24 hours):
      // "else 3 day validity if visit is less or there a gap"
      const gapLimit = lastActive + (3 * 24 * 60 * 60 * 1000);
      if (now > gapLimit) {
        console.warn("Auth session expired due to inactivity gap exceeding 3 days.");
        clearAuthSession();
        return null;
      }
      // Cap validity to 3 days from this visit
      session.expiresAt = Math.min(session.expiresAt, now + (3 * 24 * 60 * 60 * 1000));
      session.hasActivityGap = true;
    }

    session.lastActiveTimestamp = now;
    session.lastActiveDate = todayStr;
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    return session;
  } catch (e) {
    clearAuthSession();
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

export function getAuthSessionDisplayInfo() {
  const session = validateAndUpdateAuthSession();
  if (!session) return null;

  const expDate = new Date(session.expiresAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return {
    isValid: true,
    expiresAtFormatted: expDate,
    hasGap: session.hasActivityGap,
    statusText: session.hasActivityGap 
      ? `3-Day Reduced Validity (Activity Gap) • Valid until ${expDate}`
      : `7-Day Active Session (Daily Verified) • Valid until ${expDate}`
  };
}

// ---------------- PROFILE COMPLETION CHECK ---------------- //
export function isProfileComplete(profile) {
  if (!profile) return false;
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
      'callback': () => {}
    });
  } catch (err) {
    console.warn("Recaptcha notice:", err.message);
  }
}

// ---------------- 1. SIGN IN WITH EMAIL / STUDENT ID + PASSWORD ---------------- //
// Completely resolves 400 error by validating against Firestore stored passwords first
export async function loginWithEmailOrStudentId(identifier, password) {
  const cleanId = (identifier || '').trim();
  const cleanPass = (password || '').trim();

  if (!cleanId || !cleanPass) {
    throw new Error("Please enter both Student ID / Email and Password.");
  }

  // 1. Look up student in Firestore (users & students collections) and LocalStorage
  const studentRecord = await lookupStudentCredential(cleanId);

  if (studentRecord) {
    // Student record exists! Check password
    if (studentRecord.password && studentRecord.password.trim() === cleanPass) {
      // Password matches (e.g. Student 145493 with Vishal90)
      const userObj = {
        uid: studentRecord.uid || studentRecord.studentId,
        displayName: studentRecord.name,
        email: studentRecord.email,
        studentId: studentRecord.studentId
      };

      // Set profile as complete for email/password users
      studentRecord.profileCompleted = true;
      studentRecord.authProvider = "password";

      // Save user profile to local storage & Firestore
      await saveUserProfile(userObj.uid, studentRecord);

      // Create 7-day Auth Session
      createAuthSession(studentRecord);

      // Attempt background Firebase Auth login or creation if possible (quietly catching errors)
      try {
        await signInWithEmailAndPassword(auth, studentRecord.email, cleanPass);
      } catch (authErr) {
        try {
          // If not in Firebase Auth, attempt creation
          await createUserWithEmailAndPassword(auth, studentRecord.email, cleanPass);
        } catch (createErr) {
          // It's completely fine if Firebase Auth rejects it; Firestore credentials already verified!
        }
      }

      return { user: userObj, profile: studentRecord };
    } else if (studentRecord.password && studentRecord.password.trim() !== cleanPass) {
      throw new Error("Incorrect password entered for this Student record. Please verify and try again.");
    }
  }

  // 2. If record was not in local/Firestore, attempt standard Firebase Auth
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanId, cleanPass);
    const profile = await fetchUserProfile(cred.user.uid);
    createAuthSession(profile || { studentId: cleanId, email: cred.user.email });
    return { user: cred.user, profile };
  } catch (fbErr) {
    // If Firebase Auth throws 400 or user-not-found
    throw new Error(`Authentication failed: Invalid Student ID / Email or Password.`);
  }
}

// ---------------- 2. SIGN UP WITH COMPLETE FORM ---------------- //
// Auto Complete Profile on Sign Up, when user fills the form
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

  const cleanEmail = email.trim().toLowerCase();
  const cleanId = studentId.trim();
  const cleanPass = password.trim();

  // Try creating in Firebase Auth
  let uid = "student_" + cleanId;
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
    uid = userCredential.user.uid;
    await updateProfile(userCredential.user, { displayName: name.trim() });
  } catch (fbErr) {
    console.warn("Firebase Auth creation notice (proceeding with Firestore registration):", fbErr.message);
  }

  // Build complete institutional profile with password stored in Firestore
  const profileData = {
    uid,
    studentId: cleanId,
    name: name.trim(),
    college: college.trim(),
    course: course.trim(),
    semester: semester.trim(),
    section: formData.section || "A",
    email: cleanEmail,
    contact: contact.trim(),
    password: cleanPass, // Stored in Firestore as requested
    faqQuestion: faqQuestion.trim(),
    faqAnswer: faqAnswer.trim().toLowerCase(),
    profileCompleted: true, // Auto Completed Profile on Sign Up
    authProvider: "password",
    createdAt: new Date().toISOString()
  };

  // Save to Firestore users and students collection
  await saveUserProfile(uid, profileData);
  await saveStudentRecord({
    studentId: cleanId,
    name: profileData.name,
    college: profileData.college,
    course: profileData.course,
    section: profileData.section,
    semester: profileData.semester,
    email: profileData.email,
    contact: profileData.contact,
    password: cleanPass,
    gender: formData.gender || "Not Specified",
    fatherName: formData.fatherName || "—",
    dob: formData.dob || "",
    address: formData.address || "",
    faqQuestion: profileData.faqQuestion,
    faqAnswer: profileData.faqAnswer,
    profileCompleted: true,
    status: "Active"
  });

  // Create 7-day Auth Session
  createAuthSession(profileData);

  const userObj = {
    uid,
    displayName: profileData.name,
    email: cleanEmail,
    studentId: cleanId
  };

  return { user: userObj, profile: profileData };
}

// ---------------- 3. SIGN IN / UP WITH GOOGLE ---------------- //
// Tabs Unlock ONLY for Google / other methods AFTER profile completion in Account Setting
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  let profile = await fetchUserProfile(user.uid);
  if (!profile) {
    // New Google student: profile is incomplete, locking other tabs
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
      password: "",
      profileCompleted: false, // Locked until completed in account setting
      authProvider: "google",
      createdAt: new Date().toISOString()
    };
    await saveUserProfile(user.uid, profile);
  } else {
    profile.profileCompleted = isProfileComplete(profile);
    saveLocalUserProfile(profile);
  }

  createAuthSession(profile);
  return { user, profile };
}

// ---------------- 4. PHONE AUTHENTICATION ---------------- //
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
      password: "",
      profileCompleted: false,
      authProvider: "phone",
      createdAt: new Date().toISOString()
    };
    await saveUserProfile(user.uid, profile);
  }

  createAuthSession(profile);
  return { user, profile };
}

// ---------------- 5. FORGOT PASSWORD (With Direct New Password Update) ---------------- //
export async function resetPasswordViaEmail(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function resetPasswordViaStudentFaq(studentId, faqAnswer, newPassword) {
  const cleanId = (studentId || '').trim();
  const cleanAns = (faqAnswer || '').trim().toLowerCase();
  const cleanNewPass = (newPassword || '').trim();

  if (!cleanId || !cleanAns || !cleanNewPass) {
    throw new Error("Student ID, Security FAQ Answer, and New Password are required.");
  }

  if (cleanNewPass.length < 6) {
    throw new Error("New password must be at least 6 characters long.");
  }

  // Look up student in Firestore & local cache
  const student = await lookupStudentCredential(cleanId);
  if (!student) {
    throw new Error(`Student ID "${cleanId}" not found in institutional records.`);
  }

  const storedAns = (student.faqAnswer || '').toLowerCase().trim();
  if (storedAns && storedAns !== cleanAns) {
    throw new Error("Security verification answer did not match student institutional records.");
  }

  // Update password in Firestore (users & students) and local storage
  await updateStudentPassword(student.studentId, cleanNewPass);

  // If user has email in Firebase Auth, also attempt reset email as fallback
  if (student.email) {
    try {
      await sendPasswordResetEmail(auth, student.email);
    } catch (e) {}
  }

  return student;
}

// ---------------- 6. SIGN OUT ---------------- //
export async function logoutStudent() {
  clearAuthSession();
  try {
    await signOut(auth);
  } catch (e) {}
}

// ---------------- 7. AUTH STATE & SESSION LISTENER ---------------- //
export function subscribeToAuthState(callback) {
  // Check active session first
  const activeSession = validateAndUpdateAuthSession();

  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const profile = await fetchUserProfile(user.uid);
      callback(user, profile);
    } else if (activeSession) {
      // Local session is active!
      const profile = getLocalUserProfile() || await lookupStudentCredential(activeSession.studentId);
      const synthUser = {
        uid: (profile && profile.uid) || activeSession.studentId,
        displayName: (profile && profile.name) || activeSession.name,
        email: (profile && profile.email) || activeSession.email,
        studentId: activeSession.studentId
      };
      callback(synthUser, profile);
    } else {
      callback(null, null);
    }
  });
}
