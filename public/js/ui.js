// User Interface Handlers, Routing, Modals, Gestures & Tab Rendering
import { 
  getLocalUsers, 
  saveUserRecord, 
  deleteUserRecord, 
  getLocalTasks, 
  addDailyTaskRecord, 
  updateDailyTaskRecord, 
  deleteDailyTaskRecord,
  getLocalUserProfile,
  saveLocalUserProfile
} from './db.js';
import { isProfileComplete } from './auth.js';

// State management
export const appState = {
  currentUser: null,
  userProfile: null,
  activeView: 'home', // 'home' | 'dashboard'
  activeTab: 'myprofile', // 'myprofile' | 'accountsetting' | 'dailydiary' | 'tasklog'
  studentSearchQuery: '',
  taskFilter: {
    date: '',
    datePreset: 'all', // 'all', 'today', 'week', 'month'
    subject: 'all',
    category: 'all',
    status: 'all',
    search: ''
  }
};

// ---------------- TOAST NOTIFICATIONS ---------------- //

export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const typeStyles = {
    success: 'bg-emerald-800 text-white border-l-4 border-emerald-400',
    error: 'bg-rose-900 text-white border-l-4 border-rose-400',
    warning: 'bg-amber-800 text-white border-l-4 border-amber-300',
    info: 'bg-slate-900 text-white border-l-4 border-blue-400'
  };

  const icons = {
    success: 'fa-circle-check text-emerald-300',
    error: 'fa-circle-exclamation text-rose-300',
    warning: 'fa-triangle-exclamation text-amber-300',
    info: 'fa-circle-info text-blue-300'
  };

  toast.className = `flex items-center gap-3 px-4 py-3 rounded shadow-xl text-sm transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto ${typeStyles[type] || typeStyles.info}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info} text-base"></i>
    <div class="flex-1 font-medium leading-snug">${message}</div>
    <button class="text-slate-300 hover:text-white ml-2 text-xs" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ---------------- MODAL MANAGEMENT ---------------- //

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

// ---------------- MOBILE SIDEBAR & HARD SWIPE GESTURES ---------------- //

export function toggleSidebar(forceState) {
  const sidebar = document.getElementById('sms-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar) return;

  const isOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('sidebar-open');
  if (isOpen) {
    sidebar.classList.add('sidebar-open');
    if (backdrop) backdrop.classList.add('active');
  } else {
    sidebar.classList.remove('sidebar-open');
    if (backdrop) backdrop.classList.remove('active');
  }
}

// Strict "Hard hand swipe gestures" (rejects soft/random scrolling)
export function initSwipeGestures() {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  const minDeltaX = 70; // Must move at least 70px horizontally
  const maxDeltaY = 45; // Must NOT drift vertically more than 45px
  const minVelocity = 0.28; // Require intentional swift hand swipe (px/ms)

  window.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (e.changedTouches.length !== 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndTime = Date.now();

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const deltaTime = touchEndTime - touchStartTime;

    // Reject long static touches or zero time
    if (deltaTime < 40 || deltaTime > 600) return;

    const velocity = Math.abs(deltaX) / deltaTime;

    // Hard gesture validation check
    const isHorizontal = Math.abs(deltaX) >= minDeltaX && Math.abs(deltaY) <= maxDeltaY;
    const isHardFlick = velocity >= minVelocity;

    if (isHorizontal && isHardFlick) {
      const sidebar = document.getElementById('sms-sidebar');
      const isSidebarOpen = sidebar && sidebar.classList.contains('sidebar-open');

      // Swipe Left-to-Right from edge opens sidebar
      if (deltaX > 0 && touchStartX <= 110 && !isSidebarOpen) {
        toggleSidebar(true);
        showToast("Sidebar toggled via gesture", "info", 1800);
      }
      // Swipe Right-to-Left closes sidebar
      else if (deltaX < 0 && isSidebarOpen) {
        toggleSidebar(false);
      }
    }
  }, { passive: true });
}

// ---------------- TAB NAVIGATION & LOCKING LOGIC ---------------- //

export function switchTab(tabId) {
  const profile = appState.userProfile;
  const profileComplete = isProfileComplete(profile);
  const isGoogleOrOther = profile && (profile.authProvider === 'google' || profile.authProvider === 'phone');
  const isLocked = isGoogleOrOther && !profileComplete;

  // Requirement: Tabs lock only for Google & other incomplete methods; unlocked for Email/Password
  if (isLocked && tabId !== 'accountsetting') {
    showToast("Profile Incomplete: Please finish configuring your student credentials in Account Settings to unlock this tab.", "warning", 5000);
    tabId = 'accountsetting';
  }

  appState.activeTab = tabId;

  // Update URL hash & query param
  const url = new URL(window.location);
  url.hash = 'dashboard';
  url.searchParams.set('tab', tabId);
  window.history.replaceState({}, '', url);

  // Update tab navigation active classes
  const navButtons = document.querySelectorAll('.sidebar-nav-btn');
  navButtons.forEach(btn => {
    const target = btn.getAttribute('data-tab');
    if (target === tabId) {
      btn.classList.add('bg-blue-900', 'text-white', 'font-semibold', 'border-l-4', 'border-blue-400');
      btn.classList.remove('text-slate-300', 'hover:bg-slate-800');
    } else {
      btn.classList.remove('bg-blue-900', 'text-white', 'font-semibold', 'border-l-4', 'border-blue-400');
      btn.classList.add('text-slate-300', 'hover:bg-slate-800');
    }
  });

  // Switch tab container visibility
  const tabContainers = document.querySelectorAll('.tab-content-panel');
  tabContainers.forEach(panel => {
    panel.classList.add('hidden');
  });

  const activePanel = document.getElementById(`tab-${tabId}`);
  if (activePanel) {
    activePanel.classList.remove('hidden');
  }

  // Refresh tab content
  if (tabId === 'myprofile') {
    renderMyProfileTab();
  } else if (tabId === 'accountsetting') {
    renderAccountSettingTab();
  } else if (tabId === 'dailydiary') {
    renderDailyDiaryTab();
  } else if (tabId === 'tasklog') {
    renderTaskLogTab();
  }

  // Close mobile sidebar after tab selection
  if (window.innerWidth < 1024) {
    toggleSidebar(false);
  }
}

export function updateSidebarLockStatus() {
  const profile = appState.userProfile;
  const profileComplete = isProfileComplete(profile);
  const isGoogleOrOther = profile && (profile.authProvider === 'google' || profile.authProvider === 'phone');
  const isLocked = isGoogleOrOther && !profileComplete;

  const banner = document.getElementById('profile-locked-banner');
  if (banner) {
    if (isLocked) {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  const tabsToLock = ['myprofile', 'dailydiary', 'tasklog'];
  tabsToLock.forEach(tabKey => {
    const btn = document.querySelector(`.sidebar-nav-btn[data-tab="${tabKey}"]`);
    if (btn) {
      const lockBadge = btn.querySelector('.tab-lock-icon');
      if (isLocked) {
        btn.classList.add('tab-locked');
        if (lockBadge) lockBadge.classList.remove('hidden');
      } else {
        btn.classList.remove('tab-locked');
        if (lockBadge) lockBadge.classList.add('hidden');
      }
    }
  });
}

// ---------------- TAB 1: MY PROFILE (Direct Tribute to Reference Image 2) ---------------- //

export function renderMyProfileTab() {
  const users = getLocalUsers();
  const profile = appState.userProfile || {};
  const currentId = profile.studentId || "145493";

  // Match or use primary record
  let currentStudent = users.find(s => s.studentId === currentId) || users[0] || profile;

  // Populate active form fields
  document.getElementById('prof-student-id').value = currentStudent.studentId || '';
  document.getElementById('prof-student-name').value = currentStudent.name || '';
  document.getElementById('prof-father-name').value = currentStudent.fatherName || '';
  document.getElementById('prof-dob').value = currentStudent.dob || '';
  document.getElementById('prof-gender').value = currentStudent.gender || 'Male';
  document.getElementById('prof-contact').value = currentStudent.contact || '';
  document.getElementById('prof-email').value = currentStudent.email || '';
  document.getElementById('prof-section').value = currentStudent.section || 'A';
  document.getElementById('prof-address').value = currentStudent.address || '';

  // Render ID card preview
  renderDigitalIdCard(currentStudent);

  // Render Table
  renderStudentsTable(students);
}

export function renderDigitalIdCard(student) {
  const cardName = document.getElementById('id-card-name');
  const cardId = document.getElementById('id-card-id');
  const cardCourse = document.getElementById('id-card-course');
  const cardDept = document.getElementById('id-card-dept');
  const cardContact = document.getElementById('id-card-contact');
  const cardEmail = document.getElementById('id-card-email');

  if (cardName) cardName.textContent = student.name || 'Student Name';
  if (cardId) cardId.textContent = student.studentId || '------';
  if (cardCourse) cardCourse.textContent = `${student.course || 'B.Tech CSE'} (Sec ${student.section || 'A'})`;
  if (cardDept) cardDept.textContent = student.college || 'Institute of Engineering & Technology';
  if (cardContact) cardContact.textContent = student.contact || 'Not Provided';
  if (cardEmail) cardEmail.textContent = student.email || 'student@domain.edu';
}

export function renderStudentsTable(students) {
  const tbody = document.getElementById('students-table-body');
  if (!tbody) return;

  const searchQuery = appState.studentSearchQuery.toLowerCase().trim();
  const filtered = students.filter(s => {
    if (!searchQuery) return true;
    return (s.name && s.name.toLowerCase().includes(searchQuery)) ||
           (s.studentId && s.studentId.toLowerCase().includes(searchQuery));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center py-6 text-slate-500">
          <i class="fa-solid fa-folder-open text-2xl text-slate-300 block mb-2"></i>
          No student records matching query "${appState.studentSearchQuery}".
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(s => `
    <tr class="cursor-pointer hover:bg-blue-50/60 transition-colors" onclick="window.populateStudentForm('${s.studentId}')">
      <td class="font-bold text-blue-900">${s.studentId}</td>
      <td class="font-medium text-slate-800">${s.name}</td>
      <td class="text-slate-600">${s.fatherName || '—'}</td>
      <td class="text-slate-600">${s.dob || '—'}</td>
      <td>
        <span class="inline-block px-2 py-0.5 text-xs rounded font-medium ${s.gender === 'Female' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}">
          ${s.gender || 'Other'}
        </span>
      </td>
      <td class="text-slate-600 font-mono text-xs">${s.contact || '—'}</td>
      <td class="font-semibold text-center text-slate-700">${s.section || 'A'}</td>
      <td class="text-slate-600 text-xs">${s.email || '—'}</td>
      <td class="text-slate-600 text-xs max-w-xs truncate" title="${s.address || ''}">${s.address || '—'}</td>
      <td class="text-center whitespace-nowrap">
        <button title="Edit" class="text-blue-600 hover:text-blue-800 p-1 mx-0.5" onclick="event.stopPropagation(); window.populateStudentForm('${s.studentId}')">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button title="Delete" class="text-rose-600 hover:text-rose-800 p-1 mx-0.5" onclick="event.stopPropagation(); window.confirmDeleteStudent('${s.studentId}')">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// ---------------- TAB 2: ACCOUNT SETTINGS ---------------- //

