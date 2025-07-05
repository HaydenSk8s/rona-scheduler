// migrate_department_columns.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

function migrateTable(table, columns, unique, cb) {
  const tempTable = `${table}_new`;
  const oldCols = columns.filter(c => c !== 'department').join(', ');
  const newCols = columns.join(', ');
  const colDefs = columns.map(c =>
    c === 'department'
      ? `department TEXT DEFAULT 'customer_service'`
      : c === 'id'
        ? 'id INTEGER PRIMARY KEY AUTOINCREMENT'
        : c === 'data'
          ? 'data TEXT'
          : 'weekStartDate TEXT'
  );
  const uniqueDef = unique ? `, UNIQUE(${unique})` : '';
  db.serialize(() => {
    db.run(`DROP TABLE IF EXISTS ${tempTable}`);
    db.run(`CREATE TABLE IF NOT EXISTS ${tempTable} (${colDefs.join(', ')}${uniqueDef})`);
    db.all(`SELECT * FROM ${table}`, (err, rows) => {
      if (err) throw err;
      const insert = db.prepare(`INSERT INTO ${tempTable} (${newCols}) VALUES (${columns.map(() => '?').join(', ')})`);
      rows.forEach(row => {
        const vals = columns.map(c =>
          c === 'department' ? 'customer_service' : row[c]
        );
        insert.run(vals);
      });
      insert.finalize(() => {
        db.run(`DROP TABLE ${table}`);
        db.run(`ALTER TABLE ${tempTable} RENAME TO ${table}`);
        // Drop any old indexes that might conflict
        if (table === 'schedule') db.run('DROP INDEX IF EXISTS idx_schedule_week_dept');
        if (table === 'employees') db.run('DROP INDEX IF EXISTS idx_employees_dept');
        if (table === 'availability') db.run('DROP INDEX IF EXISTS idx_availability_dept');
        cb();
      });
    });
  });
}

function migrate() {
  migrateTable('schedule', ['id', 'data', 'weekStartDate', 'department'], 'weekStartDate, department', () => {
    migrateTable('employees', ['id', 'data', 'department'], 'department', () => {
      migrateTable('availability', ['id', 'data', 'department'], 'department', () => {
        console.log('Migration complete! You can now restart your backend.');
        db.close();
      });
    });
  });
}

migrate(); 