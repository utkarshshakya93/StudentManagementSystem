// Application Bootstrap & Event Wiring
import { 
  loginWithEmailOrStudentId, 
  registerStudentWithEmailPassword, 
  signInWithGoogle, 
  sendPhoneVerificationCode, 
  confirmPhoneVerificationCode, 
  resetPasswordViaEmail, 
  verifyStudentFaq, 
  logoutStudent, 
  subscribeToAuthState, 
  isProfileComplete 
} from './auth.js';
import { 
  fetchAllStudents, 
  saveStudentRecord, 
  deleteStudentRecord, 
  fetchAllTasks, 
  addDailyTaskRecord, 
  updateDailyTaskRecord, 
  deleteDailyTaskRecord, 
  getLocalStudents, 
  getLocalTasks, 
  saveUserProfile, 
  getLocalUserProfile 
} from './db.js';
import { 
  appState, 
  showToast, 
  openModal, 
  closeModal, 
  toggleSidebar, 
  initSwipeGestures, 
  switchTab, 
  updateSidebarLockStatus, 
  renderMyProfileTab, 
  renderAccountSettingTab, 
  renderDailyDiaryTab, 
  renderTaskLogTab, 
  renderStudentsTable, 
  renderTodayDiaryList 
} from './ui.js';

// Global window bindings for HTML onclick handlers
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleSidebar = toggleSidebar;
window.switchTab = switchTab;

// 1. ROUTING & VIEW SWITCHING
export function setView(viewName) {
  appState.activeView = viewName;
  const homeView = document.getElementById('view-home');
  const dashboardView = document.getElementById('view-dashboard');
  const navAuthBtn = document.getElementById('nav-portal-action-btn');

  if (viewName === 'dashboard') {
    if (homeView) homeView.classList.add('hidden');
    if (dashboardView) dashboardView.classList.remove('hidden');
    if (navAuthBtn) {
      navAuthBtn.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket mr-2"></i>Sign Out';
      navAuthBtn.onclick = handleSignOut;
    }
  } else {
    if (homeView) homeView.classList.remove('hidden');
    if (dashboardView) dashboardView.classList.add('hidden');
    if (navAuthBtn) {
      navAuthBtn.innerHTML = '<i class="fa-solid fa-lock mr-2"></i>Sign In';
      navAuthBtn.onclick = () => openModal('modal-signin');
    }
  }
}

// 2. INITIALIZE APPLICATION
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize touch swipe listener
  initSwipeGestures();

  // Load initial datasets from Firestore / Cache
  await fetchAllStudents();
  await fetchAllTasks();

  // Listen to Auth State
  subscribeToAuthState(async (user, profile) => {
    appState.currentUser = user;
    appState.userProfile = profile;

    if (user) {
      // User is authenticated
      const complete = isProfileComplete(profile);

      // Update User summary pill in Header & Sidebar
      updateUserInterfaceSummary(user, profile);

      // Check URL parameters for tab
      const urlParams = new URLSearchParams(window.location.search);
      const requestedTab = urlParams.get('tab') || 'myprofile';

      setView('dashboard');

      // Requirement: Sign Up with Google requires redirect to dashboard?tab=accountsetting and disable all tabs until completion
      if (!complete) {
        showToast("Welcome! Please complete your academic profile to unlock all student services.", "warning", 6000);
        switchTab('accountsetting');
      } else {
        switchTab(requestedTab);
      }
      updateSidebarLockStatus();
    } else {
      // Unauthenticated
      const hash = window.location.hash;
      if (hash === '#dashboard') {
        // Redirect back to home
        window.location.hash = '';
      }
      setView('home');
    }
  });

  // Attach DOM Listeners
  setupEventListeners();
});

// Update profile info across header & sidebar
function updateUserInterfaceSummary(user, profile) {
  const displayName = (profile && profile.name) || user.displayName || 'Utkarsh Shakya';
  const studentId = (profile && profile.studentId) || '145493';
  const course = (profile && profile.course) || 'B.Tech CSE';
  const email = (profile && profile.email) || user.email || '';

  const elHeaderName = document.getElementById('header-user-name');
  const elHeaderId = document.getElementById('header-user-id');
  const elSidebarName = document.getElementById('sidebar-user-name');
  const elSidebarId = document.getElementById('sidebar-user-id');
  const elSidebarCourse = document.getElementById('sidebar-user-course');

  if (elHeaderName) elHeaderName.textContent = displayName;
  if (elHeaderId) elHeaderId.textContent = `ID: ${studentId}`;
  if (elSidebarName) elSidebarName.textContent = displayName;
  if (elSidebarId) elSidebarId.textContent = studentId;
  if (elSidebarCourse) elSidebarCourse.textContent = course;
}

