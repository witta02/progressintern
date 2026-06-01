import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../environments/environment';
import { InternshipDataService } from './internship-data.service';
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
  Role,
  User
} from './internship.models';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly data = inject(InternshipDataService);
  protected readonly useMockData = environment.useMockData;
  protected readonly schemaTables = DB_SCHEMA_TABLES;

  protected currentUserId: number | null = null;
  protected activeView = 'dashboard';
  protected loginError = '';
  protected notice = '';
  protected loginForm = {
    email: 'student@demo.ac.th',
    password: 'student123'
  };

  protected newStudent = {
    name: '',
    email: '',
    password: 'student123'
  };

  protected profileDraft = {
    phone: '',
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
    logbooks: 'Logbook',
    evaluations: 'ประเมินผล',
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
      return [`${this.visibleInternships.length} internship ของฉัน`, `${this.visibleApplications.length} ใบสมัครของฉัน`];
    }

    if (this.currentUser.role === 'company') {
      return [`${this.visibleInternships.length} นักศึกษาฝึกงาน`, `${this.visibleApplications.length} ใบสมัคร`];
    }

    if (this.currentUser.role === 'advisor') {
      return [`${this.managedStudents.length} นักศึกษา`, `${this.visibleInternships.length} internship`];
    }

    return [`${this.users.length} users`, `${this.internships.length} internships`];
  }

  protected get availableViews(): string[] {
    const viewsByRole: Record<Role, string[]> = {
      admin: ['dashboard', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'evaluations', 'schema'],
      advisor: ['dashboard', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'evaluations'],
      student: ['dashboard', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'evaluations'],
      company: ['dashboard', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'evaluations']
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
        { label: 'นักศึกษาในความดูแล', value: this.managedStudents.length, helper: 'mock: ผูก advisorId' },
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

    return this.users.filter(
      (user) => user.role === 'student' && user.advisorId === this.currentUser.id
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

  protected login(): void {
    const email = this.loginForm.email.trim().toLowerCase();
    const user = this.users.find(
      (item) => item.email.toLowerCase() === email && item.password === this.loginForm.password
    );

    if (!user) {
      this.loginError = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      return;
    }

    this.finishLogin(user);
  }

  protected useDemoAccount(user: User): void {
    this.loginForm = {
      email: user.email,
      password: user.password ?? ''
    };
  }

  protected logout(): void {
    this.currentUserId = null;
    this.activeView = 'dashboard';
    this.loginError = '';
    this.notice = '';
    this.selectedEvaluationInternshipId = null;
  }

  protected setActiveView(view: string): void {
    this.activeView = this.availableViews.includes(view) ? view : 'dashboard';
    this.notice = '';

    if (this.activeView === 'evaluations') {
      this.selectedEvaluationInternshipId = this.visibleInternships[0]?.id ?? null;
      this.evaluationType = this.currentUser.role === 'advisor' ? 'advisor' : 'mentor';
    }
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
      job.status === 'open' &&
      !this.applications.some(
        (application) =>
          application.studentId === this.currentUser.id && application.jobPostingId === job.id
      )
    );
  }

  protected applyJob(job: JobPosting): void {
    if (!this.canApply(job)) {
      return;
    }

    this.data.addApplication({
      studentId: this.currentUser.id,
      jobPostingId: job.id,
      status: 'pending',
      appliedAt: new Date().toISOString()
    });
    this.notice = `สมัครตำแหน่ง ${job.title} แล้ว รอการพิจารณาจากบริษัท`;
    this.setActiveView('applications');
  }

  protected updateApplication(application: Application, status: ApplicationStatus): void {
    this.data.updateApplicationStatus(application, status);
    this.notice = `อัปเดตใบสมัครของ ${this.userName(application.studentId)} เป็น ${status}`;

    if (
      status !== 'approved' ||
      this.internships.some((internship) => internship.studentId === application.studentId)
    ) {
      return;
    }

    const job = this.jobPostings.find((item) => item.id === application.jobPostingId);
    if (!job) {
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
    this.notice = `อนุมัติใบสมัครและสร้าง internship ให้ ${this.userName(application.studentId)} แล้ว`;
  }

  protected addStudent(): void {
    if (!this.newStudent.name.trim() || !this.newStudent.email.trim()) {
      this.notice = 'กรุณากรอกชื่อนักศึกษาและอีเมล';
      return;
    }

    if (this.users.some((user) => user.email.toLowerCase() === this.newStudent.email.trim().toLowerCase())) {
      this.notice = 'อีเมลนี้มีอยู่ในระบบแล้ว';
      return;
    }

    if (this.newStudent.password.trim().length < 6) {
      this.notice = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
      return;
    }

    this.data.addStudent({
      name: this.newStudent.name.trim(),
      email: this.newStudent.email.trim(),
      password: this.newStudent.password.trim(),
      advisorId: this.currentUser.id
    });
    this.notice = `สร้างบัญชีนักศึกษา ${this.newStudent.name.trim()} แล้ว`;
    this.newStudent = { name: '', email: '', password: 'student123' };
  }

  protected saveProfile(): void {
    this.data.updateUser(this.currentUser.id, {
      phone: this.profileDraft.phone,
      resumeUrl: this.profileDraft.resumeUrl
    });
    this.notice = 'บันทึกข้อมูลส่วนตัวแล้ว';
  }

  protected addJob(): void {
    if (!this.currentCompanyId || !this.newJob.title.trim()) {
      this.notice = 'กรุณากรอกชื่อตำแหน่งงาน';
      return;
    }

    this.data.addJob({
      companyId: this.currentCompanyId,
      title: this.newJob.title.trim(),
      description: this.newJob.description.trim() || 'รายละเอียดงานฝึกงาน',
      requirements: this.newJob.requirements.trim() || 'พร้อมเรียนรู้งาน',
      benefits: this.newJob.benefits.trim() || undefined,
      slots: Number(this.newJob.slots) || 1
    });
    this.newJob = { title: '', description: '', requirements: '', benefits: '', slots: 1 };
    this.notice = 'โพสต์ตำแหน่งงานใหม่แล้ว';
  }

  protected checkIn(): void {
    if (!this.activeInternship || this.hasOpenAttendance()) {
      this.notice = this.hasOpenAttendance()
        ? 'มีรายการ check in ที่ยังไม่ได้ check out'
        : 'ยังไม่มี internship ที่ active';
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
    this.notice = `Check in แล้ว (${status})`;
  }

  protected checkOut(): void {
    const openAttendance = this.attendances.find(
      (attendance) =>
        attendance.internshipId === this.activeInternship?.id && !attendance.checkOutTime
    );

    if (!openAttendance) {
      this.notice = 'ยังไม่มีรายการ check in ที่เปิดอยู่';
      return;
    }

    this.data.updateAttendance(openAttendance.id, {
      checkOutTime: new Date().toISOString()
    });
    this.notice = 'Check out แล้ว';
  }

  protected setAttendanceStatus(attendance: Attendance, status: AttendanceStatus): void {
    this.data.setAttendanceStatus(attendance, status);
    this.notice = `อัปเดตสถานะเวลาของ ${this.userName(attendance.studentId)} เป็น ${status}`;
  }

  protected addLogbook(): void {
    if (!this.activeInternship || !this.logbookTitle.trim() || !this.logbookText.trim()) {
      this.notice = !this.activeInternship
        ? 'ยังไม่มี internship ที่ active'
        : 'กรุณากรอกหัวข้อและเนื้อหา logbook';
      return;
    }

    this.data.addLogbook({
      internshipId: this.activeInternship.id,
      title: this.logbookTitle.trim(),
      content: this.logbookText.trim()
    });
    this.logbookTitle = '';
    this.logbookText = '';
    this.notice = 'ส่ง Logbook แล้ว (status: pending)';
  }

  protected reviewLogbook(logbook: Logbook, status: LogbookStatus): void {
    this.data.updateLogbookStatus(
      logbook,
      status,
      status === 'approved' ? 'รับรองโดย mentor' : 'ต้องแก้ไขและส่งใหม่'
    );
    this.notice = `อัปเดต Logbook ของ ${this.userName(this.internshipFor(logbook.internshipId)?.studentId || 0)} เป็น ${status}`;
  }

  protected addEvaluation(): void {
    if (!this.selectedEvaluationInternship || !this.evaluationFeedback.trim()) {
      this.notice = !this.selectedEvaluationInternship
        ? 'กรุณาเลือกนักศึกษาที่ต้องการประเมิน'
        : 'กรุณากรอก feedback';
      return;
    }

    this.data.addEvaluation({
      internshipId: this.selectedEvaluationInternship.id,
      evaluatorId: this.currentUser.id,
      score: Number(this.evaluationScore),
      feedback: this.evaluationFeedback.trim(),
      evaluationType: this.evaluationType
    });
    this.evaluationFeedback = '';
    this.evaluationScore = 85;
    this.notice = `บันทึกการประเมิน ${this.userName(this.selectedEvaluationInternship.studentId)} แล้ว`;
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
    this.data.resetDemoData();
  }

  private finishLogin(user: User): void {
    this.currentUserId = user.id;
    this.loginError = '';
    this.notice = `เข้าสู่ระบบเป็น ${this.roleName(user.role)} แล้ว`;
    this.setActiveView('dashboard');
    this.selectedEvaluationInternshipId = this.visibleInternships[0]?.id ?? null;
    this.profileDraft = {
      phone: user.phone ?? '',
      resumeUrl: user.resumeUrl ?? ''
    };
    this.evaluationType = user.role === 'advisor' ? 'advisor' : 'mentor';
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
