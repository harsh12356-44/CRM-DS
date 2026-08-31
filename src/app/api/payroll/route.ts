import { NextResponse } from 'next/server';
import { getDbData, saveDbData, logAudit } from '@/lib/store';
import { PayrollPreview } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get('month')) || 7;
  const year = Number(searchParams.get('year')) || 2026;

  const db = getDbData();

  // Auto-generate or calculate payroll previews for month/year if not generated
  const previews: PayrollPreview[] = db.employees.map(emp => {
    const existing = db.payrollPreviews.find(
      p => p.employeeId === emp.id && p.month === month && p.year === year
    );

    if (existing) return existing;

    // Calculate default payroll values based on monthly salary (standard 160 required hours)
    const effectiveSalary = emp.monthlySalary > 0 ? emp.monthlySalary : 60000;
    const requiredHours = 160;
    const creditedHours = 152; // 8 short hours mock
    const shortHours = Math.max(0, requiredHours - creditedHours);
    const hourlyRate = Math.round((effectiveSalary / requiredHours) * 100) / 100;
    const estimatedDeduction = Math.round(hourlyRate * shortHours * 100) / 100;
    const missingPunches = emp.id === 'emp-3' ? 1 : 0;

    return {
      id: `pay-${emp.id}-${month}-${year}`,
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department,
      month,
      year,
      monthlySalary: effectiveSalary,
      requiredHours,
      creditedHours,
      shortHours,
      hourlyRate,
      estimatedDeduction,
      missingPunches,
      status: missingPunches > 0 ? 'Needs Attendance Review' : 'Ready for Payroll',
      hrComment: '',
    };
  });

  return NextResponse.json({ month, year, previews });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payrollId, status, hrComment } = body;
    const db = getDbData();

    const index = db.payrollPreviews.findIndex(p => p.id === payrollId);
    if (index !== -1) {
      db.payrollPreviews[index].status = status || 'Finalized';
      if (hrComment !== undefined) db.payrollPreviews[index].hrComment = hrComment;
      logAudit('Finalize Payroll', 'PayrollPreview', payrollId, undefined, JSON.stringify(db.payrollPreviews[index]));
      saveDbData(db);
      return NextResponse.json({ success: true, preview: db.payrollPreviews[index] });
    }

    // Save newly calculated item
    db.payrollPreviews.push(body);
    logAudit('Create Payroll Record', 'PayrollPreview', body.id, undefined, JSON.stringify(body));
    saveDbData(db);

    return NextResponse.json({ success: true, preview: body });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error processing payroll' }, { status: 500 });
  }
}
