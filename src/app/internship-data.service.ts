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
  Logbook,
  LogbookStatus,
  RegisterInput,
  User
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

  /** Set after API load attempt */
  apiConnected = false;
  apiLoadError = '';

  constructor() {
    if (environment.useMockData) {
      this.seedDemoData();
      this.loadFromStorage();
    } else {
      void this.refreshFromApi();
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
    this.apiConnected = true;
    this.apiLoadError = '';
  }

  companyForUser(userId: number): Company | undefined {
    return this.companies.find((c) => c.userId === userId);
  }

  companyIdForUser(userId: number): number | undefined {
    return this.companyForUser(userId)?.id;
  }

  addStudent(student: Omit<User, 'id' | 'role' | 'status'> & { advisorId: number }): void {
    this.users = [...this.users, { ...student, id: this.nextId(this.users), role: 'student', status: 'active' }];
    this.persist();
  }

  emailExists(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    return this.users.some((user) => user.email.toLowerCase() === normalized);
  }

  async login(email: string, password: string): Promise<User | null> {
    if (this.api.apiEnabled()) {
      const user = await firstValueFrom(this.api.login(email, password));
      if (user && !this.users.some((item) => item.id === user.id)) {
        this.users = [...this.users, user];
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

    if (password.length < (this.api.apiEnabled() ? 8 : 6)) {
      return { error: this.api.apiEnabled() ? 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' : 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' };
    }

    if (this.emailExists(email)) {
      return { error: 'อีเมลนี้ถูกใช้งานแล้ว' };
    }

    if (input.role === 'company' && !input.companyName?.trim()) {
      return { error: 'กรุณากรอกชื่อบริษัท' };
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
        return { error: 'ลงทะเบียนไม่สำเร็จ ตรวจสอบการเชื่อมต่อ API' };
      }

      this.users = [...this.users, created];
      await this.refreshFromApi();
      const user = this.users.find((u) => u.id === created.id) ?? created;
      return { user };
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
    this.users = this.users.map((user) => (user.id === userId ? { ...user, ...updates } : user));
    this.persist();
  }

  addJob(job: Omit<JobPosting, 'id' | 'status' | 'createdAt' | 'updatedAt'>): void {
    this.jobPostings = [
      ...this.jobPostings,
      { ...job, id: this.nextId(this.jobPostings), status: 'open' }
    ];
    this.persist();
  }

  addApplication(application: Omit<Application, 'id' | 'updatedAt'>): void {
    if (this.api.apiEnabled()) {
      void firstValueFrom(this.api.createApplication(application)).then((created) => {
        if (created) {
          this.applications = [...this.applications, created];
        }
      });
      return;
    }

    this.applications = [...this.applications, { ...application, id: this.nextId(this.applications) }];
    this.persist();
  }

  updateApplicationStatus(application: Application, status: ApplicationStatus): void {
    if (this.api.apiEnabled()) {
      void firstValueFrom(this.api.patchApplication(application.id, status)).then((updated) => {
        if (updated) {
          this.applications = this.applications.map((item) =>
            item.id === application.id ? updated : item
          );
        }
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
      void firstValueFrom(this.api.createInternship(internship)).then((created) => {
        if (created) {
          this.internships = [...this.internships, created];
        }
      });
      return;
    }

    this.internships = [...this.internships, { ...internship, id: this.nextId(this.internships) }];
    this.persist();
  }

  addAttendance(attendance: Omit<Attendance, 'id' | 'createdAt'>): void {
    if (this.api.apiEnabled()) {
      void firstValueFrom(this.api.createAttendance(attendance)).then((created) => {
        if (created) {
          this.attendances = [...this.attendances, created];
        }
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
      ).then((updated) => {
        if (updated) {
          this.attendances = this.attendances.map((a) => (a.id === attendanceId ? updated : a));
        }
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
      void firstValueFrom(this.api.createLogbook(payload)).then((created) => {
        if (created) {
          this.logbooks = [...this.logbooks, created];
        }
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
      ).then((updated) => {
        if (updated) {
          this.logbooks = this.logbooks.map((item) => (item.id === logbook.id ? updated : item));
        }
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
      void firstValueFrom(this.api.createEvaluation(evaluation)).then((created) => {
        if (created) {
          this.evaluations = [...this.evaluations, created];
        }
      });
      return;
    }

    this.evaluations = [...this.evaluations, { ...evaluation, id: this.nextId(this.evaluations) }];
    this.persist();
  }

  resetDemoData(): void {
    if (!this.hasLocalStorage()) {
      return;
    }

    localStorage.removeItem(this.storageKey);
    window.location.reload();
  }

  private seedDemoData(): void {
    this.users = [
      { id: 1, name: 'ผู้ดูแลระบบ', email: 'admin@demo.local', password: 'admin123', role: 'admin', status: 'active' },
      {
        id: 2,
        name: 'อ.มณีรัตน์ ศรีสุข',
        email: 'advisor@demo.ac.th',
        password: 'advisor123',
        role: 'advisor',
        status: 'active',
        phone: '081-000-0001',
        school: 'มหาวิทยาลัยเทคโนโลยีราชมงคล'
      },
      {
        id: 3,
        name: 'นัทธพงศ์ ใจดี',
        email: 'student@demo.ac.th',
        password: 'student123',
        role: 'student',
        status: 'active',
        advisorId: 2,
        phone: '081-111-2222',
        school: 'มหาวิทยาลัยเทคโนโลยีราชมงคล',
        resumeUrl: '/uploads/resume-natthapong.pdf'
      },
      {
        id: 4,
        name: 'บริษัท โปรเกรสซอฟต์ จำกัด',
        email: 'company@demo.co.th',
        password: 'company123',
        role: 'company',
        status: 'active'
      },
      {
        id: 5,
        name: 'ชลธิชา แสงทอง',
        email: 'chonthicha@demo.ac.th',
        password: 'student123',
        role: 'student',
        status: 'active',
        advisorId: 2,
        phone: '082-333-4444',
        school: 'มหาวิทยาลัยเทคโนโลยีราชมงคล'
      },
      {
        id: 6,
        name: 'อ.สมชาย รักเรียน',
        email: 'advisor2@demo.ac.th',
        password: 'advisor123',
        role: 'advisor',
        status: 'active',
        school: 'วิทยาลัยเทคนิคกรุงเทพ'
      },
      {
        id: 7,
        name: 'วิภาวดี ดีเลิศ',
        email: 'student2@demo.ac.th',
        password: 'student123',
        role: 'student',
        status: 'pending',
        advisorId: 6,
        school: 'วิทยาลัยเทคนิคกรุงเทพ'
      }
    ];

    this.companies = [
      {
        id: 1,
        userId: 4,
        companyName: 'ProgressSoft',
        description: 'Software house',
        address: 'กรุงเทพฯ',
        website: 'https://progresssoft.example',
        contactEmail: 'hr@demo.co.th'
      },
      {
        id: 2,
        userId: 0,
        companyName: 'Northwind Digital',
        description: 'E-commerce',
        address: 'เชียงใหม่',
        contactEmail: 'jobs@northwind.example'
      }
    ];

    this.jobPostings = [
      {
        id: 1,
        companyId: 1,
        title: 'Frontend Intern',
        description: 'พัฒนา UI ด้วย Angular',
        requirements: 'TypeScript, HTML, CSS',
        benefits: 'Hybrid, mentor ประจำทีม',
        slots: 3,
        status: 'open'
      },
      {
        id: 2,
        companyId: 1,
        title: 'QA Intern',
        description: 'ทดสอบระบบและเขียน test case',
        requirements: 'API testing, attention to detail',
        benefits: 'On-site',
        slots: 2,
        status: 'open'
      },
      {
        id: 3,
        companyId: 2,
        title: 'Digital Marketing Intern',
        description: 'Content และ SEO',
        requirements: 'Analytics basics',
        benefits: 'Remote',
        slots: 1,
        status: 'open'
      }
    ];

    this.applications = [
      {
        id: 1,
        studentId: 3,
        jobPostingId: 1,
        status: 'approved',
        appliedAt: '2026-05-20T10:00:00Z'
      },
      {
        id: 2,
        studentId: 5,
        jobPostingId: 2,
        status: 'pending',
        appliedAt: '2026-05-24T14:30:00Z'
      }
    ];

    this.internships = [
      {
        id: 1,
        studentId: 3,
        companyId: 1,
        jobPostingId: 1,
        startDate: '2026-06-01',
        endDate: '2026-09-30',
        status: 'active'
      }
    ];

    this.attendances = [
      {
        id: 1,
        internshipId: 1,
        studentId: 3,
        checkInTime: '2026-06-01T08:45:00',
        checkOutTime: '2026-06-01T17:10:00',
        status: 'present'
      }
    ];

    this.logbooks = [
      {
        id: 1,
        internshipId: 1,
        title: 'วันแรกฝึกงาน',
        content: 'ออกแบบหน้าจอรายการสมัครงานและแก้ responsive layout',
        status: 'approved',
        mentorComment: 'งานดี ตรงตามแผน'
      }
    ];

    this.evaluations = [
      {
        id: 1,
        internshipId: 1,
        evaluatorId: 4,
        score: 88,
        feedback: 'ตรงเวลา เรียนรู้งานเร็ว และสื่อสารดี',
        evaluationType: 'mentor'
      }
    ];
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
        evaluations: this.evaluations
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
    } catch {
      localStorage.removeItem(this.storageKey);
    }
  }

  private hasLocalStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }
}
