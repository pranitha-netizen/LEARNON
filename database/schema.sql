-- LearnOn: Online Learning Platform with Adaptive Content
-- MySQL 8.0+. Run this file in MySQL Workbench before starting the app.
CREATE DATABASE IF NOT EXISTS OnlineLearningDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE OnlineLearningDB;

CREATE TABLE IF NOT EXISTS Learners (
  learner_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  joined_on DATE NOT NULL DEFAULT (CURRENT_DATE)
);
CREATE TABLE IF NOT EXISTS Instructors (
  instructor_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS Courses (
  course_id INT AUTO_INCREMENT PRIMARY KEY,
  instructor_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  category VARCHAR(60) NOT NULL,
  duration_hours INT NOT NULL DEFAULT 4,
  level VARCHAR(30) NOT NULL DEFAULT 'Beginner',
  FOREIGN KEY (instructor_id) REFERENCES Instructors(instructor_id)
);
CREATE TABLE IF NOT EXISTS Lessons (
  lesson_id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  lesson_order INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  content TEXT,
  content_level VARCHAR(20) NOT NULL DEFAULT 'BEGINNER',
  UNIQUE (course_id, lesson_order),
  FOREIGN KEY (course_id) REFERENCES Courses(course_id) ON DELETE CASCADE,
  CHECK (lesson_order > 0)
);
CREATE TABLE IF NOT EXISTS Enrollments (
  enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
  learner_id INT NOT NULL,
  course_id INT NOT NULL,
  enrolled_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (learner_id, course_id),
  FOREIGN KEY (learner_id) REFERENCES Learners(learner_id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES Courses(course_id) ON DELETE CASCADE,
  CHECK (progress_percent BETWEEN 0 AND 100),
  CHECK (status IN ('ACTIVE','COMPLETED','DROPPED'))
);
CREATE TABLE IF NOT EXISTS Lesson_Progress (
  progress_id INT AUTO_INCREMENT PRIMARY KEY,
  learner_id INT NOT NULL,
  lesson_id INT NOT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  completed_on DATETIME NULL,
  UNIQUE (learner_id, lesson_id),
  FOREIGN KEY (learner_id) REFERENCES Learners(learner_id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES Lessons(lesson_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS Assessments (
  assessment_id INT AUTO_INCREMENT PRIMARY KEY,
  lesson_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  max_marks DECIMAL(5,2) NOT NULL DEFAULT 10,
  FOREIGN KEY (lesson_id) REFERENCES Lessons(lesson_id) ON DELETE CASCADE,
  CHECK (max_marks > 0)
);
CREATE TABLE IF NOT EXISTS Questions (
  question_id INT AUTO_INCREMENT PRIMARY KEY,
  assessment_id INT NOT NULL,
  question_text VARCHAR(500) NOT NULL,
  option_a VARCHAR(255) NOT NULL,
  option_b VARCHAR(255) NOT NULL,
  option_c VARCHAR(255) NOT NULL,
  option_d VARCHAR(255) NOT NULL,
  correct_option CHAR(1) NOT NULL,
  max_marks DECIMAL(5,2) NOT NULL DEFAULT 2,
  FOREIGN KEY (assessment_id) REFERENCES Assessments(assessment_id) ON DELETE CASCADE,
  CHECK (correct_option IN ('A','B','C','D')),
  CHECK (max_marks > 0)
);
CREATE TABLE IF NOT EXISTS Learner_Responses (
  response_id INT AUTO_INCREMENT PRIMARY KEY,
  learner_id INT NOT NULL,
  question_id INT NOT NULL,
  selected_option CHAR(1) NULL,
  marks_awarded DECIMAL(5,2) NOT NULL DEFAULT 0,
  attempted_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (learner_id) REFERENCES Learners(learner_id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES Questions(question_id) ON DELETE CASCADE,
  CHECK (marks_awarded >= 0)
);
CREATE TABLE IF NOT EXISTS Content_Recommendations (
  recommendation_id INT AUTO_INCREMENT PRIMARY KEY,
  learner_id INT NOT NULL,
  course_id INT NOT NULL,
  recommendation_type VARCHAR(20) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  created_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  FOREIGN KEY (learner_id) REFERENCES Learners(learner_id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES Courses(course_id) ON DELETE CASCADE,
  CHECK (recommendation_type IN ('REVISION','PRACTICE','ADVANCED'))
);

INSERT IGNORE INTO Instructors (instructor_id, full_name, email) VALUES
(1, 'Meera Krishnan', 'meera@example.com'), (2, 'Arun Kumar', 'arun@example.com');
INSERT IGNORE INTO Courses (course_id, instructor_id, title, description, category, duration_hours, level) VALUES
(1, 1, 'Database Fundamentals', 'Learn relational databases, keys, normalization and SQL queries.', 'Computer Science', 6, 'Beginner'),
(2, 2, 'Python Programming', 'Build programming foundations with variables, conditions and functions.', 'Programming', 8, 'Beginner'),
(3, 1, 'Web Development Basics', 'Understand HTML, CSS and the foundations of interactive websites.', 'Web Development', 5, 'Beginner');
INSERT IGNORE INTO Lessons (lesson_id, course_id, lesson_order, title, description, content, content_level) VALUES
(1,1,1,'Introduction to DBMS','Understand databases and DBMS concepts.','A database stores related information in an organized way. A DBMS lets users create, read, update and delete data. Examples include MySQL and PostgreSQL.','BEGINNER'),
(2,1,2,'Keys and Relationships','Explore primary keys and foreign keys.','A primary key uniquely identifies a row. A foreign key references a key in another table and helps preserve referential integrity.','BEGINNER'),
(3,1,3,'SQL Queries and Joins','Retrieve related data using SQL.','SELECT retrieves rows. WHERE filters them. JOIN combines related tables using matching columns. GROUP BY summarizes rows.','INTERMEDIATE'),
(4,2,1,'Python Basics','Learn variables, data types and output.','Variables refer to values. Common types include integers, floats, strings and booleans. Use print() to display output.','BEGINNER'),
(5,2,2,'Conditions and Loops','Control program flow.','if/elif/else selects a branch. for and while loops repeat operations. Indentation defines Python code blocks.','BEGINNER'),
(6,3,1,'HTML Structure','Create the structure of a web page.','HTML uses elements such as headings, paragraphs, links and forms to structure web content.','BEGINNER'),
(7,3,2,'CSS Styling','Style page layouts and components.','CSS controls colors, typography, spacing and layout. Flexbox and Grid are common layout systems.','INTERMEDIATE');
INSERT IGNORE INTO Assessments (assessment_id, lesson_id, title, max_marks) VALUES (1,1,'DBMS Basics Quiz',10),(2,2,'Keys and Relationships Quiz',10),(3,4,'Python Basics Quiz',10),(4,6,'HTML Basics Quiz',10);
INSERT IGNORE INTO Questions (question_id, assessment_id, question_text, option_a, option_b, option_c, option_d, correct_option, max_marks) VALUES
(1,1,'What does DBMS stand for?','Data Backup Management System','Database Management System','Digital Base Memory Service','Data Build Machine Software','B',2),
(2,1,'Which command retrieves data from a table?','GET','OPEN','SELECT','FETCH TABLE','C',2),
(3,1,'Which key uniquely identifies each row?','Foreign key','Primary key','Duplicate key','Search key','B',2),
(4,1,'Which SQL clause filters rows?','ORDER BY','GROUP BY','WHERE','JOIN','C',2),
(5,1,'What does a foreign key help maintain?','Text formatting','Referential integrity','Page styling','Sorting only','B',2),
(6,2,'Which key uniquely identifies a record?','Primary key','Foreign key','Optional key','Repeated key','A',2),
(7,2,'Which constraint prevents duplicate values?','CHECK','UNIQUE','DEFAULT','INDEX only','B',2),
(8,2,'Which JOIN returns matching rows from both tables?','INNER JOIN','CROSS JOIN','FULL TEXT','NO JOIN','A',2),
(9,2,'Which clause groups aggregate results?','WHERE','GROUP BY','LIMIT','VALUES','B',2),
(10,2,'Which constraint links a child row to a parent row?','FOREIGN KEY','UNIQUE','NOT NULL','DEFAULT','A',2),
(11,3,'Which function displays output in Python?','echo()','write()','print()','show()','C',2),
(12,3,'Which symbol starts a Python comment?','//','#','<!--','**','B',2),
(13,3,'Which type stores text?','int','float','str','bool','C',2),
(14,3,'Which keyword starts a condition?','when','if','select','caseof','B',2),
(15,3,'Which loop iterates over a sequence?','for','switch','define','class','A',2),
(16,4,'What is HTML mainly used for?','Database storage','Web page structure','Network routing','Image editing','B',2),
(17,4,'Which tag represents the largest standard heading?','<h6>','<head>','<h1>','<title>','C',2),
(18,4,'Which tag creates a hyperlink?','<linkto>','<a>','<href>','<url>','B',2),
(19,4,'What does CSS control?','Page styling','SQL storage','Server hardware','Email delivery','A',2),
(20,4,'Which attribute provides alternate text for an image?','src','href','alt','class','C',2);
CREATE OR REPLACE VIEW Course_Progress_Summary AS
SELECT c.course_id, c.title, COUNT(e.enrollment_id) AS enrolled_learners,
       ROUND(AVG(e.progress_percent),2) AS average_progress
FROM Courses c LEFT JOIN Enrollments e ON e.course_id=c.course_id
GROUP BY c.course_id,c.title;