export function renderAccountSettingTab() {
  const profile = appState.userProfile || {};
  const isComplete = isProfileComplete(profile);

  // Progress calculation
  const fields = ['studentId', 'name', 'college', 'course', 'semester', 'contact', 'faqQuestion', 'faqAnswer'];
  const filled = fields.filter(f => Boolean(profile[f] && profile[f].toString().trim())).length;
  const percentage = Math.round((filled / fields.length) * 100);

  const meter = document.getElementById('profile-progress-meter');
  const label = document.getElementById('profile-progress-label');
  const statusBadge = document.getElementById('profile-status-badge');

  if (meter) meter.style.width = `${percentage}%`;
  if (label) label.textContent = `${percentage}% Profile Completion`;
  if (statusBadge) {
    if (percentage === 100) {
      statusBadge.className = 'px-2.5 py-1 text-xs rounded-full bg-emerald-100 text-emerald-800 font-semibold';
      statusBadge.textContent = 'Verified & Complete';
    } else {
      statusBadge.className = 'px-2.5 py-1 text-xs rounded-full bg-amber-100 text-amber-800 font-semibold';
      statusBadge.textContent = 'Action Required';
    }
  }

  // Populate inputs
  document.getElementById('acc-student-id').value = profile.studentId || '';
  document.getElementById('acc-name').value = profile.name || '';
  document.getElementById('acc-college').value = profile.college || '';
  document.getElementById('acc-course').value = profile.course || '';
  document.getElementById('acc-section').value = profile.section || 'A';
  document.getElementById('acc-semester').value = profile.semester || 'Semester 1';
  document.getElementById('acc-email').value = profile.email || (appState.currentUser ? appState.currentUser.email : '');
  document.getElementById('acc-contact').value = profile.contact || profile.phone || '';
  document.getElementById('acc-faq-question').value = profile.faqQuestion || '';
  document.getElementById('acc-faq-answer').value = profile.faqAnswer || '';
  document.getElementById('acc-father-name').value = profile.fatherName || '';
  document.getElementById('acc-dob').value = profile.dob || '';
  document.getElementById('acc-gender').value = profile.gender || 'Male';
  document.getElementById('acc-address').value = profile.address || '';
}

