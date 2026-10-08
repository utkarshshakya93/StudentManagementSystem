// Single Unified Database & Storage Layer (Cloud Firestore 'users' collection)
// All student records ARE user records - No redundant collections, No dummy data

import { 
  db, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  query,
  where,
  serverTimestamp 
} from './firebase-init.js';
import { secureSaltPassword } from './crypto.js';

// Pre-configured official student record for 145493 with salted password (Vishal90)
const SEED_STUDENT_145493 = {
  docId: "CvxwfGsZG9cjggBEk6c7Rx120x12",
  uid: "CvxwfGsZG9cjggBEk6c7Rx120x12",
  studentId: "145493",
  name: "Utkarsh Shakya",
  fatherName: "Brajesh Kumar",
  dob: "2007-07-12",
  gender: "Male",
  contact: "8299254889",
  section: "A",
  email: "utkarshshakya61@gmail.com",
  alternateEmail: "utkarshshakya125@gmail.com",
  college: "DPG College",
  course: "BCA-5A",
  semester: "Semester 5",
  address: "kampil(farrukhabad)",
  faqQuestion: "What was the name of your childhood mentor or favorite teacher?",
  faqAnswer: "vishal",
  status: "Active",
  profileCompleted: true,
  authProvider: "password",
  // Salted cryptographic hash & AES-GCM cipher for password 'Vishal90'
  salt: "03947afb6589e1302a4a7e607fa43d68",
  passwordHash: "9b5f807e23f67bdca342b7ebcc2faea87f619db93acbf90fb76d4edc039ac5f1",
  passwordCipher: "61566d465e9d73b814a5e3073edde565b30aeca573b03c61",
  iv: "5ce61c7877f1f635962ea131"
};

const STORAGE_KEYS = {
  USERS: "sms_academic_users",
  CURRENT_USER: "sms_current_user_profile",
  TASKS: "sms_daily_tasks",
  AUTH_SESSION: "sms_auth_session"
};

// ---------------- UNIFIED USER / STUDENT OPERATIONS (Collection: 'users') ---------------- //

export function getLocalUsers() {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!data) {
    // Only student 145493, absolutely NO dummy data
    const list = [SEED_STUDENT_145493];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(list));
    return list;
  }
  try {
    const list = JSON.parse(data);
    return list.filter(u => u && u.studentId);
  } catch (e) {
    return [SEED_STUDENT_145493];
  }
}

