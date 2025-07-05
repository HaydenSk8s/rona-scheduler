// scheduler-backend/server.js
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Serve static files (frontend)
app.use(express.static('.'));

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Database tables are created manually in Supabase dashboard
// No initialization needed as tables already exist

// --- Delete old weeks whose Saturday is before today ---
async function deleteOldWeeks() {
  try {
    const { data: rows, error } = await supabase
      .from('schedule')
      .select('weekStartDate');

    if (error) {
      console.error('Error fetching weeks:', error);
      return;
    }

    for (const row of rows || []) {
      const weekStart = new Date(row.weekStartDate);
      weekStart.setHours(0,0,0,0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // Saturday
      const isSunday = (weekStart.getDay() === 0);
      console.log(`[CLEANUP] Checking weekStartDate: ${row.weekStartDate} (isSunday: ${isSunday}, weekEnd: ${weekEnd.toISOString().slice(0,10)}, today: ${new Date().toISOString().slice(0,10)})`);
      
      if (!isSunday) {
        await supabase
          .from('schedule')
          .delete()
          .eq('weekStartDate', row.weekStartDate);
        console.log('[CLEANUP] Deleted non-Sunday week:', row.weekStartDate);
      } else if (weekEnd < new Date()) {
        await supabase
          .from('schedule')
          .delete()
          .eq('weekStartDate', row.weekStartDate);
        console.log('[CLEANUP] Deleted old week:', row.weekStartDate);
      } else {
        console.log(`[CLEANUP] Keeping week: ${row.weekStartDate}`);
      }
    }
  } catch (error) {
    console.error('Error deleting old weeks:', error);
  }
}

deleteOldWeeks();

// --- SCHEDULE ENDPOINTS ---
// Get schedule for a specific week and department
app.get('/api/schedule', async (req, res) => {
  const week = req.query.week;
  const department = req.query.department || 'customer_service';
  if (!week) return res.status(400).json({ error: 'Missing week parameter' });

  try {
    const { data, error } = await supabase
      .from('schedule')
      .select('data')
      .eq('weekStartDate', week)
      .eq('department', department)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({error: error.message});
    }

    res.json(data ? JSON.parse(data.data) : { schedules: {}, weekStartDate: week });
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Save schedule for a specific week and department (upsert)
app.post('/api/schedule', async (req, res) => {
  const { weekStartDate, schedules, department } = req.body;
  const dept = department || 'customer_service';
  if (!weekStartDate) return res.status(400).json({ error: 'Missing weekStartDate' });

  const data = JSON.stringify({ schedules, weekStartDate });

  try {
    const { error } = await supabase
      .from('schedule')
      .upsert({
        data: data,
        weekStartDate: weekStartDate,
        department: dept
      }, {
        onConflict: 'weekStartDate,department'
      });

    if (error) return res.status(500).json({error: error.message});
    res.json({success: true});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// List all schedule weekStartDates for a department
app.get('/api/schedule/weeks', async (req, res) => {
  const department = req.query.department || 'customer_service';
  
  try {
    const { data, error } = await supabase
      .from('schedule')
      .select('weekStartDate')
      .eq('department', department);

    if (error) return res.status(500).json({error: error.message});
    res.json(data.map(r => r.weekStartDate));
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Delete a schedule by weekStartDate and department
app.delete('/api/schedule', async (req, res) => {
  const week = req.query.week;
  const department = req.query.department || 'customer_service';
  if (!week) return res.status(400).json({ error: 'Missing week parameter' });
  
  try {
    const { error } = await supabase
      .from('schedule')
      .delete()
      .eq('weekStartDate', week)
      .eq('department', department);

    if (error) return res.status(500).json({error: error.message});
    res.json({success: true});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// --- AVAILABILITY ENDPOINTS ---
// Get latest availability for a department
app.get('/api/availability', async (req, res) => {
  const department = req.query.department || 'customer_service';
  
  try {
    const { data, error } = await supabase
      .from('availability')
      .select('data')
      .eq('department', department)
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({error: error.message});
    }
    
    res.json(data ? JSON.parse(data.data) : {});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Save availability for a department
app.post('/api/availability', async (req, res) => {
  const { data, department } = req.body;
  const dept = department || 'customer_service';
  const payload = typeof data === 'string' ? data : JSON.stringify(data || req.body);
  
  try {
    const { error } = await supabase
      .from('availability')
      .upsert({
        data: payload,
        department: dept
      }, {
        onConflict: 'department'
      });

    if (error) return res.status(500).json({error: error.message});
    res.json({success: true});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// --- EMPLOYEES ENDPOINTS ---
// Get latest employees list for a department
app.get('/api/employees', async (req, res) => {
  const department = req.query.department || 'customer_service';
  
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('data')
      .eq('department', department)
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({error: error.message});
    }
    
    res.json(data ? JSON.parse(data.data) : []);
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Save employees list for a department
app.post('/api/employees', async (req, res) => {
  const { data, department } = req.body;
  const dept = department || 'customer_service';
  const payload = typeof data === 'string' ? data : JSON.stringify(data || req.body);
  
  try {
    const { error } = await supabase
      .from('employees')
      .upsert({
        data: payload,
        department: dept
      }, {
        onConflict: 'department'
      });

    if (error) return res.status(500).json({error: error.message});
    res.json({success: true});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Static file serving will automatically serve index.html for the root route

app.listen(PORT, () => {
  console.log(`Scheduler backend running on port ${PORT}`);
}); 