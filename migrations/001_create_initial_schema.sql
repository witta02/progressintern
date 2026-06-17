-- ========================================================
-- 📋 INTERNSHIP MANAGEMENT SYSTEM - DATABASE SCHEMA
-- ========================================================

-- 0️⃣ SCHOOLS TABLE (ข้อมูลสถาบันการศึกษา)
CREATE TABLE IF NOT EXISTS schools (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 0️⃣.1️⃣ ENROLLMENT_CODES TABLE (รหัสสมัครเข้าใช้งาน)
CREATE TABLE IF NOT EXISTS enrollment_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NULL,
    role ENUM('student', 'advisor', 'company') NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    max_uses INT NULL,
    used_count INT DEFAULT 0,
    expires_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 1️⃣ USERS TABLE (ข้อมูลผู้ใช้ - นักศึกษา, บริษัท, อาจารย์)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('student', 'company', 'advisor', 'admin') NOT NULL DEFAULT 'student',
    phone VARCHAR(20),
    school VARCHAR(255),
    school_id INT NULL,
    intro TEXT,
    field VARCHAR(255),
    profile_image VARCHAR(500),
    status ENUM('active', 'pending', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_school_id (school_id)
);

-- 2️⃣ COMPANIES TABLE (ข้อมูลสถานประกอบการ)
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    address TEXT,
    phone VARCHAR(20),
    industry VARCHAR(100),
    employee_count INT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_company_name (company_name)
);

-- 3️⃣ JOB_POSTINGS TABLE (ประกาศรับสมัครงาน)
CREATE TABLE IF NOT EXISTS job_postings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description LONGTEXT NOT NULL,
    requirements TEXT,
    benefits TEXT,
    category VARCHAR(100),
    location VARCHAR(255),
    salary_range VARCHAR(100),
    slots INT DEFAULT 1,
    status ENUM('open', 'closed', 'filled') DEFAULT 'open',
    work_days VARCHAR(255) DEFAULT 'Monday - Friday',
    checkin_time TIME DEFAULT '09:00:00',
    checkout_time TIME DEFAULT '17:00:00',
    lated_time TIME DEFAULT '09:15:00',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deadline DATE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_company_id (company_id),
    INDEX idx_status (status),
    INDEX idx_category (category)
);

-- 4️⃣ APPLICATIONS TABLE (ใบสมัครงาน)
CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    job_posting_id INT NOT NULL,
    resume_path VARCHAR(500),
    cover_letter TEXT,
    status ENUM('pending', 'interview', 'approved', 'rejected') DEFAULT 'pending',
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (job_posting_id) REFERENCES job_postings(id) ON DELETE CASCADE,
    UNIQUE KEY unique_application (student_id, job_posting_id),
    INDEX idx_student_id (student_id),
    INDEX idx_status (status)
);

-- 5️⃣ INTERNSHIPS TABLE (ข้อมูลการฝึกงาน)
CREATE TABLE IF NOT EXISTS internships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    company_id INT NOT NULL,
    job_posting_id INT NOT NULL,
    mentor_id INT,
    supervisor_id INT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
    total_hours INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (job_posting_id) REFERENCES job_postings(id) ON DELETE SET NULL,
    FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_student_id (student_id),
    INDEX idx_company_id (company_id),
    INDEX idx_status (status)
);

-- 6️⃣ ATTENDANCES TABLE (บันทึกเวลาเข้า-ออก)
CREATE TABLE IF NOT EXISTS attendances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    internship_id INT NOT NULL,
    student_id INT NOT NULL,
    check_in_time DATETIME,
    check_out_time DATETIME,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    checkout_latitude DOUBLE NULL,
    checkout_longitude DOUBLE NULL,
    status ENUM('present', 'absent', 'late', 'early_leave') DEFAULT 'present',
    verification_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_internship_id (internship_id),
    INDEX idx_created_at (created_at)
);

-- 7️⃣ LOGBOOKS TABLE (รายงานประจำวัน/สัปดาห์)
CREATE TABLE IF NOT EXISTS logbooks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    internship_id INT NOT NULL,
    student_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content LONGTEXT NOT NULL,
    week_number INT,
    status ENUM('draft', 'submitted', 'approved', 'rejected') DEFAULT 'draft',
    mentor_comment TEXT,
    mentor_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    submitted_at DATETIME,
    reviewed_at DATETIME,
    FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_internship_id (internship_id),
    INDEX idx_status (status)
);

-- 8️⃣ EVALUATIONS TABLE (ระบบประเมินผล)
CREATE TABLE IF NOT EXISTS evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    internship_id INT NOT NULL,
    evaluator_id INT NOT NULL,
    evaluator_role ENUM('mentor', 'advisor', 'company') NOT NULL,
    score DECIMAL(5, 2),
    max_score DECIMAL(5, 2) DEFAULT 100,
    rubric_data JSON,
    comment LONGTEXT,
    is_final BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE,
    FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_evaluation (internship_id, evaluator_id, evaluator_role),
    INDEX idx_internship_id (internship_id),
    INDEX idx_score (score)
);

-- 9️⃣ LEAVE_REQUESTS TABLE (ระบบลากิจ/ลาป่วย)
CREATE TABLE IF NOT EXISTS leave_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    internship_id INT NOT NULL,
    student_id INT NOT NULL,
    leave_type ENUM('sick', 'personal') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    mentor_id INT,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    approved_at DATETIME,
    FOREIGN KEY (internship_id) REFERENCES internships(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_internship_id (internship_id),
    INDEX idx_student_id (student_id),
    INDEX idx_status (status)
);

-- 🔟 NOTIFICATIONS TABLE (การแจ้งเตือน)
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    message LONGTEXT NOT NULL,
    related_entity_type VARCHAR(50),
    related_entity_id INT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);

-- 🔟 FILE_UPLOADS TABLE (เก็บข้อมูล file uploads)
CREATE TABLE IF NOT EXISTS file_uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INT,
    upload_type ENUM('resume', 'certificate', 'logbook_attachment', 'company_doc') DEFAULT 'resume',
    related_entity_type VARCHAR(50),
    related_entity_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_upload_type (upload_type)
);

-- 1️⃣1️⃣ AUDIT_LOGS TABLE (บันทึกการเปลี่ยนแปลง)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    old_value JSON,
    new_value JSON,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_entity (entity_type, entity_id)
);

-- ========================================================
-- 📌 CREATE INDEXES FOR PERFORMANCE
-- ========================================================
-- (Indexes already created above, but can add more if needed)

-- ========================================================
-- 🔐 DEFAULT DATA (Optional - for testing)
-- ========================================================

-- Admin user (e-mail: admin@internship.com, password: hashed)
-- INSERT INTO users (name, email, password, role) VALUES 
-- ('Admin User', 'admin@internship.com', '$2a$10$...', 'admin');

-- ========================================================
-- ✅ Schema Version Log (for migration tracking)
-- ========================================================
CREATE TABLE IF NOT EXISTS schema_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    version VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_versions (version, description) VALUES 
('1.0.0', 'Initial schema creation - core tables (users, companies, jobs, applications, internships, attendances, logbooks, evaluations, notifications, files, audit_logs)');
