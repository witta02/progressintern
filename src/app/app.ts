import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
    resumeUrl: ''
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

  protected adminUserSearchQuery = '';
  protected adminUserRoleFilter = '';
  protected adminUserStatusFilter = '';

  protected readonly viewLabels: Record<string, string> = {
    dashboard: 'ภาพรวม',
    admin_users: 'จัดการผู้ใช้',
    admin_schools: 'จัดการโรงเรียน',
    admin_codes: 'จัดการรหัสเชิญ',
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
      admin: ['dashboard', 'admin_users', 'admin_schools', 'admin_codes', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'leaves', 'evaluations', 'edit', 'schema'],
      advisor: ['dashboard', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'leaves', 'evaluations', 'edit'],
      student: ['dashboard', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'leaves', 'evaluations', 'edit'],
      company: ['dashboard', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'leaves', 'evaluations', 'edit']
    };

    if (!this.currentUser) return [];
    return viewsByRole[this.currentUser.role] || [];
  }

  protected get dashboardMetrics() {
    if (this.currentUser?.role === 'admin') {
      return [
        { label: 'ผู้ใช้ทั้งหมด', value: this.users.length, helper: 'ทุก role ในระบบ' },
        { label: 'บริษัททั้งหมด', value: this.companies.length, helper: 'สถานประกอบการที่ลงทะเบียน' },
        { label: 'ฝึกงานทั้งหมด', value: this.internships.length, helper: 'internship ทุกสถานะ' },
        { label: 'ยังไม่ check out', value: this.openAttendanceCount, helper: 'รายการลงเวลาที่ยังไม่จบ' }
      ];
    }

    if (this.currentUser?.role === 'advisor') {
      return [
        { label: 'นักศึกษาในสังกัด', value: this.managedStudents.length, helper: 'นักศึกษาที่โรงเรียนเดียวกัน' },
        { label: 'ใบสมัครของนักศึกษา', value: this.visibleApplications.length, helper: 'ติดตามผลสมัครงาน' },
        { label: 'กำลังฝึกงาน', value: this.visibleInternships.length, helper: 'internship ของนักศึกษาในความดูแล' },
        { label: 'ยังไม่ check out', value: this.openAttendanceCount, helper: 'ติดตามการลงเวลา' }
      ];
    }

    if (this.currentUser?.role === 'company') {
      return [
        { label: 'งานที่บริษัทโพสต์', value: this.visibleJobs.length, helper: 'ตำแหน่งของบริษัทนี้' },
        { label: 'ใบสมัครที่ได้รับ', value: this.visibleApplications.length, helper: 'pending / interview / approved' },
        { label: 'นักศึกษาฝึกงาน', value: this.visibleInternships.length, helper: 'นักศึกษาที่ฝึกงานกับบริษัทนี้' },
        { label: 'ยังไม่ check out', value: this.openAttendanceCount, helper: 'ตรวจสอบการลงเวลา' }
      ];
    }

    return [
      { label: 'งานที่เปิดรับ', value: this.visibleJobs.length, helper: 'ตำแหน่งที่สามารถสมัครได้' },
      { label: 'ใบสมัครของฉัน', value: this.visibleApplications.length, helper: 'ประวัติสมัครงาน' },
      { label: 'สถานะฝึกงานของฉัน', value: this.visibleInternships.length, helper: 'internship ที่ active' },
      { label: 'ยังไม่ check out', value: this.openAttendanceCount, helper: 'รายการลงเวลาของตัวเอง' }
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

    // Advisor can see students with the same school name
    if (this.currentUser.school) {
      return this.users.filter(
        (user) => user.role === 'student' && user.school === this.currentUser?.school
      );
    }

    return this.users.filter(
      (user) => user.role === 'student' && user.advisorId === this.currentUser?.id
    );
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
    const email = this.loginForm.email.trim().toLowerCase();
    const result = await this.data.login(email, this.loginForm.password);

    if (!result || 'error' in result) {
      const msg = (result && 'error' in result) ? result.error : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      this.loginError = msg;
      this.notifications.error(msg, 'เข้าสู่ระบบไม่สำเร็จ');
      return;
    }

    this.finishLogin(result);
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
    this.finishLogin(result.user);
    this.notifications.success(`ยินดีต้อนรับ ${result.user.name}`, 'สมัครสมาชิกสำเร็จ');
  }

  protected async onCodeChange(code: string): Promise<void> {
    this.codeValidationError = '';
    this.detectedRoleName = '';
    this.registerForm.role = '';
    this.registerForm.school = '';

    const cleanCode = code.trim();
    if (!cleanCode) {
      return;
    }

    this.validatingCode = true;
    const res = await this.data.validateCode(cleanCode);
    this.validatingCode = false;

    if (!res || 'error' in res) {
      this.codeValidationError = res?.error || 'รหัสสมัครเรียนหรือรหัสเชิญไม่ถูกต้อง';
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
        resumeUrl: user.resumeUrl ?? ''
      };
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
  }
  
  protected rejectStudent(student: User): void {
    this.data.updateUser(student.id, { status: 'rejected' });
    this.notifications.warning(`ปฏิเสธบัญชีของ ${student.name} แล้ว`, 'จัดการผู้ใช้');
  }
  
  protected claimStudent(student: User): void {
    const user = this.currentUser;
    if (!user) return;
    this.data.updateUser(student.id, { school: user.school, status: 'active' });
    this.notifications.success(`แก้ไขโรงเรียนและรับ ${student.name} เข้าสังกัดแล้ว`, 'จัดการนักศึกษา');
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

  protected deleteJob(job: JobPosting): void {
    if (confirm(`คุณแน่ใจหรือไม่ที่จะลบประกาศรับสมัครงาน "${job.title}"?`)) {
      this.data.deleteJob(job.id);
      this.notifications.warning(`ลบประกาศรับสมัครงาน "${job.title}" แล้ว`, 'ตำแหน่งงาน');
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
      verificationStatus: 'pending'
    });
    this.notifications.success(
      `Check in แล้ว (${this.attendanceStatusLabel(status)})`,
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

    this.data.updateAttendance(openAttendance.id, {
      checkOutTime: new Date().toISOString()
    });
    this.notifications.success('Check out แล้ว', 'ลงเวลา');
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
  }

  protected setLeaveStatus(leave: LeaveRequest, status: 'approved' | 'rejected'): void {
    const student = this.userName(leave.studentId);
    this.data.updateLeaveStatus(leave.id, status);
    
    if (status === 'approved') {
      this.notifications.success(`อนุมัติคำขอลาของ ${student} แล้ว`, 'การลา');
    } else {
      this.notifications.warning(`ปฏิเสธคำขอลาของ ${student} แล้ว`, 'การลา');
    }
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

  private finishLogin(user: User, showNotification = true): void {
    this.currentUserId = user.id;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.sessionKey, user.id.toString());
    }
    this.loginError = '';
    
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
      resumeUrl: user.resumeUrl ?? ''
    };
    this.evaluationType = user.role === 'advisor' ? 'advisor' : 'mentor';
  }

  private today(): string {
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
  }

  protected async deleteAdminCode(code: any): Promise<void> {
    if (confirm(`คุณแน่ใจหรือไม่ที่จะลบรหัสเชิญ "${code.code}"?`)) {
      const res = await this.data.deleteAdminCode(code.id);
      if (res && res.error) {
        this.notifications.error(res.error, 'จัดการรหัสเชิญ');
      } else {
        this.notifications.success(`ลบรหัสเชิญ "${code.code}" สำเร็จ`, 'จัดการรหัสเชิญ');
      }
    }
  }
}
