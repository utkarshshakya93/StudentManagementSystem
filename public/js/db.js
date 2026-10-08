// Database & Storage Layer (Firestore with Local Storage Dual-Sync)
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

// Initial verified registry records from the reference design
// With student 145493 configured with password "Vishal90" as requested
const INITIAL_STUDENTS = [
  {
    studentId: "145493",
    name: "Utkarsh Shakya",
    fatherName: "Brajesh Kumar",
    dob: "2007-12-09",
    gender: "Male",
    contact: "8299254889",
    section: "A",
    email: "utkarshshakya61@gmail.com",
    password: "Vishal90",
    address: "kampil(farrukhabad)",
    college: "DPG College",
    course: "BCA-5A",
    semester: "Semester 6",
    status: "Active",
    profileCompleted: true,
    faqQuestion: "What was the name of your secondary high school?",
    faqAnswer: "St Mary"
  },
  {
    studentId: "145492",
    name: "Rohit Kumar",
    fatherName: "Sanjay Kumar",
    dob: "2003-03-22",
    gender: "Male",
    contact: "9123456789",
    section: "B",
    email: "rohit@gmail.com",
    password: "Password123",
    address: "Meerut, UP",
    college: "Institute of Engineering & Technology",
    course: "B.Tech Information Technology",
    semester: "Semester 6",
    status: "Active",
    profileCompleted: true,
    faqQuestion: "What was your first major academic subject?",
    faqAnswer: "Computer Science"
  },
  {
    studentId: "145491",
    name: "Neha Verma",
    fatherName: "Suresh Verma",
    dob: "2003-11-14",
    gender: "Female",
    contact: "8765432109",
    section: "A",
    email: "neha@gmail.com",
    password: "Password123",
    address: "Delhi",
    college: "Institute of Engineering & Technology",
    course: "B.Tech Computer Science & Engineering",
    semester: "Semester 6",
    status: "Active",
    profileCompleted: true,
    faqQuestion: "What was the name of your secondary high school?",
    faqAnswer: "Delhi Public School"
  }
];

// Initial academic task log entries
const INITIAL_TASKS = [
  {
    id: "task-seed-1",
    studentId: "145493",
    subject: "Data Structures & Algorithms",
    subjectCode: "CS-301",
    lecture: "Lecture 24",
    category: "Lab Assignment",
    taskDescription: "Implement Dijkstra's Single Source Shortest Path Algorithm in C++ with test graphs and write worst-case complexity analysis in lab record.",
    priority: "High",
    status: "Completed",
    targetDate: new Date().toISOString().split('T')[0],
    dateFormatted: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    createdAt: Date.now() - 3600000 * 24
  },
  {
    id: "task-seed-2",
    studentId: "145493",
    subject: "Database Management Systems",
    subjectCode: "CS-302",
    lecture: "Lecture 18",
    category: "Homework / Problem Set",
    taskDescription: "Complete Boyce-Codd Normal Form (BCNF) decomposition problems from Unit 3 problem sheet and formulate relational schema diagrams.",
    priority: "Medium",
    status: "Pending",
    targetDate: new Date().toISOString().split('T')[0],
    dateFormatted: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    createdAt: Date.now() - 3600000 * 12
  },
  {
    id: "task-seed-3",
    studentId: "145493",
    subject: "Operating Systems",
    subjectCode: "CS-304",
    lecture: "Lecture 12",
    category: "Lecture Notes",
    taskDescription: "Review Virtual Memory demand paging, TLB hit rates, and write comparison summary of LRU vs FIFO page replacement algorithms.",
    priority: "Normal",
    status: "In Progress",
    targetDate: new Date().toISOString().split('T')[0],
    dateFormatted: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    createdAt: Date.now() - 3600000 * 5
  },
  {
    id: "task-seed-4",
    studentId: "145493",
    subject: "Professional Ethics & Values",
    subjectCode: "HU-301",
    lecture: "Seminar 03",
    category: "Seminar Presentation",
    taskDescription: "Synthesize 10-minute presentation slides on Academic Integrity, Intellectual Property Protection, and Open Source Software Licensing.",
    priority: "Normal",
    status: "Pending",
    targetDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    dateFormatted: new Date(Date.now() + 86400000 * 2).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    createdAt: Date.now() - 3600000 * 2
  }
];

