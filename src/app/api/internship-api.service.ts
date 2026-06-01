import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
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
      jobPostings: this.getList<ApiJobPosting, JobPosting>('job-postings', mapJobPosting),
      applications: this.getList<ApiApplication, Application>('applications', mapApplication),
      internships: this.getList<ApiInternship, Internship>('internships', mapInternship),
      attendances: this.getList<ApiAttendance, Attendance>('attendances', mapAttendance),
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
      .post<{ user: ApiUser }>(`${this.base}/auth/login`, { email, password })
      .pipe(
        map((res) => mapUser(res.user)),
        catchError(() => of(null))
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

    return this.http
      .post<{ user: ApiUser }>(`${this.base}/auth/register`, body)
      .pipe(
        map((res) => mapUser(res.user)),
        catchError(() => of(null))
      );
  }

  createApplication(body: Omit<Application, 'id' | 'updatedAt'>): Observable<Application | null> {
    return this.postOne<ApiApplication, Application>('applications', toApiApplication(body), mapApplication);
  }

  patchApplication(id: number, status: ApplicationStatus): Observable<Application | null> {
    return this.patchOne<ApiApplication, Application>(`applications/${id}`, { status }, mapApplication);
  }

  createInternship(body: Omit<Internship, 'id' | 'createdAt' | 'updatedAt'>): Observable<Internship | null> {
    return this.postOne<ApiInternship, Internship>('internships', toApiInternship(body), mapInternship);
  }

  createAttendance(body: Omit<Attendance, 'id' | 'createdAt'>): Observable<Attendance | null> {
    return this.postOne<ApiAttendance, Attendance>('attendances', {
      internship_id: body.internshipId,
      student_id: body.studentId,
      check_in_time: body.checkInTime,
      check_out_time: body.checkOutTime ?? null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      status: body.status
    }, mapAttendance);
  }

  patchAttendance(id: number, patch: Partial<Pick<Attendance, 'checkOutTime' | 'status'>>): Observable<Attendance | null> {
    return this.patchOne<ApiAttendance, Attendance>(`attendances/${id}`, {
      check_out_time: patch.checkOutTime ?? null,
      status: patch.status
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
    return this.patchOne<ApiLogbook, Logbook>(`logbooks/${id}`, {
      status: patch.status,
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
    return this.http.get<D[]>(`${this.base}/${path}`).pipe(
      map((rows) => rows.map(mapper)),
      catchError(() => of([]))
    );
  }

  private postOne<D, M>(path: string, body: unknown, mapper: (dto: D) => M): Observable<M | null> {
    return this.http.post<D>(`${this.base}/${path}`, body).pipe(
      map(mapper),
      catchError(() => of(null))
    );
  }

  private patchOne<D, M>(path: string, body: unknown, mapper: (dto: D) => M): Observable<M | null> {
    return this.http.patch<D>(`${this.base}/${path}`, body).pipe(
      map(mapper),
      catchError(() => of(null))
    );
  }
}
