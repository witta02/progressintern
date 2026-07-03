package models

import (
	"time"
)

// ========================================================
// 📦 DATABASE MODELS & VALIDATION STRUCTURES
// ========================================================

// ==================== Authentication ====================

type User struct {
	ID           int       `json:"id" db:"id"`
	Name         string    `json:"name" db:"name"`
	Email        string    `json:"email" db:"email"`
	Password     string    `json:"-" db:"password"` // ซ่อนรหัสผ่านจาก JSON response
	Role         string    `json:"role" db:"role"`  // student, company, advisor, admin
	PhoneNumber  string    `json:"phone" db:"phone"`
	Intro        string    `json:"intro" db:"intro"`
	Field        string    `json:"field" db:"field"`
	School       string    `json:"school" db:"school"`
	Status       string    `json:"status" db:"status"` // active, pending, suspended
	ResumeURL    string    `json:"resume_url" db:"resume_url"`
	ProfileImage string    `json:"profile_image" db:"profile_image"`
	AdvisorID    *int      `json:"advisor_id,omitempty" db:"advisor_id"`
	AdvisorIDs   []int     `json:"advisor_ids,omitempty"`
	StudentCode  string    `json:"student_code" db:"student_code"`
	YearLevel    string    `json:"year_level" db:"year_level"`
	ClassGroup   string    `json:"class_group" db:"class_group"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type RegisterInput struct {
	Name         string `json:"name" binding:"required,min=2,max=255"`
	Email        string `json:"email" binding:"required,email"`
	Password     string `json:"password" binding:"required,min=6"`
	Code         string `json:"code" binding:"required"` // รหัสลงทะเบียน / รหัสเชิญ
	Role         string `json:"role" binding:"omitempty,oneof=student company advisor admin"`
	Phone        string `json:"phone" binding:"omitempty"`
	Intro        string `json:"intro"`
	Field        string `json:"field"`
	School       string `json:"school"`
	CompanyName  string `json:"company_name"`
	Description  string `json:"description"`
	Address      string `json:"address"`
	ContactEmail string `json:"contact_email"`
}

type ValidateCodeResponse struct {
	Code               string `json:"code"`
	Role               string `json:"role"`
	SchoolName         string `json:"school_name,omitempty"`
	SchoolID           int    `json:"school_id,omitempty"`
	CompanyName        string `json:"company_name,omitempty"`
	CompanyAddress     string `json:"company_address,omitempty"`
	CompanyDescription string `json:"company_description,omitempty"`
	SkipCompanyFields  bool   `json:"skip_company_fields"`
}

type JWTResponse struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
	Token string `json:"token"`
}

// ==================== Company ====================

type Company struct {
	ID            int       `json:"id" db:"id"`
	UserID        int       `json:"user_id" db:"user_id"`
	CompanyName   string    `json:"company_name" db:"company_name"`
	Website       string    `json:"website" db:"website"`
	Address       string    `json:"address" db:"address"`
	Phone         string    `json:"phone" db:"phone"`
	Industry      string    `json:"industry" db:"industry"`
	EmployeeCount int       `json:"employee_count" db:"employee_count"`
	Description   string    `json:"description" db:"description"`
	Latitude      *float64  `json:"latitude" db:"latitude"`
	Longitude     *float64  `json:"longitude" db:"longitude"`
	CheckRadius   *int      `json:"check_radius" db:"check_radius"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

type CreateCompanyInput struct {
	CompanyName   string `json:"company_name" binding:"required,min=3,max=255"`
	Website       string `json:"website" binding:"omitempty,url"`
	Address       string `json:"address" binding:"required"`
	Phone         string `json:"phone" binding:"required,len=10"`
	Industry      string `json:"industry" binding:"required"`
	EmployeeCount int    `json:"employee_count" binding:"omitempty,min=1"`
	Description   string `json:"description" binding:"omitempty,max=5000"`
}

// ==================== Job Posting ====================

type JobPosting struct {
	ID                       int        `json:"id" db:"id"`
	CompanyID                int        `json:"company_id" db:"company_id"`
	Title                    string     `json:"title" db:"title"`
	Description              string     `json:"description" db:"description"`
	Requirements             string     `json:"requirements" db:"requirements"`
	Benefits                 string     `json:"benefits" db:"benefits"`
	Category                 string     `json:"category" db:"category"`
	Location                 string     `json:"location" db:"location"`
	SalaryRange              string     `json:"salary_range" db:"salary_range"`
	CheckInTime              string     `json:"checkin_time" db:"checkin_time"`
	CheckOutTime             string     `json:"checkout_time" db:"checkout_time"`
	LatedTime                string     `json:"lated_time" db:"lated_time"`
	WorkDays                 string     `json:"work_days" db:"work_days"`
	Slots                    int        `json:"slots" db:"slots"`
	Status                   string     `json:"status" db:"status"` // open, closed, filled
	Deadline                 *time.Time `json:"deadline" db:"deadline"`
	CreatedAt                time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt                time.Time  `json:"updated_at" db:"updated_at"`
}

type CreateJobInput struct {
	CompanyID    int        `json:"company_id" binding:"required"`
	Title        string     `json:"title" binding:"required,min=5,max=255"`
	Description  string     `json:"description" binding:"required,min=20"`
	Requirements string     `json:"requirements" binding:"omitempty"`
	Benefits     string     `json:"benefits" binding:"omitempty"`
	CheckInTime  string     `json:"checkin_time" binding:"required"`
	CheckOutTime string     `json:"checkout_time" binding:"required"`
	LatedTime    string     `json:"lated_time" binding:"required"`
	WorkDays     string     `json:"work_days" binding:"required"`
	Slots        int        `json:"slots" binding:"required,min=1,max=100"`
	Deadline     *time.Time `json:"deadline" binding:"omitempty"`
}

// ใช้สำหรับ handlers/jobs.go
type JobPostingInput struct {
	CompanyID    int    `json:"company_id" binding:"required"`
	Title        string `json:"title" binding:"required"`
	Description  string `json:"description" binding:"required"`
	Requirements string `json:"requirements" binding:"omitempty"`
	Benefits     string `json:"benefits" binding:"omitempty"`
	CheckInTime  string `json:"checkin_time"`
	CheckOutTime string `json:"checkout_time"`
	LatedTime    string `json:"lated_time"`
	WorkDays     string `json:"work_days"`
	Slots        int    `json:"slots" binding:"required"`
}

// ==================== Application ====================

type Application struct {
	ID              int       `json:"id" db:"id"`
	StudentID       int       `json:"student_id" db:"student_id"`
	JobPostingID    int       `json:"job_posting_id" db:"job_posting_id"`
	ResumePath      string    `json:"resume_path" db:"resume_path"`
	CoverLetter     string    `json:"cover_letter" db:"cover_letter"`
	Status          string    `json:"status" db:"status"` // pending, interview, approved, rejected
	RejectionReason string    `json:"rejection_reason" db:"rejection_reason"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

type ApplyInput struct {
	StudentID    int    `json:"student_id" binding:"required"`
	JobPostingID int    `json:"job_posting_id" binding:"required"`
	CoverLetter  string `json:"cover_letter" binding:"omitempty,max=5000"`
}

type ApplyJobInput = ApplyInput

type UpdateStatusInput struct {
	Status string `json:"status" binding:"required,oneof=pending interview approved rejected"`
}

type UpdateApplicationStatusInput struct {
	Status          string `json:"status" binding:"required,oneof=pending interview approved rejected"`
	RejectionReason string `json:"rejection_reason" binding:"omitempty"`
}

// ==================== Internship ====================

type Internship struct {
	ID           int       `json:"id" db:"id"`
	StudentID    int       `json:"student_id" db:"student_id"`
	CompanyID    int       `json:"company_id" db:"company_id"`
	JobPostingID int       `json:"job_posting_id" db:"job_posting_id"`
	MentorID     *int      `json:"mentor_id" db:"mentor_id"`
	SupervisorID *int      `json:"supervisor_id" db:"supervisor_id"`
	StartDate    time.Time `json:"start_date" db:"start_date"`
	EndDate      time.Time `json:"end_date" db:"end_date"`
	Status       string    `json:"status" db:"status"` // active, completed, cancelled
	TotalHours   int       `json:"total_hours" db:"total_hours"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// ==================== Attendance ====================

type Attendance struct {
	ID                 int        `json:"id" db:"id"`
	InternshipID       int        `json:"internship_id" db:"internship_id"`
	StudentID          int        `json:"student_id" db:"student_id"`
	CheckInTime        *time.Time `json:"check_in_time" db:"check_in_time"`
	CheckOutTime       *time.Time `json:"check_out_time" db:"check_out_time"`
	Latitude           float64    `json:"latitude" db:"latitude"`
	Longitude          float64    `json:"longitude" db:"longitude"`
	CheckoutLatitude   *float64   `json:"checkout_latitude" db:"checkout_latitude"`
	CheckoutLongitude  *float64   `json:"checkout_longitude" db:"checkout_longitude"`
	Status             string     `json:"status" db:"status"` // present, absent, late, early_leave
	VerificationStatus string     `json:"verification_status" db:"verification_status"` // pending, approved, rejected
	Notes              string     `json:"notes" db:"notes"`
	CreatedAt          time.Time  `json:"created_at" db:"created_at"`
}

type CheckInInput struct {
	InternshipID int     `json:"internship_id" binding:"required"`
	StudentID    int     `json:"student_id" binding:"required"`
	Latitude     float64 `json:"latitude" binding:"omitempty"`
	Longitude    float64 `json:"longitude" binding:"omitempty"`
}

type CheckOutInput struct {
	InternshipID int `json:"internship_id" binding:"required"`
	StudentID    int `json:"student_id" binding:"required"`
}

// ใช้สำหรับ handlers/attendance.go
type AttendanceInput struct {
	InternshipID int     `json:"internship_id" binding:"required"`
	StudentID    int     `json:"student_id" binding:"required"`
	Latitude     float64 `json:"latitude" binding:"omitempty"`
	Longitude    float64 `json:"longitude" binding:"omitempty"`
}

// ==================== Logbook ====================

type Logbook struct {
	ID            int        `json:"id" db:"id"`
	InternshipID  int        `json:"internship_id" db:"internship_id"`
	StudentID     int        `json:"student_id" db:"student_id"`
	Title         string     `json:"title" db:"title"`
	Content       string     `json:"content" db:"content"`
	WeekNumber    *int       `json:"week_number" db:"week_number"`
	Status        string     `json:"status" db:"status"` // draft, submitted, approved, rejected
	MentorComment string     `json:"mentor_comment" db:"mentor_comment"`
	MentorID      *int       `json:"mentor_id" db:"mentor_id"`
	WorkDate      *string    `json:"work_date" db:"work_date"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
	SubmittedAt   *time.Time `json:"submitted_at" db:"submitted_at"`
	ReviewedAt    *time.Time `json:"reviewed_at" db:"reviewed_at"`
}

type CreateLogbookInput struct {
	InternshipID int    `json:"internship_id" binding:"required"`
	StudentID    int    `json:"student_id" binding:"required"`
	Title        string `json:"title" binding:"required,min=5,max=255"`
	Content      string `json:"content" binding:"required,min=50"`
	WeekNumber   *int   `json:"week_number" binding:"omitempty,min=1,max=52"`
}

// ใช้สำหรับ handlers/logbooks.go
type LogbookInput struct {
	InternshipID int     `json:"internship_id" binding:"required"`
	StudentID    int     `json:"student_id" binding:"required"`
	Title        string  `json:"title" binding:"required"`
	Content      string  `json:"content" binding:"required"`
	WorkDate     *string `json:"work_date" binding:"omitempty"`
}

type ApproveLogbookInput struct {
	Status        string `json:"status" binding:"required,oneof=approved rejected"`
	MentorComment string `json:"mentor_comment" binding:"omitempty,max=2000"`
}

// ==================== Evaluation ====================

type Evaluation struct {
	ID            int               `json:"id" db:"id"`
	InternshipID  int               `json:"internship_id" db:"internship_id"`
	EvaluatorID   int               `json:"evaluator_id" db:"evaluator_id"`
	EvaluatorRole string            `json:"evaluator_role" db:"evaluator_role"` // mentor, advisor, company
	Score         float64           `json:"score" db:"score"`
	MaxScore      float64           `json:"max_score" db:"max_score"`
	RubricData    string            `json:"rubric_data" db:"rubric_data"` // JSON
	Comment       string            `json:"comment" db:"comment"`
	IsFinal       bool              `json:"is_final" db:"is_final"`
	Scores        []EvaluationScore `json:"scores,omitempty"`
	CreatedAt     time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at" db:"updated_at"`
}

type CreateEvaluationInput struct {
	InternshipID  int     `json:"internship_id" binding:"required"`
	EvaluatorRole string  `json:"evaluator_role" binding:"required,oneof=mentor advisor company"`
	Score         float64 `json:"score" binding:"required,min=0,max=100"`
	Comment       string  `json:"comment" binding:"omitempty,max=5000"`
	RubricData    string  `json:"rubric_data" binding:"omitempty"`
}

// ==================== Leave Request ====================

type LeaveRequest struct {
	ID           int        `json:"id" db:"id"`
	InternshipID int        `json:"internship_id" db:"internship_id"`
	StudentID    int        `json:"student_id" db:"student_id"`
	LeaveType    string     `json:"leave_type" db:"leave_type"` // sick, personal
	StartDate    time.Time  `json:"start_date" db:"start_date"`
	EndDate      time.Time  `json:"end_date" db:"end_date"`
	Reason       string     `json:"reason" db:"reason"`
	Status       string     `json:"status" db:"status"` // pending, approved, rejected
	MentorID     *int       `json:"mentor_id" db:"mentor_id"`
	Comment      *string    `json:"comment" db:"comment"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
	ApprovedAt   *time.Time `json:"approved_at" db:"approved_at"`
}

type CreateLeaveInput struct {
	InternshipID int    `json:"internship_id" binding:"required"`
	StudentID    int    `json:"student_id" binding:"required"`
	LeaveType    string `json:"leave_type" binding:"required,oneof=sick personal"`
	StartDate    string `json:"start_date" binding:"required"` // Expecting YYYY-MM-DD
	EndDate      string `json:"end_date" binding:"required"`   // Expecting YYYY-MM-DD
	Reason       string `json:"reason" binding:"required"`
}

type UpdateLeaveStatusInput struct {
	Status  string `json:"status" binding:"required,oneof=approved rejected"`
	Comment string `json:"comment" binding:"omitempty"`
}

// ==================== Notification ====================

type Notification struct {
	ID                int        `json:"id" db:"id"`
	UserID            int        `json:"user_id" db:"user_id"`
	Type              string     `json:"type" db:"type"`
	Title             string     `json:"title" db:"title"`
	Message           string     `json:"message" db:"message"`
	RelatedEntityType string     `json:"related_entity_type" db:"related_entity_type"`
	RelatedEntityID   *int       `json:"related_entity_id" db:"related_entity_id"`
	IsRead            bool       `json:"is_read" db:"is_read"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`
	ReadAt            *time.Time `json:"read_at" db:"read_at"`
}

// ==================== File Upload ====================

type FileUpload struct {
	ID                int       `json:"id" db:"id"`
	UserID            int       `json:"user_id" db:"user_id"`
	FilePath          string    `json:"file_path" db:"file_path"`
	FileName          string    `json:"file_name" db:"file_name"`
	FileType          string    `json:"file_type" db:"file_type"`
	FileSize          int       `json:"file_size" db:"file_size"`
	UploadType        string    `json:"upload_type" db:"upload_type"` // resume, certificate, etc
	RelatedEntityType string    `json:"related_entity_type" db:"related_entity_type"`
	RelatedEntityID   *int      `json:"related_entity_id" db:"related_entity_id"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
}

// ==================== API Response ====================

type APIResponse struct {
	Status  int         `json:"status"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

type PaginatedResponse struct {
	Status   int         `json:"status"`
	Message  string      `json:"message"`
	Data     interface{} `json:"data"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
	Total    int64       `json:"total"`
}

// ==================== School & Codes ====================

type School struct {
	ID        int       `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type EnrollmentCode struct {
	ID                 int        `json:"id" db:"id"`
	SchoolID           *int       `json:"school_id" db:"school_id"`
	SchoolName         string     `json:"school_name,omitempty" db:"school_name"`
	Role               string     `json:"role" db:"role"`
	Code               string     `json:"code" db:"code"`
	MaxUses            *int       `json:"max_uses" db:"max_uses"`
	UsedCount          int        `json:"used_count" db:"used_count"`
	ExpiresAt          *time.Time `json:"expires_at" db:"expires_at"`
	IsActive           bool       `json:"is_active" db:"is_active"`
	CompanyID          *int       `json:"company_id,omitempty" db:"company_id"`
	CompanyName        string     `json:"company_name,omitempty" db:"company_name"`
	CompanyAddress     string     `json:"company_address,omitempty" db:"company_address"`
	CompanyDescription string     `json:"company_description,omitempty" db:"company_description"`
	CreatedAt          time.Time  `json:"created_at" db:"created_at"`
}

type CreateSchoolInput struct {
	Name string `json:"name" binding:"required,min=2,max=255"`
}

type CreateCodeInput struct {
	SchoolID           *int       `json:"school_id"`
	CompanyID          *int       `json:"company_id"`
	Role               string     `json:"role" binding:"required,oneof=student advisor company"`
	Code               string     `json:"code" binding:"required,min=3,max=100"`
	MaxUses            *int       `json:"max_uses"`
	ExpiresAt          *time.Time `json:"expires_at"`
	CompanyName        string     `json:"company_name"`
	CompanyAddress     string     `json:"company_address"`
	CompanyDescription string     `json:"company_description"`
}

type UpdateCodeInput struct {
	Code      string     `json:"code" binding:"required,min=3,max=100"`
	MaxUses   *int       `json:"max_uses"`
	ExpiresAt *time.Time `json:"expires_at"`
	IsActive  *bool      `json:"is_active"`
}

// ==================== Assignments (Google Classroom Style) ====================

type Assignment struct {
	ID           int        `json:"id" db:"id"`
	Title        string     `json:"title" db:"title"`
	Description  string     `json:"description" db:"description"`
	DueDate      *time.Time `json:"due_date" db:"due_date"`
	Points       int        `json:"points" db:"points"`
	CreatorID    int        `json:"creator_id" db:"creator_id"`
	CreatorRole  string     `json:"creator_role" db:"creator_role"` // advisor, company
	SchoolID     *int       `json:"school_id,omitempty" db:"school_id"`
	CompanyID    *int       `json:"company_id,omitempty" db:"company_id"`
	StudentID    *int       `json:"student_id,omitempty" db:"student_id"`
	JobPostingID *int       `json:"job_posting_id,omitempty" db:"job_posting_id"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
}

type CreateAssignmentInput struct {
	Title        string     `json:"title" binding:"required"`
	Description  string     `json:"description"`
	DueDate      *time.Time `json:"due_date"`
	Points       int        `json:"points"`
	SchoolID     *int       `json:"school_id"`
	CompanyID    *int       `json:"company_id"`
	StudentID    *int       `json:"student_id"`
	JobPostingID *int       `json:"job_posting_id"`
}

type Submission struct {
	ID           int        `json:"id" db:"id"`
	AssignmentID int        `json:"assignment_id" db:"assignment_id"`
	StudentID    int        `json:"student_id" db:"student_id"`
	Content      string     `json:"content" db:"content"`
	FileName     string     `json:"file_name" db:"file_name"`
	FilePath     string     `json:"file_path" db:"file_path"`
	Status       string     `json:"status" db:"status"` // submitted, late, graded
	Score        *float64   `json:"score" db:"score"`
	Feedback     string     `json:"feedback" db:"feedback"`
	SubmittedAt  time.Time  `json:"submitted_at" db:"submitted_at"`
	GradedAt     *time.Time `json:"graded_at,omitempty" db:"graded_at"`
}

type CreateSubmissionInput struct {
	AssignmentID int    `json:"assignment_id" binding:"required"`
	StudentID    int    `json:"student_id" binding:"required"`
	Content      string `json:"content"`
	FileName     string `json:"file_name"`
	FilePath     string `json:"file_path"`
}

type GradeSubmissionInput struct {
	Score    float64 `json:"score" binding:"required,min=0"`
	Feedback string  `json:"feedback"`
}

// ==================== Ticket System ====================

type Ticket struct {
	ID          int       `json:"id" db:"id"`
	UserID      int       `json:"user_id" db:"user_id"`
	UserName    string    `json:"user_name,omitempty" db:"user_name"`
	UserRole    string    `json:"user_role,omitempty" db:"user_role"`
	Title       string    `json:"title" db:"title"`
	Description string    `json:"description" db:"description"`
	Status      string    `json:"status" db:"status"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type TicketReply struct {
	ID        int       `json:"id" db:"id"`
	TicketID  int       `json:"ticket_id" db:"ticket_id"`
	UserID    int       `json:"user_id" db:"user_id"`
	UserName  string    `json:"user_name,omitempty" db:"user_name"`
	UserRole  string    `json:"user_role,omitempty" db:"user_role"`
	Message   string    `json:"message" db:"message"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CreateTicketInput struct {
	Title       string `json:"title" binding:"required,min=3,max=255"`
	Description string `json:"description" binding:"required,min=5"`
}

type CreateTicketReplyInput struct {
	Message string `json:"message" binding:"required,min=1"`
}

// ==================== Rubrics ====================

type EvaluationTemplate struct {
	ID        int                   `json:"id" db:"id"`
	CreatedBy int                   `json:"created_by" db:"created_by"`
	Name      string                `json:"name" db:"name"`
	IsActive  bool                  `json:"is_active" db:"is_active"`
	CreatedAt time.Time             `json:"created_at" db:"created_at"`
	Criteria  []EvaluationCriterion `json:"criteria"`
}

type EvaluationCriterion struct {
	ID         int    `json:"id" db:"id"`
	TemplateID int    `json:"template_id" db:"template_id"`
	Label      string `json:"label" db:"label"`
	MaxScore   int    `json:"max_score" db:"max_score"`
	SortOrder  int    `json:"sort_order" db:"sort_order"`
}

type EvaluationScore struct {
	ID           int     `json:"id" db:"id"`
	EvaluationID int     `json:"evaluation_id" db:"evaluation_id"`
	CriterionID  int     `json:"criterion_id" db:"criterion_id"`
	Score        float64 `json:"score" db:"score"`
	Label        string  `json:"label,omitempty"`
	MaxScore     int     `json:"max_score,omitempty"`
}