// Local storage keys
const STORAGE_KEYS = {
  STUDENTS: "sms_academic_students",
  USER_PROFILE: "sms_current_user_profile",
  TASKS: "sms_daily_tasks",
  AUTH_SESSION: "sms_auth_session"
};

// ---------------- STUDENT DIRECTORY OPERATIONS ---------------- //

export function getLocalStudents() {
  const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
    return [...INITIAL_STUDENTS];
  }
  try {
    const list = JSON.parse(data);
    // Ensure 145493 has Vishal90 in local cache
    const s145493 = list.find(s => s.studentId === "145493");
    if (s145493 && !s145493.password) {
      s145493.password = "Vishal90";
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(list));
    }
    return list;
  } catch (e) {
    return [...INITIAL_STUDENTS];
  }
}

export function saveLocalStudents(students) {
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
}

export async function fetchAllStudents() {
  try {
    const colRef = collection(db, "students");
    const snapshot = await getDocs(colRef);
    if (!snapshot.empty) {
      const remoteStudents = [];
      snapshot.forEach(docSnap => {
        remoteStudents.push(docSnap.data());
      });

      // Check if 145493 is in remote students and has password
      const s145493 = remoteStudents.find(s => s.studentId === "145493");
      if (!s145493 || !s145493.password) {
        // Sync 145493 with Vishal90
        await saveStudentRecord(INITIAL_STUDENTS[0]);
        if (!s145493) remoteStudents.unshift(INITIAL_STUDENTS[0]);
        else s145493.password = "Vishal90";
      }

      saveLocalStudents(remoteStudents);
      return remoteStudents;
    } else {
      // Empty remote, seed initial students
      for (const s of INITIAL_STUDENTS) {
        await saveStudentRecord(s);
      }
    }
  } catch (error) {
    console.warn("Firestore fetch students error (using local cache):", error.message);
  }
  return getLocalStudents();
}

