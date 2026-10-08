// Firebase SDK v13 Initialization & Service Exports
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-analytics.js";
import { 
  getAuth, 
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
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBg5CYtpGql6TJeE2-CmsVNrvZGBmtT3fg",
  authDomain: "studentmanagementsystem-93.firebaseapp.com",
  projectId: "studentmanagementsystem-93",
  storageBucket: "studentmanagementsystem-93.firebasestorage.app",
  messagingSenderId: "295639384970",
  appId: "1:295639384970:web:4b6a1e39fdbc2f3383be73",
  measurementId: "G-D40MV5YG12"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

let analyticsInstance = null;
try {
  analyticsInstance = getAnalytics(app);
} catch (e) {
  console.warn("Analytics initialization skipped or not supported in environment:", e.message);
}
export const analytics = analyticsInstance;

export const auth = getAuth(app);
export const db = getFirestore(app);

// Export Auth functions
export {
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
};

// Export Firestore functions
export {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  addDoc,
  serverTimestamp
};