// ---------------- TAB 3: DAILY DIARY ---------------- //

export function renderDailyDiaryTab() {
  const now = new Date();
  const timeFormatted = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateFormatted = now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });

  const timeDisplay = document.getElementById('diary-live-timestamp');
  if (timeDisplay) {
    timeDisplay.textContent = `${dateFormatted} • ${timeFormatted}`;
  }

  const dateInput = document.getElementById('diary-task-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = now.toISOString().split('T')[0];
  }

  // Render recent today's tasks
  renderTodayDiaryList();
}

export function renderTodayDiaryList() {
  const listContainer = document.getElementById('today-diary-list');
  if (!listContainer) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const allTasks = getLocalTasks();
  const todayTasks = allTasks.filter(t => t.targetDate === todayStr || (!t.targetDate && t.createdAt > Date.now() - 86400000));

  if (todayTasks.length === 0) {
    listContainer.innerHTML = `
      <div class="p-6 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
        <i class="fa-solid fa-calendar-day text-3xl text-slate-300 block mb-2"></i>
        No daily tasks recorded yet today. Complete the form to log your first lecture task.
      </div>
    `;
    return;
  }

  listContainer.innerHTML = todayTasks.map(t => `
    <div class="p-4 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-blue-300 transition-all">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-2">
          <input type="checkbox" ${t.status === 'Completed' ? 'checked' : ''} 
            class="h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer"
            onchange="window.toggleTaskComplete('${t.id}')">
          <span class="font-bold text-slate-800 text-sm ${t.status === 'Completed' ? 'line-through text-slate-400' : ''}">
            ${t.subject}
          </span>
          <span class="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-semibold">${t.subjectCode || 'N/A'}</span>
          <span class="text-xs text-slate-500 font-medium">${t.lecture || ''}</span>
        </div>
        <span class="text-xs px-2 py-0.5 rounded-full font-medium ${getCategoryBadgeClass(t.category)}">
          ${t.category}
        </span>
      </div>
      <p class="text-xs text-slate-600 mt-2 pl-6 leading-relaxed">
        ${t.taskDescription}
      </p>
      <div class="flex items-center justify-between mt-3 pl-6 pt-2 border-t border-slate-100 text-xs text-slate-400">
        <span><i class="fa-regular fa-clock mr-1"></i>Logged: ${t.timestamp || 'Today'}</span>
        <div class="space-x-2">
          <button class="text-rose-600 hover:text-rose-800" onclick="window.deleteTask('${t.id}')">
            <i class="fa-solid fa-trash-can mr-1"></i>Delete
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// ---------------- TAB 4: TASK LOG (Full Filterable Academic Audit) ---------------- //

export function renderTaskLogTab() {
  const allTasks = getLocalTasks();
  const filters = appState.taskFilter;

  // Filter tasks
  const filtered = allTasks.filter(t => {
    // Date preset
    if (filters.datePreset === 'today') {
      const today = new Date().toISOString().split('T')[0];
      if (t.targetDate !== today) return false;
    } else if (filters.datePreset === 'week') {
      const weekAgo = Date.now() - 7 * 86400000;
      if (t.createdAt && t.createdAt < weekAgo) return false;
    } else if (filters.datePreset === 'custom' && filters.date) {
      if (t.targetDate !== filters.date) return false;
    }

    // Subject
    if (filters.subject !== 'all' && t.subject !== filters.subject) return false;

    // Category
    if (filters.category !== 'all' && t.category !== filters.category) return false;

    // Status
    if (filters.status !== 'all' && t.status !== filters.status) return false;

    // Search query
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchSub = t.subject && t.subject.toLowerCase().includes(q);
      const matchDesc = t.taskDescription && t.taskDescription.toLowerCase().includes(q);
      const matchCode = t.subjectCode && t.subjectCode.toLowerCase().includes(q);
      const matchLec = t.lecture && t.lecture.toLowerCase().includes(q);
      if (!matchSub && !matchDesc && !matchCode && !matchLec) return false;
    }

    return true;
  });

  // Calculate metrics
  const total = allTasks.length;
  const completed = allTasks.filter(t => t.status === 'Completed').length;
  const pending = total - completed;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  document.getElementById('metric-total-tasks').textContent = total;
  document.getElementById('metric-completed-tasks').textContent = completed;
  document.getElementById('metric-pending-tasks').textContent = pending;
  document.getElementById('metric-completion-rate').textContent = `${rate}%`;

  // Render Task Log Table & Cards
  const tbody = document.getElementById('task-log-tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-10 text-slate-500">
          <i class="fa-solid fa-filter-circle-xmark text-3xl text-slate-300 block mb-2"></i>
          No academic tasks found matching current filter criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(t => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="font-mono text-xs whitespace-nowrap text-slate-600">
        <span class="font-semibold text-slate-800">${t.dateFormatted || t.targetDate || 'Today'}</span><br>
        <span class="text-slate-400 text-2xs">${t.timestamp || ''}</span>
      </td>
      <td>
        <span class="font-bold text-slate-800 block">${t.subject}</span>
        <span class="text-xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-semibold">${t.subjectCode || '—'}</span>
      </td>
      <td class="text-slate-600 text-xs font-medium whitespace-nowrap">${t.lecture || '—'}</td>
      <td>
        <span class="inline-block px-2.5 py-1 text-xs rounded-full font-medium ${getCategoryBadgeClass(t.category)}">
          ${t.category}
        </span>
      </td>
      <td class="text-slate-700 text-xs leading-relaxed max-w-md">
        ${t.taskDescription}
      </td>
      <td>
        <button class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${t.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : t.status === 'In Progress' ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"
          onclick="window.cycleTaskStatus('${t.id}')">
          <i class="fa-solid ${t.status === 'Completed' ? 'fa-check-double text-emerald-600' : 'fa-hourglass-half text-amber-600'} mr-1"></i>
          ${t.status}
        </button>
      </td>
      <td class="text-center whitespace-nowrap">
        <button title="Delete" class="text-rose-600 hover:text-rose-800 p-1 mx-1" onclick="window.deleteTask('${t.id}')">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function getCategoryBadgeClass(category) {
  switch (category) {
    case 'Lab Assignment':
      return 'bg-purple-100 text-purple-800';
    case 'Homework / Problem Set':
      return 'bg-amber-100 text-amber-800';
    case 'Lecture Notes':
      return 'bg-blue-100 text-blue-800';
    case 'Seminar Presentation':
      return 'bg-emerald-100 text-emerald-800';
    case 'Term Project Milestone':
      return 'bg-rose-100 text-rose-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}
