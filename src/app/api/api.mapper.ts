import {
  Application,
  Attendance,
  Company,
  Evaluation,
  Internship,
  JobPosting,
  Logbook,
  User,
  LeaveRequest
} from '../internship.models';

/** API payloads use snake_case (MySQL / typical Node backends). */

export type ApiUser = {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: User['role'];
  status?: User['status'];
  phone?: string | null;
  school?: string | null;
  profile_image?: string | null;
  resume_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ApiCompany = {
  id: number;
  user_id: number;
  company_name: string;
  description?: string | null;
  address?: string | null;
  website?: string | null;
  contact_email?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ApiJobPosting = {
  id: number;
  company_id: number;
  title: string;
  company_name?: string | null;
  description?: string | null;
  requirements?: string | null;
  benefits?: string | null;
  checkin_time?: string | null;
  checkout_time?: string | null;
  lated_time?: string | null;
  work_days?: string | null;
  slots: number;
  status: JobPosting['status'];
  is_deleted?: boolean | null;
  created_at?: string;
  updated_at?: string;
};

export type ApiApplication = {
  id: number;
  student_id: number;
  job_posting_id: number;
  status: Application['status'];
  applied_at: string;
  updated_at?: string;
};

export type ApiInternship = {
  id: number;
  student_id: number;
  company_id: number;
  job_posting_id: number;
  start_date: string;
  end_date: string;
  status: Internship['status'];
  created_at?: string;
  updated_at?: string;
};

export type ApiAttendance = {
  id: number;
  internship_id: number;
  student_id: number;
  check_in_time: string;
  check_out_time?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  checkout_latitude?: number | null;
  checkout_longitude?: number | null;
  status: Attendance['status'];
  verification_status: Attendance['verificationStatus'];
  created_at?: string;
};

export type ApiLogbook = {
  id: number;
  internship_id: number;
  title: string;
  content: string;
  attachment_url?: string | null;
  mentor_comment?: string | null;
  status: Logbook['status'];
  created_at?: string;
  updated_at?: string;
};

export type ApiEvaluation = {
  id: number;
  internship_id: number;
  evaluator_id: number;
  score: number;
  feedback: string;
  evaluation_type: Evaluation['evaluationType'];
  created_at?: string;
  updated_at?: string;
};

export type ApiLeaveRequest = {
  id: number;
  internship_id: number;
  student_id: number;
  leave_type: 'sick' | 'personal';
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  mentor_id?: number | null;
  comment?: string | null;
  created_at?: string;
  updated_at?: string;
  approved_at?: string | null;
};

export function mapUser(dto: ApiUser): User {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email,
    password: dto.password,
    role: dto.role,
    status: dto.status,
    phone: dto.phone ?? undefined,
    school: dto.school ?? undefined,
    profileImage: dto.profile_image ?? undefined,
    resumeUrl: dto.resume_url ?? undefined,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at
  };
}

export function mapCompany(dto: ApiCompany): Company {
  return {
    id: dto.id,
    userId: dto.user_id,
    companyName: dto.company_name,
    description: dto.description ?? undefined,
    address: dto.address ?? undefined,
    website: dto.website ?? undefined,
    contactEmail: dto.contact_email ?? undefined,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at
  };
}

export function mapJobPosting(dto: ApiJobPosting): JobPosting {
  return {
    id: dto.id,
    companyId: dto.company_id,
    title: dto.title,
    companyName: dto.company_name ?? undefined,
    description: dto.description ?? undefined,
    requirements: dto.requirements ?? undefined,
    benefits: dto.benefits ?? undefined,
    checkinTime: dto.checkin_time ?? undefined,
    checkoutTime: dto.checkout_time ?? undefined,
    latedTime: dto.lated_time ?? undefined,
    workDays: dto.work_days ?? undefined,
    slots: dto.slots,
    status: dto.status,
    isDeleted: dto.is_deleted ?? false,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at
  };
}

export function mapApplication(dto: ApiApplication): Application {
  return {
    id: dto.id,
    studentId: dto.student_id,
    jobPostingId: dto.job_posting_id,
    status: dto.status,
    appliedAt: dto.applied_at,
    updatedAt: dto.updated_at
  };
}

export function mapInternship(dto: ApiInternship): Internship {
  return {
    id: dto.id,
    studentId: dto.student_id,
    companyId: dto.company_id,
    jobPostingId: dto.job_posting_id,
    startDate: dto.start_date,
    endDate: dto.end_date,
    status: dto.status,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at
  };
}

export function mapAttendance(dto: ApiAttendance): Attendance {
  return {
    id: dto.id,
    internshipId: dto.internship_id,
    studentId: dto.student_id,
    checkInTime: dto.check_in_time,
    checkOutTime: dto.check_out_time ?? undefined,
    latitude: dto.latitude ?? undefined,
    longitude: dto.longitude ?? undefined,
    checkoutLatitude: dto.checkout_latitude ?? undefined,
    checkoutLongitude: dto.checkout_longitude ?? undefined,
    status: dto.status,
    verificationStatus: dto.verification_status,
    createdAt: dto.created_at
  };
}

export function mapLogbook(dto: ApiLogbook): Logbook {
  return {
    id: dto.id,
    internshipId: dto.internship_id,
    title: dto.title,
    content: dto.content,
    attachmentUrl: dto.attachment_url ?? undefined,
    mentorComment: dto.mentor_comment ?? undefined,
    status: dto.status,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at
  };
}

export function mapEvaluation(dto: ApiEvaluation): Evaluation {
  return {
    id: dto.id,
    internshipId: dto.internship_id,
    evaluatorId: dto.evaluator_id,
    score: dto.score,
    feedback: dto.feedback,
    evaluationType: dto.evaluation_type,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at
  };
}

export function mapLeaveRequest(dto: ApiLeaveRequest): LeaveRequest {
  return {
    id: dto.id,
    internshipId: dto.internship_id,
    studentId: dto.student_id,
    leaveType: dto.leave_type,
    startDate: dto.start_date,
    endDate: dto.end_date,
    reason: dto.reason,
    status: dto.status,
    mentorId: dto.mentor_id ?? undefined,
    comment: dto.comment ?? undefined,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    approvedAt: dto.approved_at ?? undefined
  };
}

export function toApiApplication(body: Omit<Application, 'id' | 'updatedAt'>): Omit<ApiApplication, 'id'> {
  return {
    student_id: body.studentId,
    job_posting_id: body.jobPostingId,
    status: body.status,
    applied_at: body.appliedAt
  };
}

export function toApiInternship(body: Omit<Internship, 'id' | 'createdAt' | 'updatedAt'>): Omit<ApiInternship, 'id'> {
  return {
    student_id: body.studentId,
    company_id: body.companyId,
    job_posting_id: body.jobPostingId,
    start_date: body.startDate,
    end_date: body.endDate,
    status: body.status
  };
}
