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
  serverTimestamp 
} from './firebase-init.js';

// Initial verified registry records from the reference design
const INITIAL_STUDENTS = [
  {
    studentId: "145493",
    name: "Utkarsh Shakya",
    fatherName: "Brajesh Kumar",
    dob: "2004-07-10",
    gender: "Male",
    contact: "9876543210",
    section: "A",
    email: "utkarshshakya61@gmail.com",
    address: "Kampil (Farrukhabad), UP",
    college: "Institute of Engineering & Technology",
    course: "B.Tech Computer Science & Engineering",
    semester: "Semester 6",
    status: "Active"
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
    address: "Meerut, UP",
    college: "Institute of Engineering & Technology",
    course: "B.Tech Information Technology",
    semester: "Semester 6",
    status: "Active"
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
    address: "Delhi",
    college: "Institute of Engineering & Technology",
    course: "B.Tech Computer Science & Engineering",
    semester: "Semester 6",
    status: "Active"
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
  TASKS: "sms_daily_tasks"
};

// ---------------- STUDENT DIRECTORY OPERATIONS ---------------- //

export function getLocalStudents() {
  const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
    return [...INITIAL_STUDENTS];
  }
  try {
    return JSON.parse(data);
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
      snapshot.forEach(doc => {
        remoteStudents.push(doc.data());
      });
      // Merge with initial if needed
      saveLocalStudents(remoteStudents);
      return remoteStudents;
    }
  } catch (error) {
    console.warn("Firestore fetch students error (using local cache):", error.message);
  }
  return getLocalStudents();
}

export async function saveStudentRecord(student) {
  const currentStudents = getLocalStudents();
  const existingIndex = currentStudents.findIndex(s => s.studentId === student.studentId);
  
  if (existingIndex >= 0) {
    currentStudents[existingIndex] = { ...currentStudents[existingIndex], ...student };
  } else {
    currentStudents.unshift(student);
  }
  saveLocalStudents(currentStudents);

  // Sync to Firestore
  try {
    const studentDocRef = doc(db, "students", student.studentId);
    await setDoc(studentDocRef, {
      ...student,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn("Firestore save student warning:", error.message);
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

  return filtered;
}

// ---------------- USER PROFILE OPERATIONS ---------------- //

export function getLocalUserProfile() {
  const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
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
  localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
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

export async function saveUserProfile(uid, profileData) {
  const existing = getLocalUserProfile() || {};
  const merged = { ...existing, ...profileData, uid };
  saveLocalUserProfile(merged);

  // Also add or update the student registry with this profile if studentId is present
  if (merged.studentId) {
    await saveStudentRecord({
      studentId: merged.studentId,
      name: merged.name || merged.displayName || "Student",
      fatherName: merged.fatherName || "—",
      dob: merged.dob || "",
      gender: merged.gender || "Not Specified",
      contact: merged.contact || merged.phone || "",
      section: merged.section || "A",
      email: merged.email || "",
      address: merged.address || "",
      college: merged.college || "Academic Institute",
      course: merged.course || "Degree Course",
      semester: merged.semester || "Semester 1",
      status: "Active"
    });
  }

  try {
    const userDocRef = doc(db, "users", uid);
    await setDoc(userDocRef, {
      ...merged,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn("Firestore saveUserProfile warning:", error.message);
  }

  return merged;
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
      snapshot.forEach(doc => {
        remoteTasks.push({ id: doc.id, ...doc.data() });
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
