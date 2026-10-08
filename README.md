# Student Management System (SMS) - Academic Portal

An advanced, responsive, and formally designed **Student Management System & Academic Self-Service Portal** built with modern responsive web standards, Firebase SDK (Authentication & Firestore), and persistent offline resilience.

🌐 **Live Deployment**: [https://studentmanagementsystem-93.web.app](https://studentmanagementsystem-93.web.app)  
📦 **Firebase Hosting Alternative**: [https://studentmanagementsystem-93.firebaseapp.com](https://studentmanagementsystem-93.firebaseapp.com)

---

## 🏛️ System Features & Architecture

### 1. Institutional Homepage & Overview
- **Dignified University Tone**: Zero artificial buzzwords or technical jargon; focuses on real student benefits, academic announcements, and student support.
- **Inbuilt Modals**:
  - **Portal Sign In**: Supports Sign In via Student ID / Email + Password, Phone Number OTP (SMS), and Google Sign-In.
  - **New Student Enrollment (Sign Up)**: Comprehensive academic registration form capturing:
    - Student ID
    - Full Student Name
    - College / Department Name
    - Course and Section
    - Semester Level (Semester 1–8)
    - Registered Email
    - Contact Phone Number
    - Security FAQ (Dropdown) & Confidential Answer
    - Password & Password Confirmation
  - **Account Recovery (Forgot Password)**: Supports email reset dispatch and identity verification using Student ID + Security FAQ Answer.

### 2. Single Page Application (SPA) Dashboard
- **Responsive Layout**:
  - **Desktop (≥1024px)**: Fixed, high-contrast formal institutional sidebar with real-time student summary card.
  - **Mobile & Tablet (<1024px)**: Off-canvas drawer accessible via hamburger menu icon or **hard hand swipe gestures** (`|dx| >= 70px`, `|dy| <= 45px`, velocity `>= 0.28 px/ms`) to prevent accidental scroll triggers.
- **Google Sign-In Profile Completion Guard**:
  - Students logging in with Google without complete mandatory records are automatically directed to `dashboard?tab=accountsetting`.
  - All other tabs remain securely locked until mandatory institutional credentials (Student ID, College, Course & Section, Semester, Contact Number, Security FAQ) are supplied and verified.

### 3. Integrated Dashboard Tabs

#### Tab 1: My Profile (Academic Registry & Dossier)
- Tribute to classic student management system functionality, modernized with university portal aesthetics.
- **Form Dossier**: Student ID, Full Name, Father's Name, Date of Birth, Gender, Contact Number, Email, Section, Permanent Residence Address.
- **Registry Operations**:
  - `Insert`: Add new student record to active institutional registry.
  - `Update`: Modify student records.
  - `Delete`: Delete record by specifying Student ID (`Delete [145493] <- Enter ID to delete`).
  - `Search`: Filter directory in real time by Name (`Search [ ] <- Enter Name to Search`).
  - `Show All`: Reset query filters.
  - `Print Dossier / ID`: Generate printable official university identity card with barcode and student metadata.
- Pre-populated with verified batch records (Utkarsh Shakya, Rohit Kumar, Neha Verma) for immediate usability.

#### Tab 2: Account Setting
- Mandatory student profile completion form with real-time completion progress meter.
- Security FAQ question selection and answer management.
- Session details and account security management.

#### Tab 3: Daily Diary (Coursework Logger)
- Create daily student tasks capturing:
  - Subject Name
  - Subject Curriculum Code (e.g., `CS-301`, `CS-302`, `CS-304`)
  - Lecture / Lab Session (e.g., `Lecture 24`, `Lab 04`)
  - Academic Category (`Lecture Notes`, `Lab Assignment`, `Homework / Problem Set`, `Seminar Presentation`, `Term Project Milestone`, `Self-Study & Revision`)
  - Auto-captured live timestamp & target deadline date
  - Priority & Status (`Pending`, `In Progress`, `Completed`)
- Today's recorded daily tasks feed with one-click completion checkboxes and deletion.

#### Tab 4: Task Log (Academic Audit & Export)
- Multi-dimensional filtering across:
  - Date Scope (All Dates, Today Only, Past 7 Days, Custom Date Picker)
  - Subject Code & Name
  - Academic Category
  - Status (`All`, `Pending`, `In Progress`, `Completed`)
  - Full-text keyword search
- Metric summary cards (Total tasks, Completed, Pending, Completion percentage).
- Institutional CSV export (`Export Task Log (CSV)`).

---

## 🛠️ Technology Stack
- **Frontend**: Semantic HTML5, Tailwind CSS, FontAwesome 6, Custom Institutional Stylesheet.
- **Backend Services**: Google Firebase SDK v13 (Firebase Auth, Cloud Firestore, Firebase Analytics).
- **Data Persistence**: Cloud Firestore with dual-sync LocalStorage fallback for zero-latency offline resilience.
- **Hosting**: Firebase Hosting with global edge CDN.

---

## 🚀 Deployment Commands
```bash
# Deploy to Firebase Hosting and Firestore rules
firebase deploy

# Push updates to GitHub
git add .
git commit -m "Your commit message"
git push origin main
```
