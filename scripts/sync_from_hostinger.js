const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://mediumvioletred-fox-353008.hostingersite.com';

function fetchJson(endpoint) {
  return new Promise((resolve, reject) => {
    https.get(`${BASE_URL}${endpoint}`, {
      headers: {
        'Cookie': 'hrm_user_role=ADMIN; hrm_user_email=digitalsuncityoffice@gmail.com',
        'Cache-Control': 'no-cache'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${endpoint}: ${e.message} (Raw: ${data.slice(0, 100)})`));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('🔄 Fetching complete live database snapshot from Hostinger...');

  const [employeesRes, leavesRes, attendanceRes, holidaysRes, deptsRes, auditRes, settingsRes] = await Promise.all([
    fetchJson('/api/employees'),
    fetchJson('/api/leaves'),
    fetchJson('/api/attendance'),
    fetchJson('/api/holidays'),
    fetchJson('/api/departments'),
    fetchJson('/api/audit-logs'),
    fetchJson('/api/settings')
  ]);

  const employees = employeesRes.employees || (Array.isArray(employeesRes) ? employeesRes : []);
  const leaveRecords = leavesRes.records || (Array.isArray(leavesRes) ? leavesRes : []);
  const attendanceLogs = attendanceRes.logs || (Array.isArray(attendanceRes) ? attendanceRes : []);
  const holidays = holidaysRes.holidays || (Array.isArray(holidaysRes) ? holidaysRes : []);
  const departments = deptsRes.departments || (Array.isArray(deptsRes) ? deptsRes : []);
  const auditLogs = auditRes.auditLogs || (Array.isArray(auditRes) ? auditRes : []);
  const settings = settingsRes.settings || settingsRes || {};

  console.log(`✅ Ingested:`);
  console.log(`   - Employees: ${employees.length}`);
  console.log(`   - Leave Records: ${leaveRecords.length}`);
  console.log(`   - Attendance Logs: ${attendanceLogs.length}`);
  console.log(`   - Holidays: ${holidays.length}`);
  console.log(`   - Departments: ${departments.length}`);
  console.log(`   - Audit Logs: ${auditLogs.length}`);

  const fullDb = {
    employees,
    leaveRecords,
    attendanceLogs,
    settings,
    payrollPreviews: [],
    holidays,
    auditLogs,
    attendanceImports: [],
    notifications: [],
    departments
  };

  const backupsDir = path.join(process.cwd(), 'data', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupsDir, `live_hostinger_full_backup_${timestamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(fullDb, null, 2), 'utf8');
  console.log(`💾 Saved immutable backup to: ${backupFile}`);

  const localDbFile = path.join(process.cwd(), 'data', 'db.json');
  fs.writeFileSync(localDbFile, JSON.stringify(fullDb, null, 2), 'utf8');
  console.log(`💾 Synchronized local data/db.json with all ${attendanceLogs.length} attendance records and ${leaveRecords.length} leaves!`);
}

main().catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
