/** Matches `internship_db` schema (camelCase in TypeScript). */

export type Role = 'student' | 'company' | 'advisor' | 'admin';

/** Roles allowed on public registration */
export type RegisterRole = 'student' | 'company' | 'advisor';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  code: string;
  role?: RegisterRole;
  phone?: string;
  intro?: string;
  field?: string;
  school?: string;
  companyName?: string;
  description?: string;
  address?: string;
  contactEmail?: string;
}

export type ApplicationStatus = 'pending' | 'interview' | 'approved' | 'rejected';
export type JobPostingStatus = 'open' | 'closed';
export type InternshipStatus = 'active' | 'completed' | 'terminated';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'early_leave';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type LogbookStatus = 'pending' | 'approved' | 'rejected';
export type EvaluationType = 'mentor' | 'advisor';
export type LeaveType = 'sick' | 'personal';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export type UserStatus = 'pending' | 'active' | 'rejected';

export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: Role;
  status?: UserStatus;
  phone?: string;
  intro?: string;
  field?: string;
  school?: string;
  profileImage?: string;
  resumeUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  internStartDate?: string;
  internEndDate?: string;
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
  latitude?: number;
  longitude?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface JobPosting {
  id: number;
  companyId: number;
  title: string;
  companyName?: string;
  description?: string;
  requirements?: string;
  benefits?: string;
  checkinTime?: string;
  checkoutTime?: string;
  latedTime?: string;
  workDays?: string;
  slots: number;
  status: JobPostingStatus;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  applicantCount?: number;
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
  checkoutLatitude?: number;
  checkoutLongitude?: number;
  status: AttendanceStatus;
  verificationStatus: VerificationStatus;
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

export interface LeaveRequest {
  id: number;
  internshipId: number;
  studentId: number;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  mentorId?: number;
  comment?: string;
  createdAt?: string;
  updatedAt?: string;
  approvedAt?: string;
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
  { name: 'evaluations', columns: 'id, internship_id, evaluator_id, score, feedback, evaluation_type, created_at, updated_at' },
  { name: 'leave_requests', columns: 'id, internship_id, student_id, leave_type, start_date, end_date, reason, status, mentor_id, comment, created_at, approved_at' }
];

export interface School {
  id: number;
  name: string;
  createdAt?: string;
}

export interface EnrollmentCode {
  id: number;
  schoolId?: number;
  schoolName?: string;
  role: 'student' | 'advisor' | 'company';
  code: string;
  maxUses?: number;
  usedCount: number;
  expiresAt?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface Assignment {
  id: number;
  title: string;
  description?: string;
  dueDate?: string;
  points: number;
  creatorId: number;
  creatorRole: string; // 'advisor' | 'company'
  schoolId?: number;
  companyId?: number;
  studentId?: number;
  jobPostingId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type SubmissionStatus = 'submitted' | 'late' | 'graded';

export interface Submission {
  id: number;
  assignmentId: number;
  studentId: number;
  content?: string;
  fileName?: string;
  filePath?: string;
  status: SubmissionStatus;
  score?: number;
  feedback?: string;
  submittedAt: string;
  gradedAt?: string;
}

export interface Ticket {
  id: number;
  user_id: number;
  user_name?: string;
  user_role?: string;
  title: string;
  description: string;
  status: 'open' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface TicketReply {
  id: number;
  ticket_id: number;
  user_id: number;
  user_name?: string;
  user_role?: string;
  message: string;
  created_at: string;
}
