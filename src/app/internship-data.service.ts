import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { InternshipApiService } from './api/internship-api.service';
import {
  Application,
  ApplicationStatus,
  Attendance,
  AttendanceStatus,
  Company,
  Evaluation,
  EvaluationType,
  Internship,
  JobPosting,
  LeaveRequest,
  Logbook,
  LogbookStatus,
  RegisterInput,
  Role,
  User,
  UserStatus,
  VerificationStatus
} from './internship.models';

@Injectable({ providedIn: 'root' })
export class InternshipDataService {
  private readonly api = inject(InternshipApiService);
  private readonly storageKey = 'intern-manager-state-v2';

  users: User[] = [];
  companies: Company[] = [];
  jobPostings: JobPosting[] = [];
  applications: Application[] = [];
  internships: Internship[] = [];
  attendances: Attendance[] = [];
  logbooks: Logbook[] = [];
  evaluations: Evaluation[] = [];
  leaves: LeaveRequest[] = [];

  /** Set after API load attempt */
  apiConnected = false;
  apiLoadError = '';

  constructor() {
    if (environment.useMockData) {
      this.seedDemoData();
      this.loadFromStorage();
    } else {
      if (typeof window !== 'undefined') {
        void this.refreshFromApi();
      }
    }
  }

  async refreshFromApi(): Promise<void> {
    const snapshot = await firstValueFrom(this.api.loadAll());

    if (!snapshot) {
      this.apiConnected = false;
      this.apiLoadError = 'Cannot reach backend. Check proxy.conf.json and that the API is running.';
      return;
    }

    this.users = snapshot.users;
    this.companies = snapshot.companies;
    this.jobPostings = snapshot.jobPostings;
    this.applications = snapshot.applications;
    this.internships = snapshot.internships;
    this.attendances = snapshot.attendances;
    this.logbooks = snapshot.logbooks;
    this.evaluations = snapshot.evaluations;
    this.leaves = snapshot.leaves;
    this.apiConnected = true;
    this.apiLoadError = '';
  }

  companyForUser(userId: number): Company | undefined {
    return this.companies.find((c) => c.userId === userId);
  }

  companyIdForUser(userId: number): number | undefined {
    return this.companyForUser(userId)?.id;
  }

  addStudent(student: Omit<User, 'id' | 'role' | 'status' | 'password'> & { password?: string, advisorId: number }): void {
    const payload = { ...student, role: 'student' as Role, status: 'active' as UserStatus };
    if (this.api.apiEnabled()) {
      void firstValueFrom(this.api.registerWithoutLogin({
        name: student.name,
        email: student.email,
        password: student.password || 'student123',
        role: 'student',
        school: student.school
      })).then(() => {
        void this.refreshFromApi();
      });
      return;
    }
    this.users = [...this.users, { ...payload, id: this.nextId(this.users), password: student.password || 'student123' }];
    this.persist();
  }

  emailExists(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    return this.users.some((user) => user.email.toLowerCase() === normalized);
  }

  async login(email: string, password: string): Promise<User | null> {
    if (this.api.apiEnabled()) {
      const user = await firstValueFrom(this.api.login(email, password));
      if (user) {
        // Add to local array if not present
        if (!this.users.some(u => u.id === user.id)) {
          this.users = [...this.users, user];
        } else {
          this.users = this.users.map(u => u.id === user.id ? user : u);
        }
        // Refresh local data to ensure we have everything
        void this.refreshFromApi();
      }
      return user;
    }

    return this.users.find(
      (item) => item.email.toLowerCase() === email && item.password === password
    ) ?? null;
  }

  async register(input: RegisterInput): Promise<{ user: User } | { error: string }> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    if (!name || !email || !password) {
      return { error: 'กรุณากรอกชื่อ อีเมล และรหัสผ่าน' };
    }

    if (this.api.apiEnabled()) {
      const created = await firstValueFrom(
        this.api.register({
          name,
          email,
          password,
          role: input.role,
          phone: input.phone?.trim() || undefined,
          school: input.school?.trim() || undefined,
          company_name: input.companyName?.trim(),
          description: input.description?.trim(),
          address: input.address?.trim(),
          contact_email: input.contactEmail?.trim() || email
        })
      );

      if (!created) {
        return { error: 'ลงทะเบียนไม่สำเร็จ ตรวจสอบการเชื่อมต่อ API หรืออีเมลอาจซ้ำ' };
      }

      await this.refreshFromApi();
      const user = this.users.find((u) => u.id === created.id) ?? created;
      return { user };
    }

    if (this.emailExists(email)) {
      return { error: 'อีเมลนี้ถูกใช้งานแล้ว' };
    }