export function saveLocalUsers(users) {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

export function getLocalUserProfile() {
  const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function saveLocalUserProfile(profile) {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(profile));
}

/**
 * Fetch all students from the single 'users' collection
 * Does NOT push any dummy data to Firestore
 */
export async function fetchAllUsers() {
  try {
    const colRef = collection(db, "users");
    const snapshot = await getDocs(colRef);
    if (!snapshot.empty) {
      const remoteUsers = [];
      snapshot.forEach(docSnap => {
        remoteUsers.push({ docId: docSnap.id, ...docSnap.data() });
      });
      saveLocalUsers(remoteUsers);
      return remoteUsers;
    }
  } catch (error) {
    console.warn("Firestore fetch users notice (using local):", error.message);
  }
  return getLocalUsers();
}

/**
 * Single, unified save to Firestore 'users' collection.
 * Creates EXACTLY ONE document per user (using docId).
 * Plain password is NEVER saved to Firestore; only salt, hash, and cipher.
 */
export async function saveUserRecord(docId, userData) {
  const users = getLocalUsers();
  const cleanEmail = (userData.email || '').trim().toLowerCase();
  const cleanStudentId = (userData.studentId || '').trim();

  // Find existing record by docId, uid, studentId, email, or alternateEmail
  const existingIdx = users.findIndex(u => 
    (docId && (u.docId === docId || u.uid === docId)) ||
    (userData.uid && (u.uid === userData.uid || u.docId === userData.uid)) ||
    (cleanStudentId && u.studentId && u.studentId.trim() === cleanStudentId) ||
    (cleanEmail && u.email && u.email.trim().toLowerCase() === cleanEmail) ||
    (cleanEmail && u.alternateEmail && u.alternateEmail.trim().toLowerCase() === cleanEmail)
  );

  let targetDocId = docId;
  // If an existing record already has a distinct UID/docId, preserve that document ID to prevent duplicate docs!
  if (existingIdx >= 0 && users[existingIdx].docId) {
    targetDocId = users[existingIdx].docId;
  }
  if (!targetDocId) {
    targetDocId = userData.uid || userData.docId || userData.studentId || ("user_" + Date.now());
  }
  targetDocId = targetDocId.trim();

  // Clean data: Remove any plain text password from being stored in Firestore
  const cleanData = { ...userData };
  delete cleanData.password;
  delete cleanData.confirmPassword;

  cleanData.docId = targetDocId;
  cleanData.uid = cleanData.uid || targetDocId;

  // 1. Update local cache
  if (existingIdx >= 0) {
    users[existingIdx] = { ...users[existingIdx], ...cleanData };
  } else {
    users.unshift(cleanData);
  }
  saveLocalUsers(users);

  // Update current user profile if it matches
  const current = getLocalUserProfile();
  if (current && (current.docId === targetDocId || current.studentId === cleanData.studentId || current.uid === targetDocId)) {
    saveLocalUserProfile({ ...current, ...cleanData });
  }

  // 2. Save EXACTLY ONE document in Firestore 'users'
  try {
    const docRef = doc(db, "users", targetDocId);
    await setDoc(docRef, {
      ...cleanData,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn("Firestore save user warning:", error.message);
  }

  return cleanData;
}

/**
 * Delete a user document from Firestore 'users' collection
 */
export async function deleteUserRecord(identifier) {
  const cleanId = (identifier || '').trim();
  const users = getLocalUsers();
  const match = users.find(u => u.docId === cleanId || u.uid === cleanId || u.studentId === cleanId);
  const targetDocId = (match && match.docId) || cleanId;

  const filtered = users.filter(u => u.docId !== targetDocId && u.studentId !== cleanId);
  saveLocalUsers(filtered);

  try {
    const docRef = doc(db, "users", targetDocId);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn("Firestore delete user warning:", error.message);
  }

  return filtered;
}

/**
 * Lookup user document in 'users' collection by Student ID or Email
 */
export async function lookupUserByStudentIdOrEmail(identifier) {
  const clean = (identifier || '').trim().toLowerCase();
  if (!clean) return null;

  // 1. Check local cache
  const localList = getLocalUsers();
  const localMatch = localList.find(u => 
    (u.studentId && u.studentId.trim().toLowerCase() === clean) ||
    (u.email && u.email.trim().toLowerCase() === clean) ||
    (u.alternateEmail && u.alternateEmail.trim().toLowerCase() === clean) ||
    (u.docId && u.docId.trim().toLowerCase() === clean) ||
    (u.uid && u.uid.trim().toLowerCase() === clean)
  );
  if (localMatch) {
    return localMatch;
  }

  // 2. Direct document get by ID
  try {
    const docRef = doc(db, "users", identifier.trim());
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { docId: snap.id, ...snap.data() };
    }
  } catch (e) {}

  // 3. Query Firestore 'users' where studentId == identifier
  try {
    const colRef = collection(db, "users");
    const q1 = query(colRef, where("studentId", "==", identifier.trim()));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      return { docId: snap1.docs[0].id, ...snap1.docs[0].data() };
    }
  } catch (e) {}

  // 4. Query Firestore 'users' where email == identifier
  try {
    const colRef = collection(db, "users");
    const q2 = query(colRef, where("email", "==", identifier.trim().toLowerCase()));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) {
      return { docId: snap2.docs[0].id, ...snap2.docs[0].data() };
    }
  } catch (e) {}

  // 5. Query Firestore 'users' where alternateEmail == identifier
  try {
    const colRef = collection(db, "users");
    const q3 = query(colRef, where("alternateEmail", "==", identifier.trim().toLowerCase()));
    const snap3 = await getDocs(q3);
    if (!snap3.empty) {
      return { docId: snap3.docs[0].id, ...snap3.docs[0].data() };
    }
  } catch (e) {}

  return null;
}

