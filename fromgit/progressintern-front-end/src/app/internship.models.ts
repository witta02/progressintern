/** Matches `internship_db` schema (camelCase in TypeScript). */

export type Role = 'student' | 'company' | 'advisor' | 'admin';

/** Roles allowed on public registration */
export type RegisterRole = 'student' | 'company' | 'advisor';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: RegisterRole;
  phone?: string;
  school?: string;
  companyName?: string;
  description?: string;
  address?: string;
  contactEmail?: string;
}

export type ApplicationStatus = 'pending' | 'interview' | 'approved' | 'rejected';
export type JobPostingStatus = 'open' | 'closed';
export type InternshipStatus = 'active' | 'completed' | 'terminated';
export type AttendanceStatus = 'present' | 'late' | 'absent';
export type LogbookStatus = 'pending' | 'approved' | 'rejected';
export type EvaluationType = 'mentor' | 'advisor';

export type UserStatus = 'pending' | 'active' | 'rejected';

export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: Role;
  status?: UserStatus;
  phone?: string;
  school?: string;
  profileImage?: string;
  resumeUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Mock-only: link student → advisor until backend adds this relation */
  advisorId?: number;
}

export interface Company {
  id: number;
  userId: number;
  companyName: string;
  description?: string;
  address?: string;
  website?: string;
  contactEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface JobPosting {
  id: number;
  companyId: number;
  title: string;
  description?: string;
  requirements?: string;
  benefits?: string;
  slots: number;
  status: JobPostingStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Application {
  id: number;
  studentId: number;
  jobPostingId: number;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt?: string;
}

export interface Internship {
  id: number;
  studentId: number;
  companyId: number;
  jobPostingId: number;
  startDate: string;
  endDate: string;
  status: InternshipStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Attendance {
  id: number;
  internshipId: number;
  studentId: number;
  checkInTime: string;
  checkOutTime?: string;
  latitude?: number;
  longitude?: number;
  status: AttendanceStatus;
  createdAt?: string;
}

export interface Logbook {
  id: number;
  internshipId: number;
  title: string;
  content: string;
  attachmentUrl?: string;
  mentorComment?: string;
  status: LogbookStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Evaluation {
  id: number;
  internshipId: number;
  evaluatorId: number;
  score: number;
  feedback: string;
  evaluationType: EvaluationType;
  createdAt?: string;
  updatedAt?: string;
}

/** Column reference for admin schema view */
export const DB_SCHEMA_TABLES: { name: string; columns: string }[] = [
  { name: 'users', columns: 'id, name, email, password, role, phone, profile_image, resume_url, created_at, updated_at' },
  { name: 'companies', columns: 'id, user_id, company_name, description, address, website, contact_email, created_at, updated_at' },
  { name: 'job_postings', columns: 'id, company_id, title, description, requirements, benefits, slots, status, created_at, updated_at' },
  { name: 'applications', columns: 'id, student_id, job_posting_id, status, applied_at, updated_at' },
  { name: 'internships', columns: 'id, student_id, company_id, job_posting_id, start_date, end_date, status, created_at, updated_at' },
  { name: 'attendances', columns: 'id, internship_id, student_id, check_in_time, check_out_time, latitude, longitude, status, created_at' },
  { name: 'logbooks', columns: 'id, internship_id, title, content, attachment_url, mentor_comment, status, created_at, updated_at' },
  { name: 'evaluations', columns: 'id, internship_id, evaluator_id, score, feedback, evaluation_type, created_at, updated_at' }
];
