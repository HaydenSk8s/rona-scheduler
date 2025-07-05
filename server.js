// scheduler-backend/server.js
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Initialize SQLite DB
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT,
    weekStartDate TEXT,
    department TEXT DEFAULT 'customer_service',
    UNIQUE(weekStartDate, department)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT,
    department TEXT DEFAULT 'customer_service',
    UNIQUE(department)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT,
    department TEXT DEFAULT 'customer_service',
    UNIQUE(department)
  )`);

  // --- MIGRATION: Add unique constraints if missing ---
  db.get("PRAGMA table_info(schedule)", (err, row) => {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_week_dept ON schedule(weekStartDate, department)`);
  });
  db.get("PRAGMA table_info(availability)", (err, row) => {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_availability_dept ON availability(department)`);
  });
  db.get("PRAGMA table_info(employees)", (err, row) => {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_dept ON employees(department)`);
  });
});

// --- Delete old weeks whose Saturday is before today ---
function deleteOldWeeks() {
  const today = new Date();
  today.setHours(0,0,0,0);
  db.all('SELECT weekStartDate FROM schedule', (err, rows) => {
    if (err) {
      console.error('Error fetching weeks:', err);
      return;
    }
    rows.forEach(row => {
      const weekStart = new Date(row.weekStartDate);
      weekStart.setHours(0,0,0,0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // Saturday
      const isSunday = (weekStart.getDay() === 0);
      console.log(`[CLEANUP] Checking weekStartDate: ${row.weekStartDate} (isSunday: ${isSunday}, weekEnd: ${weekEnd.toISOString().slice(0,10)}, today: ${today.toISOString().slice(0,10)})`);
      if (!isSunday) {
        db.run('DELETE FROM schedule WHERE weekStartDate = ?', [row.weekStartDate], function(err) {
          if (err) console.error('[CLEANUP] Error deleting non-Sunday week:', row.weekStartDate, err);
          else console.log('[CLEANUP] Deleted non-Sunday week:', row.weekStartDate);
        });
      } else if (weekEnd < today) {
        db.run('DELETE FROM schedule WHERE weekStartDate = ?', [row.weekStartDate], function(err) {
          if (err) console.error('[CLEANUP] Error deleting old week:', row.weekStartDate, err);
          else console.log('[CLEANUP] Deleted old week:', row.weekStartDate);
        });
      } else {
        console.log(`[CLEANUP] Keeping week: ${row.weekStartDate}`);
      }
    });
  });
}

deleteOldWeeks();

// --- ONE-TIME MIGRATION: Add department column and unique constraints if missing ---
function runMigrations() {
  // Add department column if missing
  db.all("PRAGMA table_info(schedule)", (err, columns) => {
    if (!columns.some(col => col.name === 'department')) {
      db.run("ALTER TABLE schedule ADD COLUMN department TEXT DEFAULT 'customer_service'", (err) => {
        if (err) console.error('[MIGRATION] Failed to add department to schedule:', err);
        else console.log('[MIGRATION] Added department column to schedule');
      });
    }
  });
  db.all("PRAGMA table_info(employees)", (err, columns) => {
    if (!columns.some(col => col.name === 'department')) {
      db.run("ALTER TABLE employees ADD COLUMN department TEXT DEFAULT 'customer_service'", (err) => {
        if (err) console.error('[MIGRATION] Failed to add department to employees:', err);
        else console.log('[MIGRATION] Added department column to employees');
      });
    }
  });
  db.all("PRAGMA table_info(availability)", (err, columns) => {
    if (!columns.some(col => col.name === 'department')) {
      db.run("ALTER TABLE availability ADD COLUMN department TEXT DEFAULT 'customer_service'", (err) => {
        if (err) console.error('[MIGRATION] Failed to add department to availability:', err);
        else console.log('[MIGRATION] Added department column to availability');
      });
    }
  });
  // Add unique indexes if missing
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_week_dept ON schedule(weekStartDate, department)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_availability_dept ON availability(department)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_dept ON employees(department)`);
}

runMigrations();

// --- SCHEDULE ENDPOINTS ---
// Get schedule for a specific week and department
app.get('/api/schedule', (req, res) => {
  const week = req.query.week;
  const department = req.query.department || 'customer_service';
  if (!week) return res.status(400).json({ error: 'Missing week parameter' });
  db.get('SELECT data FROM schedule WHERE weekStartDate = ? AND department = ?', [week, department], (err, row) => {
    if (err) return res.status(500).json({error: err.message});
    res.json(row ? JSON.parse(row.data) : { schedules: {}, weekStartDate: week });
  });
});
// Save schedule for a specific week and department (upsert)
app.post('/api/schedule', (req, res) => {
  const { weekStartDate, schedules, department } = req.body;
  const dept = department || 'customer_service';
  if (!weekStartDate) return res.status(400).json({ error: 'Missing weekStartDate' });
  const data = JSON.stringify({ schedules, weekStartDate });
  db.run(
    `INSERT INTO schedule (data, weekStartDate, department) VALUES (?, ?, ?)
     ON CONFLICT(weekStartDate, department) DO UPDATE SET data=excluded.data`,
    [data, weekStartDate, dept],
    function(err) {
      if (err) return res.status(500).json({error: err.message});
      res.json({success: true});
    }
  );
});
// List all schedule weekStartDates for a department
app.get('/api/schedule/weeks', (req, res) => {
  const department = req.query.department || 'customer_service';
  db.all('SELECT weekStartDate FROM schedule WHERE department = ?', [department], (err, rows) => {
    if (err) return res.status(500).json({error: err.message});
    res.json(rows.map(r => r.weekStartDate));
  });
});
// Delete a schedule by weekStartDate and department
app.delete('/api/schedule', (req, res) => {
  const week = req.query.week;
  const department = req.query.department || 'customer_service';
  if (!week) return res.status(400).json({ error: 'Missing week parameter' });
  db.run('DELETE FROM schedule WHERE weekStartDate = ? AND department = ?', [week, department], function(err) {
    if (err) return res.status(500).json({error: err.message});
    res.json({success: true});
  });
});

// --- AVAILABILITY ENDPOINTS ---
// Get latest availability for a department
app.get('/api/availability', (req, res) => {
  const department = req.query.department || 'customer_service';
  db.get('SELECT data FROM availability WHERE department = ? ORDER BY id DESC LIMIT 1', [department], (err, row) => {
    if (err) return res.status(500).json({error: err.message});
    res.json(row ? JSON.parse(row.data) : {});
  });
});
// Save availability for a department
app.post('/api/availability', (req, res) => {
  const { data, department } = req.body;
  const dept = department || 'customer_service';
  const payload = typeof data === 'string' ? data : JSON.stringify(data || req.body);
  db.run(
    `INSERT INTO availability (data, department) VALUES (?, ?)
     ON CONFLICT(department) DO UPDATE SET data=excluded.data`,
    [payload, dept],
    function(err) {
      if (err) return res.status(500).json({error: err.message});
      res.json({success: true});
    }
  );
});

// --- EMPLOYEES ENDPOINTS ---
// Get latest employees list for a department
app.get('/api/employees', (req, res) => {
  const department = req.query.department || 'customer_service';
  db.get('SELECT data FROM employees WHERE department = ? ORDER BY id DESC LIMIT 1', [department], (err, row) => {
    if (err) return res.status(500).json({error: err.message});
    res.json(row ? JSON.parse(row.data) : []);
  });
});
// Save employees list for a department
app.post('/api/employees', (req, res) => {
  const { data, department } = req.body;
  const dept = department || 'customer_service';
  const payload = typeof data === 'string' ? data : JSON.stringify(data || req.body);
  db.run(
    `INSERT INTO employees (data, department) VALUES (?, ?)
     ON CONFLICT(department) DO UPDATE SET data=excluded.data`,
    [payload, dept],
    function(err) {
      if (err) return res.status(500).json({error: err.message});
      res.json({success: true});
    }
  );
});

// Add a root route for health check / friendly message
app.get('/', (req, res) => {
  res.send('<h2>Rona Scheduler Backend is running! 🚦</h2><p>API endpoints are available at /api/...</p>');
});

app.listen(PORT, () => {
  console.log(`Scheduler backend running on port ${PORT}`);
}); 