/**
 * Update password with salt, SHA-256 hash, and AES-GCM cipher in single 'users' document
 */
export async function updateUserSaltedPassword(docId, newPassword) {
  if (!docId || !newPassword) return false;

  const cryptoData = await secureSaltPassword(newPassword);

  const users = getLocalUsers();
  const match = users.find(u => u.docId === docId || u.studentId === docId || (u.uid && u.uid === docId));
  const targetDocId = (match && match.docId) || docId;

  // Update in local cache
  if (match) {
    match.salt = cryptoData.salt;
    match.passwordHash = cryptoData.passwordHash;
    match.passwordCipher = cryptoData.passwordCipher;
    match.iv = cryptoData.iv;
    delete match.password;
    saveLocalUsers(users);
  }

  const current = getLocalUserProfile();
  if (current && (current.docId === targetDocId || current.studentId === targetDocId || current.docId === docId)) {
    current.salt = cryptoData.salt;
    current.passwordHash = cryptoData.passwordHash;
    current.passwordCipher = cryptoData.passwordCipher;
    current.iv = cryptoData.iv;
    delete current.password;
    saveLocalUserProfile(current);
  }

  // Update in Firestore 'users' collection (merging with single target document)
  try {
    const docRef = doc(db, "users", targetDocId);
    await setDoc(docRef, {
      salt: cryptoData.salt,
      passwordHash: cryptoData.passwordHash,
      passwordCipher: cryptoData.passwordCipher,
      iv: cryptoData.iv,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (e) {
    console.warn("Firestore password update warning:", e.message);
    return false;
  }
}

// ---------------- DAILY DIARY & TASK OPERATIONS ---------------- //

export function getLocalTasks() {
  const data = localStorage.getItem(STORAGE_KEYS.TASKS);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function saveLocalTasks(tasks) {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
}

export async function fetchAllTasks() {
  try {
    const colRef = collection(db, "daily_tasks");
    const snapshot = await getDocs(colRef);
    if (!snapshot.empty) {
      const remoteTasks = [];
      snapshot.forEach(docSnap => {
        remoteTasks.push({ id: docSnap.id, ...docSnap.data() });
      });
      saveLocalTasks(remoteTasks);
      return remoteTasks;
    }
  } catch (error) {
    console.warn("Firestore fetch tasks warning:", error.message);
  }
  return getLocalTasks();
}

export async function addDailyTaskRecord(task) {
  const currentTasks = getLocalTasks();
  const newTask = {
    ...task,
    id: task.id || "task-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
    createdAt: Date.now()
  };
  currentTasks.unshift(newTask);
  saveLocalTasks(currentTasks);

  try {
    const taskDocRef = doc(db, "daily_tasks", newTask.id);
    await setDoc(taskDocRef, {
      ...newTask,
      savedAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("Firestore add task warning:", error.message);
  }

  return currentTasks;
}

export async function updateDailyTaskRecord(taskId, updates) {
  const currentTasks = getLocalTasks();
  const index = currentTasks.findIndex(t => t.id === taskId);
  if (index >= 0) {
    currentTasks[index] = { ...currentTasks[index], ...updates };
    saveLocalTasks(currentTasks);
  }

  try {
    const taskDocRef = doc(db, "daily_tasks", taskId);
    await updateDoc(taskDocRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("Firestore update task warning:", error.message);
  }

  return currentTasks;
}

export async function deleteDailyTaskRecord(taskId) {
  const currentTasks = getLocalTasks();
  const filtered = currentTasks.filter(t => t.id !== taskId);
  saveLocalTasks(filtered);

  try {
    const taskDocRef = doc(db, "daily_tasks", taskId);
    await deleteDoc(taskDocRef);
  } catch (error) {
    console.warn("Firestore delete task warning:", error.message);
  }

  return filtered;
}