export async function saveStudentRecord(student) {
  const currentStudents = getLocalStudents();
  const existingIndex = currentStudents.findIndex(s => s.studentId === student.studentId);
  
  let mergedStudent = { ...student };
  if (existingIndex >= 0) {
    // Preserve existing password if not provided
    if (!mergedStudent.password && currentStudents[existingIndex].password) {
      mergedStudent.password = currentStudents[existingIndex].password;
    }
    currentStudents[existingIndex] = { ...currentStudents[existingIndex], ...mergedStudent };
  } else {
    currentStudents.unshift(mergedStudent);
  }
  saveLocalStudents(currentStudents);

  // Sync to Firestore students collection
  try {
    const studentDocRef = doc(db, "students", student.studentId);
    await setDoc(studentDocRef, {
      ...mergedStudent,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn("Firestore save student warning:", error.message);
  }

  // Also sync to Firestore users collection so credential lookup finds it
  try {
    const userDocRef = doc(db, "users", student.studentId);
    await setDoc(userDocRef, {
      ...mergedStudent,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn("Firestore save user record warning:", error.message);
  }

  return currentStudents;
}

export async function deleteStudentRecord(studentId) {
  const currentStudents = getLocalStudents();
  const filtered = currentStudents.filter(s => s.studentId !== studentId);
  saveLocalStudents(filtered);

  try {
    const studentDocRef = doc(db, "students", studentId);
    await deleteDoc(studentDocRef);
  } catch (error) {
    console.warn("Firestore delete student warning:", error.message);
  }

  try {
    const userDocRef = doc(db, "users", studentId);
    await deleteDoc(userDocRef);
  } catch (error) {}

  return filtered;
}

// ---------------- USER CREDENTIAL & PROFILE OPERATIONS ---------------- //

export function getLocalUserProfile() {
  const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.studentId === "145493" && !parsed.password) {
        parsed.password = "Vishal90";
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function saveLocalUserProfile(profile) {
  localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
}

// Lookup student credential in Firestore & Local storage
export async function lookupStudentCredential(identifier) {
  const cleanId = (identifier || '').trim().toLowerCase();
  if (!cleanId) return null;

  // 1. Check local user profile
  const localProf = getLocalUserProfile();
  if (localProf) {
    const matchId = (localProf.studentId || '').toLowerCase() === cleanId;
    const matchEmail = (localProf.email || '').toLowerCase() === cleanId;
    if (matchId || matchEmail) {
      return localProf;
    }
  }

  // 2. Check local students directory
  const localStudents = getLocalStudents();
  const matchLocal = localStudents.find(s => 
    (s.studentId && s.studentId.toLowerCase() === cleanId) || 
    (s.email && s.email.toLowerCase() === cleanId)
  );
  if (matchLocal) {
    return matchLocal;
  }

  // 3. Query Firestore 'users' collection by ID
  try {
    const docRef = doc(db, "users", identifier.trim());
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (e) {}

  // 4. Query Firestore 'students' collection by ID
  try {
    const docRef = doc(db, "students", identifier.trim());
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (e) {}

  // 5. Query Firestore 'users' by email
  try {
    const colRef = collection(db, "users");
    const q = query(colRef, where("email", "==", identifier.trim().toLowerCase()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data();
    }
  } catch (e) {}

  // 6. Query Firestore 'students' by email
  try {
    const colRef = collection(db, "students");
    const q = query(colRef, where("email", "==", identifier.trim().toLowerCase()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data();
    }
  } catch (e) {}

  return null;
}

export async function fetchUserProfile(uid) {
  if (!uid) return getLocalUserProfile();

  try {
    const userDocRef = doc(db, "users", uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      saveLocalUserProfile(data);
      return data;
    }
  } catch (error) {
    console.warn("Firestore fetchUserProfile warning:", error.message);
  }
  return getLocalUserProfile();
}

// Save User Profile including Password to Firestore and Local Storage
export async function saveUserProfile(uid, profileData) {
  const existing = getLocalUserProfile() || {};
  const merged = { ...existing, ...profileData };
  if (uid) merged.uid = uid;
  saveLocalUserProfile(merged);

  // Update in local students directory
  if (merged.studentId) {
    const students = getLocalStudents();
    const idx = students.findIndex(s => s.studentId === merged.studentId);
    if (idx >= 0) {
      students[idx] = { ...students[idx], ...merged };
    } else {
      students.unshift(merged);
    }
    saveLocalStudents(students);
  }

  // Sync to Firestore 'users' by uid and by studentId
  try {
    if (uid) {
      const userDocRef = doc(db, "users", uid);
      await setDoc(userDocRef, {
        ...merged,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    if (merged.studentId && merged.studentId !== uid) {
      const studentUserDocRef = doc(db, "users", merged.studentId);
      await setDoc(studentUserDocRef, {
        ...merged,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
    console.warn("Firestore saveUserProfile users warning:", error.message);
  }

  // Also sync to Firestore 'students' collection
  if (merged.studentId) {
    try {
      const studentDocRef = doc(db, "students", merged.studentId);
      await setDoc(studentDocRef, {
        ...merged,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.warn("Firestore saveUserProfile students warning:", error.message);
    }
  }

  return merged;
}

// Update password in Firestore (users & students collections) and local storage
export async function updateStudentPassword(studentId, newPassword) {
  if (!studentId || !newPassword) return false;

  // 1. Update in local students
  const students = getLocalStudents();
  const match = students.find(s => s.studentId === studentId);
  if (match) {
    match.password = newPassword;
    saveLocalStudents(students);
  }

  // 2. Update in local user profile
  const localProf = getLocalUserProfile();
  if (localProf && localProf.studentId === studentId) {
    localProf.password = newPassword;
    saveLocalUserProfile(localProf);
  }

  // 3. Update in Firestore
  try {
    const userDoc = doc(db, "users", studentId);
    await setDoc(userDoc, { password: newPassword, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) {}

  try {
    const studDoc = doc(db, "students", studentId);
    await setDoc(studDoc, { password: newPassword, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) {}

  return true;
}

// ---------------- DAILY DIARY & TASK OPERATIONS ---------------- //

export function getLocalTasks() {
  const data = localStorage.getItem(STORAGE_KEYS.TASKS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
    return [...INITIAL_TASKS];
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return [...INITIAL_TASKS];
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
    console.warn("Firestore fetch tasks warning (using local):", error.message);
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
