import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiApplication,
  ApiAttendance,
  ApiCompany,
  ApiEvaluation,
  ApiInternship,
  ApiJobPosting,
  ApiLogbook,
  ApiUser,
  ApiLeaveRequest,
  ApiAssignment,
  ApiSubmission,
  mapApplication,
  mapAttendance,
  mapCompany,
  mapEvaluation,
  mapInternship,
  mapJobPosting,
  mapLogbook,
  mapUser,
  mapLeaveRequest,
  mapAssignment,
  mapSubmission,
  toApiApplication,
  toApiInternship,
  toApiAssignment,
  toApiSubmission
} from './api.mapper';
import {
  Application,
  ApplicationStatus,
  Attendance,
  AttendanceStatus,
  Company,
  Evaluation,
  Internship,
  JobPosting,
  Logbook,
  User,
  LeaveRequest,
  School,
  EnrollmentCode,
  Assignment,
  Submission
} from '../internship.models';

export type InternshipDbSnapshot = {
  users: User[];
  companies: Company[];
  jobPostings: JobPosting[];
  applications: Application[];
  internships: Internship[];
  attendances: Attendance[];
  logbooks: Logbook[];
  evaluations: Evaluation[];
  leaves: LeaveRequest[];
  assignments: Assignment[];
  submissions: Submission[];
};

type LoginResponse = {
  status: number;
  message: string;
  data: ApiUser & {
    token: string;
  };
};

/**
 * REST client aligned with `internship_db` tables.
 */
