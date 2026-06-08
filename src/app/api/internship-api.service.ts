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
  mapApplication,
  mapAttendance,
  mapCompany,
  mapEvaluation,
  mapInternship,
  mapJobPosting,
  mapLogbook,
  mapUser,
  toApiApplication,
  toApiInternship
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
  User
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
 * Expected routes (adjust with your coworker if paths differ):
 *   GET/POST  /api/users
 *   GET/POST  /api/companies
 *   GET/POST  /api/job-postings
 *   GET/PATCH /api/applications
 *   GET/POST  /api/internships
 *   GET/POST  /api/attendances
 *   GET/POST  /api/logbooks
 *   GET/POST  /api/evaluations
 *   POST      /api/auth/login  → { user: ApiUser, token?: string }
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
      evaluations: this.getList<ApiEvaluation, Evaluation>('evaluations', mapEvaluation)
    }).pipe(
      catchError((err) => {
        console.error('[InternshipApi] Failed to load data', err);
        return of(null);
      })
    );
  }

  login(email: string, password: string): Observable<User | null> {
    if (!this.apiEnabled()) {
      return of(null);
    }

    return this.http
      .post<LoginResponse>(`${this.base}/auth/login`, { email, password })
      .pipe(
        map((res) => {
          const data = res?.data;
          if (data && data.token) {
            this.setToken(data.token);
          }
          return data ? mapUser(data) : null;
        }),
        catchError((err) => {
          console.error('[InternshipApi] Login failed', err);
          return of(null);
        })
      );
  }

  register(body: {
    name: string;
    email: string;
    password: string;
    role: 'student' | 'company' | 'advisor';
    phone?: string;
    school?: string;
    company_name?: string;
    description?: string;
    address?: string;
    contact_email?: string;
  }): Observable<User | null> {
    if (!this.apiEnabled()) {
      return of(null);
    }
    return this.http.post(`${this.base}/auth/register`, body).pipe(
      switchMap(() => this.login(body.email, body.password)),
      catchError(() => of(null))
    );
  }

  registerWithoutLogin(body: {
    name: string;
    email: string;
    password: string;
    role: 'student' | 'company' | 'advisor';
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

  updateUser(id: number, body: Partial<User>): Observable<User | null> {
    return this.putOne<ApiUser, User>(`users/${id}`, {
      id: id,
      name: body.name ?? '',
      email: body.email ?? '',
      phone: body.phone ?? null,
      school: body.school ?? null,
      status: body.status,
      resume_url: body.resumeUrl ?? null
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

  patchAttendance(attendance: Attendance, patch: Partial<Pick<Attendance, 'checkOutTime' | 'status' | 'verificationStatus'>>): Observable<Attendance | null> {
    return this.putOne<ApiAttendance, Attendance>('attendance/check-out', {
      id: attendance.id,
      internship_id: attendance.internshipId,
      student_id: attendance.studentId,
      status: patch.status,
      verification_status: patch.verificationStatus
    }, mapAttendance);
  }

  createLogbook(body: Omit<Logbook, 'id' | 'createdAt' | 'updatedAt' | 'mentorComment' | 'status'> & { status?: Logbook['status'] }): Observable<Logbook | null> {
    return this.postOne<ApiLogbook, Logbook>('logbooks', {
      internship_id: body.internshipId,
      title: body.title,
      content: body.content,
      attachment_url: body.attachmentUrl ?? null,
      status: body.status ?? 'pending'
    }, mapLogbook);
  }

  patchLogbook(id: number, patch: Partial<Pick<Logbook, 'status' | 'mentorComment'>>): Observable<Logbook | null> {
    return this.putOne<ApiLogbook, Logbook>(`logbooks/${id}/approve`, {
      status: patch.status,
      comment: patch.mentorComment ?? null,
      mentor_comment: patch.mentorComment ?? null
    }, mapLogbook);
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

  private getList<D, M>(path: string, mapper: (dto: D) => M): Observable<M[]> {
    interface ApiResponseList<T> {
      status?: number;
      data?: T[];
      users?: T[];
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

  private patchOne<D, M>(path: string, body: unknown, mapper: (dto: D) => M): Observable<M | null> {
    return this.http.patch<any>(`${this.base}/${path}`, body, this.authOptions()).pipe(
      map((res) => {
        const data = res?.data !== undefined ? res.data : res;
        return mapper(data);
      }),
      catchError((err) => {
        console.error(`[InternshipApi] Failed to patch ${path}`, err);
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

  private setToken(token: string): void {
    if (typeof localStorage !== 'undefined') {
      console.log('[InternshipApi] setToken:', token);
      localStorage.setItem(this.tokenKey, token);
    }
  }

  private authOptions(): { headers?: HttpHeaders } {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    const token = localStorage.getItem(this.tokenKey);
    console.log('[InternshipApi] authOptions token:', token);
    if (!token) {
      return {};
    }
    return {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${token}`
      })
    };
  }
}
