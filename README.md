# LearnOn — Online Learning Platform with Adaptive Content

A runnable VS Code project based on the supplied DBMS report. It keeps the report's nine core database entities and adds `Lesson_Progress` plus login credentials to support a working web demonstration.

## Technology
- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js + Express REST API
- Database: MySQL 8.0+
- Authentication: bcrypt password hashing + JWT session token
- Adaptive rules: score below 50% = REVISION; 50% to below 80% = PRACTICE; 80% or above = ADVANCED

## Requirements
Install Node.js 18+ and MySQL Server 8.0+. MySQL Workbench is recommended but optional. Open this whole folder in VS Code.

## 1. Create the database
1. Start the MySQL server.
2. Open MySQL Workbench and connect to your local server.
3. Open `database/schema.sql` and execute the full script (lightning icon).
4. The script creates `OnlineLearningDB`, the tables, sample courses, lessons, quizzes, questions and the `Course_Progress_Summary` view.

## 2. Configure the app
In the project root, copy `.env.example` to a new file named `.env`. Set `DB_USER` and `DB_PASSWORD` to your local MySQL credentials. Leave `DB_NAME=OnlineLearningDB` unless you also change the database name in MySQL.

Example for a typical local MySQL setup:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_mysql_password
DB_NAME=OnlineLearningDB
JWT_SECRET=use_a_long_random_secret_here
```
Do not commit `.env` to GitHub.

## 3. Install and run
Open the VS Code terminal in the project root (the folder containing `package.json`) and run:
```bash
npm install
npm start
```
When the terminal says `LearnOn is running at http://localhost:3000`, open that address in your browser. Do not open `index.html` directly or use Live Server; Express serves the frontend and API together.

## Demo account
- Email: `demo@learnon.com`
- Password: `LearnOn@123`

The server creates the demo learner automatically at first start. You can also create a learner using **Create account**. If you have previously inserted a demo account manually without a password hash, delete that learner row or change its email before starting.

## Included functionality
- Registration and sign-in
- Course catalog and course enrollment
- Lesson reading and completion tracking
- Progress dashboard
- Multiple-choice quizzes and automatic scoring
- Database-stored adaptive recommendations
- Course summary report from the SQL view
- SQL constraints, foreign keys, unique enrollment, sample data and report queries

## Project layout
```text
LEARNON/
├── backend/
│   └── src/
│       ├── db.js
│       └── server.js
├── database/
│   └── schema.sql
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Troubleshooting
- **Cannot connect to MySQL:** ensure MySQL service is running and `.env` has the correct credentials.
- **Unknown database/table:** execute `database/schema.sql` in MySQL Workbench.
- **`npm` is not recognized:** install Node.js LTS, restart VS Code, and run `node -v` and `npm -v`.
- **Port 3000 in use:** change `PORT=3001` in `.env` and open `http://localhost:3001`.
- **Demo login fails:** confirm the server started successfully and check the terminal for SQL errors.

## Notes
This is an academic prototype, not a production deployment. Recommendation categories use the report's explicit score thresholds; they are rule-based, not a trained AI model. Use a strong JWT secret and HTTPS before any real deployment.