@Injectable({ providedIn: 'root' })
export class InternshipApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl.replace(/\/$/, '');
  private readonly tokenKey = 'intern-manager-api-token-v1';

  apiEnabled(): boolean {
    return !environment.useMockData;
  }

  loadAll(): Observable<InternshipDbSnapshot | null> {
    if (!this.apiEnabled()) {
      return of(null);
    }

    return forkJoin({
      users: this.getList<ApiUser, User>('users', mapUser),
      companies: this.getList<ApiCompany, Company>('companies', mapCompany),
      jobPostings: this.getList<ApiJobPosting, JobPosting>('jobs', mapJobPosting),
      applications: this.getList<ApiApplication, Application>('applications', mapApplication),
      internships: this.getList<ApiInternship, Internship>('internships', mapInternship),
      attendances: this.getList<ApiAttendance, Attendance>('attendance', mapAttendance),
      logbooks: this.getList<ApiLogbook, Logbook>('logbooks', mapLogbook),
      evaluations: this.getList<ApiEvaluation, Evaluation>('evaluations', mapEvaluation),
      leaves: this.getList<ApiLeaveRequest, LeaveRequest>('leaves', mapLeaveRequest),
      assignments: this.getList<ApiAssignment, Assignment>('assignments', mapAssignment),
      submissions: this.getList<ApiSubmission, Submission>('submissions', mapSubmission)
    }).pipe(
      catchError((err) => {
        console.error('[InternshipApi] Failed to load data', err);
        return of(null);
      })
    );
  }

  login(email: string, password: string): Observable<User> {
    if (!this.apiEnabled()) {
      throw new Error('API is disabled');
    }

    return this.http
      .post<LoginResponse>(`${this.base}/auth/login`, { email, password })
      .pipe(
        map((res) => {
          const data = res?.data;
          if (data && data.token) {
            this.setToken(data.token);
          }
          if (!data) {
            throw new Error('ข้อมูลผู้ใช้งานไม่ถูกต้อง');
          }
          return mapUser(data);
        })
      );
  }

  register(body: {
    name: string;
    email: string;
    password: string;
    code: string;
    role?: 'student' | 'company' | 'advisor';
    phone?: string;
    school?: string;
    company_name?: string;
    description?: string;
    address?: string;
    contact_email?: string;
  }): Observable<User> {
    if (!this.apiEnabled()) {
      throw new Error('API is disabled');
    }
    return this.http.post(`${this.base}/auth/register`, body).pipe(
      switchMap(() => this.login(body.email, body.password))
    );
  }

  registerWithoutLogin(body: {
    name: string;
    email: string;
    password: string;
    code: string;
    role?: 'student' | 'company' | 'advisor';
    phone?: string;
    school?: string;
    company_name?: string;
    description?: string;
    address?: string;
    contact_email?: string;
  }): Observable<any> {
    if (!this.apiEnabled()) {
      return of(null);
    }
    return this.http.post(`${this.base}/auth/register`, body).pipe(
      catchError((err) => {
        console.error('[InternshipApi] registerWithoutLogin failed', err);
        return of(null);
      })
    );
  }

  validateCode(code: string): Observable<any> {
    if (!this.apiEnabled()) {
      return of(null);
    }
    return this.http.get<any>(`${this.base}/auth/validate-code`, {
      params: { code }
    });
  }

  updateUser(id: number, body: Partial<User>): Observable<User | null> {
    return this.putOne<ApiUser, User>(`users/${id}`, {
      id: id,
      name: body.name ?? '',
      email: body.email ?? '',
      phone: body.phone ?? null,
      school: body.school ?? null,
      status: body.status,
      resume_url: body.resumeUrl ?? null,
      advisor_id: body.advisorId !== undefined ? body.advisorId : undefined,
      intern_start_date: body.internStartDate !== undefined ? body.internStartDate : undefined,
      intern_end_date: body.internEndDate !== undefined ? body.internEndDate : undefined
    } as any, mapUser);
  }

  createJob(body: Omit<JobPosting, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Observable<JobPosting | null> {
    return this.postOne<ApiJobPosting, JobPosting>('jobs', {
      company_id: body.companyId,
      title: body.title,
      description: body.description ?? '',
      requirements: body.requirements ?? '',
      benefits: body.benefits ?? '',
      checkin_time: body.checkinTime,
      checkout_time: body.checkoutTime,
      lated_time: body.latedTime,
      work_days: body.workDays,
      slots: body.slots ?? 1,
      status: 'open'
    }, mapJobPosting);
  }

  updateJob(id: number, body: Omit<JobPosting, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Observable<JobPosting | null> {
    return this.putOne<ApiJobPosting, JobPosting>(`jobs/${id}`, {
      company_id: body.companyId,
      title: body.title,
      description: body.description ?? '',
      requirements: body.requirements ?? '',
      benefits: body.benefits ?? '',
      checkin_time: body.checkinTime,
      checkout_time: body.checkoutTime,
      lated_time: body.latedTime,
      work_days: body.workDays,
      slots: body.slots ?? 1
    }, mapJobPosting);
  }

  deleteJob(id: number): Observable<any> {
    if (!this.apiEnabled()) {
      return of(null);
    }
    return this.http.delete<any>(`${this.base}/jobs/${id}`, this.authOptions()).pipe(
      catchError((err) => {
        console.error('[InternshipApi] deleteJob failed', err);
        return of(null);
      })
    );
  }

  createApplication(body: Omit<Application, 'id' | 'updatedAt'>): Observable<Application | null> {
    return this.postOne<ApiApplication, Application>('applications', toApiApplication(body), mapApplication);
  }

  patchApplication(id: number, status: ApplicationStatus): Observable<Application | null> {
    return this.putOne<ApiApplication, Application>(`applications/${id}/status`, { status }, mapApplication);
  }

  createInternship(body: Omit<Internship, 'id' | 'createdAt' | 'updatedAt'>): Observable<Internship | null> {
    return this.postOne<ApiInternship, Internship>('internships', toApiInternship(body), mapInternship);
  }
 
  patchInternshipStatus(id: number, status: 'active' | 'completed' | 'terminated'): Observable<Internship | null> {
    return this.putOne<ApiInternship, Internship>(`internships/${id}/status`, { status }, mapInternship);
  }

  createAttendance(body: Omit<Attendance, 'id' | 'createdAt'>): Observable<Attendance | null> {
    return this.postOne<ApiAttendance, Attendance>('attendance/check-in', {
      internship_id: body.internshipId,
      student_id: body.studentId,
      check_in_time: body.checkInTime,
      check_out_time: body.checkOutTime ?? null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      status: body.status
    }, mapAttendance);
  }

  patchAttendance(attendance: Attendance, patch: Partial<Pick<Attendance, 'checkOutTime' | 'status' | 'verificationStatus' | 'checkoutLatitude' | 'checkoutLongitude'>>): Observable<Attendance | null> {
    return this.putOne<ApiAttendance, Attendance>('attendance/check-out', {
      id: attendance.id,
      internship_id: attendance.internshipId,
      student_id: attendance.studentId,
      status: patch.status,
      verification_status: patch.verificationStatus,
      latitude: patch.checkoutLatitude ?? null,
      longitude: patch.checkoutLongitude ?? null
    }, mapAttendance);
  }

  createLogbook(body: Omit<Logbook, 'id' | 'createdAt' | 'updatedAt' | 'mentorComment' | 'status'> & { status?: Logbook['status'] }): Observable<Logbook | null> {
    return this.postOneRequired<ApiLogbook, Logbook>('logbooks', {
      internship_id: body.internshipId,
      title: body.title,
      content: body.content,
      attachment_url: body.attachmentUrl ?? null,
      status: body.status ?? 'pending'
    }, mapLogbook);
  }

  patchLogbook(id: number, patch: Partial<Pick<Logbook, 'status' | 'mentorComment'>>): Observable<Logbook | null> {
    return this.putOneRequired<ApiLogbook, Logbook>(`logbooks/${id}/approve`, {
      status: patch.status,
      comment: patch.mentorComment ?? null,
      mentor_comment: patch.mentorComment ?? null
    }, mapLogbook);
  }

  updateLogbook(id: number, body: { title: string; content: string }): Observable<Logbook | null> {
    return this.putOneRequired<ApiLogbook, Logbook>(`logbooks/${id}`, {
      title: body.title,
      content: body.content
    }, mapLogbook);
  }

  deleteLogbook(id: number): Observable<any> {
    return this.http.delete<any>(`${this.base}/logbooks/${id}`, this.authOptions());
  }

  createEvaluation(body: Omit<Evaluation, 'id' | 'createdAt' | 'updatedAt'>): Observable<Evaluation | null> {
    return this.postOne<ApiEvaluation, Evaluation>('evaluations', {
      internship_id: body.internshipId,
      evaluator_id: body.evaluatorId,
      score: body.score,
      feedback: body.feedback,
      evaluation_type: body.evaluationType
    }, mapEvaluation);
  }

  createLeave(body: Omit<LeaveRequest, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'approvedAt'>): Observable<LeaveRequest | null> {
    return this.postOneRequired<ApiLeaveRequest, LeaveRequest>('leaves', {
      internship_id: (body as any).internshipId,
      student_id: (body as any).studentId,
      leave_type: (body as any).leaveType,
      start_date: (body as any).startDate,
      end_date: (body as any).endDate,
      reason: (body as any).reason
    }, mapLeaveRequest);
  }

  patchLeaveStatus(id: number, status: 'approved' | 'rejected', comment?: string): Observable<LeaveRequest | null> {
    return this.putOneRequired<ApiLeaveRequest, LeaveRequest>(`leaves/${id}/status`, {
      status,
      comment: comment ?? null
    }, mapLeaveRequest);
  }

  updateLeave(id: number, body: Omit<LeaveRequest, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'approvedAt'>): Observable<LeaveRequest | null> {
    return this.putOneRequired<ApiLeaveRequest, LeaveRequest>(`leaves/${id}`, {
      internship_id: (body as any).internshipId,
      student_id: (body as any).studentId,
      leave_type: (body as any).leaveType,
      start_date: (body as any).startDate,
      end_date: (body as any).endDate,
      reason: (body as any).reason
    }, mapLeaveRequest);
  }

  deleteLeave(id: number): Observable<any> {
    return this.http.delete<any>(`${this.base}/leaves/${id}`, this.authOptions());
  }

  createAssignment(body: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>): Observable<Assignment | null> {
    return this.postOne<ApiAssignment, Assignment>('assignments', toApiAssignment(body), mapAssignment);
  }

  createSubmission(body: Omit<Submission, 'id' | 'submittedAt' | 'gradedAt' | 'score' | 'feedback' | 'status'>): Observable<Submission | null> {
    return this.postOne<ApiSubmission, Submission>('submissions', toApiSubmission(body), mapSubmission);
  }

  gradeSubmission(id: number, score: number, feedback: string): Observable<Submission | null> {
    return this.putOne<ApiSubmission, Submission>(`submissions/${id}/grade`, { score, feedback }, mapSubmission);
  }

  private getList<D, M>(path: string, mapper: (dto: D) => M): Observable<M[]> {
    interface ApiResponseList<T> {
      status?: number;
      data?: T[];
    }
    return this.http.get<ApiResponseList<D>>(`${this.base}/${path}`, this.authOptions()).pipe(
      map((res) => {
        const rows = res?.data || [];
        return rows.map(mapper);
      }),
      catchError((err) => {
        console.error(`[InternshipApi] Failed to load list from ${path}`, err);
        return of([]);
      })
    );
  }

  private postOne<D, M>(path: string, body: unknown, mapper: (dto: D) => M): Observable<M | null> {
    return this.http.post<any>(`${this.base}/${path}`, body, this.authOptions()).pipe(
      map((res) => {
        const data = res?.data !== undefined ? res.data : res;
        return mapper(data);
      }),
      catchError((err) => {
        console.error(`[InternshipApi] Failed to post to ${path}`, err);
        return of(null);
      })
    );
  }

  private putOne<D, M>(path: string, body: unknown, mapper: (dto: D) => M): Observable<M | null> {
    return this.http.put<any>(`${this.base}/${path}`, body, this.authOptions()).pipe(
      map((res) => {
        const data = res?.data !== undefined ? res.data : res;
        return mapper(data);
      }),
      catchError((err) => {
        console.error(`[InternshipApi] Failed to put to ${path}`, err);
        return of(null);
      })
    );
  }

  private postOneRequired<D, M>(path: string, body: unknown, mapper: (dto: D) => M): Observable<M> {
    return this.http.post<any>(`${this.base}/${path}`, body, this.authOptions()).pipe(
      map((res) => mapper(this.requireResponseData<D>(res)))
    );
  }

  private putOneRequired<D, M>(path: string, body: unknown, mapper: (dto: D) => M): Observable<M> {
    return this.http.put<any>(`${this.base}/${path}`, body, this.authOptions()).pipe(
      map((res) => mapper(this.requireResponseData<D>(res)))
    );
  }

  private requireResponseData<D>(res: any): D {
    if (res?.data !== undefined && res.data !== null) {
      return res.data as D;
    }
    throw new Error(res?.error || res?.message || 'API response did not include saved data');
  }

  private setToken(token: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.tokenKey, token);
    }
  }

  private authOptions(): { headers?: HttpHeaders } {
    if (typeof localStorage === 'undefined') {
      return {};
    }
    const token = localStorage.getItem(this.tokenKey);
    if (!token) {
      return {};
    }
    return {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${token}`
      })
    };
  }

  getAdminSchools(): Observable<School[]> {
    return this.http.get<any>(`${this.base}/schools`, this.authOptions()).pipe(
      map((res) => res?.data || []),
      catchError(() => of([]))
    );
  }

  createAdminSchool(name: string): Observable<any> {
    return this.http.post<any>(`${this.base}/schools`, { name }, this.authOptions()).pipe(
      catchError((err) => {
        throw err;
      })
    );
  }

  createCompany(body: { company_name: string; description?: string; address?: string }): Observable<any> {
    return this.http.post<any>(`${this.base}/companies`, body, this.authOptions()).pipe(
      catchError((err) => {
        throw err;
      })
    );
  }

  getTickets(): Observable<any[]> {
    return this.http.get<any>(`${this.base}/tickets`, this.authOptions()).pipe(
      map(res => res?.data || []),
      catchError(() => of([]))
    );
  }

  getTicketById(id: number): Observable<any> {
    return this.http.get<any>(`${this.base}/tickets/${id}`, this.authOptions()).pipe(
      map(res => res?.data || null),
      catchError(() => of(null))
    );
  }

  createTicket(body: { title: string; description: string }): Observable<any> {
    return this.http.post<any>(`${this.base}/tickets`, body, this.authOptions()).pipe(
      catchError(err => {
        throw err;
      })
    );
  }

  replyTicket(id: number, message: string): Observable<any> {
    return this.http.post<any>(`${this.base}/tickets/${id}/replies`, { message }, this.authOptions()).pipe(
      catchError(err => {
        throw err;
      })
    );
  }

  updateTicketStatus(id: number, status: 'open' | 'resolved' | 'closed'): Observable<any> {
    return this.http.put<any>(`${this.base}/tickets/${id}/status`, { status }, this.authOptions()).pipe(
      catchError(err => {
        throw err;
      })
    );
  }

  getAdminCodes(): Observable<EnrollmentCode[]> {
    return this.http.get<any>(`${this.base}/admin/codes`, this.authOptions()).pipe(
      map((res) => res?.data || []),
      catchError(() => of([]))
    );
  }

  createAdminCode(body: {
    school_id?: number | null;
    role: 'student' | 'advisor' | 'company';
    code: string;
    max_uses?: number | null;
    expires_at?: string | null;
    company_name?: string;
    company_address?: string;
    company_description?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.base}/admin/codes`, body, this.authOptions()).pipe(
      catchError((err) => {
        throw err;
      })
    );
  }

  updateAdminCode(id: number, body: {
    code: string;
    max_uses?: number | null;
    expires_at?: string | null;
    is_active?: boolean;
  }): Observable<any> {
    return this.http.put<any>(`${this.base}/admin/codes/${id}`, body, this.authOptions()).pipe(
      catchError((err) => {
        throw err;
      })
    );
  }

  deleteAdminCode(id: number): Observable<any> {
    return this.http.delete<any>(`${this.base}/admin/codes/${id}`, this.authOptions()).pipe(
      catchError((err) => {
        throw err;
      })
    );
  }

  getAdminTables(): Observable<string[]> {
    return this.http.get<any>(`${this.base}/admin/tables`, this.authOptions()).pipe(
      map((res) => res?.data || []),
      catchError(() => of([]))
    );
  }

  executeAdminQuery(query: string): Observable<any> {
    return this.http.post<any>(`${this.base}/admin/query`, { query }, this.authOptions()).pipe(
      catchError((err) => {
        throw err;
      })
    );
  }

  /** Company admin: create an employee invite code linked to their company */
  createEmployeeCode(code: string): Observable<any> {
    return this.http.post<any>(`${this.base}/company/employees/codes`, { code }, this.authOptions()).pipe(
      catchError((err) => {
        throw err;
      })
    );
  }

  /** Company admin: list their company's active employee invite codes */
  getCompanyCodes(): Observable<any[]> {
    return this.http.get<any>(`${this.base}/company/employees/codes`, this.authOptions()).pipe(
      map((res) => res?.data || []),
      catchError(() => of([]))
    );
  }
}