// 3. EVENT LISTENERS
function setupEventListeners() {
  // Mobile hamburger menu toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => toggleSidebar());
  }

  const closeSidebarBtn = document.getElementById('close-sidebar-btn');
  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
  }

  const backdrop = document.getElementById('sidebar-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => toggleSidebar(false));
  }

  // Sidebar Tab click handlers
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Home modal triggers
  document.querySelectorAll('.btn-open-signin').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal('modal-signup');
      closeModal('modal-forgot');
      openModal('modal-signin');
    });
  });

  document.querySelectorAll('.btn-open-signup').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal('modal-signin');
      closeModal('modal-forgot');
      openModal('modal-signup');
    });
  });

  document.querySelectorAll('.btn-open-forgot').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal('modal-signin');
      closeModal('modal-signup');
      openModal('modal-forgot');
    });
  });

  // Modal Backdrop Click to close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
      }
    });
  });

  // Sign In with Email/ID Form
  const formSignIn = document.getElementById('form-signin');
  if (formSignIn) {
    formSignIn.addEventListener('submit', handleSignInEmail);
  }

  // Google Sign In Buttons
  document.querySelectorAll('.btn-google-auth').forEach(btn => {
    btn.addEventListener('click', handleGoogleAuth);
  });

  // Sign Up Form
  const formSignUp = document.getElementById('form-signup');
  if (formSignUp) {
    formSignUp.addEventListener('submit', handleSignUpForm);
  }

  // Phone OTP Sign In
  const btnSendOtp = document.getElementById('btn-send-phone-otp');
  if (btnSendOtp) {
    btnSendOtp.addEventListener('click', handleSendPhoneOtp);
  }

  const btnVerifyOtp = document.getElementById('btn-verify-phone-otp');
  if (btnVerifyOtp) {
    btnVerifyOtp.addEventListener('click', handleVerifyPhoneOtp);
  }

  // Forgot Password Forms
  const formForgotEmail = document.getElementById('form-forgot-email');
  if (formForgotEmail) {
    formForgotEmail.addEventListener('submit', handleForgotEmail);
  }

  const formForgotFaq = document.getElementById('form-forgot-faq');
  if (formForgotFaq) {
    formForgotFaq.addEventListener('submit', handleForgotFaq);
  }

  // Tab 1 (My Profile) Form & Toolbar Listeners
  setupProfileTabHandlers();

  // Tab 2 (Account Setting) Form Listeners
  setupAccountSettingHandlers();

  // Tab 3 (Daily Diary) Form Listeners
  setupDailyDiaryHandlers();

  // Tab 4 (Task Log) Filter Listeners
  setupTaskLogHandlers();
}

// ---------------- AUTH HANDLERS ---------------- //

async function handleSignInEmail(e) {
  e.preventDefault();
  const identifier = document.getElementById('signin-identifier').value;
  const password = document.getElementById('signin-password').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Verifying Credentials...';
    await loginWithEmailOrStudentId(identifier, password);
    closeModal('modal-signin');
    showToast("Authentication successful! Welcome to Student Portal.", "success");
  } catch (err) {
    showToast(err.message || "Failed to sign in. Please verify credentials.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-2"></i>Sign In to Portal';
  }
}

async function handleGoogleAuth() {
  try {
    const { user, profile } = await signInWithGoogle();
    closeModal('modal-signin');
    closeModal('modal-signup');
    showToast("Google Authentication successful!", "success");

    // Profile check
    if (!isProfileComplete(profile)) {
      switchTab('accountsetting');
    }
  } catch (err) {
    showToast("Google Authentication error: " + err.message, "error");
  }
}

