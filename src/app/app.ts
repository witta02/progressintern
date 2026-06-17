import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { environment } from '../environments/environment';
import { InternshipDataService } from './internship-data.service';
import { NotificationHostComponent } from './notification-host.component';
import { NotificationService } from './notification.service';
import {
  Application,
  ApplicationStatus,
  Attendance,
  AttendanceStatus,
  Company,
  DB_SCHEMA_TABLES,
  EvaluationType,
  Internship,
  JobPosting,
  Logbook,
  LogbookStatus,
  RegisterRole,
  Role,
  User,
  LeaveRequest
} from './internship.models';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, NotificationHostComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly data = inject(InternshipDataService);
  protected readonly notifications = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly useMockData = environment.useMockData;
  protected readonly schemaTables = DB_SCHEMA_TABLES;

  private readonly sessionKey = 'intern-manager-session-v1';

  private codeDebounceTimer: any = null;

  protected currentUserId: number | null = null;
  protected initialized = false;

  constructor() {
    console.log('App Initialized v2.0 - Leaves & SweetAlert2');
    this.initSession();
    setTimeout(() => {
      this.notifications.success('ยินดีต้อนรับสู่ระบบจัดการฝึกงาน', 'Welcome');
    }, 2000);
  }

  private async initSession(): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return;
    }

    // 1. Synchronously read local session immediately so isAuthenticated is set instantly on client
    const saved = localStorage.getItem(this.sessionKey);
    if (saved) {
      const id = parseInt(saved, 10);
      if (!isNaN(id)) {
        this.currentUserId = id;
        
        // Also restore activeView pre-emptively to avoid dashboard tab flicker
        const savedView = localStorage.getItem('intern-manager-active-view-v1');
        if (savedView) {
          this.activeView = savedView;
        }
      }
    }

    // 2. Load API data in the background
    if (!this.useMockData) {
      try {
        await this.data.refreshFromApi();
      } catch (err) {
        console.error('[App] Failed to load initial data from API', err);
      }
    }

    // 3. Re-verify the session with the loaded user list from API
    if (this.currentUserId) {
      const user = this.users.find((u) => u.id === this.currentUserId);
      if (user) {
        this.finishLogin(user, false);
      } else {
        this.logout();
      }
    }

    this.initialized = true;
    this.cdr.markForCheck();
  }
  protected sidebarOpen = false;
  protected activeView = 'dashboard';
  protected authMode: 'login' | 'register' = 'login';
  protected loginError = '';
  protected loginLoading = false;
  protected registerError = '';
  protected registerLoading = false;
  protected notificationPanelOpen = false;
  
  protected studentSearchQuery = '';

  protected loginForm = {
    email: '',
    password: ''
  };

  protected registerForm = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    code: '',
    role: '' as RegisterRole | '',
    phone: '',
    school: '',
    companyName: '',
    description: '',
    address: '',
    contactEmail: ''
  };

  protected detectedRoleName = '';
  protected codeValidationError = '';
  protected validatingCode = false;

  protected newStudent = {
    name: '',
    email: '',
    password: 'student123'
  };

  protected profileDraft = {
    name: '',
    email: '',
    phone: '',
    school: '',
    resumeUrl: '',
    intro: '',
    field: ''
  };

  protected leaveForm = {
    leaveType: 'sick' as 'sick' | 'personal',
    startDate: this.today(),
    endDate: this.today(),
    reason: ''
  };

  protected newJob = {
    title: '',
    description: '',
    requirements: '',
    benefits: '',
    checkinTime: '09:00',
    checkoutTime: '17:00',
    latedTime: '09:15',
    workDays: 'Monday - Friday',
    slots: 1
  };

  protected logbookTitle = '';
  protected logbookText = '';
  protected evaluationFeedback = '';
  protected evaluationScore = 85;
  protected evaluationType: EvaluationType = 'mentor';
  protected selectedEvaluationInternshipId: number | null = null;

  protected adminSchoolInput = {
    name: ''
  };

  protected adminCodeForm = {
    schoolId: null as number | null,
    role: 'student' as 'student' | 'advisor' | 'company',
    code: '',
    maxUses: null as number | null,
    expiresAt: null as string | null
  };

  protected selectedCodeToEdit: any | null = null;

  protected editCodeForm = {
    id: 0,
    code: '',
    maxUses: null as number | null,
    expiresAt: null as string | null,
    isActive: true
  };

  protected selectedJobToEdit: JobPosting | null = null;

  protected editJobForm = {
    title: '',
    description: '',
    requirements: '',
    benefits: '',
    checkinTime: '09:00',
    checkoutTime: '17:00',
    latedTime: '09:15',
    workDays: 'Monday - Friday',
    slots: 1
  };

  protected adminUserSearchQuery = '';
  protected adminUserRoleFilter = '';
  protected adminUserStatusFilter = '';

  protected adminQueryText = 'SELECT * FROM users';
  protected adminQueryResults: any = null;
  protected adminTables: string[] = [];
  protected selectedAdminTable = '';
  protected adminQueryError = '';
  protected workbenchTab: 'query' | 'schema' = 'query';
  protected tableSchemaInfo: any = null;
  protected queryDuration = 0;

  // ----------- Student Detail Panel -----------
  protected selectedInternshipId: number | null = null;
  protected internshipDetailOpen = false;
  protected internshipTableSearch = '';
  protected internshipTableStatusFilter = '';
  protected advisorStudentFilter: 'my' | 'school_all' | 'school_unassigned' | 'other_schools' = 'my';
  protected showAddStudentModal = false;
  protected addStudentModalTab: 'pick' | 'create' = 'pick';
  protected pickStudentSearchQuery = '';


  protected readonly viewLabels: Record<string, string> = {
    dashboard: 'ภาพรวม',
    admin_users: 'จัดการผู้ใช้',
    admin_schools: 'จัดการโรงเรียน',
    admin_codes: 'จัดการรหัสเชิญ',
    students: 'จัดการนักศึกษา',
    jobs: 'ตำแหน่งงาน',
    applications: 'การสมัคร',
    internships: 'ฝึกงาน',
    attendance: 'ลงเวลา',
    logbooks: 'บันทึก',
    leaves: 'การลา',
    evaluations: 'ประเมินผล',
    edit: 'แก้ไขข้อมูล',
    schema: 'ฐานข้อมูล'
  };

  protected get users(): User[] {
    return this.data.users;
  }

  protected get companies(): Company[] {
    return this.data.companies;
  }

  protected get jobPostings(): JobPosting[] {
    return this.data.jobPostings;
  }

  protected get applications(): Application[] {
    return this.data.applications;
  }

  protected get internships(): Internship[] {
    return this.data.internships;
  }

  protected get attendances(): Attendance[] {
    return this.data.attendances;
  }

  protected get currentUser(): User | undefined {
    return this.users.find((user) => user.id === this.currentUserId);
  }

  protected get isAuthenticated(): boolean {
    return this.currentUserId !== null;
  }

  protected get roleLabel(): string {
    return this.currentUser ? this.roleName(this.currentUser.role) : '';
  }

  protected get openAttendanceCount(): number {
    return this.visibleAttendances.filter((a) => !a.checkOutTime).length;
  }

  protected get topSummary(): string[] {
    if (this.currentUser?.role === 'student') {
      return [`สถานะ: ${this.currentUser.status}`, `${this.visibleInternships.length} internship ของฉัน`];
    }

    if (this.currentUser?.role === 'company') {
      return [`${this.visibleInternships.length} นักศึกษาฝึกงาน`, `${this.visibleApplications.length} ใบสมัคร`];
    }

    if (this.currentUser?.role === 'advisor') {
      return [`สังกัด: ${this.currentUser.school}`, `${this.managedStudents.length} นักศึกษาในสังกัด`];
    }

    return [`${this.users.length} users`, `${this.internships.length} internships`];
  }

  protected get availableViews(): string[] {
    const viewsByRole: Record<Role, string[]> = {
      admin: ['dashboard', 'admin_users', 'admin_schools', 'admin_codes', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'leaves', 'evaluations', 'edit'],
      advisor: ['dashboard', 'students', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'leaves', 'evaluations', 'edit'],
      student: ['dashboard', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'leaves', 'evaluations', 'edit'],
      company: ['dashboard', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'leaves', 'evaluations', 'edit']
    };

    if (!this.currentUser) return [];
    return viewsByRole[this.currentUser.role] || [];
  }

  protected get dashboardMetrics() {
    if (this.currentUser?.role === 'admin') {
      return [
        { label: 'ผู้ใช้ทั้งหมด', value: this.users.length, helper: 'ทุก role ในระบบ', view: 'admin_users' },
        { label: 'บริษัททั้งหมด', value: this.companies.length, helper: 'สถานประกอบการที่ลงทะเบียน', view: 'jobs' },
        { label: 'ฝึกงานทั้งหมด', value: this.internships.length, helper: 'internship ทุกสถานะ', view: 'internships' },
        { label: 'ยังไม่ check out', value: this.openAttendanceCount, helper: 'รายการลงเวลาที่ยังไม่จบ', view: 'attendance' }
      ];
    }

    if (this.currentUser?.role === 'advisor') {
      return [
        { label: 'นักศึกษาในสังกัด', value: this.managedStudents.length, helper: 'นักศึกษาที่โรงเรียนเดียวกัน', view: 'students' },
        { label: 'ใบสมัครของนักศึกษา', value: this.visibleApplications.length, helper: 'ติดตามผลสมัครงาน', view: 'applications' },
        { label: 'กำลังฝึกงาน', value: this.visibleInternships.length, helper: 'internship ของนักศึกษาในความดูแล', view: 'internships' },
        { label: 'ยังไม่ check out', value: this.openAttendanceCount, helper: 'ติดตามการลงเวลา', view: 'attendance' }
      ];
    }

    if (this.currentUser?.role === 'company') {
      return [
        { label: 'งานที่บริษัทโพสต์', value: this.visibleJobs.length, helper: 'ตำแหน่งของบริษัทนี้', view: 'jobs' },
        { label: 'ใบสมัครที่ได้รับ', value: this.visibleApplications.length, helper: 'pending / interview / approved', view: 'applications' },
        { label: 'นักศึกษาฝึกงาน', value: this.visibleInternships.length, helper: 'นักศึกษาที่ฝึกงานกับบริษัทนี้', view: 'internships' },
        { label: 'ยังไม่ check out', value: this.openAttendanceCount, helper: 'ตรวจสอบการลงเวลา', view: 'attendance' }
      ];
    }

    return [
      { label: 'งานที่เปิดรับ', value: this.visibleJobs.length, helper: 'ตำแหน่งที่สามารถสมัครได้', view: 'jobs' },
      { label: 'ใบสมัครของฉัน', value: this.visibleApplications.length, helper: 'ประวัติสมัครงาน', view: 'applications' },
      { label: 'สถานะฝึกงานของฉัน', value: this.visibleInternships.length, helper: 'internship ที่ active', view: 'internships' },
      { label: 'ยังไม่ check out', value: this.openAttendanceCount, helper: 'รายการลงเวลาของตัวเอง', view: 'attendance' }
    ];
  }

  protected get currentCompany(): Company | undefined {
    return this.currentUser ? this.data.companyForUser(this.currentUser.id) : undefined;
  }

  protected get currentCompanyId(): number | undefined {
    return this.currentUser ? this.data.companyIdForUser(this.currentUser.id) : undefined;
  }

  protected get managedStudents(): User[] {
    if (this.currentUser?.role === 'admin') {
      return this.users.filter((user) => user.role !== 'admin');
    }

    if (this.currentUser?.role !== 'advisor') {
      return [];
    }

    const user = this.currentUser;
    const filter = this.advisorStudentFilter;

    if (filter === 'school_all') {
      return this.users.filter(
        (u) => u.role === 'student' && u.school === user.school
      );
    }
    if (filter === 'school_unassigned') {
      return this.users.filter(
        (u) => u.role === 'student' && u.school === user.school && !u.advisorId
      );
    }
    if (filter === 'other_schools') {
      return this.users.filter(
        (u) => u.role === 'student' && u.school !== user.school
      );
    }

    // Default is 'my' (My Students)
    return this.users.filter(
      (u) => u.role === 'student' && u.advisorId === user.id
    );
  }
  
  protected get advisorStudents(): User[] {
    return this.users.filter(u => u.role === 'student' && u.advisorId === this.currentUser?.id);
  }
  
  protected get pickableStudents(): User[] {
    const user = this.currentUser;
    if (user?.role !== 'advisor') return [];
    const query = this.pickStudentSearchQuery.trim().toLowerCase();
    return this.users.filter(u => 
      u.role === 'student' && 
      u.advisorId !== user.id &&
      (u.name.toLowerCase().includes(query) || 
       u.email.toLowerCase().includes(query) || 
       (u.school && u.school.toLowerCase().includes(query)))
    );
  }

  protected get pendingStudents(): User[] {
    const user = this.currentUser;
    if (!user || user.role !== 'advisor') return [];
    return this.users.filter(u => u.role === 'student' && u.school === user.school && u.status === 'pending');
  }

  protected get pendingLogbooks(): Logbook[] {
    return this.visibleLogbooks.filter(l => l.status === 'pending');
  }

  protected get pendingApplications(): Application[] {
    const companyId = this.currentCompanyId;
    if (!companyId) return [];
    const jobIds = this.jobPostings
      .filter((j) => j.companyId === companyId && !j.isDeleted)
      .map((j) => j.id);
    return this.data.applications.filter(
      (a) => jobIds.includes(a.jobPostingId) && a.status === 'pending'
    );
  }

  protected get pendingAttendances(): Attendance[] {
    const companyId = this.currentCompanyId;
    if (!companyId) return [];
    const internshipIds = this.internships
      .filter((i) => i.companyId === companyId && i.status === 'active')
      .map((i) => i.id);
    return this.attendances.filter(
      (a) => internshipIds.includes(a.internshipId) && a.verificationStatus === 'pending'
    );
  }

  protected get pendingUsers(): User[] {
    if (this.currentUser?.role !== 'admin') return [];
    return this.users.filter(u => u.status === 'pending');
  }

  protected get todayAttendance() {
    const user = this.currentUser;
    if (!user || user.role !== 'student') return undefined;
    const todayStr = new Date().toDateString();
    return this.attendances.find(
      (a) => a.studentId === user.id && new Date(a.checkInTime).toDateString() === todayStr
    );
  }

  protected get isTodayCheckedIn(): boolean {
    return !!this.todayAttendance;
  }

  protected get isTodayCheckedOut(): boolean {
    return !!this.todayAttendance?.checkOutTime;
  }

  protected get otherStudents(): User[] {
    const user = this.currentUser;
    if (user?.role !== 'advisor') return [];
    
    const query = this.studentSearchQuery.trim().toLowerCase();
    
    return this.users.filter(u => 
      u.role === 'student' && 
      u.school !== user.school &&
      (u.school?.toLowerCase().includes(query) || u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
    );
  }

  protected get visibleJobs(): JobPosting[] {
    const list = this.jobPostings.filter((job) => !job.isDeleted);

    if (this.currentUser?.role === 'admin') {
      return list;
    }

    if (this.currentUser?.role === 'company' && this.currentCompanyId) {
      return list.filter((job) => job.companyId === this.currentCompanyId);
    }

    // For students, advisors, and others, filter out filled jobs
    return list.filter((job) => {
      const filledCount = this.internships.filter(
        (internship) => internship.jobPostingId === job.id && (internship.status === 'active' || internship.status === 'completed')
      ).length;
      return filledCount < job.slots;
    });
  }

  protected get visibleApplications(): Application[] {
    const user = this.currentUser;
    if (user?.role === 'admin') {
      return this.applications;
    }

    if (user?.role === 'student') {
      return this.applications.filter((application) => application.studentId === user.id);
    }

    if (user?.role === 'company' && this.currentCompanyId) {
      const companyJobIds = this.jobPostings
        .filter((job) => job.companyId === this.currentCompanyId)
        .map((job) => job.id);

      return this.applications.filter((application) =>
        companyJobIds.includes(application.jobPostingId)
      );
    }

    const studentIds = this.managedStudents.map((student) => student.id);
    return this.applications.filter((application) => studentIds.includes(application.studentId));
  }

  protected get visibleInternships(): Internship[] {
    const user = this.currentUser;
    if (user?.role === 'admin') {
      return this.internships;
    }

    if (user?.role === 'student') {
      return this.internships.filter((internship) => internship.studentId === user.id);
    }

    if (user?.role === 'company' && this.currentCompanyId) {
      return this.internships.filter((internship) => internship.companyId === this.currentCompanyId);
    }

    const studentIds = this.managedStudents.map((student) => student.id);
    return this.internships.filter((internship) => studentIds.includes(internship.studentId));
  }

  protected attendanceStudentFilterId: number | null = null;

  protected get attendanceStudents(): User[] {
    const studentIds = new Set(this.visibleInternships.map((i) => i.studentId));
    return this.users.filter((u) => studentIds.has(u.id));
  }

  protected get visibleAttendances(): Attendance[] {
    const internshipIds = this.visibleInternships.map((internship) => internship.id);
    let list = this.attendances.filter((attendance) => internshipIds.includes(attendance.internshipId));

    if (this.attendanceStudentFilterId) {
      list = list.filter((a) => a.studentId === Number(this.attendanceStudentFilterId));
    }

    return list;
  }

  protected get activeInternship(): Internship | undefined {
    return this.visibleInternships.find((internship) => internship.status === 'active');
  }

  protected get selectedEvaluationInternship(): Internship | undefined {
    return this.visibleInternships.find(
      (internship) => internship.id === this.selectedEvaluationInternshipId
    );
  }

  protected get visibleLogbooks(): Logbook[] {
    const internshipIds = this.visibleInternships.map((internship) => internship.id);
    return this.data.logbooks.filter((logbook) => internshipIds.includes(logbook.internshipId));
  }

  protected get visibleLeaves(): LeaveRequest[] {
    const internshipIds = this.visibleInternships.map((internship) => internship.id);
    return this.data.leaves.filter((leave) => internshipIds.includes(leave.internshipId));
  }

  protected get visibleEvaluations() {
    const internshipIds = this.visibleInternships.map((internship) => internship.id);
    return this.data.evaluations.filter((evaluation) => internshipIds.includes(evaluation.internshipId));
  }

  protected setAuthMode(mode: 'login' | 'register'): void {
    this.authMode = mode;
    this.loginError = '';
    this.registerError = '';
  }

  protected get isRegisterCompany(): boolean {
    return this.registerForm.role === 'company';
  }

  protected async login(): Promise<void> {
    this.loginError = '';
    this.loginLoading = true;
    this.cdr.detectChanges();
    const email = this.loginForm.email.trim().toLowerCase();
    const result = await this.data.login(email, this.loginForm.password);

    if (!result || 'error' in result) {
      const msg = (result && 'error' in result) ? result.error : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      this.loginError = msg;
      this.notifications.error(msg, 'เข้าสู่ระบบไม่สำเร็จ');
      this.loginLoading = false;
      this.cdr.detectChanges();
      return;
    }

    await this.finishLogin(result);
    this.loginLoading = false;
  }

  protected async register(): Promise<void> {
    this.registerError = '';

    if (this.registerForm.password !== this.registerForm.confirmPassword) {
      this.registerError = 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน';
      this.notifications.error('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน', 'สมัครสมาชิก');
      return;
    }

    if (!this.registerForm.role) {
      this.registerError = 'กรุณากรอกรหัสสมัครเรียนหรือรหัสเชิญที่ถูกต้องก่อนสมัครสมาชิก';
      this.notifications.error('กรุณากรอกรหัสเชิญที่ถูกต้อง', 'สมัครสมาชิก');
      return;
    }

    this.registerLoading = true;

    const result = await this.data.register({
      name: this.registerForm.name,
      email: this.registerForm.email,
      password: this.registerForm.password,
      code: this.registerForm.code,
      role: this.registerForm.role as RegisterRole,
      phone: this.registerForm.phone || undefined,
      school: this.registerForm.school || undefined,
      companyName: this.isRegisterCompany ? this.registerForm.companyName : undefined,
      description: this.isRegisterCompany ? this.registerForm.description : undefined,
      address: this.isRegisterCompany ? this.registerForm.address : undefined,
      contactEmail: this.isRegisterCompany ? this.registerForm.contactEmail : undefined
    });

    this.registerLoading = false;

    if ('error' in result) {
      this.registerError = result.error;
      this.notifications.error(result.error, 'สมัครสมาชิกไม่สำเร็จ');
      return;
    }

    this.resetRegisterForm();
    this.authMode = 'login';
    await this.finishLogin(result.user);
    this.notifications.success(`ยินดีต้อนรับ ${result.user.name}`, 'สมัครสมาชิกสำเร็จ');
  }

  protected onCodeChange(code: string): void {
    this.codeValidationError = '';
    this.detectedRoleName = '';
    this.registerForm.role = '';
    this.registerForm.school = '';

    const cleanCode = code.trim();
    if (!cleanCode) {
      return;
    }

    if (this.codeDebounceTimer) {
      clearTimeout(this.codeDebounceTimer);
    }

    this.validatingCode = true;
    this.codeDebounceTimer = setTimeout(async () => {
      const res = await this.data.validateCode(cleanCode);
      this.validatingCode = false;

      if (!res || 'error' in res) {
        this.codeValidationError = res?.error || 'รหัสสมัครเรียนหรือรหัสเชิญไม่ถูกต้อง';
        this.cdr.markForCheck();
        return;
      }

      const { role, school_name } = res.data;
      this.registerForm.role = role as RegisterRole;
      if (school_name) {
        this.registerForm.school = school_name;
      }

      if (role === 'student') {
        this.detectedRoleName = `นักศึกษา (Student) - ${school_name || ''}`;
      } else if (role === 'advisor') {
        this.detectedRoleName = `อาจารย์ / ผู้ดูแลฝึกงาน (Advisor) - ${school_name || ''}`;
      } else if (role === 'company') {
        this.detectedRoleName = `สถานประกอบการ (Company) ${school_name ? '- เชิญโดย ' + school_name : ''}`;
      }
      this.cdr.markForCheck();
    }, 500);
  }

  protected logout(): void {
    this.currentUserId = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.sessionKey);
      localStorage.removeItem('intern-manager-api-token-v1');
      localStorage.removeItem('intern-manager-active-view-v1');
    }
    this.sidebarOpen = true;
    this.activeView = 'dashboard';
    this.loginError = '';
    this.notificationPanelOpen = false;
    this.selectedEvaluationInternshipId = null;
    this.notifications.info('คุณออกจากระบบแล้ว', 'ออกจากระบบ');
    this.cdr.detectChanges();
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }

  protected toggleNotificationPanel(): void {
    this.notificationPanelOpen = !this.notificationPanelOpen;
    if (this.notificationPanelOpen) {
      this.notifications.markAllRead();
    }
  }

  protected closeNotificationPanel(): void {
    this.notificationPanelOpen = false;
  }

  protected setActiveView(view: string): void {
    const user = this.currentUser;
    this.activeView = this.availableViews.includes(view) ? view : 'dashboard';
    this.notificationPanelOpen = false;

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('intern-manager-active-view-v1', this.activeView);
    }

    if (this.activeView === 'jobs' && user?.role === 'student') {
      const hasActiveInternship = this.internships.some(
        (internship) => internship.studentId === user.id && internship.status === 'active'
      );
      if (hasActiveInternship) {
        alert('คุณมีสถานที่ฝึกงานแล้ว ไม่สามารถดูหรือสมัครตำแหน่งงานเพิ่มได้');
        this.notifications.warning('คุณมีสถานที่ฝึกงานแล้ว ไม่สามารถดูหรือสมัครตำแหน่งงานเพิ่มได้', 'ตำแหน่งงาน');
        this.activeView = 'dashboard';
        return;
      }
    }

    if (this.activeView === 'evaluations') {
      this.selectedEvaluationInternshipId = this.visibleInternships[0]?.id ?? null;
      this.evaluationType = user?.role === 'advisor' ? 'advisor' : 'mentor';
    }
    
    if (this.activeView === 'edit' && user) {
      this.profileDraft = {
        name: user.name,
        email: user.email,
        phone: user.phone ?? '',
        school: user.school ?? '',
        resumeUrl: user.resumeUrl ?? '',
        intro: user.intro ?? '',
        field: user.field ?? ''
      };
    }

    if (this.activeView === 'schema') {
      void this.loadAdminTables();
    }

    this.closeSidebar();
  }

  protected toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  protected closeSidebar(): void {
    this.sidebarOpen = false;
  }

  protected openSidebar(): void {
    this.sidebarOpen = true;
  }

  protected roleName(role: Role): string {
    return {
      admin: 'ผู้ดูแลระบบ',
      advisor: 'อาจารย์ที่ปรึกษา',
      student: 'นักศึกษา',
      company: 'บริษัท'
    }[role];
  }

  protected userName(userId: number): string {
    return this.users.find((user) => user.id === userId)?.name ?? '-';
  }

  protected studentField(userId: number): string {
    return this.users.find((user) => user.id === userId)?.field ?? '-';
  }

  protected studentIntro(userId: number): string {
    return this.users.find((user) => user.id === userId)?.intro ?? '';
  }

  protected studentResume(userId: number): string {
    return this.users.find((user) => user.id === userId)?.resumeUrl ?? '';
  }

  protected jobName(jobPostingId: number): string {
    return this.jobPostings.find((job) => job.id === jobPostingId)?.title ?? '-';
  }

  protected companyName(companyId: number): string {
    return this.companies.find((company) => company.id === companyId)?.companyName ?? '-';
  }

  protected internshipJobTitle(internship: Internship): string {
    return this.jobName(internship.jobPostingId);
  }

  protected jobSummary(job: JobPosting): string {
    const parts = [job.description, job.requirements].filter(Boolean);
    return parts.join(' · ') || '-';
  }

  protected formatDateTime(value: string | undefined): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('th-TH');
  }

  protected canApply(job: JobPosting): boolean {
    const user = this.currentUser;
    if (!user || user.role !== 'student') return false;

    // Check if student already has an active internship
    const hasActiveInternship = this.internships.some(
      (internship) => internship.studentId === user.id && internship.status === 'active'
    );
    if (hasActiveInternship) {
      return false;
    }

    return (
      user?.status === 'active' &&
      job.status === 'open' &&
      !this.applications.some(
        (application) =>
          application.studentId === user?.id && application.jobPostingId === job.id
      )
    );
  }

  protected applyJob(job: JobPosting): void {
    const user = this.currentUser;
    if (user?.status !== 'active') {
      this.notifications.warning('บัญชีของคุณยังไม่ได้รับการอนุมัติ', 'สมัครงาน');
      return;
    }
    
    if (!this.canApply(job)) {
      if (user?.role !== 'student') {
        this.notifications.warning('เฉพาะนักศึกษาจึงสมัครงานได้', 'สมัครงาน');
      } else if (job.status !== 'open') {
        this.notifications.warning('ตำแหน่งนี้ปิดรับสมัครแล้ว', 'สมัครงาน');
      } else {
        this.notifications.warning('คุณสมัครตำแหน่งนี้แล้ว', 'สมัครงาน');
      }
      return;
    }

    this.data.addApplication({
      studentId: user.id,
      jobPostingId: job.id,
      status: 'pending',
      appliedAt: new Date().toISOString()
    });
    this.notifications.success(
      `สมัครตำแหน่ง ${job.title} แล้ว รอการพิจารณาจากบริษัท`,
      'ส่งใบสมัคร'
    );
    this.setActiveView('applications');
    window.location.reload();
  }

  protected updateApplication(application: Application, status: ApplicationStatus): void {
    const student = this.userName(application.studentId);

    if (status === 'approved') {
      const hasActiveInternship = this.internships.some(
        (internship) => internship.studentId === application.studentId && internship.status === 'active'
      );
      if (hasActiveInternship) {
        alert('นักศึกษาคนนี้ มีสถานที่ฝึกงานแล้ว');
        this.notifications.error('นักศึกษาคนนี้ มีสถานที่ฝึกงานแล้ว', 'แจ้งเตือน');
        this.data.updateApplicationStatus(application, 'rejected');
        return;
      }
    }

    this.data.updateApplicationStatus(application, status);
    const label = this.applicationStatusLabel(status);

    if (status === 'rejected') {
      this.notifications.warning(`ใบสมัครของ ${student} → ${label}`, 'การสมัคร');
    } else if (status === 'approved') {
      this.notifications.success(`ใบสมัครของ ${student} → ${label}`, 'การสมัคร');
    } else {
      this.notifications.info(`ใบสมัครของ ${student} → ${label}`, 'การสมัคร');
    }

    if (
      status !== 'approved' ||
      !this.useMockData ||
      this.internships.some((internship) => internship.studentId === application.studentId)
    ) {
      return;
    }

    const job = this.jobPostings.find((item) => item.id === application.jobPostingId);
    if (!job) {
      this.notifications.warning('ไม่พบตำแหน่งงานที่เชื่อมกับใบสมัคร', 'ฝึกงาน');
      return;
    }

    this.data.addInternship({
      studentId: application.studentId,
      companyId: job.companyId,
      jobPostingId: job.id,
      startDate: this.today(),
      endDate: '2026-09-30',
      status: 'active'
    });
    this.notifications.success(
      `สร้างฝึกงานให้ ${student} ตำแหน่ง ${job.title} แล้ว`,
      'ฝึกงาน'
    );
    window.location.reload();
  }

  protected addStudent(): void {
    const user = this.currentUser;
    if (!user) return;
    if (!this.newStudent.name.trim() || !this.newStudent.email.trim()) {
      this.notifications.warning('กรุณากรอกชื่อนักศึกษาและอีเมล', 'เพิ่มนักศึกษา');
      return;
    }

    if (this.users.some((u) => u.email.toLowerCase() === this.newStudent.email.trim().toLowerCase())) {
      this.notifications.error('อีเมลนี้มีอยู่ในระบบแล้ว', 'เพิ่มนักศึกษา');
      return;
    }

    if (this.newStudent.password.trim().length < 6) {
      this.notifications.warning('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'เพิ่มนักศึกษา');
      return;
    }

    const name = this.newStudent.name.trim();
    this.data.addStudent({
      name,
      email: this.newStudent.email.trim(),
      password: this.newStudent.password.trim(),
      advisorId: user.id,
      school: user.school
    });
    this.notifications.success(`สร้างบัญชีนักศึกษา ${name} แล้ว`, 'เพิ่มนักศึกษา');
    this.newStudent = { name: '', email: '', password: 'student123' };
    this.showAddStudentModal = false;
  }
  
  protected approveStudent(student: User): void {
    const user = this.currentUser;
    if (!user) return;
    const updates: Partial<User> = { status: 'active' };
    if (user.role === 'advisor') {
      updates.school = user.school;
    }
    this.data.updateUser(student.id, updates);
    this.notifications.success(`อนุมัติผู้ใช้ ${student.name} เรียบร้อยแล้ว`, 'จัดการผู้ใช้');
    window.location.reload();
  }
  
  protected rejectStudent(student: User): void {
    this.data.updateUser(student.id, { status: 'rejected' });
    this.notifications.warning(`ปฏิเสธบัญชีของ ${student.name} แล้ว`, 'จัดการผู้ใช้');
    window.location.reload();
  }
  
  protected claimStudent(student: User): void {
    const user = this.currentUser;
    if (!user) return;
    this.data.updateUser(student.id, { school: user.school, status: 'active' });
    this.notifications.success(`แก้ไขโรงเรียนและรับ ${student.name} เข้าสังกัดแล้ว`, 'จัดการนักศึกษา');
    window.location.reload();
  }

  protected saveProfile(): void {
    const user = this.currentUser;
    if (!user) return;
    this.data.updateUser(user.id, {
      name: this.profileDraft.name,
      email: this.profileDraft.email,
      phone: this.profileDraft.phone,
      school: this.profileDraft.school,
      resumeUrl: this.profileDraft.resumeUrl
    });
    this.notifications.success('บันทึกข้อมูลส่วนตัวแล้ว', 'โปรไฟล์');
    window.location.reload();
  }

  protected addJob(): void {
    if (!this.currentCompanyId || !this.newJob.title.trim()) {
      this.notifications.warning('กรุณากรอกชื่อตำแหน่งงาน', 'โพสต์งาน');
      return;
    }

    const title = this.newJob.title.trim();
    this.data.addJob({
      companyId: this.currentCompanyId,
      title,
      description: this.newJob.description.trim() || 'รายละเอียดงานฝึกงาน',
      requirements: this.newJob.requirements.trim() || 'พร้อมเรียนรู้งาน',
      benefits: this.newJob.benefits.trim() || undefined,
      checkinTime: this.newJob.checkinTime + ':00',
      checkoutTime: this.newJob.checkoutTime + ':00',
      latedTime: this.newJob.latedTime + ':00',
      workDays: this.newJob.workDays.trim() || 'Monday - Friday',
      slots: Number(this.newJob.slots) || 1
    });
    this.newJob = { 
      title: '', description: '', requirements: '', benefits: '', 
      checkinTime: '09:00', checkoutTime: '17:00', latedTime: '09:15', 
      workDays: 'Monday - Friday',
      slots: 1 
    };
    this.notifications.success(`โพสต์ตำแหน่ง ${title} แล้ว`, 'ตำแหน่งงาน');
  }

  protected editJob(job: JobPosting): void {
    this.selectedJobToEdit = job;
    this.editJobForm = {
      title: job.title,
      description: job.description ?? '',
      requirements: job.requirements ?? '',
      benefits: job.benefits ?? '',
      checkinTime: job.checkinTime ? job.checkinTime.slice(0, 5) : '09:00',
      checkoutTime: job.checkoutTime ? job.checkoutTime.slice(0, 5) : '17:00',
      latedTime: job.latedTime ? job.latedTime.slice(0, 5) : '09:15',
      workDays: job.workDays || 'Monday - Friday',
      slots: job.slots || 1
    };
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected cancelEditJob(): void {
    this.selectedJobToEdit = null;
  }

  protected updateJob(): void {
    if (!this.selectedJobToEdit || !this.editJobForm.title.trim()) {
      this.notifications.warning('กรุณากรอกชื่อตำแหน่งงาน', 'โพสต์งาน');
      return;
    }

    const title = this.editJobForm.title.trim();
    const ensureSeconds = (timeStr: string) => {
      return timeStr.length === 5 ? timeStr + ':00' : timeStr;
    };

    this.data.updateJob(this.selectedJobToEdit.id, {
      companyId: this.selectedJobToEdit.companyId,
      title,
      description: this.editJobForm.description.trim() || 'รายละเอียดงานฝึกงาน',
      requirements: this.editJobForm.requirements.trim() || 'พร้อมเรียนรู้งาน',
      benefits: this.editJobForm.benefits.trim() || undefined,
      checkinTime: ensureSeconds(this.editJobForm.checkinTime),
      checkoutTime: ensureSeconds(this.editJobForm.checkoutTime),
      latedTime: ensureSeconds(this.editJobForm.latedTime),
      workDays: this.editJobForm.workDays.trim() || 'Monday - Friday',
      slots: Number(this.editJobForm.slots) || 1
    });

    this.selectedJobToEdit = null;
    this.notifications.success(`แก้ไขประกาศตำแหน่ง ${title} แล้ว`, 'ตำแหน่งงาน');
    window.location.reload();
  }

  protected deleteJob(job: JobPosting): void {
    if (confirm(`คุณแน่ใจหรือไม่ที่จะลบประกาศรับสมัครงาน "${job.title}"?`)) {
      this.data.deleteJob(job.id);
      this.notifications.warning(`ลบประกาศรับสมัครงาน "${job.title}" แล้ว`, 'ตำแหน่งงาน');
      window.location.reload();
    }
  }

  protected checkIn(): void {
    const user = this.currentUser;
    if (!user || !this.activeInternship) {
      this.notifications.warning('ยังไม่มีฝึกงานที่ active', 'ลงเวลา');
      return;
    }

    // Check if already checked in today
    const todayStr = new Date().toDateString();
    const checkedInToday = this.attendances.some(
      (a) => a.studentId === user.id && new Date(a.checkInTime).toDateString() === todayStr
    );
    if (checkedInToday) {
      this.notifications.warning('วันนี้คุณได้ลงเวลาไปแล้ว', 'ลงเวลา');
      return;
    }

    if (this.hasOpenAttendance()) {
      this.notifications.warning('มีรายการ check in ที่ยังไม่ได้ check out', 'ลงเวลา');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      Swal.fire({
        title: 'กำลังดึงพิกัด GPS...',
        text: 'กรุณาอนุญาตให้ระบบเข้าถึงตำแหน่งของคุณหากเบราว์เซอร์ร้องขอ',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      navigator.geolocation.getCurrentPosition(
        (position) => {
          Swal.close();
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          this.executeCheckIn(lat, lon);
        },
        (error) => {
          Swal.close();
          console.error('[App] Geolocation check-in error — trying IP fallback', error);
          // PC fallback: use IP-based geolocation
          this.getIpLocation().then(coords => {
            if (coords) {
              this.executeCheckIn(coords.lat, coords.lon);
            } else {
              Swal.fire({
                title: 'ไม่สามารถดึงตำแหน่งได้',
                text: 'ระบบไม่สามารถระบุพิกัดได้ คุณต้องการลงเวลาเข้างานต่อโดยไม่มีพิกัดหรือไม่?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'ลงเวลาต่อ',
                cancelButtonText: 'ยกเลิก'
              }).then((result) => {
                if (result.isConfirmed) this.executeCheckIn();
              });
            }
          });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      this.executeCheckIn();
    }
  }

  private executeCheckIn(lat?: number, lon?: number): void {
    const user = this.currentUser;
    if (!user || !this.activeInternship) return;

    const now = new Date();
    const job = this.jobPostings.find(j => j.id === this.activeInternship?.jobPostingId);
    let status: AttendanceStatus = 'present';
    
    if (job?.latedTime) {
      const [h, m] = job.latedTime.split(':').map(Number);
      const latedDate = new Date();
      latedDate.setHours(h, m, 0, 0);
      if (now > latedDate) {
        status = 'late';
      }
    } else {
      if (now.getHours() >= 9 && now.getMinutes() >= 15) {
        status = 'late';
      }
    }

    this.data.addAttendance({
      internshipId: this.activeInternship.id,
      studentId: user.id,
      checkInTime: now.toISOString(),
      status,
      verificationStatus: 'pending',
      latitude: lat,
      longitude: lon
    });
    this.notifications.success(
      `Check in แล้ว (${this.attendanceStatusLabel(status)})` + (lat ? ' พร้อมพิกัด GPS' : ''),
      'ลงเวลา'
    );
  }

  protected checkOut(): void {
    const todayStr = new Date().toDateString();
    
    // Check if already checked out today
    const checkedOutToday = this.attendances.some(
      (a) => a.studentId === this.currentUser?.id && a.checkOutTime && new Date(a.checkInTime).toDateString() === todayStr
    );
    if (checkedOutToday) {
      this.notifications.warning('วันนี้คุณได้ลงเวลาไปแล้ว', 'ลงเวลา');
      return;
    }

    const openAttendance = this.attendances.find(
      (attendance) =>
        attendance.internshipId === this.activeInternship?.id && !attendance.checkOutTime
    );

    if (!openAttendance) {
      this.notifications.warning('ยังไม่มีรายการ check in ที่เปิดอยู่', 'ลงเวลา');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      Swal.fire({
        title: 'กำลังดึงพิกัด GPS...',
        text: 'กรุณาอนุญาตให้ระบบเข้าถึงตำแหน่งของคุณหากเบราว์เซอร์ร้องขอ',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      navigator.geolocation.getCurrentPosition(
        (position) => {
          Swal.close();
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          this.executeCheckOut(openAttendance.id, lat, lon);
        },
        (error) => {
          Swal.close();
          console.error('[App] Geolocation check-out error — trying IP fallback', error);
          // PC fallback: use IP-based geolocation
          this.getIpLocation().then(coords => {
            if (coords) {
              this.executeCheckOut(openAttendance.id, coords.lat, coords.lon);
            } else {
              Swal.fire({
                title: 'ไม่สามารถดึงตำแหน่งได้',
                text: 'ระบบไม่สามารถระบุพิกัดได้ คุณต้องการลงเวลาออกงานต่อโดยไม่มีพิกัดหรือไม่?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'ลงเวลาต่อ',
                cancelButtonText: 'ยกเลิก'
              }).then((result) => {
                if (result.isConfirmed) this.executeCheckOut(openAttendance.id);
              });
            }
          });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      this.executeCheckOut(openAttendance.id);
    }
  }

  private executeCheckOut(attendanceId: number, lat?: number, lon?: number): void {
    this.data.updateAttendance(attendanceId, {
      checkOutTime: new Date().toISOString(),
      checkoutLatitude: lat,
      checkoutLongitude: lon
    });
    this.notifications.success('Check out แล้ว' + (lat ? ' พร้อมพิกัด GPS' : ''), 'ลงเวลา');
  }

  protected setAttendanceVerification(attendance: Attendance, status: 'approved' | 'rejected'): void {
    this.data.setAttendanceVerification(attendance, status);
    const student = this.userName(attendance.studentId);
    if (status === 'approved') {
      this.notifications.success(`อนุมัติการลงเวลาของ ${student} แล้ว`, 'อนุมัติ');
    } else {
      this.notifications.warning(`ปฏิเสธการลงเวลาของ ${student} แล้ว (เปลี่ยนเป็น ขาด)`, 'ปฏิเสธ');
    }
  }

  /** IP-based geolocation fallback for desktop browsers where GPS is inaccurate */
  private async getIpLocation(): Promise<{ lat: number; lon: number } | null> {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (!res.ok) return null;
      const data = await res.json();
      if (data.latitude && data.longitude) {
        return { lat: data.latitude, lon: data.longitude };
      }
      return null;
    } catch {
      return null;
    }
  }

  protected showMap(lat: number | undefined | null, lon: number | undefined | null, typeLabel: string): void {
    if (!lat || !lon) return;
    if (this.currentUser?.role === 'student') return;

    const mapUrl = `https://maps.google.com/maps?q=${lat},${lon}&z=16&output=embed`;
    const externalUrl = `https://www.google.com/maps?q=${lat},${lon}`;

    Swal.fire({
      title: `<span class="text-slate-800 font-black text-2xl tracking-tight">${typeLabel}</span>`,
      html: `
        <div class="rounded-[2rem] overflow-hidden border border-slate-200/80 shadow-inner my-4">
          <iframe width="100%" height="350" frameborder="0" style="border:0; display: block;" src="${mapUrl}"></iframe>
        </div>
        <p class="text-xs text-slate-500 font-extrabold mb-4">พิกัด GPS: ${lat}, ${lon}</p>
        <a href="${externalUrl}" target="_blank" class="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-black text-[10px] uppercase tracking-widest bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl border border-blue-100 shadow-sm transition-all hover:scale-105">
          📍 เปิดใน Google Maps ↗
        </a>
      `,
      showConfirmButton: true,
      confirmButtonText: 'ปิดหน้าต่าง',
      confirmButtonColor: '#3b82f6',
      customClass: {
        popup: 'rounded-[2.5rem] p-8 border border-slate-100 shadow-2xl'
      }
    });
  }

  protected addLogbook(): void {
    if (!this.activeInternship) {
      this.notifications.warning('ยังไม่มีฝึกงานที่ active', 'บันทึก');
      return;
    }

    if (!this.logbookTitle.trim() || !this.logbookText.trim()) {
      this.notifications.warning('กรุณากรอกหัวข้อและเนื้อหาบันทึก', 'บันทึก');
      return;
    }

    this.data.addLogbook({
      internshipId: this.activeInternship.id,
      title: this.logbookTitle.trim(),
      content: this.logbookText.trim()
    });
    this.logbookTitle = '';
    this.logbookText = '';
    this.notifications.success('ส่งบันทึกแล้ว (รออนุมัติ)', 'บันทึก');
    window.location.reload();
  }

  protected reviewLogbook(logbook: Logbook, status: LogbookStatus): void {
    this.data.updateLogbookStatus(
      logbook,
      status,
      status === 'approved' ? 'รับรองโดย mentor' : 'ต้องแก้ไขและส่งใหม่'
    );
    const student = this.userName(this.internshipFor(logbook.internshipId)?.studentId || 0);
    const label = this.logbookStatusLabel(status);

    if (status === 'approved') {
      this.notifications.success(`บันทึกของ ${student} → ${label}`, 'บันทึก');
    } else {
      this.notifications.warning(`บันทึกของ ${student} → ${label}`, 'บันทึก');
    }
  }

  protected addLeave(): void {
    if (!this.activeInternship) {
      this.notifications.warning('ยังไม่มีฝึกงานที่ active', 'การลา');
      return;
    }

    if (!this.leaveForm.reason.trim()) {
      this.notifications.warning('กรุณากรอกเหตุผลการลา', 'การลา');
      return;
    }

    this.data.addLeave({
      internshipId: this.activeInternship.id,
      studentId: this.currentUser!.id,
      leaveType: this.leaveForm.leaveType,
      startDate: this.leaveForm.startDate,
      endDate: this.leaveForm.endDate,
      reason: this.leaveForm.reason.trim()
    });
    
    this.leaveForm.reason = '';
    this.notifications.success('ส่งคำขอลาแล้ว (รออนุมัติ)', 'การลา');
    window.location.reload();
  }

  protected setLeaveStatus(leave: LeaveRequest, status: 'approved' | 'rejected'): void {
    const student = this.userName(leave.studentId);
    this.data.updateLeaveStatus(leave.id, status);
    
    if (status === 'approved') {
      this.notifications.success(`อนุมัติคำขอลาของ ${student} แล้ว`, 'การลา');
    } else {
      this.notifications.warning(`ปฏิเสธคำขอลาของ ${student} แล้ว`, 'การลา');
    }
    window.location.reload();
  }

  protected addEvaluation(): void {
    const user = this.currentUser;
    if (!user || !this.selectedEvaluationInternship) {
      this.notifications.warning('กรุณาเลือกนักศึกษาที่ต้องการประเมิน', 'ประเมินผล');
      return;
    }

    if (!this.evaluationFeedback.trim()) {
      this.notifications.warning('กรุณากรอกข้อเสนอแนะ', 'ประเมินผล');
      return;
    }

    const student = this.userName(this.selectedEvaluationInternship.studentId);
    const score = Number(this.evaluationScore);
    this.data.addEvaluation({
      internshipId: this.selectedEvaluationInternship.id,
      evaluatorId: user.id,
      score,
      feedback: this.evaluationFeedback.trim(),
      evaluationType: this.evaluationType
    });
    this.evaluationFeedback = '';
    this.evaluationScore = 85;
    this.notifications.success(`บันทึกการประเมิน ${student} คะแนน ${score}`, 'ประเมินผล');
    window.location.reload();
  }

  protected hasOpenAttendance(): boolean {
    return this.attendances.some(
      (attendance) =>
        attendance.internshipId === this.activeInternship?.id && !attendance.checkOutTime
    );
  }

  protected internshipFor(id: number): Internship | undefined {
    return this.internships.find((internship) => internship.id === id);
  }

  protected evaluatorLabel(evaluation: { evaluatorId: number; evaluationType: string }): string {
    return `${this.userName(evaluation.evaluatorId)} (${evaluation.evaluationType})`;
  }

  private resetRegisterForm(): void {
    this.registerForm = {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      code: '',
      role: '',
      phone: '',
      school: '',
      companyName: '',
      description: '',
      address: '',
      contactEmail: ''
    };
    this.detectedRoleName = '';
    this.codeValidationError = '';
  }

  private async finishLogin(user: User, showNotification = true): Promise<void> {
    this.currentUserId = user.id;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.sessionKey, user.id.toString());
    }
    this.loginError = '';

    // Await a fresh full data snapshot so all views are populated instantly
    await this.data.refreshFromApi();

    if (showNotification) {
      this.notifications.success(
        `เข้าสู่ระบบเป็น ${this.roleName(user.role)}`,
        `ยินดีต้อนรับ ${user.name}`
      );
    }

    let targetView = 'dashboard';
    if (typeof localStorage !== 'undefined') {
      const savedView = localStorage.getItem('intern-manager-active-view-v1');
      if (savedView) {
        targetView = savedView;
      }
    }
    this.setActiveView(targetView);
    this.selectedEvaluationInternshipId = this.visibleInternships[0]?.id ?? null;
    this.profileDraft = {
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      school: user.school ?? '',
      resumeUrl: user.resumeUrl ?? '',
      intro: user.intro ?? '',
      field: user.field ?? ''
    };
    this.evaluationType = user.role === 'advisor' ? 'advisor' : 'mentor';

    this.cdr.detectChanges();
  }

  protected today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  protected formatTermDate(dateStr: string | undefined): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  protected getInternshipProgress(internship: Internship): { percent: number; label: string } {
    const start = new Date(internship.startDate).getTime();
    const end = new Date(internship.endDate).getTime();
    const now = new Date().getTime();

    if (isNaN(start) || isNaN(end) || start >= end) {
      return { percent: 0, label: '-' };
    }

    const total = end - start;
    const elapsed = now - start;

    if (elapsed < 0) {
      return { percent: 0, label: 'ยังไม่เริ่มฝึกงาน' };
    }

    let percent = Math.min(Math.round((elapsed / total) * 100), 100);
    if (percent < 0) percent = 0;

    const remainingDays = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
    const totalDays = Math.ceil(total / (1000 * 60 * 60 * 24));

    let label = `ผ่านไปแล้ว ${percent}%`;
    if (remainingDays > 0) {
      label += ` (เหลืออีก ${remainingDays} วัน จาก ${totalDays} วัน)`;
    } else {
      label = `สิ้นสุดการฝึกงานแล้ว (${totalDays} วัน)`;
    }

    return { percent, label };
  }

  protected applicationStatusLabel(status: ApplicationStatus): string {
    return {
      pending: 'รอดำเนินการ',
      interview: 'นัดสัมภาษณ์',
      approved: 'อนุมัติ',
      rejected: 'ปฏิเสธ'
    }[status];
  }

  protected attendanceStatusLabel(status: AttendanceStatus): string {
    return {
      present: 'มาตรงเวลา',
      late: 'สาย',
      absent: 'ขาด',
      early_leave: 'กลับก่อนเวลา'
    }[status];
  }

  protected logbookStatusLabel(status: LogbookStatus): string {
    return {
      pending: 'รออนุมัติ',
      approved: 'อนุมัติ',
      rejected: 'ปฏิเสธ'
    }[status];
  }

  protected leaveTypeLabel(type: string): string {
    return {
      sick: 'ลาป่วย',
      personal: 'ลากิจ'
    }[type] || type;
  }

  protected leaveStatusLabel(status: string): string {
    return {
      pending: 'รออนุมัติ',
      approved: 'อนุมัติแล้ว',
      rejected: 'ปฏิเสธแล้ว'
    }[status] || status;
  }

  protected verificationStatusLabel(status: 'pending' | 'approved' | 'rejected'): string {
    return {
      pending: 'รอตรวจสอบ',
      approved: 'อนุมัติแล้ว',
      rejected: 'ปฏิเสธแล้ว'
    }[status];
  }

  protected get filteredUsers(): User[] {
    return this.users.filter(u => {
      const query = this.adminUserSearchQuery.trim().toLowerCase();
      const matchesQuery = !query || 
        u.name.toLowerCase().includes(query) || 
        u.email.toLowerCase().includes(query) || 
        (u.school && u.school.toLowerCase().includes(query));
      
      const matchesRole = !this.adminUserRoleFilter || u.role === this.adminUserRoleFilter;
      const matchesStatus = !this.adminUserStatusFilter || u.status === this.adminUserStatusFilter;
      
      return matchesQuery && matchesRole && matchesStatus;
    });
  }

  protected toggleUserStatus(user: User, newStatus: any): void {
    if (user.id === this.currentUserId) {
      this.notifications.warning('คุณไม่สามารถเปลี่ยนสถานะของตนเองได้', 'จัดการผู้ใช้');
      return;
    }
    this.data.updateUser(user.id, { status: newStatus });
    this.notifications.success(`ปรับปรุงสถานะของ ${user.name} เป็น ${newStatus} แล้ว`, 'จัดการผู้ใช้');
    window.location.reload();
  }

  protected async createAdminSchool(): Promise<void> {
    if (!this.adminSchoolInput.name.trim()) {
      this.notifications.warning('กรุณากรอกชื่อสถานศึกษา', 'จัดการสถานศึกษา');
      return;
    }
    const name = this.adminSchoolInput.name.trim();
    const res = await this.data.addAdminSchool(name);
    if (res && res.error) {
      this.notifications.error(res.error, 'จัดการสถานศึกษา');
    } else {
      this.notifications.success(`เพิ่มสถานศึกษา ${name} สำเร็จ`, 'จัดการสถานศึกษา');
      this.adminSchoolInput.name = '';
    }
    window.location.reload();
  }

  protected async createAdminCode(): Promise<void> {
    if (!this.adminCodeForm.code.trim()) {
      this.notifications.warning('กรุณากรอกรหัสเชิญ', 'จัดการรหัสเชิญ');
      return;
    }
    const body = {
      schoolId: this.adminCodeForm.role === 'company' ? null : (this.adminCodeForm.schoolId ? Number(this.adminCodeForm.schoolId) : null),
      role: this.adminCodeForm.role,
      code: this.adminCodeForm.code.trim().toUpperCase(),
      maxUses: this.adminCodeForm.maxUses ? Number(this.adminCodeForm.maxUses) : null,
      expiresAt: this.adminCodeForm.expiresAt ? new Date(this.adminCodeForm.expiresAt).toISOString() : null
    };
    const res = await this.data.addAdminCode(body);
    if (res && res.error) {
      this.notifications.error(res.error, 'จัดการรหัสเชิญ');
    } else {
      this.notifications.success(`สร้างรหัสเชิญ ${body.code} สำเร็จ`, 'จัดการรหัสเชิญ');
      this.adminCodeForm.code = '';
      this.adminCodeForm.maxUses = null;
      this.adminCodeForm.expiresAt = null;
    }
    window.location.reload();
  }

  protected editCode(code: any): void {
    this.selectedCodeToEdit = code;
    this.editCodeForm = {
      id: code.id,
      code: code.code,
      maxUses: code.maxUses || null,
      expiresAt: code.expiresAt ? new Date(code.expiresAt).toISOString().slice(0, 10) : null,
      isActive: code.isActive
    };
  }

  protected cancelEditCode(): void {
    this.selectedCodeToEdit = null;
  }

  protected async updateAdminCode(): Promise<void> {
    if (!this.selectedCodeToEdit) return;
    if (!this.editCodeForm.code.trim()) {
      this.notifications.warning('กรุณากรอกรหัสเชิญ', 'จัดการรหัสเชิญ');
      return;
    }
    const body = {
      code: this.editCodeForm.code.trim().toUpperCase(),
      maxUses: this.editCodeForm.maxUses ? Number(this.editCodeForm.maxUses) : null,
      expiresAt: this.editCodeForm.expiresAt ? new Date(this.editCodeForm.expiresAt).toISOString() : null,
      isActive: this.editCodeForm.isActive
    };
    const res = await this.data.updateAdminCode(this.editCodeForm.id, body);
    if (res && res.error) {
      this.notifications.error(res.error, 'จัดการรหัสเชิญ');
    } else {
      this.notifications.success(`อัปเดตรหัสเชิญเรียบร้อยแล้ว`, 'จัดการรหัสเชิญ');
      this.selectedCodeToEdit = null;
    }
    window.location.reload();
  }

  protected async deleteAdminCode(code: any): Promise<void> {
    if (confirm(`คุณแน่ใจหรือไม่ที่จะลบรหัสเชิญ "${code.code}"?`)) {
      const res = await this.data.deleteAdminCode(code.id);
      if (res && res.error) {
        this.notifications.error(res.error, 'จัดการรหัสเชิญ');
      } else {
        this.notifications.success(`ลบรหัสเชิญ "${code.code}" สำเร็จ`, 'จัดการรหัสเชิญ');
      }
      window.location.reload();
    }
  }

  protected async loadAdminTables(): Promise<void> {
    this.adminTables = await this.data.getAdminTables();
  }

  protected async executeAdminQuery(): Promise<void> {
    if (!this.adminQueryText.trim()) {
      this.notifications.warning('กรุณากรอกคำสั่ง SQL', 'จัดการฐานข้อมูล');
      return;
    }

    this.adminQueryError = '';
    this.adminQueryResults = null;
    this.workbenchTab = 'query';

    const startTime = performance.now();
    const res = await this.data.executeAdminQuery(this.adminQueryText.trim());
    const endTime = performance.now();
    this.queryDuration = Math.round(endTime - startTime);

    if (res && res.error) {
      this.adminQueryError = res.error;
      this.notifications.error(res.error, 'ผลการทำงานล้มเหลว');
    } else {
      this.adminQueryResults = res;
      this.notifications.success('รันคำสั่ง SQL สำเร็จ', 'ผลการทำงาน');
      // Refresh local database caches if write operation succeeded
      if (res.type === 'exec') {
        void this.data.refreshFromApi();
      }
    }
    window.location.reload();
  }

  protected selectQuickTable(table: string): void {
    this.selectedAdminTable = table;
    this.adminQueryText = `SELECT * FROM ${table} LIMIT 100`;
    void this.executeAdminQuery();
  }

  protected async describeTable(tableName: string): Promise<void> {
    this.selectedAdminTable = tableName;
    this.workbenchTab = 'schema';
    this.adminQueryError = '';
    this.tableSchemaInfo = null;

    const res = await this.data.executeAdminQuery(`DESCRIBE ${tableName}`);
    if (res && res.error) {
      this.adminQueryError = res.error;
      this.notifications.error(res.error, 'ไม่สามารถดึงโครงสร้างตารางได้');
    } else {
      this.tableSchemaInfo = res;
    }
    window.location.reload();
  }

  protected exportToCSV(): void {
    if (!this.adminQueryResults || this.adminQueryResults.type !== 'select') return;
    const columns = this.adminQueryResults.columns;
    const rows = this.adminQueryResults.data;

    let csvContent = columns.join(',') + '\n';
    rows.forEach((row: any) => {
      const line = columns.map((col: string) => {
        let val = row[col] !== null ? String(row[col]) : '';
        // Escape quotes
        val = val.replace(/"/g, '""');
        return `"${val}"`;
      }).join(',');
      csvContent += line + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${this.selectedAdminTable || 'query_results'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.notifications.success('ส่งออกผลลัพธ์เป็น CSV สำเร็จ', 'Export CSV');
    window.location.reload();
  }

  protected getQueryResultRows(results: any): any[] {
    return results?.data || [];
  }

  // ============================================================
  //  Internship Detail Panel
  // ============================================================

  protected get selectedInternshipDetail(): Internship | undefined {
    return this.internships.find(i => i.id === this.selectedInternshipId);
  }

  protected get filteredVisibleInternships(): Internship[] {
    let list = this.visibleInternships;
    const q = this.internshipTableSearch.toLowerCase().trim();
    if (q) {
      list = list.filter(i => {
        const name = this.userName(i.studentId).toLowerCase();
        const job  = this.internshipJobTitle(i).toLowerCase();
        const co   = this.companyName(i.companyId).toLowerCase();
        return name.includes(q) || job.includes(q) || co.includes(q);
      });
    }
    if (this.internshipTableStatusFilter) {
      list = list.filter(i => i.status === this.internshipTableStatusFilter);
    }
    return list;
  }

  protected openInternshipDetail(internship: Internship): void {
    this.selectedInternshipId = internship.id;
    this.internshipDetailOpen = true;
  }

  protected closeInternshipDetail(): void {
    this.internshipDetailOpen = false;
    setTimeout(() => { this.selectedInternshipId = null; }, 350);
  }

  protected printStudentReport(): void {
    window.print();
  }

  protected getStudentAttendanceSummary(studentId: number, internshipId: number): {
    total: number; late: number; absent: number; earlyLeave: number;
    pendingVerify: number; approved: number; open: number;
    recent: Attendance[];
  } {
    const list = this.attendances.filter(
      a => a.internshipId === internshipId && a.studentId === studentId
    );
    return {
      total:        list.length,
      late:         list.filter(a => a.status === 'late').length,
      absent:       list.filter(a => a.status === 'absent').length,
      earlyLeave:   list.filter(a => a.status === 'early_leave').length,
      pendingVerify:list.filter(a => a.verificationStatus === 'pending').length,
      approved:     list.filter(a => a.verificationStatus === 'approved').length,
      open:         list.filter(a => !a.checkOutTime).length,
      recent:       [...list].sort((a, b) =>
        new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()
      ).slice(0, 10)
    };
  }

  protected getStudentLogbookSummary(internshipId: number): {
    total: number; approved: number; pending: number; rejected: number; recent: Logbook[];
  } {
    const list = this.data.logbooks.filter(l => l.internshipId === internshipId);
    return {
      total:    list.length,
      approved: list.filter(l => l.status === 'approved').length,
      pending:  list.filter(l => l.status === 'pending').length,
      rejected: list.filter(l => l.status === 'rejected').length,
      recent:   [...list].sort((a, b) =>
        new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
      ).slice(0, 5)
    };
  }

  protected getStudentLeaveSummary(internshipId: number): {
    total: number; sick: number; personal: number; approved: number; leaves: LeaveRequest[];
  } {
    const list = this.data.leaves.filter(l => l.internshipId === internshipId);
    return {
      total:    list.length,
      sick:     list.filter(l => l.leaveType === 'sick').length,
      personal: list.filter(l => l.leaveType === 'personal').length,
      approved: list.filter(l => l.status === 'approved').length,
      leaves:   list
    };
  }

  protected getStudentEvaluation(internshipId: number): {
    mentorScore: number | null; advisorScore: number | null; average: number | null;
  } {
    const evals = this.data.evaluations.filter(e => e.internshipId === internshipId);
    const mentor  = evals.find(e => e.evaluationType === 'mentor');
    const advisor = evals.find(e => e.evaluationType === 'advisor');
    const scores  = [mentor?.score, advisor?.score].filter((s): s is number => s != null);
    return {
      mentorScore:  mentor?.score  ?? null,
      advisorScore: advisor?.score ?? null,
      average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
    };
  }

  protected get detailStudent(): User | undefined {
    return this.selectedInternshipDetail
      ? this.users.find(u => u.id === this.selectedInternshipDetail!.studentId)
      : undefined;
  }

  protected get detailJob(): JobPosting | undefined {
    return this.selectedInternshipDetail
      ? this.jobPostings.find(j => j.id === this.selectedInternshipDetail!.jobPostingId)
      : undefined;
  }

  protected get detailCompany(): import('./internship.models').Company | undefined {
    return this.selectedInternshipDetail
      ? this.companies.find(c => c.id === this.selectedInternshipDetail!.companyId)
      : undefined;
  }

  /** Opens the detail panel for the most-recent internship of a student.
   *  Used by the Applications table's "View" button. */
  protected openInternshipDetailByStudentId(studentId: number): void {
    const internship = [...this.internships]
      .filter(i => i.studentId === studentId)
      .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())[0];
    if (internship) {
      this.openInternshipDetail(internship);
    } else {
      this.notifications.info('ยังไม่มีข้อมูลการฝึกงานของนักศึกษาคนนี้', 'ข้อมูลนักศึกษา');
    }
  }

  protected studentAdvisorName(studentId: number): string | null {
    const student = this.users.find(u => u.id === studentId);
    if (!student || !student.advisorId) return null;
    const adv = this.users.find(u => u.id === student.advisorId && u.role === 'advisor');
    return adv ? adv.name : 'มีอาจารย์ดูแลแล้ว';
  }

  protected isMyStudent(studentId: number): boolean {
    const student = this.users.find(u => u.id === studentId);
    return student?.advisorId === this.currentUser?.id;
  }

  protected assignStudentToAdvisor(studentId: number): void {
    if (!this.currentUser) return;
    const advisorId = this.currentUser.id;
    const student = this.users.find(u => u.id === studentId);
    if (!student) return;
    
    const msg = student.advisorId 
      ? `คุณแน่ใจหรือไม่ที่จะย้ายนักศึกษา "${student.name}" มาอยู่ในการดูแลของคุณ?`
      : `คุณต้องการรับนักศึกษา "${student.name}" เข้าอยู่ในการดูแลของคุณหรือไม่?`;
      
    if (confirm(msg)) {
      if (this.data.api.apiEnabled()) {
        this.data.api.updateUser(studentId, { advisorId } as any).subscribe({
          next: () => {
            this.notifications.success(`รับนักศึกษา ${student.name} เข้ากลุ่มแล้ว`, "สำเร็จ");
            this.data.refreshFromApi();
            this.showAddStudentModal = false;
          },
          error: (err) => {
            this.notifications.error(`เกิดข้อผิดพลาด: ${err.message}`, "ล้มเหลว");
          }
        });
      } else {
        student.advisorId = advisorId;
        this.data.persist();
        this.notifications.success(`รับนักศึกษา ${student.name} เข้ากลุ่มแล้ว (Mock)`, "สำเร็จ");
        this.showAddStudentModal = false;
      }
    }
  }

  protected removeStudentFromAdvisor(studentId: number): void {
    const student = this.users.find(u => u.id === studentId);
    if (!student) return;
    
    if (confirm(`คุณแน่ใจหรือไม่ที่จะนำนักศึกษา "${student.name}" ออกจากความดูแลของคุณ?`)) {
      if (this.data.api.apiEnabled()) {
        this.data.api.updateUser(studentId, { advisorId: 0 } as any).subscribe({
          next: () => {
            this.notifications.success(`นำนักศึกษา ${student.name} ออกจากกลุ่มแล้ว`, "สำเร็จ");
            this.data.refreshFromApi();
          },
          error: (err) => {
            this.notifications.error(`เกิดข้อผิดพลาด: ${err.message}`, "ล้มเหลว");
          }
        });
      } else {
        delete student.advisorId;
        this.data.persist();
        this.notifications.success(`นำนักศึกษา ${student.name} ออกจากกลุ่มแล้ว (Mock)`, "สำเร็จ");
      }
    }
  }

  protected getStudentAdvisor(advisorId: number | undefined): User | undefined {
    if (!advisorId) return undefined;
    return this.users.find(u => u.id === advisorId && u.role === 'advisor');
  }
}
