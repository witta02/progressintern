import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
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
  User
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
  protected readonly useMockData = environment.useMockData;
  protected readonly schemaTables = DB_SCHEMA_TABLES;

  private readonly sessionKey = 'intern-manager-session-v1';

  protected currentUserId: number | null = null;

  constructor() {
    this.loadSession();
    setTimeout(() => {
      this.notifications.info('ยินดีต้อนรับเข้าสู่ระบบจัดการฝึกงาน', 'ระบบพร้อมใช้งาน');
    }, 1000);
  }

  private loadSession(): void {
    if (typeof localStorage === 'undefined') return;
    const saved = localStorage.getItem(this.sessionKey);
    if (saved) {
      const id = parseInt(saved, 10);
      if (!isNaN(id)) {
        this.currentUserId = id;
        setTimeout(() => {
          const user = this.users.find((u) => u.id === id);
          if (user) {
            this.finishLogin(user, false);
          } else {
            this.logout();
          }
        }, 200);
      }
    }
  }
  protected sidebarOpen = true;
  protected activeView = 'dashboard';
  protected authMode: 'login' | 'register' = 'login';
  protected loginError = '';
  protected registerError = '';
  protected registerLoading = false;
  protected notificationPanelOpen = false;
  
  protected studentSearchQuery = '';

  protected loginForm = {
    email: 'student@demo.ac.th',
    password: 'student123'
  };

  protected registerForm = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student' as RegisterRole,
    phone: '',
    school: '',
    companyName: '',
    description: '',
    address: '',
    contactEmail: ''
  };

  protected readonly registerRoleOptions: { value: RegisterRole; label: string }[] = [
    { value: 'student', label: 'นักศึกษา (student)' },
    { value: 'advisor', label: 'ครูอาจารย์ (teacher/advisor)' },
    { value: 'company', label: 'บริษัท (company)' }
  ];

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

  protected newJob = {
    title: '',
    description: '',
    requirements: '',
    benefits: '',
    slots: 1
  };

  protected logbookTitle = '';
  protected logbookText = '';
  protected evaluationFeedback = '';
  protected evaluationScore = 85;
  protected evaluationType: EvaluationType = 'mentor';
  protected selectedEvaluationInternshipId: number | null = null;

  protected readonly viewLabels: Record<string, string> = {
    dashboard: 'ภาพรวม',
    jobs: 'ตำแหน่งงาน',
    applications: 'การสมัคร',
    internships: 'ฝึกงาน',
    attendance: 'ลงเวลา',
    logbooks: 'บันทึก',
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

  protected get currentUser(): User {
    return this.users.find((user) => user.id === this.currentUserId) ?? this.users[0];
  }

  protected get isAuthenticated(): boolean {
    return this.currentUserId !== null;
  }

  protected get demoUsers(): User[] {
    return this.users.filter((user) => user.password);
  }

  protected get roleLabel(): string {
    return this.roleName(this.currentUser.role);
  }

  protected get openAttendanceCount(): number {
    return this.visibleAttendances.filter((a) => !a.checkOutTime).length;
  }

  protected get topSummary(): string[] {
    if (this.currentUser.role === 'student') {
      return [`สถานะ: ${this.currentUser.status}`, `${this.visibleInternships.length} internship ของฉัน`];
    }

    if (this.currentUser.role === 'company') {
      return [`${this.visibleInternships.length} นักศึกษาฝึกงาน`, `${this.visibleApplications.length} ใบสมัคร`];
    }

    if (this.currentUser.role === 'advisor') {
      return [`สังกัด: ${this.currentUser.school}`, `${this.managedStudents.length} นักศึกษาในสังกัด`];
    }

    return [`${this.users.length} users`, `${this.internships.length} internships`];
  }

  protected get availableViews(): string[] {
    const viewsByRole: Record<Role, string[]> = {
      admin: ['dashboard', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'evaluations', 'edit', 'schema'],
      advisor: ['dashboard', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'evaluations', 'edit'],
      student: ['dashboard', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'evaluations', 'edit'],
      company: ['dashboard', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'evaluations', 'edit']
    };

    return viewsByRole[this.currentUser.role];
  }

  protected get dashboardMetrics() {
    if (this.currentUser.role === 'admin') {
      return [
        { label: 'ผู้ใช้ทั้งหมด', value: this.users.length, helper: 'ทุก role ในระบบ' },
        { label: 'บริษัททั้งหมด', value: this.companies.length, helper: 'สถานประกอบการที่ลงทะเบียน' },
        { label: 'ฝึกงานทั้งหมด', value: this.internships.length, helper: 'internship ทุกสถานะ' },
        { label: 'ยังไม่ check out', value: this.openAttendanceCount, helper: 'รายการลงเวลาที่ยังไม่จบ' }
      ];
    }

    if (this.currentUser.role === 'advisor') {
      return [
        { label: 'นักศึกษาในสังกัด', value: this.managedStudents.length, helper: 'นักศึกษาที่โรงเรียนเดียวกัน' },
        { label: 'ใบสมัครของนักศึกษา', value: this.visibleApplications.length, helper: 'ติดตามผลสมัครงาน' },
        { label: 'กำลังฝึกงาน', value: this.visibleInternships.length, helper: 'internship ของนักศึกษาในความดูแล' },
        { label: 'ยังไม่ check out', value: this.openAttendanceCount, helper: 'ติดตามการลงเวลา' }
      ];
    }

    if (this.currentUser.role === 'company') {
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
    return this.data.companyForUser(this.currentUser.id);
  }

  protected get currentCompanyId(): number | undefined {
    return this.data.companyIdForUser(this.currentUser.id);
  }

  protected get managedStudents(): User[] {
    if (this.currentUser.role === 'admin') {
      return this.users.filter((user) => user.role === 'student');
    }

    if (this.currentUser.role !== 'advisor') {
      return [];
    }

    // Advisor can see students with the same school name
    if (this.currentUser.school) {
      return this.users.filter(
        (user) => user.role === 'student' && user.school === this.currentUser.school
      );
    }

    return this.users.filter(
      (user) => user.role === 'student' && user.advisorId === this.currentUser.id
    );
  }
  
  protected get otherStudents(): User[] {
    if (this.currentUser.role !== 'advisor') return [];
    
    const query = this.studentSearchQuery.trim().toLowerCase();
    
    return this.users.filter(user => 
      user.role === 'student' && 
      user.school !== this.currentUser.school &&
      (user.school?.toLowerCase().includes(query) || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query))
    );
  }

  protected get visibleJobs(): JobPosting[] {
    if (this.currentUser.role === 'admin') {
      return this.jobPostings;
    }

    if (this.currentUser.role === 'company' && this.currentCompanyId) {
      return this.jobPostings.filter((job) => job.companyId === this.currentCompanyId);
    }

    return this.jobPostings;
  }

  protected get visibleApplications(): Application[] {
    if (this.currentUser.role === 'admin') {
      return this.applications;
    }

    if (this.currentUser.role === 'student') {
      return this.applications.filter((application) => application.studentId === this.currentUser.id);
    }

    if (this.currentUser.role === 'company' && this.currentCompanyId) {
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
    if (this.currentUser.role === 'admin') {
      return this.internships;
    }

    if (this.currentUser.role === 'student') {
      return this.internships.filter((internship) => internship.studentId === this.currentUser.id);
    }

    if (this.currentUser.role === 'company' && this.currentCompanyId) {
      return this.internships.filter((internship) => internship.companyId === this.currentCompanyId);
    }

    const studentIds = this.managedStudents.map((student) => student.id);
    return this.internships.filter((internship) => studentIds.includes(internship.studentId));
  }

  protected get visibleAttendances(): Attendance[] {
    const internshipIds = this.visibleInternships.map((internship) => internship.id);
    return this.attendances.filter((attendance) => internshipIds.includes(attendance.internshipId));
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

  protected login(): void {
    const email = this.loginForm.email.trim().toLowerCase();
    const user = this.users.find(
      (item) => item.email.toLowerCase() === email && item.password === this.loginForm.password
    );

    if (!user) {
      this.loginError = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      this.notifications.error('อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'เข้าสู่ระบบไม่สำเร็จ');
      return;
    }

    this.finishLogin(user);
  }

  protected async register(): Promise<void> {
    this.registerError = '';

    if (this.registerForm.password !== this.registerForm.confirmPassword) {
      this.registerError = 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน';
      this.notifications.error('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน', 'สมัครสมาชิก');
      return;
    }

    this.registerLoading = true;

    const result = await this.data.register({
      name: this.registerForm.name,
      email: this.registerForm.email,
      password: this.registerForm.password,
      role: this.registerForm.role,
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

  protected useDemoAccount(user: User): void {
    this.loginForm = {
      email: user.email,
      password: user.password ?? ''
    };
    this.notifications.info(`เลือกบัญชี ${user.name} แล้ว กด Login เพื่อเข้าสู่ระบบ`, 'บัญชีทดสอบ');
  }

  protected logout(): void {
    this.currentUserId = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.sessionKey);
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
    this.activeView = this.availableViews.includes(view) ? view : 'dashboard';
    this.notificationPanelOpen = false;

    if (this.activeView === 'evaluations') {
      this.selectedEvaluationInternshipId = this.visibleInternships[0]?.id ?? null;
      this.evaluationType = this.currentUser.role === 'advisor' ? 'advisor' : 'mentor';
    }
    
    if (this.activeView === 'edit') {
      this.profileDraft = {
        name: this.currentUser.name,
        email: this.currentUser.email,
        phone: this.currentUser.phone ?? '',
        school: this.currentUser.school ?? '',
        resumeUrl: this.currentUser.resumeUrl ?? ''
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
    return (
      this.currentUser.role === 'student' &&
      this.currentUser.status === 'active' &&
      job.status === 'open' &&
      !this.applications.some(
        (application) =>
          application.studentId === this.currentUser.id && application.jobPostingId === job.id
      )
    );
  }

  protected applyJob(job: JobPosting): void {
    if (this.currentUser.status !== 'active') {
      this.notifications.warning('บัญชีของคุณยังไม่ได้รับการอนุมัติ', 'สมัครงาน');
      return;
    }
    
    if (!this.canApply(job)) {
      if (this.currentUser.role !== 'student') {
        this.notifications.warning('เฉพาะนักศึกษาจึงสมัครงานได้', 'สมัครงาน');
      } else if (job.status !== 'open') {
        this.notifications.warning('ตำแหน่งนี้ปิดรับสมัครแล้ว', 'สมัครงาน');
      } else {
        this.notifications.warning('คุณสมัครตำแหน่งนี้แล้ว', 'สมัครงาน');
      }
      return;
    }

    this.data.addApplication({
      studentId: this.currentUser.id,
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
    this.data.updateApplicationStatus(application, status);
    const student = this.userName(application.studentId);
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
    if (!this.newStudent.name.trim() || !this.newStudent.email.trim()) {
      this.notifications.warning('กรุณากรอกชื่อนักศึกษาและอีเมล', 'เพิ่มนักศึกษา');
      return;
    }

    if (this.users.some((user) => user.email.toLowerCase() === this.newStudent.email.trim().toLowerCase())) {
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
      advisorId: this.currentUser.id,
      school: this.currentUser.school
    });
    this.notifications.success(`สร้างบัญชีนักศึกษา ${name} แล้ว`, 'เพิ่มนักศึกษา');
    this.newStudent = { name: '', email: '', password: 'student123' };
  }
  
  protected approveStudent(student: User): void {
    this.data.updateUser(student.id, { status: 'active', school: this.currentUser.school });
    this.notifications.success(`อนุมัติและรับ ${student.name} เข้าสังกัดแล้ว`, 'จัดการนักศึกษา');
  }
  
  protected rejectStudent(student: User): void {
    this.data.updateUser(student.id, { status: 'rejected' });
    this.notifications.warning(`ปฏิเสธบัญชีของ ${student.name} แล้ว`, 'จัดการนักศึกษา');
  }
  
  protected claimStudent(student: User): void {
    this.data.updateUser(student.id, { school: this.currentUser.school, status: 'active' });
    this.notifications.success(`แก้ไขโรงเรียนและรับ ${student.name} เข้าสังกัดแล้ว`, 'จัดการนักศึกษา');
  }

  protected saveProfile(): void {
    this.data.updateUser(this.currentUser.id, {
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
      slots: Number(this.newJob.slots) || 1
    });
    this.newJob = { title: '', description: '', requirements: '', benefits: '', slots: 1 };
    this.notifications.success(`โพสต์ตำแหน่ง ${title} แล้ว`, 'ตำแหน่งงาน');
  }

  protected checkIn(): void {
    if (!this.activeInternship) {
      this.notifications.warning('ยังไม่มีฝึกงานที่ active', 'ลงเวลา');
      return;
    }

    if (this.hasOpenAttendance()) {
      this.notifications.warning('มีรายการ check in ที่ยังไม่ได้ check out', 'ลงเวลา');
      return;
    }

    const now = new Date();
    const hour = now.getHours();
    const status: AttendanceStatus = hour > 9 ? 'late' : 'present';

    this.data.addAttendance({
      internshipId: this.activeInternship.id,
      studentId: this.currentUser.id,
      checkInTime: now.toISOString(),
      status
    });
    this.notifications.success(
      `Check in แล้ว (${this.attendanceStatusLabel(status)})`,
      'ลงเวลา'
    );
  }

  protected checkOut(): void {
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

  protected setAttendanceStatus(attendance: Attendance, status: AttendanceStatus): void {
    this.data.setAttendanceStatus(attendance, status);
    this.notifications.success(
      `${this.userName(attendance.studentId)} → ${this.attendanceStatusLabel(status)}`,
      'อัปเดตการลงเวลา'
    );
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

  protected addEvaluation(): void {
    if (!this.selectedEvaluationInternship) {
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
      evaluatorId: this.currentUser.id,
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

  protected resetDemoData(): void {
    this.notifications.warning('กำลังรีเซ็ตข้อมูลทดสอบและโหลดหน้าใหม่', 'Demo data');
    this.data.resetDemoData();
  }

  private resetRegisterForm(): void {
    this.registerForm = {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'student',
      phone: '',
      school: '',
      companyName: '',
      description: '',
      address: '',
      contactEmail: ''
    };
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
    
    this.setActiveView('dashboard');
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

  private applicationStatusLabel(status: ApplicationStatus): string {
    return {
      pending: 'รอดำเนินการ',
      interview: 'นัดสัมภาษณ์',
      approved: 'อนุมัติ',
      rejected: 'ปฏิเสธ'
    }[status];
  }

  private attendanceStatusLabel(status: AttendanceStatus): string {
    return {
      present: 'มาตรงเวลา',
      late: 'สาย',
      absent: 'ขาด'
    }[status];
  }

  private logbookStatusLabel(status: LogbookStatus): string {
    return {
      pending: 'รออนุมัติ',
      approved: 'อนุมัติ',
      rejected: 'ปฏิเสธ'
    }[status];
  }
}
