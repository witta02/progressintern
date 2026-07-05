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
  EvaluationTemplate,
  EvaluationCriterion,
  EvaluationScore,
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
  VerificationStatus,
  School,
  EnrollmentCode,
  Assignment,
  Submission,
  SubmissionStatus,
  Ticket,
  TicketReply
} from './internship.models';

@Injectable({ providedIn: 'root' })
export class InternshipDataService {
  readonly api = inject(InternshipApiService);
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
  assignments: Assignment[] = [];
  submissions: Submission[] = [];
  evaluationTemplates: EvaluationTemplate[] = [];
  evaluationScores: EvaluationScore[] = [];

  /** Set after API load attempt */
  apiConnected = false;
  apiLoadError = '';

  schools: School[] = [];
  enrollmentCodes: EnrollmentCode[] = [];
  tickets: Ticket[] = [];

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
    this.assignments = snapshot.assignments;
    this.submissions = snapshot.submissions;
    this.apiConnected = true;
    this.apiLoadError = '';

    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('intern-manager-api-token-v1') : null;
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3 && typeof atob !== 'undefined') {
          const payload = JSON.parse(atob(parts[1]));
          if (payload) {
            // Load schools for all logged-in roles
            const schools = await firstValueFrom(this.api.getAdminSchools());
            this.schools = schools || [];

            // Load tickets for all logged-in roles
            const tickets = await firstValueFrom(this.api.getTickets());
            this.tickets = tickets || [];

            if (payload.role === 'admin') {
              const codes = await firstValueFrom(this.api.getAdminCodes());
              this.enrollmentCodes = codes || [];
            } else if (payload.role === 'company') {
              try {
                const companyCodes = await firstValueFrom(this.api.getCompanyCodes());
                this.enrollmentCodes = (companyCodes || []).map((c: any) => ({
                  id: c.id,
                  role: c.role,
                  code: c.code,
                  usedCount: c.used_count ?? 0,
                  maxUses: c.max_uses ?? undefined,
                  expiresAt: c.expires_at ? new Date(c.expires_at).toISOString() : undefined,
                  isActive: c.is_active,
                  companyId: c.company_id ?? undefined,
                  companyName: c.company_name ?? undefined,
                  createdAt: c.created_at ?? undefined
                }));
              } catch {
                this.enrollmentCodes = [];
              }
            }
          }
        }
      } catch (e) {
        // Safe fail
      }
    }
  }

  companyForUser(userId: number): Company | undefined {
    const user = this.users.find((u) => u.id === userId);
    if (user && user.companyId) {
      return this.companies.find((c) => c.id === user.companyId);
    }
    return this.companies.find((c) => c.userId === userId || c.id === userId);
  }

  companyIdForUser(userId: number): number | undefined {
    return this.companyForUser(userId)?.id;
  }

  addStudent(student: Omit<User, 'id' | 'role' | 'status' | 'password'> & { password?: string, advisorId: number }): void {
    const payload = { ...student, role: 'student' as Role, status: 'active' as UserStatus };
    if (this.api.apiEnabled()) {
      const code = student.school?.toLowerCase().includes('chula') ? 'CU-STU-2026' : 'BU-STU-2026';
      void firstValueFrom(this.api.registerWithoutLogin({
        name: student.name,
        email: student.email,
        password: student.password || 'student123',
        code: code,
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

  async login(email: string, password: string): Promise<User | { error: string }> {
    if (this.api.apiEnabled()) {
      try {
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
          return user;
        }
        return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
      } catch (err: any) {
        console.error('[InternshipDataService] Login error', err);
        const msg = err?.error?.error || err?.message || 'เข้าสู่ระบบไม่สำเร็จ';
        return { error: msg };
      }
    }

    const found = this.users.find(
      (item) => item.email.toLowerCase() === email && item.password === password
    );
    if (!found) {
      return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
    }
    return found;
  }

  async register(input: RegisterInput): Promise<{ user: User } | { error: string }> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password;
    const code = input.code.trim();

    if (!name || !email || !password || !code) {
      return { error: 'กรุณากรอกข้อมูลให้ครบถ้วน รวมถึงรหัสเชิญ/รหัสลงทะเบียน' };
    }

    if (this.api.apiEnabled()) {
      try {
        const created = await firstValueFrom(
          this.api.register({
            name,
            email,
            password,
            code,
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
      } catch (err: any) {
        console.error('[InternshipDataService] Register error', err);
        const msg = err?.error?.error || err?.message || 'ลงทะเบียนไม่สำเร็จ';
        return { error: msg };
      }
    }

    // Mock Mode Registration
    const codeResult = await this.validateCode(code);
    if ('error' in codeResult || !codeResult || !codeResult.data) {
      return { error: (codeResult && codeResult.error) ? codeResult.error : 'รหัสสมัครเรียนหรือรหัสเชิญไม่ถูกต้อง' };
    }

    const resolvedRole = codeResult.data.role;
    const resolvedSchool = codeResult.data.school_name || undefined;

    if (this.emailExists(email)) {
      return { error: 'อีเมลนี้ถูกใช้งานแล้ว' };
    }

    const now = new Date().toISOString();
    const user: User = {
      id: this.nextId(this.users),
      name,
      email,
      password,
      role: resolvedRole,
      status: resolvedRole === 'advisor' ? 'pending' : 'active',
      phone: input.phone?.trim() || undefined,
      school: resolvedSchool,
      createdAt: now,
      updatedAt: now
    };

    this.users = [...this.users, user];

    if (resolvedRole === 'company') {
      const companyNameInput = input.companyName?.trim() || name;
      const company: Company = {
        id: this.nextId(this.companies),
        userId: user.id,
        companyName: companyNameInput,
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

  async validateCode(code: string): Promise<any> {
    const cleanCode = code.trim().toUpperCase();
    if (this.api.apiEnabled()) {
      try {
        const res = await firstValueFrom(this.api.validateCode(cleanCode));
        return res;
      } catch (err: any) {
        console.error('[InternshipDataService] validateCode error', err);
        return { error: err?.error?.error || err?.message || 'รหัสไม่ถูกต้อง' };
      }
    }

    // Mock validation
    if (cleanCode === 'BU-STU-2026') {
      return { status: 200, data: { code: cleanCode, role: 'student', school_name: 'Bangkok University', school_id: 1 } };
    }
    if (cleanCode === 'BU-ADV-2026') {
      return { status: 200, data: { code: cleanCode, role: 'advisor', school_name: 'Bangkok University', school_id: 1 } };
    }
    if (cleanCode === 'CU-STU-2026') {
      return { status: 200, data: { code: cleanCode, role: 'student', school_name: 'Chulalongkorn University', school_id: 2 } };
    }
    if (cleanCode === 'CU-ADV-2026') {
      return { status: 200, data: { code: cleanCode, role: 'advisor', school_name: 'Chulalongkorn University', school_id: 2 } };
    }
    if (cleanCode === 'COMP-INV-2026') {
      return { status: 200, data: { code: cleanCode, role: 'company' } };
    }
    return { error: 'รหัสสมัครเรียนหรือรหัสเชิญไม่ถูกต้อง' };
  }

  async updateUser(userId: number, updates: Partial<User>): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.updateUser(userId, updates));
      await this.refreshFromApi();
      return;
    }

    const user = this.users.find((u) => u.id === userId);
    if ((updates as any).removeCompany) {
      this.users = this.users.map((u) => (u.id === userId ? { ...u, companyId: undefined, companyRole: undefined } : u));
    } else {
      this.users = this.users.map((u) => (u.id === userId ? { ...u, ...updates } : u));
    }

    if (user && user.role === 'company') {
      this.companies = this.companies.map((c) => {
        if (c.userId === userId) {
          return {
            ...c,
            companyName: (updates as any).companyName ?? c.companyName,
            description: (updates as any).description !== undefined ? (updates as any).description : c.description,
            address: (updates as any).address !== undefined ? (updates as any).address : c.address,
            latitude: (updates as any).latitude !== undefined ? (updates as any).latitude : c.latitude,
            longitude: (updates as any).longitude !== undefined ? (updates as any).longitude : c.longitude
          };
        }
        return c;
      });
    }

    this.persist();
  }

  async addJob(job: Omit<JobPosting, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.createJob(job));
      await this.refreshFromApi();
    } else {
      const nowStr = new Date().toISOString();
      this.jobPostings = [
        ...this.jobPostings,
        { 
          ...job, 
          id: this.nextId(this.jobPostings), 
          status: 'open',
          checkinTime: job.checkinTime || '09:00:00',
          checkoutTime: job.checkoutTime || '17:00:00',
          latedTime: job.latedTime || '09:15:00',
          workDays: job.workDays || 'Monday - Friday',
          createdAt: nowStr,
          updatedAt: nowStr
        }
      ];
      this.persist();
    }
  }

  async updateJob(id: number, job: Omit<JobPosting, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.updateJob(id, job));
      await this.refreshFromApi();
    } else {
      this.jobPostings = this.jobPostings.map((item) =>
        item.id === id ? { ...item, ...job, updatedAt: new Date().toISOString() } : item
      );
      this.persist();
    }
  }

  async deleteJob(id: number): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.deleteJob(id));
      await this.refreshFromApi();
      return;
    }

    this.jobPostings = this.jobPostings.filter((job) => job.id !== id);
    this.persist();
  }

  async setAttendanceVerification(attendance: Attendance, verificationStatus: VerificationStatus): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(
        this.api.patchAttendance(attendance, { verificationStatus })
      );
      await this.refreshFromApi();
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

  async addApplication(application: Omit<Application, 'id' | 'updatedAt'>): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.createApplication(application));
      await this.refreshFromApi();
      return;
    }

    const existing = this.applications.find(
      (app) => app.studentId === application.studentId && app.jobPostingId === application.jobPostingId
    );

    if (existing) {
      this.applications = this.applications.map((app) =>
        app.id === existing.id
          ? { ...app, status: 'pending', updatedAt: new Date().toISOString() }
          : app
      );
    } else {
      this.applications = [
        ...this.applications,
        { ...application, id: this.nextId(this.applications), appliedAt: new Date().toISOString() }
      ];
    }
    this.persist();
  }

  async updateApplicationStatus(application: Application, status: ApplicationStatus): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.patchApplication(application.id, status));
      await this.refreshFromApi();
      return;
    }

    this.applications = this.applications.map((item) =>
      item.id === application.id ? { ...item, status, updatedAt: new Date().toISOString() } : item
    );
    this.persist();
  }

  async addInternship(internship: Omit<Internship, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.createInternship(internship));
      await this.refreshFromApi();
      return;
    }

    const nowStr = new Date().toISOString();
    this.internships = [...this.internships, { 
      ...internship, 
      id: this.nextId(this.internships),
      createdAt: nowStr,
      updatedAt: nowStr
    }];
    this.persist();
  }
 
  async updateInternshipStatus(internshipId: number, status: 'active' | 'completed' | 'terminated'): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.patchInternshipStatus(internshipId, status));
      await this.refreshFromApi();
      return;
    }

    const nowStr = new Date().toISOString();
    this.internships = this.internships.map((item) =>
      item.id === internshipId ? { ...item, status, updatedAt: nowStr } : item
    );

    if (status === 'terminated') {
      const internship = this.internships.find((i) => i.id === internshipId);
      if (internship) {
        this.jobPostings = this.jobPostings.map((job) =>
          job.id === internship.jobPostingId ? { ...job, status: 'open', updatedAt: nowStr } : job
        );
      }
    }

    this.persist();
  }

  async addAttendance(attendance: Omit<Attendance, 'id' | 'createdAt'> & { isWfh?: boolean }): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.createAttendance(attendance));
      await this.refreshFromApi();
      return;
    }

    this.attendances = [...this.attendances, { ...attendance, id: this.nextId(this.attendances), isWfh: attendance.isWfh, notes: attendance.isWfh ? 'WFH' : '' }];
    this.users = this.users.map(u => u.id === attendance.studentId ? { ...u, onlineStatus: 'online' } : u);
    this.persist();
  }

  async updateAttendance(attendanceId: number, updates: Partial<Attendance>): Promise<void> {
    if (this.api.apiEnabled()) {
      const attendance = this.attendances.find((item) => item.id === attendanceId);
      if (!attendance) {
        return;
      }

      await firstValueFrom(
        this.api.patchAttendance(attendance, {
          checkOutTime: updates.checkOutTime,
          status: updates.status,
          checkoutLatitude: updates.checkoutLatitude,
          checkoutLongitude: updates.checkoutLongitude
        })
      );
      await this.refreshFromApi();
      return;
    }

    this.attendances = this.attendances.map((a) => (a.id === attendanceId ? { ...a, ...updates } : a));
    if (updates.checkOutTime) {
      const att = this.attendances.find(a => a.id === attendanceId);
      if (att) {
        this.users = this.users.map(u => u.id === att.studentId ? { ...u, onlineStatus: 'offline' } : u);
      }
    }
    this.persist();
  }

  async setAttendanceStatus(attendance: Attendance, status: AttendanceStatus): Promise<void> {
    await this.updateAttendance(attendance.id, { status });
  }

  async addLogbook(logbook: Omit<Logbook, 'id' | 'createdAt' | 'updatedAt' | 'mentorComment' | 'status'> & { workDate?: string }): Promise<void> {
    const payload = { ...logbook, status: 'pending' as LogbookStatus, workDate: logbook.workDate };

    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.createLogbook(payload));
      await this.refreshFromApi();
      return;
    }

    this.logbooks = [...this.logbooks, { ...payload, id: this.nextId(this.logbooks) }];
    this.persist();
  }

  async updateLogbookStatus(logbook: Logbook, status: LogbookStatus, mentorComment?: string): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(
        this.api.patchLogbook(logbook.id, { status, mentorComment })
      );
      await this.refreshFromApi();
      return;
    }

    this.logbooks = this.logbooks.map((item) =>
      item.id === logbook.id ? { ...item, status, mentorComment: mentorComment ?? item.mentorComment } : item
    );
    this.persist();
  }

  async updateLogbook(id: number, title: string, content: string, workDate?: string): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.updateLogbook(id, { title, content, workDate }));
      await this.refreshFromApi();
      return;
    }

    this.logbooks = this.logbooks.map((item) =>
      item.id === id ? { ...item, title, content, workDate } : item
    );
    this.persist();
  }

  async deleteLogbook(id: number): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.deleteLogbook(id));
      await this.refreshFromApi();
      return;
    }

    this.logbooks = this.logbooks.filter((item) => item.id !== id);
    this.persist();
  }

  async addEvaluation(evaluation: Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>): Promise<any> {
    if (this.api.apiEnabled()) {
      const res = await firstValueFrom(this.api.createEvaluation(evaluation));
      await this.refreshFromApi();
      return res;
    }

    const newEval = { ...evaluation, id: this.nextId(this.evaluations), createdAt: new Date().toISOString() };
    this.evaluations = [...this.evaluations, newEval];
    this.persist();
    return newEval;
  }

  async getEvaluationTemplates(): Promise<EvaluationTemplate[]> {
    if (this.api.apiEnabled()) {
      const list = await firstValueFrom(this.api.getEvaluationTemplates());
      this.evaluationTemplates = list;
      return list;
    }
    return this.evaluationTemplates;
  }

  async createEvaluationTemplate(template: Omit<EvaluationTemplate, 'id'>): Promise<any> {
    if (this.api.apiEnabled()) {
      const res = await firstValueFrom(this.api.createEvaluationTemplate(template));
      await this.refreshFromApi();
      return res;
    }
    const newT: EvaluationTemplate = {
      ...template,
      id: this.nextId(this.evaluationTemplates),
      criteria: template.criteria.map((c, idx) => ({ ...c, id: this.nextId(this.evaluationTemplates) * 10 + idx }))
    };
    this.evaluationTemplates = [...this.evaluationTemplates, newT];
    this.persist();
    return { id: newT.id };
  }

  async updateEvaluationTemplate(id: number, name: string, criteria: EvaluationCriterion[]): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.updateEvaluationTemplate(id, name, criteria));
      await this.refreshFromApi();
      return;
    }
    this.evaluationTemplates = this.evaluationTemplates.map(t => t.id === id ? { ...t, name, criteria } : t);
    this.persist();
  }

  async deleteEvaluationTemplate(id: number): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.deleteEvaluationTemplate(id));
      await this.refreshFromApi();
      return;
    }
    this.evaluationTemplates = this.evaluationTemplates.filter(t => t.id !== id);
    this.persist();
  }

  async saveEvaluationScores(evalId: number, scores: EvaluationScore[]): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.saveEvaluationScores(evalId, scores));
      await this.refreshFromApi();
      return;
    }
    this.evaluationScores = this.evaluationScores.filter(s => s.evaluationId !== evalId);
    const newScores = scores.map(s => ({
      ...s,
      id: this.nextId(this.evaluationScores),
      evaluationId: evalId
    }));
    this.evaluationScores = [...this.evaluationScores, ...newScores];
    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
    this.evaluations = this.evaluations.map(e => e.id === evalId ? { ...e, score: totalScore, scores: newScores } : e);
    this.persist();
  }

  async getEvaluationScores(evalId: number): Promise<EvaluationScore[]> {
    if (this.api.apiEnabled()) {
      return await firstValueFrom(this.api.getEvaluationScores(evalId));
    }
    return this.evaluationScores.filter(s => s.evaluationId === evalId);
  }

  async addLeave(leave: Omit<LeaveRequest, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'approvedAt'>): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.createLeave(leave));
      await this.refreshFromApi();
      return;
    }

    this.leaves = [...this.leaves, { ...leave, id: this.nextId(this.leaves), status: 'pending', createdAt: new Date().toISOString() }];
    this.persist();
  }

  async updateLeaveStatus(leaveId: number, status: 'approved' | 'rejected', comment?: string): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.patchLeaveStatus(leaveId, status, comment));
      await this.refreshFromApi();
      return;
    }

    this.leaves = this.leaves.map((l) => l.id === leaveId ? { ...l, status, comment, approvedAt: status === 'approved' ? new Date().toISOString() : undefined } : l);
    this.persist();
  }

  async updateLeave(id: number, leave: Omit<LeaveRequest, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'approvedAt'>): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.updateLeave(id, leave));
      await this.refreshFromApi();
      return;
    }

    this.leaves = this.leaves.map((l) =>
      l.id === id ? { ...l, ...leave } : l
    );
    this.persist();
  }

  async deleteLeave(id: number): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.deleteLeave(id));
      await this.refreshFromApi();
      return;
    }

    this.leaves = this.leaves.filter((l) => l.id !== id);
    this.persist();
  }

  private seedDemoData(): void {
    this.users = [
      {
        id: 9999,
        name: 'System Admin',
        email: 'admin@gmail.com',
        password: ';bT;bomN',
        role: 'admin',
        status: 'active',
        school: '-'
      }
    ];
    this.companies = [];
    this.jobPostings = [];
    this.applications = [];
    this.internships = [];
    this.attendances = [];
    this.logbooks = [];
    this.evaluations = [];
    this.leaves = [];
    this.assignments = [
      {
        id: 1,
        title: 'รายงานการฝึกงานสัปดาห์ที่ 1',
        description: 'กรุณาสรุปสิ่งที่ได้เรียนรู้และทักษะที่ใช้ในการทำงานของสัปดาห์แรก พร้อมแนบไฟล์รายงาน PDF',
        dueDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T23:59:59Z',
        points: 100,
        creatorId: 1001,
        creatorRole: 'advisor',
        schoolId: 1
      },
      {
        id: 2,
        title: 'ออกแบบหน้าจอ UI (UX/UI Design Challenge)',
        description: 'ออกแบบหน้าจอหลักของระบบจัดการตามโจทย์ที่ได้รับ โดยใช้ Figma หรือ Sketch และส่งลิงก์งาน',
        dueDate: new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T18:00:00Z',
        points: 100,
        creatorId: 2001,
        creatorRole: 'company',
        companyId: 1
      }
    ];
    this.submissions = [];
    this.schools = [
      { id: 1, name: 'Bangkok University' },
      { id: 2, name: 'Chulalongkorn University' }
    ];
    this.enrollmentCodes = [
      { id: 1, schoolId: 1, schoolName: 'Bangkok University', role: 'student', code: 'BU-STU-2026', usedCount: 0, isActive: true },
      { id: 2, schoolId: 1, schoolName: 'Bangkok University', role: 'advisor', code: 'BU-ADV-2026', maxUses: 5, usedCount: 0, isActive: true },
      { id: 3, schoolId: 2, schoolName: 'Chulalongkorn University', role: 'student', code: 'CU-STU-2026', usedCount: 0, isActive: true },
      { id: 4, schoolId: 2, schoolName: 'Chulalongkorn University', role: 'advisor', code: 'CU-ADV-2026', maxUses: 5, usedCount: 0, isActive: true },
      { id: 5, role: 'company', code: 'COMP-INV-2026', maxUses: 10, usedCount: 0, isActive: true }
    ];
    this.tickets = [
      {
        id: 1,
        user_id: 1001,
        user_name: 'สมชาย รักเรียน',
        user_role: 'student',
        title: 'ปัญหาระบบระบุพิกัด GPS',
        description: 'กดปุ่มปักหมุดพิกัดแล้วเข็มหมุดไม่เลื่อนตามตำแหน่งปัจจุบันครับ',
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 2,
        user_id: 2001,
        user_name: 'บริษัท เทคโซลูชั่นส์',
        user_role: 'company',
        title: 'แก้ไขข้อมูลที่อยู่บริษัทไม่ได้',
        description: 'พยายามแก้ไขข้อมูลที่อยู่แล้วระบบไม่ยอมเซฟครับ รบกวนตรวจสอบให้หน่อยค่ะ',
        status: 'resolved',
        created_at: new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }

  async addAdminSchool(name: string): Promise<any> {
    if (this.api.apiEnabled()) {
      try {
        const res = await firstValueFrom(this.api.createAdminSchool(name));
        await this.refreshFromApi();
        return res;
      } catch (err: any) {
        return { error: err?.error?.error || err?.message || 'เพิ่มสถานศึกษาล้มเหลว' };
      }
    }

    const school: School = {
      id: this.nextId(this.schools),
      name: name.trim()
    };
    this.schools = [...this.schools, school];
    this.persist();
    return school;
  }

  async addAdminCode(body: {
    schoolId?: number | null;
    companyId?: number | null;
    role: 'student' | 'advisor' | 'company';
    code: string;
    maxUses?: number | null;
    expiresAt?: string | null;
    companyName?: string;
    companyAddress?: string;
    companyDescription?: string;
  }): Promise<any> {
    if (this.api.apiEnabled()) {
      try {
        const payload = {
          school_id: body.schoolId,
          company_id: body.companyId,
          role: body.role,
          code: body.code,
          max_uses: body.maxUses,
          expires_at: body.expiresAt,
          company_name: body.companyName?.trim() || undefined,
          company_address: body.companyAddress?.trim() || undefined,
          company_description: body.companyDescription?.trim() || undefined
        };
        const res = await firstValueFrom(this.api.createAdminCode(payload));
        await this.refreshFromApi();
        return res;
      } catch (err: any) {
        return { error: err?.error?.error || err?.message || 'สร้างรหัสเชิญล้มเหลว' };
      }
    }

    const schoolName = this.schools.find(s => s.id === body.schoolId)?.name;
    const matchedComp = this.companies.find(c => c.id === body.companyId);
    const resolvedCompanyName = matchedComp?.companyName || body.companyName?.trim();
    const resolvedCompanyAddress = matchedComp?.address || body.companyAddress?.trim();
    const resolvedCompanyDescription = matchedComp?.description || body.companyDescription?.trim();

    const code: EnrollmentCode = {
      id: this.nextId(this.enrollmentCodes),
      schoolId: body.schoolId || undefined,
      schoolName: schoolName || undefined,
      role: body.role,
      code: body.code.trim().toUpperCase(),
      maxUses: body.maxUses || undefined,
      usedCount: 0,
      expiresAt: body.expiresAt || undefined,
      isActive: true,
      companyId: body.companyId || undefined,
      companyName: resolvedCompanyName || undefined,
      companyAddress: resolvedCompanyAddress || undefined,
      companyDescription: resolvedCompanyDescription || undefined
    };

    this.enrollmentCodes = [...this.enrollmentCodes, code];
    this.persist();
    return code;
  }

  async updateAdminCode(id: number, body: {
    code: string;
    maxUses?: number | null;
    expiresAt?: string | null;
    isActive?: boolean;
  }): Promise<any> {
    if (this.api.apiEnabled()) {
      try {
        const payload = {
          code: body.code,
          max_uses: body.maxUses,
          expires_at: body.expiresAt,
          is_active: body.isActive
        };
        const res = await firstValueFrom(this.api.updateAdminCode(id, payload));
        await this.refreshFromApi();
        return res;
      } catch (err: any) {
        return { error: err?.error?.error || err?.message || 'แก้ไขรหัสเชิญล้มเหลว' };
      }
    }

    this.enrollmentCodes = this.enrollmentCodes.map(c => {
      if (c.id === id) {
        return {
          ...c,
          code: body.code.trim().toUpperCase(),
          maxUses: body.maxUses || undefined,
          expiresAt: body.expiresAt || undefined,
          isActive: body.isActive !== undefined ? body.isActive : c.isActive
        };
      }
      return c;
    });
    this.persist();
    return { status: 200 };
  }

  async deleteAdminCode(id: number): Promise<any> {
    if (this.api.apiEnabled()) {
      try {
        const res = await firstValueFrom(this.api.deleteAdminCode(id));
        await this.refreshFromApi();
        return res;
      } catch (err: any) {
        return { error: err?.error?.error || err?.message || 'ลบรหัสเชิญล้มเหลว' };
      }
    }

    this.enrollmentCodes = this.enrollmentCodes.filter(c => c.id !== id);
    this.persist();
    return { status: 200 };
  }

  async getAdminTables(): Promise<string[]> {
    if (this.api.apiEnabled()) {
      return firstValueFrom(this.api.getAdminTables());
    }
    return ['users', 'companies', 'job_postings', 'applications', 'internships', 'attendances', 'logbooks', 'evaluations', 'leave_requests', 'schools', 'enrollment_codes'];
  }

  async executeAdminQuery(query: string): Promise<any> {
    if (this.api.apiEnabled()) {
      try {
        return await firstValueFrom(this.api.executeAdminQuery(query));
      } catch (err: any) {
        return { error: err?.error?.error || err?.message || 'Query execution failed' };
      }
    }

    const clean = query.trim().toUpperCase();
    if (clean.startsWith('SELECT')) {
      let targetTable = '';
      if (clean.includes('FROM USERS')) targetTable = 'users';
      else if (clean.includes('FROM COMPANIES')) targetTable = 'companies';
      else if (clean.includes('FROM JOB_POSTINGS') || clean.includes('FROM JOBS')) targetTable = 'jobPostings';
      else if (clean.includes('FROM APPLICATIONS')) targetTable = 'applications';
      else if (clean.includes('FROM INTERNSHIPS')) targetTable = 'internships';
      else if (clean.includes('FROM ATTENDANCES') || clean.includes('FROM ATTENDANCE')) targetTable = 'attendances';
      else if (clean.includes('FROM LOGBOOKS')) targetTable = 'logbooks';
      else if (clean.includes('FROM EVALUATIONS')) targetTable = 'evaluations';
      else if (clean.includes('FROM LEAVE_REQUESTS') || clean.includes('FROM LEAVES')) targetTable = 'leaves';
      else if (clean.includes('FROM SCHOOLS')) targetTable = 'schools';
      else if (clean.includes('FROM ENROLLMENT_CODES') || clean.includes('FROM CODES')) targetTable = 'enrollmentCodes';

      if (targetTable) {
        const list = (this as any)[targetTable] || [];
        const columns = list.length > 0 ? Object.keys(list[0]) : ['id'];
        return {
          status: 200,
          type: 'select',
          columns,
          data: list
        };
      }
      return { status: 200, type: 'select', columns: ['msg'], data: [{ msg: 'Mock execution successful for: ' + query }] };
    }

    return {
      status: 200,
      type: 'exec',
      rows_affected: 1,
      last_insert_id: 0
    };
  }

  private nextId(items: { id?: number }[]): number {
    return Math.max(0, ...items.map((item) => item.id || 0)) + 1;
  }

  async deleteOtherApplications(studentId: number, keepAppId: number): Promise<void> {
    if (this.api.apiEnabled()) {
      return;
    }
    this.applications = this.applications.filter(
      (app) => app.studentId !== studentId || app.id === keepAppId
    );
    this.persist();
  }

  persist(): void {
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
        leaves: this.leaves,
        schools: this.schools,
        enrollmentCodes: this.enrollmentCodes,
        assignments: this.assignments,
        submissions: this.submissions,
        tickets: this.tickets,
        evaluationTemplates: this.evaluationTemplates,
        evaluationScores: this.evaluationScores
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
      this.schools = Array.isArray(state.schools) ? state.schools : this.schools;
      this.enrollmentCodes = Array.isArray(state.enrollmentCodes) ? state.enrollmentCodes : this.enrollmentCodes;
      this.evaluationTemplates = Array.isArray(state.evaluationTemplates) ? state.evaluationTemplates : this.evaluationTemplates;
      this.evaluationScores = Array.isArray(state.evaluationScores) ? state.evaluationScores : this.evaluationScores;
      this.assignments = Array.isArray(state.assignments) ? state.assignments : this.assignments;
      this.submissions = Array.isArray(state.submissions) ? state.submissions : this.submissions;
      this.tickets = Array.isArray(state.tickets) ? state.tickets : this.tickets;
    } catch {
      localStorage.removeItem(this.storageKey);
    }
  }

  async addCompany(name: string, description?: string, address?: string): Promise<any> {
    if (this.api.apiEnabled()) {
      try {
        const res = await firstValueFrom(this.api.createCompany({ company_name: name, description, address }));
        await this.refreshFromApi();
        return res;
      } catch (err: any) {
        return { error: err?.error?.error || err?.message || 'เพิ่มบริษัทล้มเหลว' };
      }
    }

    const company: Company = {
      id: this.nextId(this.companies),
      userId: 9999 + this.companies.length,
      companyName: name.trim(),
      description: description || '',
      address: address || '',
      website: ''
    };
    this.companies = [...this.companies, company];
    this.persist();
    return company;
  }

  async addTicket(title: string, description: string, currentUser?: any): Promise<any> {
    if (this.api.apiEnabled()) {
      try {
        const res = await firstValueFrom(this.api.createTicket({ title, description }));
        await this.refreshFromApi();
        return res;
      } catch (err: any) {
        return { error: err?.error?.error || err?.message || 'สร้างคำขอความช่วยเหลือล้มเหลว' };
      }
    }

    const ticket: Ticket = {
      id: this.nextId(this.tickets),
      user_id: currentUser?.id || 1001,
      user_name: currentUser?.name || 'User',
      user_role: currentUser?.role || 'student',
      title: title.trim(),
      description: description.trim(),
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.tickets = [ticket, ...this.tickets];
    this.persist();
    return ticket;
  }

  async replyToTicket(ticketId: number, message: string, currentUser?: any): Promise<any> {
    if (this.api.apiEnabled()) {
      try {
        const res = await firstValueFrom(this.api.replyTicket(ticketId, message));
        await this.refreshFromApi();
        return res;
      } catch (err: any) {
        return { error: err?.error?.error || err?.message || 'ตอบกลับล้มเหลว' };
      }
    }

    return { status: 200, message: 'ตอบกลับเรียบร้อย (Mock)' };
  }

  async updateTicketStatus(ticketId: number, status: 'open' | 'resolved' | 'closed'): Promise<any> {
    if (this.api.apiEnabled()) {
      try {
        const res = await firstValueFrom(this.api.updateTicketStatus(ticketId, status));
        await this.refreshFromApi();
        return res;
      } catch (err: any) {
        return { error: err?.error?.error || err?.message || 'ปรับปรุงสถานะล้มเหลว' };
      }
    }

    this.tickets = this.tickets.map(t => t.id === ticketId ? { ...t, status, updated_at: new Date().toISOString() } : t);
    this.persist();
    return { status: 200, message: 'ปรับปรุงสถานะเรียบร้อย' };
  }

  async addAssignment(assignment: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.createAssignment(assignment));
      await this.refreshFromApi();
      return;
    }

    const nowStr = new Date().toISOString();
    const newAss = {
      ...assignment,
      id: this.nextId(this.assignments),
      createdAt: nowStr,
      updatedAt: nowStr
    };
    this.assignments = [...this.assignments, newAss];
    this.persist();
  }

  async addSubmission(submission: Omit<Submission, 'id' | 'submittedAt' | 'gradedAt' | 'score' | 'feedback' | 'status'>): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.createSubmission(submission));
      await this.refreshFromApi();
      return;
    }

    const nowStr = new Date().toISOString();
    const idx = this.submissions.findIndex(s => s.assignmentId === submission['assignmentId'] && s.studentId === submission['studentId']);
    
    let status: SubmissionStatus = 'submitted';
    const ass = this.assignments.find(a => a.id === submission['assignmentId']);
    if (ass && ass.dueDate && new Date().getTime() > new Date(ass.dueDate).getTime()) {
      status = 'late';
    }

    if (idx >= 0) {
      this.submissions = this.submissions.map((s, i) => i === idx ? {
        ...s,
        content: submission['content'],
        fileName: submission['fileName'],
        filePath: submission['filePath'],
        status,
        submittedAt: nowStr,
        score: undefined,
        feedback: undefined,
        gradedAt: undefined
      } : s);
    } else {
      const newSub: Submission = {
        ...submission,
        id: this.nextId(this.submissions),
        status,
        submittedAt: nowStr
      };
      this.submissions = [...this.submissions, newSub];
    }
    this.persist();
  }

  async gradeSubmission(id: number, score: number, feedback: string): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.gradeSubmission(id, score, feedback));
      await this.refreshFromApi();
      return;
    }

    const nowStr = new Date().toISOString();
    this.submissions = this.submissions.map(s => s.id === id ? {
      ...s,
      score,
      feedback,
      status: 'graded' as SubmissionStatus,
      gradedAt: nowStr
    } : s);
    this.persist();
  }

  private hasLocalStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }
}
