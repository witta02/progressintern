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
  VerificationStatus,
  School,
  EnrollmentCode
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

  /** Set after API load attempt */
  apiConnected = false;
  apiLoadError = '';

  schools: School[] = [];
  enrollmentCodes: EnrollmentCode[] = [];

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

    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('intern-manager-api-token-v1') : null;
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3 && typeof atob !== 'undefined') {
          const payload = JSON.parse(atob(parts[1]));
          if (payload && payload.role === 'admin') {
            const schools = await firstValueFrom(this.api.getAdminSchools());
            this.schools = schools || [];
            const codes = await firstValueFrom(this.api.getAdminCodes());
            this.enrollmentCodes = codes || [];
          }
        }
      } catch (e) {
        // Safe fail if user is not admin or parsing failed
      }
    }
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

    this.users = this.users.map((user) => (user.id === userId ? { ...user, ...updates } : user));
    this.persist();
  }

  async addJob(job: Omit<JobPosting, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.createJob(job));
      await this.refreshFromApi();
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

  async updateJob(id: number, job: Omit<JobPosting, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.updateJob(id, job));
      await this.refreshFromApi();
    } else {
      this.jobPostings = this.jobPostings.map((item) =>
        item.id === id ? { ...item, ...job } : item
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

    this.applications = [...this.applications, { ...application, id: this.nextId(this.applications) }];
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

    this.internships = [...this.internships, { ...internship, id: this.nextId(this.internships) }];
    this.persist();
  }
 
  async updateInternshipStatus(internshipId: number, status: 'active' | 'completed' | 'terminated'): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.patchInternshipStatus(internshipId, status));
      await this.refreshFromApi();
      return;
    }

    this.internships = this.internships.map((item) =>
      item.id === internshipId ? { ...item, status, updatedAt: new Date().toISOString() } : item
    );
    this.persist();
  }

  async addAttendance(attendance: Omit<Attendance, 'id' | 'createdAt'>): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.createAttendance(attendance));
      await this.refreshFromApi();
      return;
    }

    this.attendances = [...this.attendances, { ...attendance, id: this.nextId(this.attendances) }];
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
    this.persist();
  }

  async setAttendanceStatus(attendance: Attendance, status: AttendanceStatus): Promise<void> {
    await this.updateAttendance(attendance.id, { status });
  }

  async addLogbook(logbook: Omit<Logbook, 'id' | 'createdAt' | 'updatedAt' | 'mentorComment' | 'status'>): Promise<void> {
    const payload = { ...logbook, status: 'pending' as LogbookStatus };

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

  async updateLogbook(id: number, title: string, content: string): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.updateLogbook(id, { title, content }));
      await this.refreshFromApi();
      return;
    }

    this.logbooks = this.logbooks.map((item) =>
      item.id === id ? { ...item, title, content } : item
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

  async addEvaluation(evaluation: Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    if (this.api.apiEnabled()) {
      await firstValueFrom(this.api.createEvaluation(evaluation));
      await this.refreshFromApi();
      return;
    }

    this.evaluations = [...this.evaluations, { ...evaluation, id: this.nextId(this.evaluations) }];
    this.persist();
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
    role: 'student' | 'advisor' | 'company';
    code: string;
    maxUses?: number | null;
    expiresAt?: string | null;
  }): Promise<any> {
    if (this.api.apiEnabled()) {
      try {
        const payload = {
          school_id: body.schoolId,
          role: body.role,
          code: body.code,
          max_uses: body.maxUses,
          expires_at: body.expiresAt
        };
        const res = await firstValueFrom(this.api.createAdminCode(payload));
        await this.refreshFromApi();
        return res;
      } catch (err: any) {
        return { error: err?.error?.error || err?.message || 'สร้างรหัสเชิญล้มเหลว' };
      }
    }

    const schoolName = this.schools.find(s => s.id === body.schoolId)?.name;
    const code: EnrollmentCode = {
      id: this.nextId(this.enrollmentCodes),
      schoolId: body.schoolId || undefined,
      schoolName: schoolName || undefined,
      role: body.role,
      code: body.code.trim().toUpperCase(),
      maxUses: body.maxUses || undefined,
      usedCount: 0,
      expiresAt: body.expiresAt || undefined,
      isActive: true
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

  private nextId(items: { id: number }[]): number {
    return Math.max(0, ...items.map((item) => item.id)) + 1;
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
        enrollmentCodes: this.enrollmentCodes
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
    } catch {
      localStorage.removeItem(this.storageKey);
    }
  }

  private hasLocalStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }
}