async function handleSignUpForm(e) {
  e.preventDefault();
  const studentId = document.getElementById('signup-student-id').value;
  const name = document.getElementById('signup-name').value;
  const college = document.getElementById('signup-college').value;
  const course = document.getElementById('signup-course').value;
  const semester = document.getElementById('signup-semester').value;
  const email = document.getElementById('signup-email').value;
  const contact = document.getElementById('signup-contact').value;
  const faqQuestion = document.getElementById('signup-faq-question').value;
  const faqAnswer = document.getElementById('signup-faq-answer').value;
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-confirm-password').value;

  if (password !== confirmPassword) {
    showToast("Password confirmation does not match.", "warning");
    return;
  }

  if (password.length < 6) {
    showToast("Password must be at least 6 characters long.", "warning");
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Enrolling Student...';

    await registerStudentWithEmailPassword({
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
    });

    closeModal('modal-signup');
    showToast("Student Enrollment completed! Welcome to your Academic Portal.", "success");
  } catch (err) {
    showToast("Registration failed: " + err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-user-plus mr-2"></i>Create Student Account';
  }
}

async function handleSendPhoneOtp() {
  const phone = document.getElementById('phone-number-input').value.trim();
  if (!phone) {
    showToast("Please enter a valid phone number with country code (e.g. +91XXXXXXXXXX)", "warning");
    return;
  }

  const btn = document.getElementById('btn-send-phone-otp');
  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Sending Code...';
    await sendPhoneVerificationCode(phone);
    document.getElementById('phone-otp-section').classList.remove('hidden');
    showToast("SMS Verification code dispatched. Enter OTP below.", "info");
  } catch (err) {
    showToast("SMS dispatch error: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Send Code';
  }
}

async function handleVerifyPhoneOtp() {
  const otp = document.getElementById('phone-otp-input').value.trim();
  if (!otp || otp.length < 6) {
    showToast("Please enter the 6-digit verification code.", "warning");
    return;
  }

  const btn = document.getElementById('btn-verify-phone-otp');
  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Verifying...';
    await confirmPhoneVerificationCode(otp);
    closeModal('modal-signin');
    showToast("Phone verification successful!", "success");
  } catch (err) {
    showToast("Invalid verification code: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Verify & Sign In';
  }
}

async function handleForgotEmail(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email-input').value;
  try {
    await resetPasswordViaEmail(email);
    closeModal('modal-forgot');
    showToast(`Password reset link dispatched to ${email}`, "success");
  } catch (err) {
    showToast("Password reset error: " + err.message, "error");
  }
}

async function handleForgotFaq(e) {
  e.preventDefault();
  const studentId = document.getElementById('forgot-faq-id').value;
  const answer = document.getElementById('forgot-faq-answer').value;
  try {
    const email = await verifyStudentFaq(studentId, answer);
    closeModal('modal-forgot');
    showToast(`Security verified! Password reset instructions sent to ${email}`, "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleSignOut() {
  try {
    await logoutStudent();
    setView('home');
    showToast("Signed out of Student Portal successfully.", "info");
  } catch (err) {
    showToast("Sign out error: " + err.message, "error");
  }
}

// ---------------- TAB 1 HANDLERS (MY PROFILE) ---------------- //

function setupProfileTabHandlers() {
  // Populate form from table click
  window.populateStudentForm = (studentId) => {
    const students = getLocalStudents();
    const match = students.find(s => s.studentId === studentId);
    if (match) {
      document.getElementById('prof-student-id').value = match.studentId || '';
      document.getElementById('prof-student-name').value = match.name || '';
      document.getElementById('prof-father-name').value = match.fatherName || '';
      document.getElementById('prof-dob').value = match.dob || '';
      document.getElementById('prof-gender').value = match.gender || 'Male';
      document.getElementById('prof-contact').value = match.contact || '';
      document.getElementById('prof-email').value = match.email || '';
      document.getElementById('prof-section').value = match.section || 'A';
      document.getElementById('prof-address').value = match.address || '';
      renderDigitalIdCard(match);
      showToast(`Selected record ID: ${match.studentId}`, "info", 1500);
    }
  };

  // Insert Record Button
  const btnInsert = document.getElementById('btn-student-insert');
  if (btnInsert) {
    btnInsert.addEventListener('click', async () => {
      const studentData = getFormDataFromProfile();
      if (!studentData.studentId || !studentData.name) {
        showToast("Student ID and Student Name are required.", "warning");
        return;
      }
      await saveStudentRecord(studentData);
      renderMyProfileTab();
      showToast(`Student ${studentData.name} (ID: ${studentData.studentId}) saved successfully.`, "success");
    });
  }

  // Update Record Button
  const btnUpdate = document.getElementById('btn-student-update');
  if (btnUpdate) {
    btnUpdate.addEventListener('click', async () => {
      const studentData = getFormDataFromProfile();
      if (!studentData.studentId) {
        showToast("Please enter or select a Student ID to update.", "warning");
        return;
      }
      await saveStudentRecord(studentData);
      renderMyProfileTab();
      showToast(`Record for ${studentData.name} updated.`, "success");
    });
  }

  // Delete Record by ID (from image reference: Delete [145493] <- Enter ID to delete)
  const btnDeleteById = document.getElementById('btn-delete-by-id');
  if (btnDeleteById) {
    btnDeleteById.addEventListener('click', async () => {
      const deleteIdInput = document.getElementById('input-delete-id');
      const idToDelete = deleteIdInput ? deleteIdInput.value.trim() : '';
      if (!idToDelete) {
        showToast("Please enter Student ID to delete.", "warning");
        return;
      }
      window.confirmDeleteStudent(idToDelete);
    });
  }

  window.confirmDeleteStudent = async (studentId) => {
    if (confirm(`Are you sure you want to delete student record ID ${studentId} from academic registry?`)) {
      await deleteStudentRecord(studentId);
      renderMyProfileTab();
      showToast(`Student record ${studentId} deleted.`, "info");
    }
  };

  // Search by Name (from image reference: Search [ ] <- Enter Name to Search)
  const btnSearchName = document.getElementById('btn-search-name');
  const inputSearchName = document.getElementById('input-search-name');
  if (btnSearchName && inputSearchName) {
    btnSearchName.addEventListener('click', () => {
      appState.studentSearchQuery = inputSearchName.value.trim();
      renderStudentsTable(getLocalStudents());
    });
    inputSearchName.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        appState.studentSearchQuery = inputSearchName.value.trim();
        renderStudentsTable(getLocalStudents());
      }
    });
  }

  // Show All Button
  const btnShowAll = document.getElementById('btn-show-all');
  if (btnShowAll) {
    btnShowAll.addEventListener('click', () => {
      appState.studentSearchQuery = '';
      if (inputSearchName) inputSearchName.value = '';
      renderStudentsTable(getLocalStudents());
      showToast("Displaying all student records.", "info", 1500);
    });
  }

  // Print ID Card / Dossier
  const btnPrintCard = document.getElementById('btn-print-id-card');
  if (btnPrintCard) {
    btnPrintCard.addEventListener('click', () => {
      window.print();
    });
  }
}

