-- Modules 1–3: catalog, accounts, sessions, and anonymous reviews.
-- InnoDB supplies foreign keys, transactions, and row-level locking.
CREATE TABLE IF NOT EXISTS departments (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  source_url VARCHAR(512) NOT NULL DEFAULT ''
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS professors (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  department_id VARCHAR(80) NOT NULL,
  designation VARCHAR(120) NOT NULL,
  source_url VARCHAR(512) NOT NULL DEFAULT '',
  office VARCHAR(100) NOT NULL DEFAULT '',
  bio TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  INDEX idx_professors_department (department_id),
  INDEX idx_professors_name (name)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS courses (
  id VARCHAR(80) PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  source_url VARCHAR(512) NOT NULL DEFAULT '',
  name VARCHAR(100) NOT NULL,
  department_id VARCHAR(80) NOT NULL,
  credits DECIMAL(3,1) UNSIGNED NULL,
  semester VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  CONSTRAINT chk_courses_credits CHECK (credits BETWEEN 0 AND 10),
  INDEX idx_courses_department (department_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS professor_courses (
  professor_id VARCHAR(80) NOT NULL,
  course_id VARCHAR(80) NOT NULL,
  PRIMARY KEY (professor_id, course_id),
  FOREIGN KEY (professor_id) REFERENCES professors(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'admin') NOT NULL DEFAULT 'student',
  anonymous_seed CHAR(64) NOT NULL,
  session_version INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS password_resets (
  user_id CHAR(36) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  sent_at BIGINT UNSIGNED NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR(128) PRIMARY KEY,
  data JSON NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  INDEX idx_sessions_expiry (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reviews (
  id CHAR(36) PRIMARY KEY,
  professor_id VARCHAR(80) NOT NULL,
  course_id VARCHAR(80) NOT NULL,
  context_key CHAR(64) NOT NULL UNIQUE,
  semester VARCHAR(32) NOT NULL,
  ratings JSON NOT NULL,
  review_text VARCHAR(1000) NOT NULL DEFAULT '',
  tags JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (professor_id) REFERENCES professors(id) ON DELETE RESTRICT,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
  INDEX idx_reviews_professor (professor_id),
  INDEX idx_reviews_course (course_id)
) ENGINE=InnoDB;