    const now = new Date().toISOString();
    const user: User = {
      id: this.nextId(this.users),
      name,
      email,
      password,
      role: input.role,
      status: input.role === 'student' ? 'pending' : 'active',
      phone: input.phone?.trim() || undefined,
      school: input.school?.trim() || undefined,
      createdAt: now,
      updatedAt: now
    };

    this.users = [...this.users, user];

    if (input.role === 'company') {
      const company: Company = {
        id: this.nextId(this.companies),
        userId: user.id,
        companyName: input.companyName!.trim(),
        description: input.description?.trim() || undefined,
        address: input.address?.trim() || undefined,
        contactEmail: input.contactEmail?.trim() || email,
        createdAt: now,
        updatedAt: now
      };
      this.companies = [...this.companies, company];
    }

    this.persist();
    return { user };
  }

  updateUser(userId: number, updates: Partial<User>): void {
    if (this.api.apiEnabled()) {
      void firstValueFrom(this.api.updateUser(userId, updates)).then(() => {
        void this.refreshFromApi();
      });
      return;
    }

    this.users = this.users.map((user) => (user.id === userId ? { ...user, ...updates } : user));
    this.persist();
  }

  addJob(job: Omit<JobPosting, 'id' | 'status' | 'createdAt' | 'updatedAt'>): void {
    if (this.api.apiEnabled()) {
      void firstValueFrom(this.api.createJob(job)).then(() => {
        void this.refreshFromApi();
      });
    } else {
      this.jobPostings = [
        ...this.jobPostings,
        { 
          ...job, 
          id: this.nextId(this.jobPostings), 
          status: 'open',
          checkinTime: job.checkinTime || '09:00:00',
          checkoutTime: job.checkoutTime || '17:00:00',
          latedTime: job.latedTime || '09:15:00',
          workDays: job.workDays || 'Monday - Friday'
        }
      ];
      this.persist();
    }
  }

  deleteJob(id: number): void {
    if (this.api.apiEnabled()) {
      void firstValueFrom(this.api.deleteJob(id)).then(() => {
        void this.refreshFromApi();
      });
      return;
    }

    this.jobPostings = this.jobPostings.filter((job) => job.id !== id);
    this.persist();
  }

  setAttendanceVerification(attendance: Attendance, verificationStatus: VerificationStatus): void {
    if (this.api.apiEnabled()) {
      void firstValueFrom(
        this.api.patchAttendance(attendance, { verificationStatus })
      ).then(() => {
        void this.refreshFromApi();
      });
      return;
    }

    this.attendances = this.attendances.map((a) =>
      a.id === attendance.id
        ? {
            ...a,
            verificationStatus,
            status: verificationStatus === 'rejected' ? 'absent' : a.status
          }
        : a
    );
    this.persist();
  }

  addApplication(application: Omit<Application, 'id' | 'updatedAt'>): void {
    if (this.api.apiEnabled()) {
      void firstValueFrom(this.api.createApplication(application)).then(() => {
        void this.refreshFromApi();
      });
      return;
    }

    this.applications = [...this.applications, { ...application, id: this.nextId(this.applications) }];
    this.persist();
  }

  updateApplicationStatus(application: Application, status: ApplicationStatus): void {
    if (this.api.apiEnabled()) {
      void firstValueFrom(this.api.patchApplication(application.id, status)).then(() => {
        void this.refreshFromApi();
      });
      return;
    }

    this.applications = this.applications.map((item) =>
      item.id === application.id ? { ...item, status, updatedAt: new Date().toISOString() } : item
    );
    this.persist();
  }

  addInternship(internship: Omit<Internship, 'id' | 'createdAt' | 'updatedAt'>): void {
    if (this.api.apiEnabled()) {
      void firstValueFrom(this.api.createInternship(internship)).then(() => {
        void this.refreshFromApi();
      });
      return;
    }

    this.internships = [...this.internships, { ...internship, id: this.nextId(this.internships) }];
    this.persist();
  }

  addAttendance(attendance: Omit<Attendance, 'id' | 'createdAt'>): void {
    if (this.api.apiEnabled()) {
      void firstValueFrom(this.api.createAttendance(attendance)).then(() => {
        void this.refreshFromApi();
      });
      return;
    }

    this.attendances = [...this.attendances, { ...attendance, id: this.nextId(this.attendances) }];
    this.persist();
  }

  updateAttendance(attendanceId: number, updates: Partial<Attendance>): void {
    if (this.api.apiEnabled()) {
      const attendance = this.attendances.find((item) => item.id === attendanceId);
      if (!attendance) {
        return;
      }

      void firstValueFrom(
        this.api.patchAttendance(attendance, {
          checkOutTime: updates.checkOutTime,
          status: updates.status
        })
      ).then(() => {
        void this.refreshFromApi();
      });
      return;
    }

    this.attendances = this.attendances.map((a) => (a.id === attendanceId ? { ...a, ...updates } : a));
    this.persist();
  }

  setAttendanceStatus(attendance: Attendance, status: AttendanceStatus): void {
    this.updateAttendance(attendance.id, { status });
  }

  addLogbook(logbook: Omit<Logbook, 'id' | 'createdAt' | 'updatedAt' | 'mentorComment' | 'status'>): void {
    const payload = { ...logbook, status: 'pending' as LogbookStatus };

    if (this.api.apiEnabled()) {
      void firstValueFrom(this.api.createLogbook(payload)).then(() => {
        void this.refreshFromApi();
      });
      return;
    }

    this.logbooks = [...this.logbooks, { ...payload, id: this.nextId(this.logbooks) }];
    this.persist();
  }

  updateLogbookStatus(logbook: Logbook, status: LogbookStatus, mentorComment?: string): void {
    if (this.api.apiEnabled()) {
      void firstValueFrom(
        this.api.patchLogbook(logbook.id, { status, mentorComment })
      ).then(() => {
        void this.refreshFromApi();
      });
      return;
    }

    this.logbooks = this.logbooks.map((item) =>
      item.id === logbook.id ? { ...item, status, mentorComment: mentorComment ?? item.mentorComment } : item
    );
    this.persist();
  }

  addEvaluation(evaluation: Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>): void {
    if (this.api.apiEnabled()) {
      void firstValueFrom(this.api.createEvaluation(evaluation)).then(() => {
        void this.refreshFromApi();
      });
      return;
    }

    this.evaluations = [...this.evaluations, { ...evaluation, id: this.nextId(this.evaluations) }];
    this.persist();
  }

  addLeave(leave: Omit<LeaveRequest, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'approvedAt'>): void {
    if (this.api.apiEnabled()) {
      void firstValueFrom(this.api.createLeave(leave)).then(() => {
        void this.refreshFromApi();
      });
      return;
    }

    this.leaves = [...this.leaves, { ...leave, id: this.nextId(this.leaves), status: 'pending', createdAt: new Date().toISOString() }];
    this.persist();
  }

  updateLeaveStatus(leaveId: number, status: 'approved' | 'rejected', comment?: string): void {
    if (this.api.apiEnabled()) {
      void firstValueFrom(this.api.patchLeaveStatus(leaveId, status, comment)).then(() => {
        void this.refreshFromApi();
      });
      return;
    }

    this.leaves = this.leaves.map((l) => l.id === leaveId ? { ...l, status, comment, approvedAt: status === 'approved' ? new Date().toISOString() : undefined } : l);
    this.persist();
  }

  private seedDemoData(): void {
    this.users = [];
    this.companies = [];
    this.jobPostings = [];
    this.applications = [];
    this.internships = [];
    this.attendances = [];
    this.logbooks = [];
    this.evaluations = [];
    this.leaves = [];
  }

  private nextId(items: { id: number }[]): number {
    return Math.max(0, ...items.map((item) => item.id)) + 1;
  }

  private persist(): void {
    if (!environment.useMockData || !this.hasLocalStorage()) {
      return;
    }

    localStorage.setItem(
      this.storageKey,
      JSON.stringify({
        users: this.users,
        companies: this.companies,
        jobPostings: this.jobPostings,
        applications: this.applications,
        internships: this.internships,
        attendances: this.attendances,
        logbooks: this.logbooks,
        evaluations: this.evaluations,
        leaves: this.leaves
      })
    );
  }

  private loadFromStorage(): void {
    if (!this.hasLocalStorage()) {
      return;
    }

    const rawState = localStorage.getItem(this.storageKey);
    if (!rawState) {
      return;
    }

    try {
      const state = JSON.parse(rawState) as Partial<InternshipDataService>;
      this.users = Array.isArray(state.users) ? state.users : this.users;
      this.companies = Array.isArray(state.companies) ? state.companies : this.companies;
      this.jobPostings = Array.isArray(state.jobPostings) ? state.jobPostings : this.jobPostings;
      this.applications = Array.isArray(state.applications) ? state.applications : this.applications;
      this.internships = Array.isArray(state.internships) ? state.internships : this.internships;
      this.attendances = Array.isArray(state.attendances) ? state.attendances : this.attendances;
      this.logbooks = Array.isArray(state.logbooks) ? state.logbooks : this.logbooks;
      this.evaluations = Array.isArray(state.evaluations) ? state.evaluations : this.evaluations;
      this.leaves = Array.isArray(state.leaves) ? state.leaves : this.leaves;
    } catch {
      localStorage.removeItem(this.storageKey);
    }
  }

  private hasLocalStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }
}
