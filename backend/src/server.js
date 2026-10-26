const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const pool = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-before-deployment';
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../../frontend')));

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Your session has expired. Please sign in again.' }); }
}
function asyncRoute(fn) { return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); }

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'connected', app: 'LearnOn' });
}));

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8)
    return res.status(400).json({ error: 'Enter your name, a valid email and a password of at least 8 characters.' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const [result] = await pool.execute('INSERT INTO Learners (full_name,email,password_hash,joined_on) VALUES (?,?,?,CURRENT_DATE)', [name,email,hash]);
    const token = jwt.sign({ learnerId: result.insertId, name, email }, JWT_SECRET, { expiresIn: '12h' });
    res.status(201).json({ token, user: { learnerId: result.insertId, name, email } });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'An account with this email already exists.' });
    throw e;
  }
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const [rows] = await pool.execute('SELECT learner_id,full_name,email,password_hash FROM Learners WHERE email=?', [email]);
  if (!rows.length || !rows[0].password_hash || !(await bcrypt.compare(password, rows[0].password_hash)))
    return res.status(401).json({ error: 'Incorrect email or password.' });
  const u = rows[0];
  const token = jwt.sign({ learnerId: u.learner_id, name: u.full_name, email: u.email }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { learnerId: u.learner_id, name: u.full_name, email: u.email } });
}));

app.get('/api/me', auth, asyncRoute(async (req, res) => {
  const [[u]] = await pool.execute('SELECT learner_id,full_name,email,joined_on FROM Learners WHERE learner_id=?', [req.user.learnerId]);
  if (!u) return res.status(404).json({ error: 'Learner account not found.' });
  res.json({ learnerId: u.learner_id, name: u.full_name, email: u.email, joinedOn: u.joined_on });
}));

app.get('/api/courses', asyncRoute(async (_req, res) => {
  const [rows] = await pool.query(`SELECT c.course_id,c.title,c.description,c.category,c.duration_hours,c.level,i.full_name AS instructor,
    COUNT(DISTINCT le.lesson_id) AS lesson_count FROM Courses c JOIN Instructors i ON i.instructor_id=c.instructor_id
    LEFT JOIN Lessons le ON le.course_id=c.course_id GROUP BY c.course_id ORDER BY c.course_id`);
  res.json(rows);
}));

app.post('/api/courses/:id/enroll', auth, asyncRoute(async (req, res) => {
  const courseId = Number(req.params.id);
  if (!Number.isInteger(courseId) || courseId < 1) return res.status(400).json({ error: 'Invalid course.' });
  try {
    await pool.execute('INSERT INTO Enrollments (learner_id,course_id,enrolled_on,progress_percent,status) VALUES (?,?,CURRENT_DATE,0,\'ACTIVE\')', [req.user.learnerId, courseId]);
    res.status(201).json({ message: 'You are enrolled in this course.' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'You are already enrolled in this course.' });
    if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(404).json({ error: 'Course not found.' });
    throw e;
  }
}));

app.get('/api/dashboard', auth, asyncRoute(async (req, res) => {
  const id = req.user.learnerId;
  const [[stats]] = await pool.execute(`SELECT COUNT(*) AS enrolled, SUM(status='COMPLETED') AS completed,
    ROUND(AVG(progress_percent),0) AS avgProgress FROM Enrollments WHERE learner_id=?`, [id]);
  const [courses] = await pool.execute(`SELECT c.course_id,c.title,c.category,c.level,c.duration_hours,e.progress_percent,e.status,
    (SELECT COUNT(*) FROM Lessons l WHERE l.course_id=c.course_id) AS lesson_count,
    (SELECT COUNT(*) FROM Lesson_Progress lp JOIN Lessons l2 ON l2.lesson_id=lp.lesson_id WHERE lp.learner_id=e.learner_id AND l2.course_id=c.course_id AND lp.completed=1) AS completed_lessons
    FROM Enrollments e JOIN Courses c ON c.course_id=e.course_id WHERE e.learner_id=? ORDER BY e.enrollment_id DESC`, [id]);
  res.json({ stats: { enrolled: stats.enrolled || 0, completed: stats.completed || 0, avgProgress: stats.avgProgress || 0 }, courses });
}));