function getFormDataFromProfile() {
  return {
    studentId: document.getElementById('prof-student-id').value.trim(),
    name: document.getElementById('prof-student-name').value.trim(),
    fatherName: document.getElementById('prof-father-name').value.trim(),
    dob: document.getElementById('prof-dob').value,
    gender: document.getElementById('prof-gender').value,
    contact: document.getElementById('prof-contact').value.trim(),
    email: document.getElementById('prof-email').value.trim(),
    section: document.getElementById('prof-section').value,
    address: document.getElementById('prof-address').value.trim(),
    college: "Institute of Engineering & Technology",
    course: "B.Tech Computer Science & Engineering",
    semester: "Semester 6",
    status: "Active"
  };
}

// ---------------- TAB 2 HANDLERS (ACCOUNT SETTING) ---------------- //

function setupAccountSettingHandlers() {
  const formAccount = document.getElementById('form-account-settings');
  if (formAccount) {
    formAccount.addEventListener('submit', async (e) => {
      e.preventDefault();
      const updatedProfile = {
        studentId: document.getElementById('acc-student-id').value.trim(),
        name: document.getElementById('acc-name').value.trim(),
        college: document.getElementById('acc-college').value.trim(),
        course: document.getElementById('acc-course').value.trim(),
        section: document.getElementById('acc-section').value,
        semester: document.getElementById('acc-semester').value,
        email: document.getElementById('acc-email').value.trim(),
        contact: document.getElementById('acc-contact').value.trim(),
        faqQuestion: document.getElementById('acc-faq-question').value,
        faqAnswer: document.getElementById('acc-faq-answer').value.trim(),
        fatherName: document.getElementById('acc-father-name').value.trim(),
        dob: document.getElementById('acc-dob').value,
        gender: document.getElementById('acc-gender').value,
        address: document.getElementById('acc-address').value.trim(),
        profileCompleted: true
      };

      const uid = appState.currentUser ? appState.currentUser.uid : 'guest-student';
      const saved = await saveUserProfile(uid, updatedProfile);
      appState.userProfile = saved;

      updateSidebarLockStatus();
      updateUserInterfaceSummary(appState.currentUser || {}, saved);
      renderAccountSettingTab();
      showToast("Profile credentials updated successfully! All portal tabs unlocked.", "success");
    });
  }
}

// ---------------- TAB 3 HANDLERS (DAILY DIARY) ---------------- //

