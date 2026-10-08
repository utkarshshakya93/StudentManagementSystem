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
  studentId: "145493",
  name: "Utkarsh Shakya",
  fatherName: "Brajesh Kumar",
  dob: "2007-12-09",
  gender: "Male",
  contact: "8299254889",
  section: "A",
  email: "utkarshshakya61@gmail.com",
  college: "DPG College",
  course: "BCA-5A",
  semester: "Semester 6",
  address: "kampil(farrukhabad)",
  faqQuestion: "What was the name of your secondary high school?",
  faqAnswer: "st mary",
  status: "Active",
  profileCompleted: true,
  authProvider: "password",
  // Salted cryptographic hash & AES-GCM cipher for password 'Vishal90'
  salt: "7ccaa7c279573f7c3fce1066f26c6306",
  passwordHash: "71a4a31d67df3edb3ba6617bf064c606a94a3987e4fb7253549b0ba25b43d973",
  passwordCipher: "8d3527e554c7e746b9a6bd3acb686352c1d455984053a4b6",
  iv: "26cf80bc8abbd5920bc00bb8"
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
  const targetDocId = (docId || userData.uid || userData.studentId || "user_" + Date.now()).trim();

  // Clean data: Remove any plain text password from being stored in Firestore
  const cleanData = { ...userData };
  delete cleanData.password;
  delete cleanData.confirmPassword;

  cleanData.docId = targetDocId;
  cleanData.uid = cleanData.uid || targetDocId;

  // 1. Update local cache
  const users = getLocalUsers();
  const existingIdx = users.findIndex(u => (u.docId === targetDocId) || (u.studentId && u.studentId === cleanData.studentId));
  if (existingIdx >= 0) {
    users[existingIdx] = { ...users[existingIdx], ...cleanData };
  } else {
    users.unshift(cleanData);
  }
  saveLocalUsers(users);

  // Update current user profile if it matches
  const current = getLocalUserProfile();
  if (current && (current.docId === targetDocId || current.studentId === cleanData.studentId)) {
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
export async function deleteUserRecord(docId) {
  const cleanId = (docId || '').trim();
  const users = getLocalUsers();
  const filtered = users.filter(u => u.docId !== cleanId && u.studentId !== cleanId);
  saveLocalUsers(filtered);

  try {
    const docRef = doc(db, "users", cleanId);
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
    (u.studentId && u.studentId.toLowerCase() === clean) ||
    (u.email && u.email.toLowerCase() === clean) ||
    (u.docId && u.docId.toLowerCase() === clean)
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

  return null;
}

/**
 * Update password with salt, SHA-256 hash, and AES-GCM cipher in single 'users' document
 */
export async function updateUserSaltedPassword(docId, newPassword) {
  if (!docId || !newPassword) return false;

  const cryptoData = await secureSaltPassword(newPassword);

  // Update in local cache
  const users = getLocalUsers();
  const match = users.find(u => u.docId === docId || u.studentId === docId);
  if (match) {
    match.salt = cryptoData.salt;
    match.passwordHash = cryptoData.passwordHash;
    match.passwordCipher = cryptoData.passwordCipher;
    match.iv = cryptoData.iv;
    delete match.password;
    saveLocalUsers(users);
  }

  const current = getLocalUserProfile();
  if (current && (current.docId === docId || current.studentId === docId)) {
    current.salt = cryptoData.salt;
    current.passwordHash = cryptoData.passwordHash;
    current.passwordCipher = cryptoData.passwordCipher;
    current.iv = cryptoData.iv;
    delete current.password;
    saveLocalUserProfile(current);
  }

  // Update in Firestore 'users' collection
  try {
    const docRef = doc(db, "users", docId);
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