app.get('/api/courses/:id/lessons', auth, asyncRoute(async (req, res) => {
  const courseId = Number(req.params.id), learnerId = req.user.learnerId;
  const [[enrollment]] = await pool.execute('SELECT enrollment_id FROM Enrollments WHERE learner_id=? AND course_id=? AND status<>\'DROPPED\'', [learnerId,courseId]);
  if (!enrollment) return res.status(403).json({ error: 'Enroll in this course before opening lessons.' });
  const [lessons] = await pool.execute(`SELECT l.lesson_id,l.course_id,l.lesson_order,l.title,l.description,l.content,l.content_level,
    COALESCE(lp.completed,0) AS completed,a.assessment_id,a.title AS assessment_title
    FROM Lessons l LEFT JOIN Lesson_Progress lp ON lp.lesson_id=l.lesson_id AND lp.learner_id=?
    LEFT JOIN Assessments a ON a.lesson_id=l.lesson_id WHERE l.course_id=? ORDER BY l.lesson_order,a.assessment_id`, [learnerId,courseId]);
  const unique = [...new Map(lessons.map(x => [x.lesson_id,x])).values()];
  res.json(unique);
}));

app.post('/api/lessons/:id/complete', auth, asyncRoute(async (req, res) => {
  const lessonId = Number(req.params.id), learnerId = req.user.learnerId;
  const [[lesson]] = await pool.execute('SELECT lesson_id,course_id FROM Lessons WHERE lesson_id=?', [lessonId]);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });
  const [[enrollment]] = await pool.execute('SELECT enrollment_id FROM Enrollments WHERE learner_id=? AND course_id=? AND status<>\'DROPPED\'', [learnerId,lesson.course_id]);
  if (!enrollment) return res.status(403).json({ error: 'Enroll in this course first.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`INSERT INTO Lesson_Progress (learner_id,lesson_id,completed,completed_on) VALUES (?,?,1,NOW())
      ON DUPLICATE KEY UPDATE completed=1,completed_on=NOW()`, [learnerId,lessonId]);
    const [[counts]] = await conn.execute(`SELECT COUNT(*) AS total,SUM(COALESCE(lp.completed,0)) AS done FROM Lessons l
      LEFT JOIN Lesson_Progress lp ON lp.lesson_id=l.lesson_id AND lp.learner_id=? WHERE l.course_id=?`, [learnerId,lesson.course_id]);
    const percent = counts.total ? Math.round((Number(counts.done || 0) / Number(counts.total))*10000)/100 : 0;
    await conn.execute(`UPDATE Enrollments SET progress_percent=?,status=? WHERE learner_id=? AND course_id=?`, [percent,percent>=100?'COMPLETED':'ACTIVE',learnerId,lesson.course_id]);
    await conn.commit(); res.json({ message: 'Lesson marked complete.', progressPercent: percent });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

app.get('/api/assessments/:id', auth, asyncRoute(async (req, res) => {
  const assessmentId = Number(req.params.id);
  const [[a]] = await pool.execute(`SELECT a.assessment_id,a.title,a.max_marks,l.course_id FROM Assessments a JOIN Lessons l ON l.lesson_id=a.lesson_id WHERE a.assessment_id=?`, [assessmentId]);
  if (!a) return res.status(404).json({ error: 'Assessment not found.' });
  const [[enrollment]] = await pool.execute('SELECT enrollment_id FROM Enrollments WHERE learner_id=? AND course_id=?', [req.user.learnerId,a.course_id]);
  if (!enrollment) return res.status(403).json({ error: 'Enroll in this course first.' });
  const [questions] = await pool.execute('SELECT question_id,question_text,option_a,option_b,option_c,option_d,max_marks FROM Questions WHERE assessment_id=? ORDER BY question_id', [assessmentId]);
  res.json({ ...a, questions });
}));

app.post('/api/assessments/:id/submit', auth, asyncRoute(async (req, res) => {
  const assessmentId = Number(req.params.id), answers = req.body.answers;
  if (!Array.isArray(answers) || !answers.length) return res.status(400).json({ error: 'Submit at least one answer.' });
  const [[assessment]] = await pool.execute(`SELECT a.assessment_id,a.title,l.course_id FROM Assessments a JOIN Lessons l ON l.lesson_id=a.lesson_id WHERE a.assessment_id=?`, [assessmentId]);
  if (!assessment) return res.status(404).json({ error: 'Assessment not found.' });
  const [[enrollment]] = await pool.execute('SELECT enrollment_id FROM Enrollments WHERE learner_id=? AND course_id=?', [req.user.learnerId,assessment.course_id]);
  if (!enrollment) return res.status(403).json({ error: 'Enroll in this course first.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let score = 0, maxScore = 0;
    for (const ans of answers) {
      const qid = Number(ans.questionId), selected = String(ans.selectedOption || '').toUpperCase();
      if (!['A','B','C','D'].includes(selected)) continue;
      const [[q]] = await conn.execute('SELECT question_id,correct_option,max_marks FROM Questions WHERE question_id=? AND assessment_id=?', [qid,assessmentId]);
      if (!q) continue;
      const marks = selected === q.correct_option ? Number(q.max_marks) : 0;
      score += marks; maxScore += Number(q.max_marks);
      await conn.execute('INSERT INTO Learner_Responses (learner_id,question_id,selected_option,marks_awarded,attempted_on) VALUES (?,?,?,?,NOW())', [req.user.learnerId,qid,selected,marks]);
    }
    if (!maxScore) { await conn.rollback(); return res.status(400).json({ error: 'No valid answers were received.' }); }
    const percent = Math.round(score/maxScore*10000)/100;
    const type = percent < 50 ? 'REVISION' : percent < 80 ? 'PRACTICE' : 'ADVANCED';
    const reason = percent < 50 ? 'Your score suggests revisiting the lesson fundamentals.' : percent < 80 ? 'You understand some concepts; extra practice will strengthen them.' : 'Strong performance: try more challenging content next.';
    await conn.execute('INSERT INTO Content_Recommendations (learner_id,course_id,recommendation_type,reason,created_on) VALUES (?,?,?,?,CURRENT_DATE)', [req.user.learnerId,assessment.course_id,type,reason]);
    await conn.commit();
    res.json({ score, maxScore, percent, recommendationType: type, reason, message: 'Assessment submitted successfully.' });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

app.get('/api/recommendations', auth, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(`SELECT cr.recommendation_id,cr.recommendation_type,cr.reason,cr.created_on,c.course_id,c.title AS course_title
    FROM Content_Recommendations cr JOIN Courses c ON c.course_id=cr.course_id WHERE cr.learner_id=? ORDER BY cr.recommendation_id DESC LIMIT 20`, [req.user.learnerId]);
  const [fallback] = await pool.execute(`SELECT e.course_id,c.title AS course_title,e.progress_percent,
    CASE WHEN e.progress_percent<40 THEN 'REVISION' WHEN e.progress_percent<80 THEN 'PRACTICE' ELSE 'ADVANCED' END AS recommendation_type,
    CASE WHEN e.progress_percent<40 THEN 'Your course progress is low. Review the lessons and revisit key concepts.' WHEN e.progress_percent<80 THEN 'Continue lessons and complete practice activities to improve mastery.' ELSE 'Your progress is strong. Try the next challenge or review advanced topics.' END AS reason
    FROM Enrollments e JOIN Courses c ON c.course_id=e.course_id WHERE e.learner_id=? AND NOT EXISTS (SELECT 1 FROM Content_Recommendations cr WHERE cr.learner_id=e.learner_id AND cr.course_id=e.course_id)`, [req.user.learnerId]);
  res.json([...rows, ...fallback]);
}));

app.get('/api/reports/course-summary', auth, asyncRoute(async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM Course_Progress_Summary ORDER BY title');
  res.json(rows);
}));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 'ER_BAD_DB_ERROR' || err.code === 'ER_NO_SUCH_TABLE') return res.status(500).json({ error: 'Database is not initialized. Run database/schema.sql in MySQL Workbench, then restart the server.' });
  res.status(500).json({ error: 'Something went wrong on the server. Check the terminal for details.' });
});

async function start() {
  try {
    await pool.query('SELECT 1');
    // Demo account is created at startup if it does not already exist.
    const email = 'demo@learnon.com';
    const [found] = await pool.execute('SELECT learner_id FROM Learners WHERE email=?', [email]);
    if (!found.length) {
      const hash = await bcrypt.hash('LearnOn@123', 10);
      await pool.execute('INSERT INTO Learners (full_name,email,password_hash,joined_on) VALUES (?,?,?,CURRENT_DATE)', ['Demo Learner',email,hash]);
    }
    app.listen(PORT, () => console.log(`\nLearnOn is running at http://localhost:${PORT}\nDatabase: ${process.env.DB_NAME || 'OnlineLearningDB'}\nDemo login: demo@learnon.com / LearnOn@123\n`));
  } catch (e) {
    console.error('\nUnable to connect to MySQL. Check that MySQL is running and .env has the correct credentials.');
    console.error(e.message);
    process.exit(1);
  }
}
start();