function setupDailyDiaryHandlers() {
  const formDiary = document.getElementById('form-daily-diary');
  if (formDiary) {
    formDiary.addEventListener('submit', async (e) => {
      e.preventDefault();
      const subject = document.getElementById('diary-subject').value.trim();
      const subjectCode = document.getElementById('diary-subject-code').value.trim();
      const lecture = document.getElementById('diary-lecture').value.trim();
      const category = document.getElementById('diary-category').value;
      const taskDescription = document.getElementById('diary-description').value.trim();
      const priority = document.getElementById('diary-priority').value;
      const targetDate = document.getElementById('diary-task-date').value;

      if (!subject || !taskDescription) {
        showToast("Subject and Task Description are required.", "warning");
        return;
      }

      const now = new Date();
      const newTask = {
        subject,
        subjectCode: subjectCode || 'N/A',
        lecture: lecture || 'Lecture Notes',
        category,
        taskDescription,
        priority,
        status: 'Pending',
        targetDate: targetDate || now.toISOString().split('T')[0],
        dateFormatted: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        timestamp: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      };

      await addDailyTaskRecord(newTask);
      formDiary.reset();
      // Re-populate live date
      document.getElementById('diary-task-date').value = now.toISOString().split('T')[0];
      renderDailyDiaryTab();
      showToast("Daily academic task logged successfully!", "success");
    });
  }

  window.toggleTaskComplete = async (taskId) => {
    const tasks = getLocalTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
      await updateDailyTaskRecord(taskId, { status: newStatus });
      renderDailyDiaryTab();
      showToast(`Task marked as ${newStatus}`, "info", 1500);
    }
  };

  window.deleteTask = async (taskId) => {
    if (confirm("Delete this academic task entry?")) {
      await deleteDailyTaskRecord(taskId);
      renderDailyDiaryTab();
      if (appState.activeTab === 'tasklog') {
        renderTaskLogTab();
      }
      showToast("Task removed.", "info");
    }
  };
}

// ---------------- TAB 4 HANDLERS (TASK LOG) ---------------- //

function setupTaskLogHandlers() {
  // Preset buttons
  document.querySelectorAll('.btn-filter-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-filter-preset').forEach(b => {
        b.classList.remove('bg-blue-900', 'text-white');
        b.classList.add('bg-white', 'text-slate-700');
      });
      btn.classList.add('bg-blue-900', 'text-white');
      btn.classList.remove('bg-white', 'text-slate-700');

      appState.taskFilter.datePreset = btn.getAttribute('data-preset');
      renderTaskLogTab();
    });
  });

  // Filter dropdowns
  const filterSub = document.getElementById('filter-task-subject');
  if (filterSub) {
    filterSub.addEventListener('change', (e) => {
      appState.taskFilter.subject = e.target.value;
      renderTaskLogTab();
    });
  }

  const filterCat = document.getElementById('filter-task-category');
  if (filterCat) {
    filterCat.addEventListener('change', (e) => {
      appState.taskFilter.category = e.target.value;
      renderTaskLogTab();
    });
  }

  const filterStat = document.getElementById('filter-task-status');
  if (filterStat) {
    filterStat.addEventListener('change', (e) => {
      appState.taskFilter.status = e.target.value;
      renderTaskLogTab();
    });
  }

  const searchInput = document.getElementById('filter-task-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      appState.taskFilter.search = e.target.value.trim();
      renderTaskLogTab();
    });
  }

  window.cycleTaskStatus = async (taskId) => {
    const tasks = getLocalTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      let nextStatus = 'In Progress';
      if (task.status === 'In Progress') nextStatus = 'Completed';
      else if (task.status === 'Completed') nextStatus = 'Pending';

      await updateDailyTaskRecord(taskId, { status: nextStatus });
      renderTaskLogTab();
      showToast(`Status updated: ${nextStatus}`, "info", 1500);
    }
  };

  // Export to CSV
  const btnExportCsv = document.getElementById('btn-export-task-csv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      const tasks = getLocalTasks();
      if (tasks.length === 0) {
        showToast("No tasks available to export.", "warning");
        return;
      }

      let csv = "ID,Date,Time,Subject,Subject Code,Lecture,Category,Priority,Status,Description\n";
      tasks.forEach(t => {
        const cleanDesc = `"${(t.taskDescription || '').replace(/"/g, '""')}"`;
        csv += `${t.id},${t.targetDate || ''},${t.timestamp || ''},"${t.subject}","${t.subjectCode}","${t.lecture}","${t.category}",${t.priority},${t.status},${cleanDesc}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `academic_task_log_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Academic Task Log exported as CSV.", "success");
    });
  }
}
