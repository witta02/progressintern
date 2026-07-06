import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { environment } from '../environments/environment';
import { InternshipDataService } from './internship-data.service';
import { NotificationHostComponent } from './notification-host.component';
import { NotificationService } from './notification.service';
import { ApiService } from './core/services/api.service';
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
  LeaveRequest,
  Assignment,
  Submission,
  SubmissionStatus,
  Evaluation,
  EvaluationTemplate
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
  private readonly sanitizer = inject(DomSanitizer);
  private readonly apiService = inject(ApiService);
  protected readonly useMockData = environment.useMockData;
  protected readonly schemaTables = DB_SCHEMA_TABLES;



  private readonly sessionKey = 'intern-manager-session-v1';

  private codeDebounceTimer: any = null;
  private pollingIntervalId: any = null;
  private knownAssignmentIds = new Set<number>();

  protected currentUserId: number | null = null;
  protected initialized = false;
  protected apiRetrying = false;
  protected currentTime = new Date();

  constructor() {
    console.log('โปรเจคส่งที่ฝึกงานฮัฟ ส่องไรเอ่ยย');
    this.applyRoleTheme(undefined);
    this.initSession();
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.currentTime = new Date();
      }, 1000);
    }
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

    // 2. Load API data – retry up to 3 times if the backend is slow to wake up (serverless cold start)
    if (!this.useMockData) {
      let loaded = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.data.refreshFromApi();
          if (this.data.apiConnected) {
            loaded = true;
            break;
          }
        } catch (err) {
          console.error(`[App] API load attempt ${attempt + 1} failed`, err);
        }
        if (attempt < 2) {
          // Wait 2s before retry (gives cold-start serverless time to wake up)
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      if (!loaded) {
        console.warn('[App] API not reachable after 3 attempts. Showing error state.');
      }
    }

    // 3. Re-verify the session – but ONLY log out if the API is confirmed connected
    //    If the API load failed, keep the stored session to avoid forcing re-login on every refresh.
    if (this.currentUserId) {
      const user = this.users.find((u) => u.id === this.currentUserId);
      if (user) {
        await this.finishLogin(user, false);
      } else if (this.data.apiConnected) {
        // API loaded successfully but user was not found → session is invalid
        this.logout();
      } else {
        // API failed to load – keep the user logged in with their stored ID
        // so they don't have to re-login every time there is a transient network hiccup.
        console.warn('[App] API not reachable on startup — keeping stored session alive.');
        const savedView = localStorage.getItem('intern-manager-active-view-v1');
        if (savedView) this.activeView = savedView;
      }
    }

    this.initialized = true;
    this.cdr.markForCheck();
  }
  protected sidebarOpen = false;
  protected activeView = 'dashboard';

  // Feature 3: Logbook work date
  protected logbookDate = this.today();

  // Feature 4: Map picker & Radius
  private leafletMap: any;
  private leafletMarker: any;
  private leafletCircle: any;

  // Feature 5: Status Filters
  protected applicationStatusFilter = 'all';
  protected internshipStatusFilter = 'all';
  protected logbookStatusFilter = 'all';
  protected leaveStatusFilter = 'all';

  // Feature 6: Custom Evaluation Rubrics
  protected evaluationTemplates: any[] = [];
  protected selectedTemplateId: number | null = null;
  protected rubricScores: { [criterionId: number]: number } = {};
  protected showTemplateBuilder = false;
  protected editingTemplate: any = { name: '', criteria: [] };
  protected newCriterionLabel = '';
  protected newCriterionMax = 10;
  protected authMode: 'login' | 'register' = 'login';
  protected loginError = '';
  protected loginLoading = false;
  protected showLoginPassword = false;
  protected showRegisterPassword = false;
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
  protected skipCompanyFields = false;
  protected presetCompanyName = '';
  protected currentLatitude: number | null = null;
  protected currentLongitude: number | null = null;

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
    field: '',
    number: 0 as number,
    yearLevel: '',
    classGroup: '',
    internStartDate: '',
    internEndDate: '',
    companyName: '',
    description: '',
    address: '',
    latitude: '' as string | number,
    longitude: '' as string | number,
    checkRadius: 200 as string | number
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

  protected editingLogbook: Logbook | null = null;
  protected editLogbookForm = { title: '', content: '', workDate: '' };

  protected editingLeave: LeaveRequest | null = null;
  protected editLeaveForm = { leaveType: 'sick' as 'sick' | 'personal', startDate: '', endDate: '', reason: '' };
  protected evaluationFeedback = '';
  protected evaluationScore = 85;
  protected evaluationType: EvaluationType = 'mentor';
  protected selectedEvaluationInternshipId: number | null = null;
  protected expandedEvaluationId: number | null = null;

  protected adminSchoolInput = {
    name: ''
  };

  protected adminCodeForm = {
    schoolId: null as number | null,
    companyId: null as number | null,
    role: 'student' as 'student' | 'advisor' | 'company',
    code: '',
    maxUses: null as number | null,
    expiresAt: null as string | null,
    companyName: '',
    companyAddress: '',
    companyDescription: ''
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

  // ----------- Classroom Assignment System & UX Improvements -----------
  protected newAssignment = {
    title: '',
    description: '',
    dueDate: '',
    points: 100,
    targetType: 'all' as 'all' | 'student' | 'position',
    studentId: null as number | null,
    jobPostingId: null as number | null
  };
  protected assignmentSubmitForm = {
    content: '',
    fileName: '',
    filePath: ''
  };
  protected selectedAssignmentIdForDetails: number | null = null;
  protected selectedSubmissionForGrading: Submission | null = null;
  protected gradeForm = {
    score: 100,
    feedback: ''
  };
  protected rubricPunctuality = 25;
  protected rubricTechnical = 25;
  protected rubricAttitude = 25;
  protected rubricDocumentation = 25;

  protected uploadingResume = false;
  protected resumeUploadSuccess = false;
  protected uploadingWorkFile = false;

  // Track checked boxes for batch actions
  protected selectedStudentIds: Record<number, boolean> = {};
  protected selectedAttendanceIds: Record<number, boolean> = {};
  protected selectedLogbookIds: Record<number, boolean> = {};

  // ----------- Student Detail Panel -----------
  protected selectedInternshipId: number | null = null;
  protected internshipDetailOpen = false;
  protected internshipTableSearch = '';
  protected internshipTableStatusFilter = '';
  protected advisorStudentFilter: 'my' | 'school_all' | 'school_unassigned' | 'other_schools' = 'my';
  protected showAddStudentModal = false;
  protected addStudentModalTab: 'pick' | 'create' = 'pick';
  protected pickStudentSearchQuery = '';
  protected selectedStudentToAssignId = 0;

  // Teacher/Advisor Class Groups and Rooms toggle menu
  protected showClassGroupsMenu = true;
  protected selectedClassGroupFilter = 'all_students';
  protected advisorStudentSearch = '';
  
  // Custom Class Groups created by the advisor
  protected advisorCustomClassGroups: { yearLevel: string, classGroup: string }[] = [];
  protected newGroupYearLevel = '';
  protected newGroupClassGroup = '';
  
  // Selected student for details popup
  protected selectedStudentForDetail: User | null = null;
  protected studentDetailInternship: Internship | null = null;
  protected studentDetailAttendances: Attendance[] = [];
  protected studentDetailLogbooks: Logbook[] = [];
  protected studentDetailLeaves: LeaveRequest[] = [];

  // Company & School management view variables
  protected newSchoolName = '';
  protected newCompanyName = '';
  protected newCompanyDesc = '';
  protected newCompanyAddr = '';
  protected compSchoolTab: 'schools' | 'companies' = 'schools';
  protected compSchoolSearch = '';

  // Employee management (company admin)
  protected employeeInviteCode = '';
  protected employeeInviteLoading = false;
  protected showEmployeeInviteModal = false;

  // Support Tickets view variables
  protected newTicketTitle = '';
  protected newTicketDesc = '';
  protected ticketSearchQuery = '';
  protected ticketStatusFilter: 'all' | 'open' | 'resolved' | 'closed' = 'all';
  protected selectedTicket: any = null;
  protected selectedTicketReplies: any[] = [];
  protected newReplyMessage = '';
  protected isSubmittingTicket = false;
  protected isSubmittingReply = false;
  protected ticketDetailLoading = false;

  protected readonly viewLabels: Record<string, string> = {
    dashboard: 'ภาพรวม',
    admin_users: 'จัดการผู้ใช้',
    admin_schools: 'จัดการโรงเรียน',
    admin_codes: 'จัดการรหัสเชิญ',
    students: 'จัดการนักศึกษา',
    jobs: 'ตำแหน่งงาน',
    applications: 'การสมัคร',
    internships: 'ฝึกงาน',
    company_employees: 'จัดการพนักงาน',
    attendance: 'ลงเวลา',
    logbooks: 'บันทึก',
    leaves: 'การลา',
    evaluations: 'ประเมินผล',
    classwork: 'งาน',
    edit: 'แก้ไขข้อมูล',
    schema: 'ฐานข้อมูล',
    company_school: 'บริษัท & โรงเรียน',
    tickets: 'แจ้งปัญหา'
  };

  protected get assignments(): Assignment[] {
    const user = this.currentUser;
    if (!user) return [];

    return this.data.assignments.filter(ass => {
      if (user.role === 'admin') return true;

      if (user.role === 'advisor') {
        const advisorSchool = this.data.schools.find(s => s.name === user.school);
        return ass.creatorId === user.id || (ass.schoolId !== undefined && ass.schoolId === advisorSchool?.id);
      }

      if (user.role === 'company') {
        const company = this.currentCompany;
        if (!company) return false;
        return ass.creatorId === user.id || 
               (ass.companyId !== undefined && ass.companyId === company.id) ||
               this.internships.some(i => i.companyId === company.id && i.status === 'active' && (
                 ass.studentId === i.studentId || 
                 ass.jobPostingId === i.jobPostingId
               ));
      }

      if (user.role === 'student') {
        const studentSchool = this.data.schools.find(s => s.name === user.school);
        const matchesSchool = ass.schoolId !== undefined && ass.schoolId === studentSchool?.id;
        
        const activeInternship = this.internships.find(i => i.studentId === user.id && i.status === 'active');
        const matchesCompany = activeInternship && ass.companyId !== undefined && ass.companyId === activeInternship.companyId;

        if (matchesSchool) {
          return ass.studentId === undefined || ass.studentId === null || ass.studentId === user.id;
        }

        if (matchesCompany) {
          if (ass.studentId !== undefined && ass.studentId !== null) {
            return ass.studentId === user.id;
          }
          if (ass.jobPostingId !== undefined && ass.jobPostingId !== null) {
            return ass.jobPostingId === activeInternship.jobPostingId;
          }
          return true;
        }

        return false;
      }

      return false;
    });
  }

  protected get selectedAssignment(): Assignment | undefined {
    const id = this.selectedAssignmentIdForDetails;
    if (!id) return undefined;
    return this.data.assignments.find(a => a.id === id);
  }

  protected getAssignmentById(id: number): Assignment | undefined {
    return this.data.assignments.find(a => a.id === id);
  }

  protected get submissions(): Submission[] {
    return this.data.submissions;
  }

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
      admin: ['dashboard', 'admin_users', 'admin_codes', 'company_school', 'tickets', 'edit'],
      advisor: ['dashboard', 'students', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'leaves', 'evaluations', 'classwork', 'tickets', 'edit'],
      student: ['dashboard', 'jobs', 'applications', 'internships', 'attendance', 'logbooks', 'leaves', 'evaluations', 'classwork', 'tickets', 'edit'],
      company: ['dashboard', 'jobs', 'applications', 'internships', 'company_employees', 'attendance', 'logbooks', 'leaves', 'evaluations', 'classwork', 'tickets', 'edit']
    };

    if (!this.currentUser) return [];
    let views = viewsByRole[this.currentUser.role] || [];

    if (this.currentUser.role === 'student' && this.activeInternship) {
      views = views.filter(v => v !== 'jobs' && v !== 'applications');
    }

    // Company employees can see: dashboard, internships, attendance, logbooks, leaves, evaluations, classwork, tickets, edit
    // (cannot manage jobs, applications, or employee settings)
    if (this.isCompanyEmployee) {
      views = ['dashboard', 'internships', 'attendance', 'logbooks', 'leaves', 'evaluations', 'classwork', 'tickets', 'edit'];
    }

    return views;
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

    if (this.currentUser?.role === 'student') {
      if (this.activeInternship) {
        return [
          { label: 'สถานะฝึกงานของฉัน', value: this.visibleInternships.length, helper: 'internship ที่ active', view: 'internships' },
          { label: 'ยังไม่ check out', value: this.openAttendanceCount, helper: 'รายการลงเวลาของตัวเอง', view: 'attendance' },
          { label: 'งานที่ได้รับมอบหมาย', value: this.assignments.length, helper: 'งานจากอาจารย์และพี่เลี้ยง', view: 'classwork' },
          { label: 'บันทึกฝึกงานของฉัน', value: this.visibleLogbooks.length, helper: 'บันทึกประจำวันที่ส่งแล้ว', view: 'logbooks' }
        ];
      }
      return [
        { label: 'งานที่เปิดรับ', value: this.visibleJobs.length, helper: 'ตำแหน่งที่สามารถสมัครได้', view: 'jobs' },
        { label: 'ใบสมัครของฉัน', value: this.visibleApplications.length, helper: 'ประวัติสมัครงาน', view: 'applications' },
        { label: 'สถานะฝึกงานของฉัน', value: this.visibleInternships.length, helper: 'internship ที่ active', view: 'internships' },
        { label: 'ยังไม่ check out', value: this.openAttendanceCount, helper: 'รายการลงเวลาของตัวเอง', view: 'attendance' }
      ];
    }

    return [];
  }

  protected get currentCompany(): Company | undefined {
    return this.currentUser ? this.data.companyForUser(this.currentUser.id) : undefined;
  }

  protected get currentCompanyId(): number | undefined {
    return this.currentUser ? this.data.companyIdForUser(this.currentUser.id) : undefined;
  }

  /** True if this is a company user with admin sub-role (first registrant). Full company permissions. */
  protected get isCompanyAdmin(): boolean {
    return this.currentUser?.role === 'company' && this.currentUser?.companyRole === 'admin';
  }

  /** True if this is a company user with employee sub-role (subsequent registrant). Limited permissions. */
  protected get isCompanyEmployee(): boolean {
    return this.currentUser?.role === 'company' && this.currentUser?.companyRole === 'employee';
  }

  protected get managedStudents(): User[] {
    if (this.currentUser?.role === 'admin') {
      return this.users.filter((user) => user.role === 'student');
    }

    if (this.currentUser?.role !== 'advisor') {
      return [];
    }

    const user = this.currentUser;
    const filter = this.advisorStudentFilter;

    if (filter === 'school_all') {
      return this.users.filter(
        (u) => u.role === 'student' && this.isSameSchool(u.school, user.school)
      );
    }
    if (filter === 'school_unassigned') {
      return this.users.filter(
        (u) => u.role === 'student' && this.isSameSchool(u.school, user.school) && !u.advisorId && (!u.advisorIds || u.advisorIds.length === 0)
      );
    }
    if (filter === 'other_schools') {
      return this.users.filter(
        (u) => u.role === 'student' && !this.isSameSchool(u.school, user.school)
      );
    }

    // Default is 'my' (My Students)
    return this.users.filter(
      (u) => u.role === 'student' && (u.advisorIds ? u.advisorIds.includes(user.id) : u.advisorId === user.id)
    );
  }
  
  protected get advisorStudents(): User[] {
    const user = this.currentUser;
    if (!user) return [];
    return this.users.filter(u => u.role === 'student' && (u.advisorIds ? u.advisorIds.includes(user.id) : u.advisorId === user.id));
  }

  protected get companyStudents(): User[] {
    const company = this.currentCompany;
    if (!company) return [];
    const activeInternships = this.internships.filter(
      (i) => i.companyId === company.id && i.status === 'active'
    );
    const studentIds = activeInternships.map((i) => i.studentId);
    return this.users.filter((u) => studentIds.includes(u.id));
  }

  protected get companyJobPostings(): JobPosting[] {
    const company = this.currentCompany;
    if (!company) return [];
    return this.jobPostings.filter((j) => j.companyId === company.id && j.status === 'open' && !j.isDeleted);
  }

  /** All company users (admin + employees) for the same company */
  protected get companyEmployees(): User[] {
    const company = this.currentCompany;
    if (!company) return [];
    return this.users.filter(u =>
      u.role === 'company' &&
      u.id !== this.currentUserId &&
      (u.companyId === company.id || this.data.companyIdForUser(u.id) === company.id)
    );
  }

  protected async changeEmployeeRole(emp: User, newRole: 'admin' | 'employee'): Promise<void> {
    try {
      await this.data.updateUser(emp.id, { companyRole: newRole });
      this.notifications.success(`เปลี่ยนบทบาทของพนักงาน ${emp.name} เป็น ${newRole === 'admin' ? 'ผู้ดูแล' : 'พนักงาน'} สำเร็จ`, 'จัดการพนักงาน');
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'จัดการพนักงาน');
    }
  }

  protected async changeEmployeeStatus(emp: User, newStatus: any): Promise<void> {
    try {
      await this.data.updateUser(emp.id, { status: newStatus });
      this.notifications.success(`อัปเดตสถานะของพนักงาน ${emp.name} เป็น ${newStatus} สำเร็จ`, 'จัดการพนักงาน');
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'จัดการพนักงาน');
    }
  }

  protected async removeEmployeeFromCompany(emp: User): Promise<void> {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบพนักงาน ${emp.name} ออกจากบริษัท?`)) {
      return;
    }
    try {
      await this.data.updateUser(emp.id, { removeCompany: true } as any);
      this.notifications.success(`ลบพนักงาน ${emp.name} ออกจากบริษัทเรียบร้อยแล้ว`, 'จัดการพนักงาน');
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'จัดการพนักงาน');
    }
  }

  /** Generate a random alphanumeric invite code for company employees */
  protected generateEmployeeInviteCode(): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    this.employeeInviteCode = `EMP-${code}`;
  }

  /** Create an enrollment code for company employees (company admin only) */
  protected async createEmployeeInviteCode(): Promise<void> {
    if (!this.isCompanyAdmin) return;
    const company = this.currentCompany;
    if (!company) return;

    if (!this.employeeInviteCode.trim()) {
      this.generateEmployeeInviteCode();
    }

    this.employeeInviteLoading = true;
    const codeStr = this.employeeInviteCode.trim().toUpperCase();
    try {
      if (this.data.api.apiEnabled()) {
        // Use dedicated company employee code endpoint
        const res = await firstValueFrom(this.data.api.createEmployeeCode(codeStr));
        if (res && res.error) {
          this.notifications.error(res.error, 'สร้างรหัสเชิญพนักงานล้มเหลว');
        } else {
          this.notifications.success(`สร้างรหัสเชิญพนักงาน "${codeStr}" สำเร็จ — แชร์รหัสนี้ให้พนักงานลงทะเบียนในหน้า Register`, 'สร้างรหัสพนักงาน');
          this.showEmployeeInviteModal = false;
          this.employeeInviteCode = '';
          await this.data.refreshFromApi();
        }
      } else {
        // Mock mode: use existing addAdminCode
        const body = {
          role: 'company' as const,
          code: codeStr,
          maxUses: null as number | null,
          expiresAt: null as string | null,
          companyName: company.companyName,
          companyAddress: company.address || '',
          companyDescription: company.description || ''
        };
        const res = await this.data.addAdminCode(body);
        if (res && res.error) {
          this.notifications.error(res.error, 'สร้างรหัสเชิญพนักงานล้มเหลว');
        } else {
          this.notifications.success(`สร้างรหัสเชิญพนักงาน "${codeStr}" สำเร็จ — แชร์รหัสนี้ให้พนักงานลงทะเบียนในหน้า Register`, 'สร้างรหัสพนักงาน');
          this.showEmployeeInviteModal = false;
          this.employeeInviteCode = '';
          await this.data.refreshFromApi();
        }
      }
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'สร้างรหัสพนักงาน');
    } finally {
      this.employeeInviteLoading = false;
    }
  }

  /** Get active company invite codes for employees */
  protected get companyEmployeeInviteCodes() {
    const company = this.currentCompany;
    if (!company) return [];
    return this.data.enrollmentCodes.filter(c =>
      c.role === 'company' &&
      (c.companyId === company.id || c.companyName === company.companyName) &&
      c.isActive
    );
  }

  protected get assignmentStudents(): User[] {
    const assId = this.selectedAssignmentIdForDetails;
    if (!assId) return [];
    
    const ass = this.assignments.find(a => a.id === assId);
    if (!ass) return [];

    const user = this.currentUser;
    if (!user) return [];

    if (user.role === 'advisor') {
      const students = this.advisorStudents;
      if (ass.studentId) {
        return students.filter(s => s.id === ass.studentId);
      }
      return students;
    }

    if (user.role === 'company') {
      const company = this.currentCompany;
      if (!company) return [];
      
      const students = this.companyStudents;
      if (ass.studentId) {
        return students.filter(s => s.id === ass.studentId);
      }
      if (ass.jobPostingId) {
        const activeInternships = this.internships.filter(
          (i) => i.companyId === company.id && i.status === 'active' && i.jobPostingId === ass.jobPostingId
        );
        const studentIds = activeInternships.map((i) => i.studentId);
        return students.filter(s => studentIds.includes(s.id));
      }
      return students;
    }

    return [];
  }
  
  protected get pickableStudents(): User[] {
    const user = this.currentUser;
    if (user?.role !== 'advisor') return [];
    const query = this.pickStudentSearchQuery.trim().toLowerCase();
    return this.users.filter(u => 
      u.role === 'student' && 
      !(u.advisorIds ? u.advisorIds.includes(user.id) : u.advisorId === user.id) &&
      (u.name.toLowerCase().includes(query) || 
       u.email.toLowerCase().includes(query) || 
       (u.school && u.school.toLowerCase().includes(query)))
    );
  }

  protected get pendingStudents(): User[] {
    const user = this.currentUser;
    if (!user || user.role !== 'advisor') return [];
    return this.users.filter(u => u.role === 'student' && this.isSameSchool(u.school, user.school) && u.status === 'pending');
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


  protected get visibleJobs(): JobPosting[] {
    const list = this.jobPostings.filter((job) => !job.isDeleted);

    if (this.currentUser?.role === 'admin') {
      return list;
    }

    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    const filteredList = list.filter((job) => {
      // 1. Check capacity
      const jobInternships = this.internships
        .filter(
          (internship) =>
            internship.jobPostingId === job.id &&
            (internship.status === 'active' || internship.status === 'completed')
        )
        .sort(
          (a, b) =>
            new Date(a.createdAt || a.updatedAt || 0).getTime() -
            new Date(b.createdAt || b.updatedAt || 0).getTime()
        );
      
      const isFull = jobInternships.length >= job.slots;
      if (isFull) {
        const lastFillingInternship = jobInternships[job.slots - 1];
        const filledTime = lastFillingInternship
          ? new Date(lastFillingInternship.createdAt || lastFillingInternship.updatedAt || 0).getTime()
          : 0;
        if (now - filledTime >= oneDay) {
          return false; // Hide if full for more than 24 hours
        }
      }

      // 2. Check status
      const isNotOpen = job.status !== 'open';
      if (isNotOpen) {
        const closedTime = job.updatedAt
          ? new Date(job.updatedAt).getTime()
          : (job.createdAt ? new Date(job.createdAt).getTime() : 0);
        if (now - closedTime >= oneDay) {
          return false; // Hide if not open for more than 24 hours
        }
      }

      return true;
    });

    if (this.currentUser?.role === 'company' && this.currentCompanyId) {
      return filteredList.filter((job) => job.companyId === this.currentCompanyId);
    }

    return filteredList;
  }

  protected getApplicantCount(jobId: number): number {
    const job = this.jobPostings.find((j) => j.id === jobId);
    if (job && job.applicantCount !== undefined) {
      return job.applicantCount;
    }
    return this.applications.filter((a) => a.jobPostingId === jobId).length;
  }

  protected get visibleApplications(): Application[] {
    const user = this.currentUser;
    let list: Application[] = [];

    if (user?.role === 'admin') {
      list = this.applications;
    } else if (user?.role === 'student') {
      list = this.applications.filter((application) => application.studentId === user.id);
    } else if (user?.role === 'company' && this.currentCompanyId) {
      const companyJobIds = this.jobPostings
        .filter((job) => job.companyId === this.currentCompanyId)
        .map((job) => job.id);

      const rawList = this.applications.filter((application) =>
        companyJobIds.includes(application.jobPostingId)
      );

      // Load manually dismissed application IDs from localStorage
      let dismissedIds: number[] = [];
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('dismissed_application_ids');
        if (stored) {
          try {
            dismissedIds = JSON.parse(stored);
          } catch (e) {
            console.error(e);
          }
        }
      }

      // Filter out dismissed applications and those processed > 1 day ago
      const oneDayMs = 24 * 60 * 60 * 1000;
      const now = new Date().getTime();

      list = rawList.filter((app) => {
        if (dismissedIds.includes(app.id)) return false;
        if (app.status === 'approved' || app.status === 'rejected') {
          const dateStr = app.updatedAt || app.appliedAt;
          if (dateStr) {
            const lastUpdated = new Date(dateStr).getTime();
            if (now - lastUpdated > oneDayMs) return false;
          }
        }
        return true;
      });
    } else {
      const studentIds = this.managedStudents.map((student) => student.id);
      list = this.applications.filter((application) => studentIds.includes(application.studentId));
    }

    if (this.applicationStatusFilter && this.applicationStatusFilter !== 'all') {
      list = list.filter((app) => app.status === this.applicationStatusFilter);
    }
    return list;
  }

  protected get visibleInternships(): Internship[] {
    const user = this.currentUser;
    let list = this.internships;

    if (user?.role === 'admin') {
      list = this.internships;
    } else if (user?.role === 'student') {
      list = this.internships.filter((internship) => internship.studentId === user.id);
    } else if (user?.role === 'company' && this.currentCompanyId) {
      list = this.internships.filter((internship) => internship.companyId === this.currentCompanyId);
    } else {
      const studentIds = this.managedStudents.map((student) => student.id);
      list = this.internships.filter((internship) => studentIds.includes(internship.studentId));
    }

    // Load manually dismissed internship IDs from localStorage
    let dismissedIds: number[] = [];
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('dismissed_internship_ids');
      if (stored) {
        try {
          dismissedIds = JSON.parse(stored);
        } catch (e) {
          console.error(e);
        }
      }
    }

    // Filter out dismissed internships and those terminated > 24 hours
    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = new Date().getTime();

    list = list.filter((internship) => {
      if (dismissedIds.includes(internship.id)) {
        return false;
      }

      if (internship.status === 'terminated') {
        const dateStr = internship.updatedAt || internship.endDate;
        if (dateStr) {
          const lastUpdated = new Date(dateStr).getTime();
          if (now - lastUpdated > oneDayMs) {
            return false;
          }
        }
      }

      return true;
    });

    if (this.internshipStatusFilter && this.internshipStatusFilter !== 'all') {
      list = list.filter((i) => i.status === this.internshipStatusFilter);
    }
    return list;
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
    let list = this.data.logbooks.filter((logbook) => internshipIds.includes(logbook.internshipId));
    if (this.logbookStatusFilter && this.logbookStatusFilter !== 'all') {
      list = list.filter((l) => l.status === this.logbookStatusFilter);
    }
    return list;
  }

  protected get visibleLeaves(): LeaveRequest[] {
    const internshipIds = this.visibleInternships.map((internship) => internship.id);
    let list = this.data.leaves.filter((leave) => internshipIds.includes(leave.internshipId));
    if (this.leaveStatusFilter && this.leaveStatusFilter !== 'all') {
      list = list.filter((l) => l.status === this.leaveStatusFilter);
    }
    return list;
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
    return this.registerForm.role === 'company' && !this.skipCompanyFields;
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
    this.skipCompanyFields = false;
    this.presetCompanyName = '';

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

      const data = res.data ?? res;
      const role = data.role;
      const school_name = data.school_name ?? data.schoolName;
      const company_name = data.company_name ?? data.companyName;
      const skip_company_fields = data.skip_company_fields ?? data.skipCompanyFields;

      this.registerForm.role = role as RegisterRole;
      if (school_name) {
        this.registerForm.school = school_name;
      }

      this.skipCompanyFields = !!skip_company_fields;
      this.presetCompanyName = company_name || '';

      if (role === 'student') {
        this.detectedRoleName = `นักศึกษา (Student) - ${school_name || ''}`;
      } else if (role === 'advisor') {
        this.detectedRoleName = `อาจารย์ / ผู้ดูแลฝึกงาน (Advisor) - ${school_name || ''}`;
      } else if (role === 'company') {
        if (this.skipCompanyFields && company_name) {
          this.detectedRoleName = `สถานประกอบการ (Company) - ${company_name}`;
        } else {
          this.detectedRoleName = `สถานประกอบการ (Company) ${school_name ? '- เชิญโดย ' + school_name : ''}`;
        }
      }
      this.cdr.markForCheck();
    }, 500);
  }

  protected logout(): void {
    this.stopNotificationSync();
    this.currentUserId = null;
    this.applyRoleTheme(undefined);
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
    this.notifications.info('คุณได้ออกจากระบบเรียบร้อยแล้ว', 'ออกจากระบบ');
    this.cdr.detectChanges();
  }

  private applyRoleTheme(role: string | undefined): void {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    if (!role) {
      // Default fallback (Indigo theme)
      root.style.setProperty('--color-brand-accent', '#6366f1');
      root.style.setProperty('--color-brand-accent-teal', '#0ea5e9');
      root.style.setProperty('--color-brand-accent-teal-dim', 'rgba(14, 165, 233, 0.1)');
      root.style.setProperty('--color-brand-accent-indigo-dim', 'rgba(99, 102, 241, 0.1)');
      root.style.setProperty('--shadow-glow-teal', '0 0 20px rgba(14, 165, 233, 0.15)');
      root.style.setProperty('--shadow-glow-indigo', '0 0 20px rgba(99, 102, 241, 0.15)');
      return;
    }

    interface ThemeColors {
      accent: string;
      accentTeal: string;
      tealDim: string;
      indigoDim: string;
      glowTeal: string;
      glowIndigo: string;
    }

    const themes: Record<string, ThemeColors> = {
      admin: {
        accent: '#EF4444', 
        accentTeal: '#DC2626',
        tealDim: 'rgba(220, 38, 38, 0.1)',
        indigoDim: 'rgba(239, 68, 68, 0.1)',
        glowTeal: '0 0 20px rgba(220, 38, 38, 0.15)',
        glowIndigo: '0 0 20px rgba(239, 68, 68, 0.15)'
      },
      company: {
        accent: '#F59E0B', 
        accentTeal: '#D97706',
        tealDim: 'rgba(217, 119, 6, 0.1)',
        indigoDim: 'rgba(245, 158, 11, 0.1)',
        glowTeal: '0 0 20px rgba(217, 119, 6, 0.15)',
        glowIndigo: '0 0 20px rgba(245, 158, 11, 0.15)'
      },
      advisor: {
        accent: '#22C55E', 
        accentTeal: '#10B981',
        tealDim: 'rgba(16, 185, 129, 0.1)',
        indigoDim: 'rgba(34, 197, 94, 0.1)',
        glowTeal: '0 0 20px rgba(16, 185, 129, 0.15)',
        glowIndigo: '0 0 20px rgba(34, 197, 94, 0.15)'
      },
      student: {
        accent: '#3B82F6', 
        accentTeal: '#2563EB',
        tealDim: 'rgba(37, 99, 235, 0.1)',
        indigoDim: 'rgba(59, 130, 246, 0.1)',
        glowTeal: '0 0 20px rgba(37, 99, 235, 0.15)',
        glowIndigo: '0 0 20px rgba(59, 130, 246, 0.15)'
      }
    };

    const theme = themes[role];
    if (theme) {
      root.style.setProperty('--color-brand-accent', theme.accent);
      root.style.setProperty('--color-brand-accent-teal', theme.accentTeal);
      root.style.setProperty('--color-brand-accent-teal-dim', theme.tealDim);
      root.style.setProperty('--color-brand-accent-indigo-dim', theme.indigoDim);
      root.style.setProperty('--shadow-glow-teal', theme.glowTeal);
      root.style.setProperty('--shadow-glow-indigo', theme.glowIndigo);
    }
  }

  protected async retryApiConnect(): Promise<void> {
    this.notifications.info('กำลังเชื่อมต่อ Server ใหม่...', 'Retry');
    try {
      await this.data.refreshFromApi();
      if (this.data.apiConnected) {
        // Re-verify session after successful reconnect
        const user = this.users.find((u) => u.id === this.currentUserId);
        if (user) {
          await this.finishLogin(user, false);
          this.notifications.success('เชื่อมต่อ Server สำเร็จ!', 'Connected');
        } else {
          this.logout();
        }
      } else {
        this.notifications.error('ยังไม่สามารถเชื่อมต่อ Server ได้', 'Error');
      }
    } catch (err: any) {
      this.notifications.error(`เชื่อมต่อล้มเหลว: ${err.message || err}`, 'Error');
    }
    this.cdr.detectChanges();
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
    this.destroyCompanyMap();
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
      void this.loadEvaluationTemplates();
    }
    
    if (this.activeView === 'edit' && user) {
      const comp = user.role === 'company' ? this.companies.find(c => c.userId === user.id) : undefined;
      this.profileDraft = {
        name: user.name,
        email: user.email,
        phone: user.phone ?? '',
        school: user.school ?? '',
        resumeUrl: user.resumeUrl ?? '',
        intro: user.intro ?? '',
        field: user.field ?? '',
        number: user.number ?? 0,
        yearLevel: user.yearLevel ?? '',
        classGroup: user.classGroup ?? '',
        internStartDate: user.internStartDate ?? '',
        internEndDate: user.internEndDate ?? '',
        companyName: comp?.companyName ?? '',
        description: comp?.description ?? '',
        address: comp?.address ?? '',
        latitude: comp?.latitude ?? '',
        longitude: comp?.longitude ?? '',
        checkRadius: comp?.checkRadius ?? 200
      };
      if (user.role === 'company') {
        this.initCompanyMap();
      }
    }

    if (this.activeView === 'attendance' && user?.role === 'student') {
      this.fetchCurrentLocationForDistance();
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

  protected studentStartDate(userId: number): string {
    return this.users.find((user) => user.id === userId)?.internStartDate ?? '';
  }

  protected studentEndDate(userId: number): string {
    return this.users.find((user) => user.id === userId)?.internEndDate ?? '';
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

    // Check if the job posting is already full
    const filledCount = this.internships.filter(
      (internship) =>
        internship.jobPostingId === job.id &&
        (internship.status === 'active' || internship.status === 'completed')
    ).length;
    if (filledCount >= job.slots) {
      return false;
    }

    return (
      user?.status === 'active' &&
      job.status === 'open' &&
      !this.applications.some(
        (application) =>
          application.studentId === user?.id &&
          application.jobPostingId === job.id &&
          application.status !== 'rejected'
      )
    );
  }

  protected async applyJob(job: JobPosting): Promise<void> {
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

    try {
      await this.data.addApplication({
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
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'ส่งใบสมัคร');
    }
  }

  protected async updateApplication(application: Application, status: ApplicationStatus): Promise<void> {
    const student = this.userName(application.studentId);

    if (status === 'approved') {
      const hasActiveInternship = this.internships.some(
        (internship) => internship.studentId === application.studentId && internship.status === 'active'
      );
      if (hasActiveInternship) {
        alert('นักศึกษาคนนี้ มีสถานที่ฝึกงานแล้ว');
        this.notifications.error('นักศึกษาคนนี้ มีสถานที่ฝึกงานแล้ว', 'แจ้งเตือน');
        try {
          await this.data.updateApplicationStatus(application, 'rejected');
        } catch (e) {
          console.error(e);
        }
        return;
      }
    }

    try {
      await this.data.updateApplicationStatus(application, status);
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
        window.location.reload();
        return;
      }

      const job = this.jobPostings.find((item) => item.id === application.jobPostingId);
      if (!job) {
        this.notifications.warning('ไม่พบตำแหน่งงานที่เชื่อมกับใบสมัคร', 'ฝึกงาน');
        window.location.reload();
        return;
      }

      await this.data.addInternship({
        studentId: application.studentId,
        companyId: job.companyId,
        jobPostingId: job.id,
        startDate: this.today(),
        endDate: '2026-09-30',
        status: 'active'
      });
      await this.data.deleteOtherApplications(application.studentId, application.id);
      this.notifications.success(
        `สร้างฝึกงานให้ ${student} ตำแหน่ง ${job.title} แล้ว`,
        'ฝึกงาน'
      );
      window.location.reload();
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'การสมัคร');
    }
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
  
  protected async approveStudent(student: User): Promise<void> {
    const user = this.currentUser;
    if (!user) return;
    const updates: Partial<User> = { status: 'active' };
    if (user.role === 'advisor') {
      updates.school = user.school;
    }
    try {
      await this.data.updateUser(student.id, updates);
      this.notifications.success(`อนุมัติผู้ใช้ ${student.name} เรียบร้อยแล้ว`, 'จัดการผู้ใช้');
      window.location.reload();
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'จัดการผู้ใช้');
    }
  }
  
  protected async rejectStudent(student: User): Promise<void> {
    try {
      await this.data.updateUser(student.id, { status: 'rejected' });
      this.notifications.warning(`ปฏิเสธบัญชีของ ${student.name} แล้ว`, 'จัดการผู้ใช้');
      window.location.reload();
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'จัดการผู้ใช้');
    }
  }
  
  protected async claimStudent(student: User): Promise<void> {
    const user = this.currentUser;
    if (!user) return;
    try {
      await this.data.updateUser(student.id, { school: user.school, status: 'active' });
      this.notifications.success(`แก้ไขโรงเรียนและรับ ${student.name} เข้าสังกัดแล้ว`, 'จัดการนักศึกษา');
      window.location.reload();
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'จัดการนักศึกษา');
    }
  }

  protected async saveProfile(): Promise<void> {
    const user = this.currentUser;
    if (!user) return;
    try {
      const payload: any = {
        name: this.profileDraft.name,
        email: this.profileDraft.email,
        phone: this.profileDraft.phone,
        school: this.profileDraft.school,
        resumeUrl: this.profileDraft.resumeUrl,
        intro: this.profileDraft.intro,
        field: this.profileDraft.field,
        number: this.profileDraft.number,
        yearLevel: this.profileDraft.yearLevel,
        classGroup: this.profileDraft.classGroup,
        internStartDate: this.profileDraft.internStartDate || null,
        internEndDate: this.profileDraft.internEndDate || null
      };

      if (user.role === 'company') {
        payload.companyName = this.profileDraft.companyName;
        payload.description = this.profileDraft.description;
        payload.address = this.profileDraft.address;

        const lat = parseFloat(String(this.profileDraft.latitude));
        const lng = parseFloat(String(this.profileDraft.longitude));
        payload.latitude = isNaN(lat) ? null : lat;
        payload.longitude = isNaN(lng) ? null : lng;
        payload.check_radius = Number(this.profileDraft.checkRadius) || 200;
      }

      await this.data.updateUser(user.id, payload);
      this.notifications.success('บันทึกข้อมูลส่วนตัวแล้ว', 'โปรไฟล์');
      window.location.reload();
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'โปรไฟล์');
    }
  }

  protected pinProfileCoordinates(): void {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      Swal.fire({
        title: 'กำลังดึงพิกัดปัจจุบัน...',
        text: 'กรุณาอนุญาตให้ระบบเข้าถึงตำแหน่งของคุณ',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      navigator.geolocation.getCurrentPosition(
        (position) => {
          Swal.close();
          this.profileDraft.latitude = position.coords.latitude.toFixed(6);
          this.profileDraft.longitude = position.coords.longitude.toFixed(6);
          if (this.leafletMap && this.leafletMarker && this.leafletCircle) {
            const latlng = [position.coords.latitude, position.coords.longitude];
            this.leafletMarker.setLatLng(latlng);
            this.leafletCircle.setLatLng(latlng);
            this.leafletMap.setView(latlng, 15);
          }
          this.notifications.success('ปักหมุดพิกัดปัจจุบันเรียบร้อยแล้ว', 'ตำแหน่ง');
        },
        (error) => {
          Swal.close();
          this.notifications.error('ไม่สามารถดึงตำแหน่งได้ กรุณากรอกด้วยตนเอง', 'ตำแหน่ง');
        }
      );
    } else {
      this.notifications.error('เบราว์เซอร์ของคุณไม่สนับสนุนการดึงตำแหน่ง', 'ตำแหน่ง');
    }
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

  protected async updateJob(): Promise<void> {
    if (!this.selectedJobToEdit || !this.editJobForm.title.trim()) {
      this.notifications.warning('กรุณากรอกชื่อตำแหน่งงาน', 'โพสต์งาน');
      return;
    }

    const title = this.editJobForm.title.trim();
    const ensureSeconds = (timeStr: string) => {
      return timeStr.length === 5 ? timeStr + ':00' : timeStr;
    };

    try {
      await this.data.updateJob(this.selectedJobToEdit.id, {
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
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'ตำแหน่งงาน');
    }
  }

  protected async deleteJob(job: JobPosting): Promise<void> {
    if (confirm(`คุณแน่ใจหรือไม่ที่จะลบประกาศรับสมัครงาน "${job.title}"?`)) {
      try {
        await this.data.deleteJob(job.id);
        this.notifications.warning(`ลบประกาศรับสมัครงาน "${job.title}" แล้ว`, 'ตำแหน่งงาน');
        window.location.reload();
      } catch (err: any) {
        this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'ตำแหน่งงาน');
      }
    }
  }

  protected get companyCheckRadius(): number {
    return this.studentCompany?.checkRadius ?? 200;
  }

  protected checkIn(isWfh: boolean = false): void {
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
          this.executeCheckIn(lat, lon, isWfh);
        },
        (error) => {
          Swal.close();
          console.error('[App] Geolocation check-in error — trying IP fallback', error);
          // PC fallback: use IP-based geolocation
          this.getIpLocation().then(coords => {
            if (coords) {
              this.executeCheckIn(coords.lat, coords.lon, isWfh);
            } else {
              Swal.fire({
                title: 'ไม่สามารถดึงตำแหน่งได้',
                text: 'ระบบไม่สามารถระบุพิกัดได้ คุณต้องการลงเวลาเข้างานต่อโดยไม่มีพิกัดหรือไม่?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'ลงเวลาต่อ',
                cancelButtonText: 'ยกเลิก'
              }).then((result) => {
                if (result.isConfirmed) this.executeCheckIn(undefined, undefined, isWfh);
              });
            }
          });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      this.executeCheckIn(undefined, undefined, isWfh);
    }
  }

  private async executeCheckIn(lat?: number, lon?: number, isWfh: boolean = false): Promise<void> {
    const user = this.currentUser;
    if (!user || !this.activeInternship) return;

    // Check radius if it's NOT WFH
    if (!isWfh) {
      if (this.companyDistance !== null && this.companyDistance > this.companyCheckRadius) {
        Swal.fire({
          title: 'อยู่นอกพื้นที่เช็คอิน',
          text: `คุณอยู่ห่างจากสถานที่ทำงาน ${Math.round(this.companyDistance)} เมตร (เกินระยะที่กำหนด ${this.companyCheckRadius} เมตร) หากทำงานที่บ้านกรุณาเช็คอินแบบ WFH`,
          icon: 'warning',
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#3b82f6'
        });
        return;
      }
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

    try {
      await this.data.addAttendance({
        internshipId: this.activeInternship.id,
        studentId: user.id,
        checkInTime: now.toISOString(),
        status,
        verificationStatus: 'pending',
        latitude: lat,
        longitude: lon,
        isWfh: isWfh
      });
      this.notifications.success(
        `Check in ${isWfh ? 'WFH' : ''} แล้ว (${this.attendanceStatusLabel(status)})` + (lat ? ' พร้อมพิกัด GPS' : ''),
        'ลงเวลา'
      );
    } catch (err: any) {
      console.error('[CheckIn] Error during check-in:', err);
      this.notifications.error(`ลงเวลาเข้างานไม่สำเร็จ: ${err.message || err}`, 'ลงเวลา');
    }
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

  // ----------- Classroom Actions & Helpers -----------
  protected get studentCompany(): Company | undefined {
    const active = this.activeInternship;
    if (!active) return undefined;
    return this.companies.find((c) => c.id === active.companyId);
  }

  protected getCompanyDistance(): number | null {
    const company = this.studentCompany;
    if (!company || company.latitude === undefined || company.longitude === undefined || company.latitude === null || company.longitude === null) {
      return null;
    }
    if (!this.currentLatitude || !this.currentLongitude) {
      return null;
    }
    return this.calculateDistance(this.currentLatitude, this.currentLongitude, company.latitude, company.longitude);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const phi1 = lat1 * Math.PI/180;
    const phi2 = lat2 * Math.PI/180;
    const deltaPhi = (lat2-lat1) * Math.PI/180;
    const deltaLambda = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  }

  private fetchCurrentLocationForDistance(): void {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.currentLatitude = position.coords.latitude;
          this.currentLongitude = position.coords.longitude;
        },
        (error) => {
          console.error('[App] Error getting location for check-in preview', error);
          this.getIpLocation().then(coords => {
            if (coords) {
              this.currentLatitude = coords.lat;
              this.currentLongitude = coords.lon;
            }
          });
        }
      );
    }
  }

  protected getAssignmentTargetLabel(ass: Assignment | undefined): string {
    if (!ass) return '';
    if (ass.studentId) {
      const student = this.users.find(u => u.id === ass.studentId);
      return `เฉพาะนักศึกษา: ${student?.name || 'ไม่ระบุ'}`;
    }
    if (ass.jobPostingId) {
      const job = this.jobPostings.find(j => j.id === ass.jobPostingId);
      return `เฉพาะตำแหน่งงาน: ${job?.title || 'ไม่ระบุ'}`;
    }
    return 'ทุกคนในสังกัด/ความดูแล';
  }

  protected async addAssignment(): Promise<void> {
    const user = this.currentUser;
    if (!user) return;
    if (!this.newAssignment.title.trim() || !this.newAssignment.description.trim()) {
      this.notifications.warning('กรุณากรอกหัวข้อและคำอธิบายงาน', 'มอบหมายงาน');
      return;
    }

    let schoolId: number | undefined = undefined;
    let companyId: number | undefined = undefined;

    if (user.role === 'advisor') {
      const dbSchool = this.data.schools.find(s => s.name === user.school);
      schoolId = dbSchool ? dbSchool.id : 1;
    } else if (user.role === 'company') {
      companyId = this.currentCompanyId;
    }

    const payload: any = {
      title: this.newAssignment.title.trim(),
      description: this.newAssignment.description.trim(),
      dueDate: this.newAssignment.dueDate ? new Date(this.newAssignment.dueDate).toISOString() : undefined,
      points: this.newAssignment.points,
      creatorId: user.id,
      creatorRole: user.role,
      schoolId,
      companyId
    };

    if (this.newAssignment.targetType === 'student' && this.newAssignment.studentId) {
      payload.studentId = Number(this.newAssignment.studentId);
    } else if (this.newAssignment.targetType === 'position' && this.newAssignment.jobPostingId) {
      payload.jobPostingId = Number(this.newAssignment.jobPostingId);
    }

    try {
      await this.data.addAssignment(payload);
      this.newAssignment = {
        title: '',
        description: '',
        dueDate: '',
        points: 100,
        targetType: 'all',
        studentId: null,
        jobPostingId: null
      };
      this.notifications.success('สร้างงานมอบหมายเรียบร้อยแล้ว', 'สำเร็จ');
    } catch (err: any) {
      this.notifications.error('สร้างงานล้มเหลว: ' + err.message, 'ผิดพลาด');
    }
  }

  protected async submitAssignment(assignmentId: number): Promise<void> {
    const user = this.currentUser;
    if (!user) return;

    if (!this.assignmentSubmitForm.content.trim() && !this.assignmentSubmitForm.fileName) {
      this.notifications.warning('กรุณากรอกรายละเอียดหรืออัปโหลดไฟล์ส่งงาน', 'ส่งงาน');
      return;
    }

    const payload = {
      assignmentId,
      studentId: user.id,
      content: this.assignmentSubmitForm.content,
      fileName: this.assignmentSubmitForm.fileName,
      filePath: this.assignmentSubmitForm.filePath
    };

    try {
      await this.data.addSubmission(payload);
      this.assignmentSubmitForm = { content: '', fileName: '', filePath: '' };
      this.selectedAssignmentIdForDetails = null;
      this.notifications.success('ส่งงานสำเร็จเรียบร้อย', 'สำเร็จ');
    } catch (err: any) {
      this.notifications.error('ส่งงานล้มเหลว: ' + err.message, 'ผิดพลาด');
    }
  }

  protected selectAssignmentForDetails(id: number): void {
    this.selectedAssignmentIdForDetails = id;
    const existing = this.submissions.find(s => s.assignmentId === id && s.studentId === this.currentUserId);
    if (existing) {
      this.assignmentSubmitForm = {
        content: existing.content ?? '',
        fileName: existing.fileName ?? '',
        filePath: existing.filePath ?? ''
      };
    } else {
      this.assignmentSubmitForm = { content: '', fileName: '', filePath: '' };
    }
  }

  protected openGradingModal(sub: Submission): void {
    this.selectedSubmissionForGrading = sub;
    const assignment = this.getAssignmentById(sub.assignmentId);
    const maxPoints = assignment?.points || 100;
    const initialRubricScore = sub.score !== undefined ? Math.round((sub.score / maxPoints) * 100) : 100;

    this.gradeForm = {
      score: initialRubricScore,
      feedback: sub.feedback ?? ''
    };

    const baseVal = Math.floor(initialRubricScore / 4);
    const remainder = initialRubricScore % 4;
    this.rubricPunctuality = baseVal + (remainder > 0 ? 1 : 0);
    this.rubricTechnical = baseVal + (remainder > 1 ? 1 : 0);
    this.rubricAttitude = baseVal + (remainder > 2 ? 1 : 0);
    this.rubricDocumentation = baseVal;
  }

  protected updateGradingScore(): void {
    this.gradeForm.score = this.rubricPunctuality + this.rubricTechnical + this.rubricAttitude + this.rubricDocumentation;
  }

  protected async gradeSubmission(): Promise<void> {
    if (!this.selectedSubmissionForGrading) return;
    try {
      const assignment = this.getAssignmentById(this.selectedSubmissionForGrading.assignmentId);
      const maxPoints = assignment?.points || 100;
      const scaledScore = parseFloat(((this.gradeForm.score / 100) * maxPoints).toFixed(2));

      await this.data.gradeSubmission(
        this.selectedSubmissionForGrading.id,
        scaledScore,
        this.gradeForm.feedback
      );
      this.notifications.success('ให้คะแนนและส่งคืนเรียบร้อย', 'สำเร็จ');
      this.selectedSubmissionForGrading = null;
    } catch (err: any) {
      this.notifications.error('บันทึกผลการตรวจล้มเหลว: ' + err.message, 'ผิดพลาด');
    }
  }

  protected getSubmissionsForAssignment(assignmentId: number): Submission[] {
    return this.submissions.filter(s => s.assignmentId === assignmentId);
  }

  protected getStudentSubmission(assignmentId: number, studentId: number): Submission | undefined {
    return this.submissions.find(s => s.assignmentId === assignmentId && s.studentId === studentId);
  }

  protected get pendingCompanyAssignmentsCount(): number {
    const user = this.currentUser;
    if (!user || user.role !== 'student') return 0;
    
    const companyAssList = this.assignments.filter(a => a.companyId !== undefined && a.companyId !== null || a.creatorRole === 'company');
    let count = 0;
    for (const ass of companyAssList) {
      const sub = this.getStudentSubmission(ass.id, user.id);
      if (!sub) {
        count++;
      } else if (sub.status !== 'accepted' && sub.status !== 'ignored' && sub.status !== 'submitted' && sub.status !== 'late' && sub.status !== 'graded') {
        count++;
      }
    }
    return count;
  }

  protected getCountdownText(dueDateStr: string | undefined): string {
    if (!dueDateStr) return 'ไม่มีกำหนดส่ง (No Deadline)';
    const dueDate = new Date(dueDateStr);
    const now = this.currentTime;
    const diffMs = dueDate.getTime() - now.getTime();
    if (diffMs <= 0) {
      return 'หมดเวลาส่งแล้ว (Deadline passed)';
    }

    const diffSecs = Math.floor(diffMs / 1000);
    const secs = diffSecs % 60;
    const diffMins = Math.floor(diffSecs / 60);
    const mins = diffMins % 60;
    const diffHours = Math.floor(diffMins / 60);
    const hours = diffHours % 24;
    const days = Math.floor(diffHours / 24);

    let parts: string[] = [];
    if (days > 0) parts.push(`${days} วัน`);
    if (hours > 0 || days > 0) parts.push(`${hours} ชั่วโมง`);
    if (diffMins > 0 || hours > 0 || days > 0) parts.push(`${mins} นาที`);
    parts.push(`${secs} วินาที`);

    return 'เหลือเวลา: ' + parts.join(' ');
  }

  protected async acceptAssignment(assignmentId: number): Promise<void> {
    const studentId = this.currentUserId;
    if (!studentId) return;
    try {
      await this.data.acceptSubmission(assignmentId, studentId);
      this.notifications.success('ยอมรับงานสำเร็จและเริ่มจับเวลาแล้ว', 'สำเร็จ');
      this.selectAssignmentForDetails(assignmentId);
    } catch (err: any) {
      this.notifications.error('ยอมรับงานล้มเหลว: ' + err.message, 'ผิดพลาด');
    }
  }

  protected async ignoreAssignment(assignmentId: number): Promise<void> {
    const studentId = this.currentUserId;
    if (!studentId) return;
    try {
      await this.data.ignoreSubmission(assignmentId, studentId);
      this.notifications.success('ปฏิเสธงานเรียบร้อยแล้ว', 'สำเร็จ');
      this.selectAssignmentForDetails(assignmentId);
    } catch (err: any) {
      this.notifications.error('ปฏิเสธงานล้มเหลว: ' + err.message, 'ผิดพลาด');
    }
  }

  // --- Resume Uploader Simulation ---
  protected triggerResumeUpload(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.uploadingResume = true;
    this.resumeUploadSuccess = false;

    if (this.data.api.apiEnabled()) {
      const formData = new FormData();
      formData.append('file', file);

      this.apiService.post<any>('/upload', formData).subscribe({
        next: (res) => {
          this.uploadingResume = false;
          if (res && res.status === 200 && res.data) {
            this.resumeUploadSuccess = true;
            this.profileDraft.resumeUrl = res.data.file_path;
            this.notifications.success('อัปโหลดไฟล์เรซูเมสำเร็จ', 'สำเร็จ');
          } else {
            this.notifications.error(res.error || 'อัปโหลดไฟล์เรซูเมล้มเหลว', 'ผิดพลาด');
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.uploadingResume = false;
          this.notifications.error(this.extractErrorMessage(err) || 'อัปโหลดไฟล์เรซูเมล้มเหลว', 'ผิดพลาด');
          this.cdr.markForCheck();
        }
      });
    } else {
      setTimeout(() => {
        this.uploadingResume = false;
        this.resumeUploadSuccess = true;
        try {
          const objectUrl = URL.createObjectURL(file);
          this.profileDraft.resumeUrl = objectUrl;
        } catch (e) {
          console.error('Error creating object URL for resume:', e);
        }
        this.notifications.success('อัปโหลดไฟล์เรซูเมสำเร็จ (จำลอง)', 'สำเร็จ');
        this.cdr.markForCheck();
      }, 1500);
    }
  }

  // --- Pending Advisor Contacts ---
  protected getSchoolAdvisors(): User[] {
    const user = this.currentUser;
    if (!user || !user.school) return [];
    return this.users.filter(u => u.role === 'advisor' && this.isSameSchool(u.school, user.school) && u.status === 'active');
  }

  /** Template-friendly getter alias for getSchoolAdvisors() */
  protected get schoolAdvisors(): User[] {
    return this.getSchoolAdvisors();
  }

  /** Template-friendly getter alias for getCompanyDistance() */
  protected get companyDistance(): number | null {
    return this.getCompanyDistance();
  }

  /** Template-friendly alias for jobName() */
  protected jobTitle(jobPostingId: number): string {
    return this.jobName(jobPostingId);
  }

  /** Resolve student name via logbook → internship → student */
  protected logbookStudentName(logbook: Logbook): string {
    const internship = this.internshipFor(logbook.internshipId);
    return internship ? this.userName(internship.studentId) : '-';
  }

  /** Resolve student name via evaluation → internship → student */
  protected evaluationStudentName(evaluation: { internshipId: number }): string {
    const internship = this.internshipFor(evaluation.internshipId);
    return internship ? this.userName(internship.studentId) : '-';
  }

  // --- Checkbox Batch Actions ---
  protected toggleSelectAllStudents(event: any): void {
    const checked = event.target.checked;
    this.pendingStudents.forEach(s => {
      this.selectedStudentIds[s.id] = checked;
    });
  }

  protected get isAllStudentsSelected(): boolean {
    if (this.pendingStudents.length === 0) return false;
    return this.pendingStudents.every(s => this.selectedStudentIds[s.id]);
  }

  protected async bulkApproveStudents(): Promise<void> {
    const selectedIds = Object.keys(this.selectedStudentIds)
      .map(Number)
      .filter(id => this.selectedStudentIds[id]);

    if (selectedIds.length === 0) {
      this.notifications.warning('กรุณาเลือกนักศึกษาอย่างน้อย 1 คน', 'เลือกรายการ');
      return;
    }

    Swal.fire({
      title: 'ยืนยันการอนุมัติทั้งหมด?',
      text: `คุณกำลังจะอนุมัติบัญชีผู้ใช้จำนวน ${selectedIds.length} รายการ`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ใช่, อนุมัติทั้งหมด',
      cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
      if (result.isConfirmed) {
        let count = 0;
        for (const id of selectedIds) {
          const u = this.users.find(user => user.id === id);
          if (u) {
            await this.data.updateUser(u.id, { ...u, status: 'active' });
            count++;
          }
        }
        this.selectedStudentIds = {};
        this.notifications.success(`อนุมัติผู้ใช้ทั้งหมด ${count} คนสำเร็จ`, 'สำเร็จ');
      }
    });
  }

  protected toggleSelectAllAttendances(event: any): void {
    const checked = event.target.checked;
    this.pendingAttendances.forEach(a => {
      this.selectedAttendanceIds[a.id] = checked;
    });
  }

  protected get isAllAttendancesSelected(): boolean {
    if (this.pendingAttendances.length === 0) return false;
    return this.pendingAttendances.every(a => this.selectedAttendanceIds[a.id]);
  }

  protected async bulkApproveAttendances(): Promise<void> {
    const selectedIds = Object.keys(this.selectedAttendanceIds)
      .map(Number)
      .filter(id => this.selectedAttendanceIds[id]);

    if (selectedIds.length === 0) {
      this.notifications.warning('กรุณาเลือกรายการลงเวลาอย่างน้อย 1 รายการ', 'เลือกรายการ');
      return;
    }

    Swal.fire({
      title: 'ยืนยันการอนุมัติเวลาเข้างาน?',
      text: `คุณกำลังจะอนุมัติเวลาของนักศึกษาจำนวน ${selectedIds.length} รายการ`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ใช่, อนุมัติทั้งหมด',
      cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
      if (result.isConfirmed) {
        let count = 0;
        for (const id of selectedIds) {
          const a = this.attendances.find(att => att.id === id);
          if (a) {
            await this.data.setAttendanceStatus(a, 'present');
            count++;
          }
        }
        this.selectedAttendanceIds = {};
        this.notifications.success(`อนุมัติเวลางานสำเร็จ ${count} รายการ`, 'สำเร็จ');
      }
    });
  }

  protected triggerWorkFileUpload(event: any): void {
    const file = event.target.files[0];
    if (!file) return;
    this.assignmentSubmitForm.fileName = file.name;

    if (this.data.api.apiEnabled()) {
      const formData = new FormData();
      formData.append('file', file);

      this.uploadingWorkFile = true;
      // Show temporary uploading notification
      this.notifications.success('กำลังอัปโหลดไฟล์ส่งงาน: ' + file.name, 'อัปโหลด');

      this.apiService.post<any>('/upload', formData).subscribe({
        next: (res) => {
          this.uploadingWorkFile = false;
          if (res && res.status === 200 && res.data) {
            this.assignmentSubmitForm.filePath = res.data.file_path;
            this.notifications.success('อัปโหลดไฟล์ส่งงานสำเร็จ: ' + file.name, 'สำเร็จ');
          } else {
            this.notifications.error(res.error || 'อัปโหลดไฟล์ส่งงานล้มเหลว', 'ผิดพลาด');
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.uploadingWorkFile = false;
          this.notifications.error(this.extractErrorMessage(err) || 'อัปโหลดไฟล์ส่งงานล้มเหลว', 'ผิดพลาด');
          this.cdr.markForCheck();
        }
      });
    } else {
      try {
        const objectUrl = URL.createObjectURL(file);
        this.assignmentSubmitForm.filePath = objectUrl;
      } catch (e) {
        console.error('Error creating object URL for work file:', e);
      }
      
      this.notifications.success('เลือกไฟล์ส่งงานแล้ว: ' + file.name + ' (จำลอง)', 'สำเร็จ');
    }
  }

  protected async addLogbook(): Promise<void> {
    if (!this.activeInternship) {
      this.notifications.warning('ยังไม่มีฝึกงานที่ active', 'บันทึก');
      return;
    }

    if (!this.logbookTitle.trim() || !this.logbookText.trim()) {
      this.notifications.warning('กรุณากรอกหัวข้อและเนื้อหาบันทึก', 'บันทึก');
      return;
    }

    try {
      await this.data.addLogbook({
        internshipId: this.activeInternship.id,
        title: this.logbookTitle.trim(),
        content: this.logbookText.trim(),
        workDate: this.logbookDate
      });
      this.logbookTitle = '';
      this.logbookText = '';
      this.notifications.success('ส่งบันทึกแล้ว (รออนุมัติ)', 'บันทึก');
      this.cdr.detectChanges();
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${this.extractErrorMessage(err)}`, 'บันทึก');
    }
  }

  protected startEditLogbook(log: Logbook): void {
    this.editingLogbook = log;
    this.editLogbookForm.title = log.title;
    this.editLogbookForm.content = log.content;
    this.editLogbookForm.workDate = log.workDate ?? '';
  }

  protected cancelEditLogbook(): void {
    this.editingLogbook = null;
  }

  protected async submitEditLogbook(): Promise<void> {
    if (!this.editingLogbook) return;
    if (!this.editLogbookForm.title.trim() || !this.editLogbookForm.content.trim()) {
      this.notifications.warning('กรุณากรอกหัวข้อและเนื้อหาบันทึก', 'บันทึก');
      return;
    }

    try {
      await this.data.updateLogbook(
        this.editingLogbook.id,
        this.editLogbookForm.title.trim(),
        this.editLogbookForm.content.trim(),
        this.editLogbookForm.workDate
      );
      this.editingLogbook = null;
      this.notifications.success('แก้ไขบันทึกเรียบร้อยแล้ว', 'บันทึก');
      this.cdr.detectChanges();
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${this.extractErrorMessage(err)}`, 'บันทึก');
    }
  }

  protected async deleteLogbook(id: number): Promise<void> {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบบันทึกรายงานนี้?')) {
      try {
        await this.data.deleteLogbook(id);
        this.notifications.success('ลบบันทึกเรียบร้อยแล้ว', 'บันทึก');
        this.cdr.detectChanges();
      } catch (err: any) {
        this.notifications.error(`เกิดข้อผิดพลาด: ${this.extractErrorMessage(err)}`, 'บันทึก');
      }
    }
  }

  protected async reviewLogbook(logbook: Logbook, status: LogbookStatus): Promise<void> {
    try {
      await this.data.updateLogbookStatus(
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
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'บันทึก');
    }
  }

  protected async addLeave(): Promise<void> {
    if (!this.activeInternship) {
      this.notifications.warning('ยังไม่มีฝึกงานที่ active', 'การลา');
      return;
    }

    if (!this.leaveForm.reason.trim()) {
      this.notifications.warning('กรุณากรอกเหตุผลการลา', 'การลา');
      return;
    }

    try {
      await this.data.addLeave({
        internshipId: this.activeInternship.id,
        studentId: this.currentUser!.id,
        leaveType: this.leaveForm.leaveType,
        startDate: this.leaveForm.startDate,
        endDate: this.leaveForm.endDate,
        reason: this.leaveForm.reason.trim()
      });

      this.leaveForm.reason = '';
      this.notifications.success('ส่งคำขอลาแล้ว (รออนุมัติ)', 'การลา');
      this.cdr.detectChanges();
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${this.extractErrorMessage(err)}`, 'การลา');
    }
  }

  protected startEditLeave(leave: LeaveRequest): void {
    this.editingLeave = leave;
    this.editLeaveForm.leaveType = leave.leaveType;
    this.editLeaveForm.startDate = leave.startDate.slice(0, 10);
    this.editLeaveForm.endDate = leave.endDate.slice(0, 10);
    this.editLeaveForm.reason = leave.reason;
  }

  protected cancelEditLeave(): void {
    this.editingLeave = null;
  }

  protected async submitEditLeave(): Promise<void> {
    if (!this.editingLeave) return;
    if (!this.editLeaveForm.reason.trim()) {
      this.notifications.warning('กรุณากรอกเหตุผลการลา', 'การลา');
      return;
    }

    try {
      await this.data.updateLeave(this.editingLeave.id, {
        internshipId: this.editingLeave.internshipId,
        studentId: this.editingLeave.studentId,
        leaveType: this.editLeaveForm.leaveType,
        startDate: this.editLeaveForm.startDate,
        endDate: this.editLeaveForm.endDate,
        reason: this.editLeaveForm.reason.trim()
      });
      this.editingLeave = null;
      this.notifications.success('แก้ไขคำขอลาเรียบร้อยแล้ว', 'การลา');
      this.cdr.detectChanges();
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${this.extractErrorMessage(err)}`, 'การลา');
    }
  }

  protected async deleteLeave(id: number): Promise<void> {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบคำขอลาบนี้?')) {
      try {
        await this.data.deleteLeave(id);
        this.notifications.success('ลบคำขอลาเรียบร้อยแล้ว', 'การลา');
        this.cdr.detectChanges();
      } catch (err: any) {
        this.notifications.error(`เกิดข้อผิดพลาด: ${this.extractErrorMessage(err)}`, 'การลา');
      }
    }
  }

  protected async setLeaveStatus(leave: LeaveRequest, status: 'approved' | 'rejected'): Promise<void> {
    const student = this.userName(leave.studentId);
    try {
      await this.data.updateLeaveStatus(leave.id, status);

      if (status === 'approved') {
        this.notifications.success(`อนุมัติคำขอลาของ ${student} แล้ว`, 'การลา');
      } else {
        this.notifications.warning(`ปฏิเสธคำขอลาของ ${student} แล้ว`, 'การลา');
      }
      this.cdr.detectChanges();
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'การลา');
    }
  }

  protected async addEvaluation(): Promise<void> {
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
    try {
      await this.data.addEvaluation({
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
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'ประเมินผล');
    }
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
    this.skipCompanyFields = false;
    this.presetCompanyName = '';
  }

  private async finishLogin(user: User, showNotification = true): Promise<void> {
    this.currentUserId = user.id;
    this.applyRoleTheme(user.role);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.sessionKey, user.id.toString());
    }
    this.loginError = '';

    // Await a fresh full data snapshot so all views are populated instantly
    await this.data.refreshFromApi();

    if (user.role === 'advisor') {
      this.loadCustomClassGroups();
    }

    if (showNotification) {
      this.notifications.success(
        `เข้าสู่ระบบในฐานะ${this.roleName(user.role)}เรียบร้อยแล้ว`,
        `ยินดีต้อนรับ คุณ${user.name}`
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
    const comp = user.role === 'company' ? this.companies.find(c => c.userId === user.id) : undefined;
    this.profileDraft = {
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      school: user.school ?? '',
      resumeUrl: user.resumeUrl ?? '',
      intro: user.intro ?? '',
      field: user.field ?? '',
      number: user.number ?? 0,
      yearLevel: user.yearLevel ?? '',
      classGroup: user.classGroup ?? '',
      internStartDate: user.internStartDate ?? '',
      internEndDate: user.internEndDate ?? '',
      companyName: comp?.companyName ?? '',
      description: comp?.description ?? '',
      address: comp?.address ?? '',
      latitude: comp?.latitude ?? '',
      longitude: comp?.longitude ?? '',
      checkRadius: comp?.checkRadius ?? 200
    };
    this.evaluationType = user.role === 'advisor' ? 'advisor' : 'mentor';

    // Notify student if they have any terminated internships that haven't been acknowledged yet
    if (user.role === 'student') {
      const myInternships = this.internships.filter((i) => i.studentId === user.id);
      myInternships.forEach((internship) => {
        if (internship.status === 'terminated') {
          const notifiedKey = `notified_terminated_internship_${internship.id}`;
          if (typeof window !== 'undefined' && window.localStorage && !window.localStorage.getItem(notifiedKey)) {
            const compName = this.companyName(internship.companyId) || 'บริษัท';
            this.notifications.warning(
              `การฝึกงานของคุณกับ ${compName} ได้ถูกยกเลิก/สิ้นสุดแล้ว (Terminated)`,
              'แจ้งเตือนการสิ้นสุดการฝึกงาน'
            );
            window.localStorage.setItem(notifiedKey, 'true');
          }
        }
      });
    }

    this.startNotificationSync();
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.stopNotificationSync();
  }

  private startNotificationSync(): void {
    this.stopNotificationSync();
    const user = this.currentUser;
    if (!user) return;

    this.knownAssignmentIds = new Set(this.assignments.map(a => a.id));

    if (typeof window !== 'undefined') {
      this.pollingIntervalId = setInterval(async () => {
        if (!this.currentUser) {
          this.stopNotificationSync();
          return;
        }
        try {
          await this.data.refreshFromApi();
          this.checkNewAssignments();
        } catch (err) {
          console.error('[Notification Polling] Error checking assignments:', err);
        }
      }, 30000); // 30 seconds

      window.addEventListener('storage', this.handleStorageEvent);
    }
  }

  private stopNotificationSync(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent);
    }
  }

  private handleStorageEvent = (event: StorageEvent): void => {
    if (event.key === 'intern-manager-state-v2') {
      void this.data.refreshFromApi().then(() => {
        this.checkNewAssignments();
        this.cdr.detectChanges();
      });
    }
  };

  private checkNewAssignments(): void {
    const currentList = this.assignments;
    let foundNew = false;
    
    for (const ass of currentList) {
      if (!this.knownAssignmentIds.has(ass.id)) {
        this.knownAssignmentIds.add(ass.id);
        if (ass.creatorId !== this.currentUserId) {
          foundNew = true;
          const creatorType = ass.creatorRole === 'company' ? 'พี่เลี้ยง/บริษัท' : 'อาจารย์';
          this.notifications.info(
            `งานใหม่: "${ass.title}"\nมอบหมายโดย: ${creatorType}`,
            'ได้รับงานมอบหมายใหม่'
          );
        }
      }
    }
    
    if (foundNew) {
      this.cdr.detectChanges();
    }
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

  protected internshipStatusLabel(status: string): string {
    return {
      active: 'กำลังฝึกงาน',
      completed: 'เสร็จสิ้นการฝึกงาน',
      terminated: 'สิ้นสุดการฝึกงาน'
    }[status] || status;
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

  protected userStatusLabel(status: string | undefined): string {
    if (!status) return '';
    return {
      active: 'อนุมัติแล้ว',
      pending: 'รออนุมัติ',
      rejected: 'ระงับการใช้งาน',
      suspended: 'ระงับการใช้งาน'
    }[status] || status;
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

  protected async toggleUserStatus(user: User, newStatus: any): Promise<void> {
    if (user.id === this.currentUserId) {
      this.notifications.warning('คุณไม่สามารถเปลี่ยนสถานะของตนเองได้', 'จัดการผู้ใช้');
      return;
    }
    try {
      await this.data.updateUser(user.id, { status: newStatus });
      this.notifications.success(`ปรับปรุงสถานะของ ${user.name} เป็น ${this.userStatusLabel(newStatus)} เรียบร้อยแล้ว`, 'จัดการผู้ใช้');
      window.location.reload();
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'จัดการผู้ใช้');
    }
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
    if (this.adminCodeForm.role === 'company' && !this.adminCodeForm.companyId && !this.adminCodeForm.companyName.trim()) {
      this.notifications.warning('กรุณาระบุชื่อสถานประกอบการ หรือเลือกสถานประกอบการที่มีอยู่', 'จัดการรหัสเชิญ');
      return;
    }
    const body = {
      schoolId: this.adminCodeForm.role === 'company' ? null : (this.adminCodeForm.schoolId ? Number(this.adminCodeForm.schoolId) : null),
      companyId: this.adminCodeForm.role === 'company' && this.adminCodeForm.companyId ? Number(this.adminCodeForm.companyId) : null,
      role: this.adminCodeForm.role,
      code: this.adminCodeForm.code.trim().toUpperCase(),
      maxUses: this.adminCodeForm.maxUses ? Number(this.adminCodeForm.maxUses) : null,
      expiresAt: this.adminCodeForm.expiresAt ? new Date(this.adminCodeForm.expiresAt).toISOString() : null,
      companyName: this.adminCodeForm.role === 'company' && !this.adminCodeForm.companyId ? this.adminCodeForm.companyName.trim() : undefined,
      companyAddress: this.adminCodeForm.role === 'company' && !this.adminCodeForm.companyId ? this.adminCodeForm.companyAddress.trim() || undefined : undefined,
      companyDescription: this.adminCodeForm.role === 'company' && !this.adminCodeForm.companyId ? this.adminCodeForm.companyDescription.trim() || undefined : undefined
    };
    const res = await this.data.addAdminCode(body);
    if (res && res.error) {
      this.notifications.error(res.error, 'จัดการรหัสเชิญ');
    } else {
      this.notifications.success(`สร้างรหัสเชิญ ${body.code} สำเร็จ`, 'จัดการรหัสเชิญ');
      this.adminCodeForm.code = '';
      this.adminCodeForm.companyId = null;
      this.adminCodeForm.maxUses = null;
      this.adminCodeForm.expiresAt = null;
      this.adminCodeForm.companyName = '';
      this.adminCodeForm.companyAddress = '';
      this.adminCodeForm.companyDescription = '';
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
    this.notifications.success('ส่งออกผลลัพธ์เป็น CSV สำเร็จ', 'ส่งออก CSV');
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
    mentorScore: number | null; 
    mentorMaxScore: number;
    advisorScore: number | null; 
    advisorMaxScore: number;
    average: number | null;
    averageMaxScore: number;
  } {
    const evals = this.data.evaluations.filter(e => e.internshipId === internshipId);
    const mentor  = evals.find(e => e.evaluationType === 'mentor');
    const advisor = evals.find(e => e.evaluationType === 'advisor');
    
    const mMax = mentor ? this.getEvaluationMaxScore(mentor) : 100;
    const aMax = advisor ? this.getEvaluationMaxScore(advisor) : 100;
    
    const mentorPct = mentor ? (mentor.score / mMax) * 100 : null;
    const advisorPct = advisor ? (advisor.score / aMax) * 100 : null;
    const percentages = [mentorPct, advisorPct].filter((p): p is number => p != null);
    
    return {
      mentorScore:  mentor?.score  ?? null,
      mentorMaxScore: mMax,
      advisorScore: advisor?.score ?? null,
      advisorMaxScore: aMax,
      average: percentages.length ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : null,
      averageMaxScore: 100
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
    if (!student) return null;
    const ids = student.advisorIds || (student.advisorId ? [student.advisorId] : []);
    if (ids.length === 0) return null;
    const advNames = this.users
      .filter(u => ids.includes(u.id) && u.role === 'advisor')
      .map(u => u.name);
    return advNames.length > 0 ? advNames.join(', ') : 'มีอาจารย์ดูแลแล้ว';
  }

  protected isSameSchool(s1?: string, s2?: string): boolean {
    return (s1 || '').trim().toLowerCase() === (s2 || '').trim().toLowerCase();
  }

  protected isMyStudent(studentId: number): boolean {
    const student = this.users.find(u => u.id === studentId);
    if (!student || !this.currentUser) return false;
    return student.advisorIds 
      ? student.advisorIds.includes(this.currentUser.id) 
      : student.advisorId === this.currentUser.id;
  }

  protected assignStudentToAdvisor(studentId: number): void {
    if (!this.currentUser) return;
    const advisorId = this.currentUser.id;
    const student = this.users.find(u => u.id === studentId);
    if (!student) return;
    
    const hasOtherAdvisor = student.advisorIds ? student.advisorIds.length > 0 : !!student.advisorId;
    const msg = hasOtherAdvisor 
      ? `คุณต้องการเข้าร่วมเป็นอาจารย์ที่ปรึกษาของนักศึกษา "${student.name}" ร่วมกับอาจารย์ท่านอื่นหรือไม่?`
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
        if (!student.advisorIds) {
          student.advisorIds = student.advisorId ? [student.advisorId] : [];
        }
        if (!student.advisorIds.includes(advisorId)) {
          student.advisorIds.push(advisorId);
        }
        student.advisorId = student.advisorIds[0];
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
        if (student.advisorIds) {
          student.advisorIds = student.advisorIds.filter(id => id !== this.currentUser?.id);
        } else if (student.advisorId === this.currentUser?.id) {
          delete student.advisorId;
        }
        student.advisorId = student.advisorIds && student.advisorIds.length > 0 ? student.advisorIds[0] : undefined;
        this.data.persist();
        this.notifications.success(`นำนักศึกษา ${student.name} ออกจากกลุ่มแล้ว`, "สำเร็จ");
      }
    }
  }

  // Class / Group Filtering and Selection
  protected toggleClassGroupsMenu(): void {
    this.showClassGroupsMenu = !this.showClassGroupsMenu;
  }
  
  protected selectClassGroupFilter(filter: string): void {
    this.selectedClassGroupFilter = filter;
    this.advisorStudentSearch = ''; // clear search when switching groups
  }
  
  protected loadCustomClassGroups(): void {
    if (!this.currentUserId) return;
    const saved = localStorage.getItem(`advisor_custom_groups_${this.currentUserId}`);
    if (saved) {
      try {
        this.advisorCustomClassGroups = JSON.parse(saved);
      } catch {
        this.advisorCustomClassGroups = [];
      }
    } else {
      this.advisorCustomClassGroups = [];
    }
  }
  
  protected saveCustomClassGroups(): void {
    if (!this.currentUserId) return;
    localStorage.setItem(`advisor_custom_groups_${this.currentUserId}`, JSON.stringify(this.advisorCustomClassGroups));
  }
  
  protected addCustomClassGroup(): void {
    const yl = this.newGroupYearLevel.trim();
    const cg = this.newGroupClassGroup.trim();
    if (!yl || !cg) {
      this.notifications.warning('กรุณากรอกชั้นปีและกลุ่ม/ห้องเรียน', 'เพิ่มกลุ่ม');
      return;
    }
    
    const exists = this.advisorCustomClassGroups.some(g => g.yearLevel === yl && g.classGroup === cg);
    if (exists) {
      this.notifications.warning('มีกลุ่ม/ห้องเรียนนี้อยู่แล้ว', 'เพิ่มกลุ่ม');
      return;
    }
    
    this.advisorCustomClassGroups.push({ yearLevel: yl, classGroup: cg });
    this.saveCustomClassGroups();
    this.newGroupYearLevel = '';
    this.newGroupClassGroup = '';
    this.notifications.success(`เพิ่มกลุ่ม/ห้องเรียน ${yl}${cg} สำเร็จ`, 'เพิ่มกลุ่ม');
  }
  
  protected removeCustomClassGroup(g: { yearLevel: string, classGroup: string }): void {
    this.advisorCustomClassGroups = this.advisorCustomClassGroups.filter(item => !(item.yearLevel === g.yearLevel && item.classGroup === g.classGroup));
    this.saveCustomClassGroups();
    if (this.selectedClassGroupFilter === `custom:${g.yearLevel}|${g.classGroup}`) {
      this.selectedClassGroupFilter = 'my_students';
    }
    this.notifications.success('ลบกลุ่ม/ห้องเรียนสำเร็จ', 'ลบกลุ่ม');
  }

  protected get autoClassGroups(): { label: string, yearLevel: string, classGroup: string, students: User[] }[] {
    const user = this.currentUser;
    if (!user || user.role !== 'advisor') return [];
    
    const sameSchoolStudents = this.users.filter(u => u.role === 'student' && this.isSameSchool(u.school, user.school));
    const groupsMap = new Map<string, User[]>();
    for (const student of sameSchoolStudents) {
      const year = student.yearLevel || '';
      const grp = student.classGroup || '';
      if (!year && !grp) continue;
      
      const key = `${year}${grp}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(student);
    }
    
    const result: { label: string, yearLevel: string, classGroup: string, students: User[] }[] = [];
    groupsMap.forEach((students, key) => {
      const firstStu = students[0];
      result.push({
        label: key,
        yearLevel: firstStu.yearLevel || '',
        classGroup: firstStu.classGroup || '',
        students
      });
    });
    
    return result.sort((a, b) => a.label.localeCompare(b.label));
  }
  
  protected get schoolStudentsCount(): number {
    const user = this.currentUser;
    if (!user) return 0;
    return this.users.filter(u => u.role === 'student' && this.isSameSchool(u.school, user.school)).length;
  }

  protected get onlineStudentsCount(): number {
    const user = this.currentUser;
    if (!user) return 0;
    return this.users.filter(u => u.role === 'student' && this.isSameSchool(u.school, user.school) && u.onlineStatus === 'online').length;
  }
  
  protected get displayedAdvisorStudents(): User[] {
    const user = this.currentUser;
    if (!user) return [];
    
    const sameSchoolStudents = this.users.filter(u => u.role === 'student' && this.isSameSchool(u.school, user.school));
    const myStudents = this.users.filter(u => u.role === 'student' && (u.advisorIds ? u.advisorIds.includes(user.id) : u.advisorId === user.id));
    
    let base: User[];
    if (this.selectedClassGroupFilter === 'my_students') {
      base = myStudents;
    } else if (this.selectedClassGroupFilter === 'all_students') {
      base = sameSchoolStudents;
    } else if (this.selectedClassGroupFilter.startsWith('custom:')) {
      const parts = this.selectedClassGroupFilter.substring(7).split('|');
      const yl = parts[0];
      const cg = parts[1];
      base = sameSchoolStudents.filter(s => (s.yearLevel || '') === yl && (s.classGroup || '') === cg);
    } else {
      base = sameSchoolStudents.filter(s => `${s.yearLevel || ''}${s.classGroup || ''}` === this.selectedClassGroupFilter);
    }

    const q = this.advisorStudentSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.number && String(s.number).includes(q)) ||
      (s.yearLevel && s.yearLevel.toLowerCase().includes(q)) ||
      (s.classGroup && s.classGroup.toLowerCase().includes(q))
    );
  }
  
  // Student online status helpers and actions
  protected userOnlineStatus(userId: number): string | undefined {
    const user = this.users.find((u) => u.id === userId);
    if (!user || user.role !== 'student') {
      return undefined;
    }
    return user.onlineStatus || 'offline';
  }
  
  protected async setOnlineStatus(status: string): Promise<void> {
    if (!this.currentUserId) return;
    try {
      await this.data.updateUser(this.currentUserId, { onlineStatus: status } as any);
      this.notifications.success(`เปลี่ยนสถานะเป็น ${status === 'online' ? 'Online' : status === 'AFK' ? 'AFK' : 'Offline'} สำเร็จ`, 'สถานะออนไลน์');
    } catch (err: any) {
      console.error('[App] Error setting online status:', err);
      this.notifications.error('ไม่สามารถเปลี่ยนสถานะได้', 'สถานะออนไลน์');
    }
  }
  
  // Student detail modal helpers
  protected showStudentDetail(student: User): void {
    this.selectedStudentForDetail = student;
    this.studentDetailInternship = this.internships.find(i => i.studentId === student.id && i.status === 'active') || null;
    this.studentDetailAttendances = this.attendances.filter(a => a.studentId === student.id);
    const studentInternshipIds = this.internships.filter(i => i.studentId === student.id).map(i => i.id);
    this.studentDetailLogbooks = this.data.logbooks.filter(l => studentInternshipIds.includes(l.internshipId));
    this.studentDetailLeaves = this.data.leaves.filter((lr: LeaveRequest) => studentInternshipIds.includes(lr.internshipId));
  }
  
  protected closeStudentDetail(): void {
    this.selectedStudentForDetail = null;
    this.studentDetailInternship = null;
    this.studentDetailAttendances = [];
    this.studentDetailLogbooks = [];
    this.studentDetailLeaves = [];
  }
  
  protected getStudentPresentDaysCount(studentId: number): number {
    return this.attendances.filter(a => a.studentId === studentId && (a.status === 'present' || a.status === 'late' || a.status === 'early_leave')).length;
  }

  protected getStudentLateDaysCount(studentId: number): number {
    return this.attendances.filter(a => a.studentId === studentId && a.status === 'late').length;
  }

  protected getStudentAbsentDaysCount(studentId: number): number {
    return this.attendances.filter(a => a.studentId === studentId && a.status === 'absent').length;
  }

  protected getStudentTotalHours(studentId: number): number {
    return this.getStudentPresentDaysCount(studentId) * 8;
  }
  
  protected getCompanyName(companyId?: number): string {
    if (!companyId) return '—';
    return this.companies.find(c => c.id === companyId)?.companyName ?? '—';
  }

  protected getStudentAdvisors(advisorIds: number[] | undefined, fallbackAdvisorId: number | undefined): User[] {
    const ids = advisorIds || (fallbackAdvisorId ? [fallbackAdvisorId] : []);
    if (ids.length === 0) return [];
    return this.users.filter(u => ids.includes(u.id) && u.role === 'advisor');
  }

  protected getAllPickableStudents(): User[] {
    const user = this.currentUser;
    if (user?.role !== 'advisor') return [];
    return this.users.filter(u =>
      u.role === 'student' &&
      this.isSameSchool(u.school, user.school) &&
      !(u.advisorIds ? u.advisorIds.includes(user.id) : u.advisorId === user.id)
    );
  }

  protected getSelectedStudentInfo(): User | undefined {
    if (!this.selectedStudentToAssignId) return undefined;
    return this.users.find(u => u.id === Number(this.selectedStudentToAssignId));
  }

  protected assignSelectedStudent(): void {
    if (!this.selectedStudentToAssignId) return;
    this.assignStudentToAdvisor(Number(this.selectedStudentToAssignId));
    this.selectedStudentToAssignId = 0;
  }

  protected hasAdvisor(student: User | undefined): boolean {
    if (!student) return false;
    return !!(student.advisorId || (student.advisorIds && student.advisorIds.length > 0));
  }

  protected async completeInternship(internshipId: number): Promise<void> {
    const result = await Swal.fire({
      title: 'ยืนยันการเสร็จสิ้นการฝึกงาน?',
      text: 'คุณต้องการเปลี่ยนสถานะการฝึกงานของนักศึกษาคนนี้เป็น "เสร็จสิ้นการฝึกงาน" หรือไม่?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#10B981',
      cancelButtonColor: '#6B7280'
    });

    if (result.isConfirmed) {
      try {
        await this.data.updateInternshipStatus(internshipId, 'completed');
        this.notifications.success('บันทึกการเสร็จสิ้นการฝึกงานสำเร็จ', 'สำเร็จ');
        this.closeInternshipDetail();
      } catch (err: any) {
        this.notifications.error(this.extractErrorMessage(err) || 'ไม่สามารถบันทึกข้อมูลได้', 'ล้มเหลว');
      }
    }
  }

  protected async terminateInternship(internshipId: number): Promise<void> {
    const result = await Swal.fire({
      title: 'ยืนยันการนำนักศึกษาออกจากบริษัท?',
      text: 'คุณต้องการสิ้นสุดการฝึกงานของนักศึกษาคนนี้และนำออกจากบริษัทหรือไม่? เมื่อทำแล้วไม่สามารถย้อนกลับได้',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันนำออก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280'
    });

    if (result.isConfirmed) {
      try {
        await this.data.updateInternshipStatus(internshipId, 'terminated');
        this.notifications.success('นำนักศึกษาออกจากบริษัทสำเร็จ', 'สำเร็จ');
        this.closeInternshipDetail();
      } catch (err: any) {
        this.notifications.error(this.extractErrorMessage(err) || 'ไม่สามารถนำนักศึกษาออกจากบริษัทได้', 'ล้มเหลว');
      }
    }
  }

  protected clearApplication(appId: number): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const stored = window.localStorage.getItem('dismissed_application_ids');
      let ids: number[] = stored ? JSON.parse(stored) : [];
      if (!ids.includes(appId)) {
        ids.push(appId);
        window.localStorage.setItem('dismissed_application_ids', JSON.stringify(ids));
        this.notifications.success('ซ่อนใบสมัครออกจากรายการแล้ว', 'สำเร็จ');
        this.cdr.markForCheck();
      }
    } catch (e) {
      console.error(e);
    }
  }

  protected clearAllProcessedApplications(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const processedVisible = this.visibleApplications.filter(
        (app) => app.status === 'approved' || app.status === 'rejected'
      );
      if (processedVisible.length === 0) {
        this.notifications.info('ไม่มีใบสมัครที่ดำเนินการแล้วให้ล้าง', 'แจ้งเตือน');
        return;
      }

      const stored = window.localStorage.getItem('dismissed_application_ids');
      let ids: number[] = stored ? JSON.parse(stored) : [];
      
      processedVisible.forEach((app) => {
        if (!ids.includes(app.id)) {
          ids.push(app.id);
        }
      });

      window.localStorage.setItem('dismissed_application_ids', JSON.stringify(ids));
      this.notifications.success('ล้างรายการใบสมัครที่ดำเนินการแล้วทั้งหมดสำเร็จ', 'สำเร็จ');
      this.cdr.markForCheck();
    } catch (e) {
      console.error(e);
    }
  }

  protected dismissInternship(internshipId: number): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const stored = window.localStorage.getItem('dismissed_internship_ids');
      let ids: number[] = stored ? JSON.parse(stored) : [];
      if (!ids.includes(internshipId)) {
        ids.push(internshipId);
        window.localStorage.setItem('dismissed_internship_ids', JSON.stringify(ids));
        this.notifications.success('ซ่อนประวัติการฝึกงานออกจากรายการแล้ว', 'สำเร็จ');
        this.cdr.markForCheck();
      }
    } catch (e) {
      console.error(e);
    }
  }

  protected getStudentAdvisor(advisorId: number | undefined): User | undefined {
    if (!advisorId) return undefined;
    return this.users.find(u => u.id === advisorId && u.role === 'advisor');
  }

  private extractErrorMessage(err: any): string {
    if (err && err.error) {
      if (typeof err.error === 'string') {
        try {
          const parsed = JSON.parse(err.error);
          return parsed.error || parsed.message || err.message || String(err);
        } catch {
          return err.error;
        }
      }
      return err.error.error || err.error.message || err.message || String(err);
    }
    return err.message || String(err);
  }

  protected getFileNameFromUrl(url: string, defaultName = 'document.pdf'): string {
    if (!url) return defaultName;
    try {
      if (url.startsWith('/api/uploads/')) {
        const basename = url.replace('/api/uploads/', '');
        const underscoreIndex = basename.indexOf('_');
        if (underscoreIndex !== -1) {
          return decodeURIComponent(basename.substring(underscoreIndex + 1));
        }
        return decodeURIComponent(basename);
      }
      if (url.includes('mock_work_') || url.includes('mock_')) {
        const parts = url.split('/d/');
        if (parts.length > 1) {
          const id = parts[1].split('/')[0];
          let clean = id.replace(/^mock_work_/, '').replace(/^mock_/, '');
          clean = clean.replace(/_/g, ' ');
          if (clean) return clean;
        }
      }
    } catch (e) {}
    return defaultName;
  }

  protected getClickableFilePath(filePath: string | undefined): string {
    if (!filePath) return 'javascript:void(0)';
    
    const isMock = filePath.includes('drive.google.com/file/d/mock_') || filePath.startsWith('mock_');
    if (isMock) {
      const filename = this.getFileNameFromUrl(filePath);
      return `/api/uploads/${filename}`;
    }
    return filePath;
  }

  // Company & School management methods
  protected async addSchoolFromView(): Promise<void> {
    if (!this.newSchoolName.trim()) {
      this.notifications.warning('กรุณาระบุชื่อสถานศึกษา', 'ข้อมูลไม่ครบถ้วน');
      return;
    }
    const res = await this.data.addAdminSchool(this.newSchoolName);
    if (res && res.error) {
      this.notifications.error(res.error, 'เพิ่มสถานศึกษาล้มเหลว');
    } else {
      this.notifications.success('เพิ่มสถานศึกษาเรียบร้อยแล้ว', 'สำเร็จ');
      this.newSchoolName = '';
    }
  }

  protected async addCompanyFromView(): Promise<void> {
    if (!this.newCompanyName.trim()) {
      this.notifications.warning('กรุณาระบุชื่อสถานประกอบการ', 'ข้อมูลไม่ครบถ้วน');
      return;
    }
    const res = await this.data.addCompany(this.newCompanyName, this.newCompanyDesc, this.newCompanyAddr);
    if (res && res.error) {
      this.notifications.error(res.error, 'เพิ่มบริษัทล้มเหลว');
    } else {
      this.notifications.success('เพิ่มบริษัทเรียบร้อยแล้ว', 'สำเร็จ');
      this.newCompanyName = '';
      this.newCompanyDesc = '';
      this.newCompanyAddr = '';
    }
  }

  protected getFilteredSchools(): any[] {
    const q = this.compSchoolSearch.toLowerCase().trim();
    if (!q) return this.data.schools;
    return this.data.schools.filter(s => s.name.toLowerCase().includes(q));
  }

  protected getFilteredCompanies(): any[] {
    const q = this.compSchoolSearch.toLowerCase().trim();
    if (!q) return this.data.companies;
    return this.data.companies.filter(c => c.companyName.toLowerCase().includes(q));
  }

  // Ticket system methods
  protected getFilteredTickets(): any[] {
    const q = this.ticketSearchQuery.toLowerCase().trim();
    const filter = this.ticketStatusFilter;
    
    return this.data.tickets.filter(t => {
      const matchQuery = !q || 
        t.title.toLowerCase().includes(q) || 
        t.description.toLowerCase().includes(q) ||
        (t.user_name && t.user_name.toLowerCase().includes(q));
      
      const matchFilter = filter === 'all' || t.status === filter;
      return matchQuery && matchFilter;
    });
  }

  protected async selectTicket(ticket: any): Promise<void> {
    this.selectedTicket = ticket;
    this.selectedTicketReplies = [];
    this.newReplyMessage = '';
    this.ticketDetailLoading = true;
    
    if (this.data.api.apiEnabled()) {
      try {
        const res = await firstValueFrom(this.data.api.getTicketById(ticket.id));
        if (res) {
          this.selectedTicket = res.ticket;
          this.selectedTicketReplies = res.replies || [];
        }
      } catch (err) {
        this.notifications.error('ดึงข้อมูลคำตอบของคำร้องช่วยเหลือล้มเหลว', 'เกิดข้อผิดพลาด');
      } finally {
        this.ticketDetailLoading = false;
      }
    } else {
      // Mock replies
      this.selectedTicketReplies = [
        {
          id: 1,
          ticket_id: ticket.id,
          user_id: 9999,
          user_name: 'ฝ่ายดูแลระบบ (Support)',
          user_role: 'admin',
          message: 'สวัสดีค่ะ ได้รับเรื่องแล้วนะคะ ทางทีมงานกำลังเร่งตรวจสอบให้ค่ะ',
          created_at: new Date(new Date(ticket.created_at).getTime() + 30 * 60 * 1000).toISOString()
        }
      ];
      this.ticketDetailLoading = false;
    }
  }

  protected async createSupportTicket(): Promise<void> {
    if (!this.newTicketTitle.trim() || !this.newTicketDesc.trim()) {
      this.notifications.warning('กรุณาระบุหัวข้อและรายละเอียดปัญหา', 'ข้อมูลไม่ครบถ้วน');
      return;
    }
    
    this.isSubmittingTicket = true;
    const res = await this.data.addTicket(this.newTicketTitle, this.newTicketDesc, this.currentUser);
    this.isSubmittingTicket = false;
    
    if (res && res.error) {
      this.notifications.error(res.error, 'สร้างคำร้องช่วยเหลือล้มเหลว');
    } else {
      this.notifications.success('ส่งเรื่องแจ้งปัญหาเรียบร้อยแล้ว', 'ส่งสำเร็จ');
      this.newTicketTitle = '';
      this.newTicketDesc = '';
    }
  }

  protected async sendTicketReply(): Promise<void> {
    if (!this.newReplyMessage.trim() || !this.selectedTicket) {
      return;
    }
    
    this.isSubmittingReply = true;
    const res = await this.data.replyToTicket(this.selectedTicket.id, this.newReplyMessage, this.currentUser);
    this.isSubmittingReply = false;
    
    if (res && res.error) {
      this.notifications.error(res.error, 'ส่งคำตอบล้มเหลว');
    } else {
      // Add local mock reply for instant feedback
      const newReply = {
        id: Date.now(),
        ticket_id: this.selectedTicket.id,
        user_id: this.currentUser?.id || 1001,
        user_name: this.currentUser?.name || 'User',
        user_role: this.currentUser?.role || 'student',
        message: this.newReplyMessage.trim(),
        created_at: new Date().toISOString()
      };
      this.selectedTicketReplies = [...this.selectedTicketReplies, newReply];
      
      // Update local ticket status in mock mode if user is not admin and ticket was resolved
      if (this.currentUser?.role !== 'admin' && this.selectedTicket.status === 'resolved') {
        this.selectedTicket.status = 'open';
      }
      
      this.newReplyMessage = '';
      this.notifications.success('ส่งคำตอบเรียบร้อย', 'สำเร็จ');
      
      // Reload from api
      if (this.data.api.apiEnabled()) {
        void this.selectTicket(this.selectedTicket);
      }
    }
  }

  protected async changeTicketStatus(status: 'open' | 'resolved' | 'closed'): Promise<void> {
    if (!this.selectedTicket) return;
    
    const res = await this.data.updateTicketStatus(this.selectedTicket.id, status);
    if (res && res.error) {
      this.notifications.error(res.error, 'ปรับปรุงสถานะคำร้องช่วยเหลือล้มเหลว');
    } else {
      this.selectedTicket.status = status;
      this.notifications.success(`อัปเดตสถานะเป็น: ${status === 'resolved' ? 'แก้ไขแล้ว' : status === 'closed' ? 'ปิดแล้ว' : 'เปิดใหม่'} เรียบร้อยแล้ว`, 'ปรับปรุงสำเร็จ');
    }
  }

  // --- Feature 4: Map Picker & Radius Circle ---
  protected initCompanyMap(): void {
    if (typeof window === 'undefined' || !(window as any).L) return;
    this.destroyCompanyMap();

    setTimeout(() => {
      const mapContainer = document.getElementById('company-location-map');
      if (!mapContainer) return;

      const L = (window as any).L;
      let lat = parseFloat(String(this.profileDraft.latitude));
      let lng = parseFloat(String(this.profileDraft.longitude));
      const hasCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

      if (!hasCoords) {
        lat = 13.7563;
        lng = 100.5018;
      }

      this.leafletMap = L.map('company-location-map').setView([lat, lng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.leafletMap);

      this.leafletMarker = L.marker([lat, lng], { draggable: true }).addTo(this.leafletMap);

      const radius = Number(this.profileDraft.checkRadius) || 200;
      this.leafletCircle = L.circle([lat, lng], {
        color: '#6366f1',
        fillColor: '#6366f1',
        fillOpacity: 0.15,
        radius: radius
      }).addTo(this.leafletMap);

      this.leafletMarker.on('dragend', () => {
        const position = this.leafletMarker.getLatLng();
        this.profileDraft.latitude = position.lat.toFixed(6);
        this.profileDraft.longitude = position.lng.toFixed(6);
        this.leafletCircle.setLatLng(position);
        this.cdr.markForCheck();
      });

      this.leafletMap.on('click', (e: any) => {
        const position = e.latlng;
        this.leafletMarker.setLatLng(position);
        this.profileDraft.latitude = position.lat.toFixed(6);
        this.profileDraft.longitude = position.lng.toFixed(6);
        this.leafletCircle.setLatLng(position);
        this.cdr.markForCheck();
      });

      setTimeout(() => {
        if (this.leafletMap) this.leafletMap.invalidateSize();
      }, 200);

    }, 150);
  }

  protected updateMapRadius(radius: number): void {
    this.profileDraft.checkRadius = radius;
    if (this.leafletCircle) {
      this.leafletCircle.setRadius(radius);
    }
  }

  protected destroyCompanyMap(): void {
    if (this.leafletMap) {
      try {
        this.leafletMap.remove();
      } catch (e) {}
      this.leafletMap = null;
      this.leafletMarker = null;
      this.leafletCircle = null;
    }
  }

  // --- Feature 6: Custom Evaluation Rubrics ---
  protected async loadEvaluationTemplates(): Promise<void> {
    try {
      this.evaluationTemplates = await this.data.getEvaluationTemplates();
    } catch (e) {
      console.error('Failed to load evaluation templates:', e);
    }
  }

  protected async saveTemplate(): Promise<void> {
    if (!this.editingTemplate.name.trim()) {
      this.notifications.warning('กรุณากรอกชื่อแบบประเมิน', 'แบบประเมิน');
      return;
    }
    if (this.editingTemplate.criteria.length === 0) {
      this.notifications.warning('กรุณาเพิ่มหัวข้อประเมินอย่างน้อย 1 รายการ', 'แบบประเมิน');
      return;
    }

    const totalMax = this.getEditingTemplateTotalMaxScore();
    if (totalMax <= 0) {
      this.notifications.warning('คะแนนเต็มรวมต้องมากกว่า 0 คะแนน กรุณากำหนดคะแนนเต็มให้กับแต่ละหัวข้อ', 'แบบประเมิน');
      return;
    }
    if (totalMax > 100) {
      this.notifications.warning(`คะแนนเต็มรวมทั้งหมดของเกณฑ์ (${totalMax} คะแนน) จะต้องไม่เกิน 100 คะแนน`, 'แบบประเมิน');
      return;
    }

    try {
      if (this.editingTemplate.id) {
        await this.data.updateEvaluationTemplate(this.editingTemplate.id, this.editingTemplate.name, this.editingTemplate.criteria);
        this.notifications.success('อัปเดตแบบประเมินเรียบร้อย', 'แบบประเมิน');
      } else {
        await this.data.createEvaluationTemplate({
          name: this.editingTemplate.name,
          criteria: this.editingTemplate.criteria
        });
        this.notifications.success('สร้างแบบประเมินเรียบร้อย', 'แบบประเมิน');
      }
      this.showTemplateBuilder = false;
      this.editingTemplate = { name: '', criteria: [] };
      await this.loadEvaluationTemplates();
    } catch (e: any) {
      this.notifications.error(`บันทึกแบบประเมินล้มเหลว: ${e.message || e}`, 'แบบประเมิน');
    }
  }

  protected editTemplate(tmpl: EvaluationTemplate): void {
    this.editingTemplate = {
      id: tmpl.id,
      name: tmpl.name,
      criteria: tmpl.criteria ? tmpl.criteria.map((c: any) => ({ ...c })) : []
    };
    this.showTemplateBuilder = true;
  }

  protected resetTemplateEditor(): void {
    this.editingTemplate = { name: '', criteria: [] };
  }

  protected async deleteTemplate(id: number): Promise<void> {
    const confirm = await Swal.fire({
      title: 'ยืนยันการลบ?',
      text: 'คุณแน่ใจว่าต้องการลบแบบประเมินนี้?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก'
    });
    if (!confirm.isConfirmed) return;

    try {
      await this.data.deleteEvaluationTemplate(id);
      this.notifications.success('ลบแบบประเมินเรียบร้อย', 'แบบประเมิน');
      await this.loadEvaluationTemplates();
      if (this.selectedTemplateId === id) {
        this.selectedTemplateId = null;
        this.rubricScores = {};
      }
    } catch (e: any) {
      this.notifications.error(`ลบแบบประเมินล้มเหลว: ${e.message || e}`, 'แบบประเมิน');
    }
  }

  protected addCriterionRow(): void {
    if (!this.newCriterionLabel.trim()) return;
    if (!this.editingTemplate.criteria) {
      this.editingTemplate.criteria = [];
    }
    this.editingTemplate.criteria.push({
      label: this.newCriterionLabel.trim(),
      maxScore: Number(this.newCriterionMax) || 10
    });
    this.newCriterionLabel = '';
    this.newCriterionMax = 10;
  }

  protected removeCriterionRow(index: number): void {
    this.editingTemplate.criteria.splice(index, 1);
  }

  protected selectTemplateForEvaluation(templateId: number | null): void {
    this.selectedTemplateId = templateId;
    this.rubricScores = {};
    if (templateId) {
      const t = this.evaluationTemplates.find(tmpl => tmpl.id === Number(templateId));
      if (t) {
        t.criteria.forEach((c: any) => {
          this.rubricScores[c.id] = 0; // default to 0, not maxScore
        });
      }
    }
  }

  protected getTotalScore(): number {
    let sum = 0;
    if (this.selectedTemplateId) {
      const t = this.evaluationTemplates.find(tmpl => tmpl.id === Number(this.selectedTemplateId));
      if (t) {
        t.criteria.forEach((c: any) => {
          sum += Number(this.rubricScores[c.id]) || 0;
        });
      }
    } else {
      sum = Number(this.evaluationScore) || 0;
    }
    return sum;
  }

  protected getMaxTotalScore(): number {
    let sum = 0;
    if (this.selectedTemplateId) {
      const t = this.evaluationTemplates.find(tmpl => tmpl.id === Number(this.selectedTemplateId));
      if (t) {
        t.criteria.forEach((c: any) => {
          sum += c.maxScore;
        });
      }
    } else {
      sum = 100;
    }
    return sum;
  }

  protected async submitRubricEvaluation(): Promise<void> {
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
    
    let totalScore = 0;
    let scoresList: any[] = [];
    if (this.selectedTemplateId) {
      const t = this.evaluationTemplates.find(tmpl => tmpl.id === Number(this.selectedTemplateId));
      if (!t) {
        this.notifications.warning('ไม่พบแบบประเมินที่เลือก กรุณาเลือกใหม่อีกครั้ง', 'ประเมินผล');
        return;
      }
      for (const c of t.criteria) {
        const val = Number(this.rubricScores[c.id]) || 0;
        if (val > c.maxScore) {
          this.notifications.warning(`คะแนนในหัวข้อ "${c.label}" (${val}) ต้องไม่เกินคะแนนเต็ม (${c.maxScore})`, 'ประเมินผล');
          return;
        }
        if (val < 0) {
          this.notifications.warning(`คะแนนในหัวข้อ "${c.label}" ต้องไม่น้อยกว่า 0`, 'ประเมินผล');
          return;
        }
        totalScore += val;
        scoresList.push({
          criterionId: c.id,
          score: val,
          maxScore: c.maxScore  // carry maxScore so getEvaluationMaxScore() works
        });
      }
    } else {
      totalScore = Number(this.evaluationScore) || 0;
      if (totalScore > 100) {
        this.notifications.warning('คะแนนรวมดิบต้องไม่เกิน 100 คะแนน', 'ประเมินผล');
        return;
      }
      if (totalScore < 0) {
        this.notifications.warning('คะแนนรวมดิบต้องไม่น้อยกว่า 0 คะแนน', 'ประเมินผล');
        return;
      }
    }

    try {
      const res = await this.data.addEvaluation({
        internshipId: this.selectedEvaluationInternship.id,
        evaluatorId: user.id,
        score: totalScore,
        feedback: this.evaluationFeedback.trim(),
        evaluationType: this.evaluationType
      });

      const evalId = res?.id;
      if (evalId && this.selectedTemplateId && scoresList.length > 0) {
        await this.data.saveEvaluationScores(evalId, scoresList);
      }

      this.evaluationFeedback = '';
      this.evaluationScore = 85;
      this.selectedTemplateId = null;
      this.rubricScores = {};
      this.notifications.success(`บันทึกการประเมิน ${student} คะแนน ${totalScore}`, 'ประเมินผล');
      window.location.reload();
    } catch (err: any) {
      this.notifications.error(`เกิดข้อผิดพลาด: ${err.message || err}`, 'ประเมินผล');
    }
  }

  protected getTemplateCriteria(templateId: any): any[] {
    if (!templateId) return [];
    const t = this.evaluationTemplates.find(tmpl => tmpl.id === Number(templateId));
    return t ? t.criteria : [];
  }

  protected getEvaluationMaxScore(evaluation: Evaluation): number {
    if (evaluation.scores && evaluation.scores.length > 0) {
      return evaluation.scores.reduce((sum: number, s: any) => sum + (s.maxScore || 0), 0);
    }
    return 100;
  }

  protected getEditingTemplateTotalMaxScore(): number {
    if (!this.editingTemplate.criteria) return 0;
    return this.editingTemplate.criteria.reduce((sum: number, c: any) => sum + (Number(c.maxScore) || 0), 0);
  }

  protected toggleEvaluationDetails(id: number): void {
    this.expandedEvaluationId = this.expandedEvaluationId === id ? null : id;
  }
}
