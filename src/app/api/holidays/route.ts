import { NextResponse } from 'next/server';
import { getDbData, saveDbData, logAudit } from '@/lib/store';
import { Holiday } from '@/lib/types';

export const dynamic = 'force-dynamic';

const OFFICIAL_2026_HOLIDAYS: Holiday[] = [
  { id: 'h-2026-01', name: 'New Year', date: '2026-01-01', isOptional: false },
  { id: 'h-2026-02', name: 'Republic Day', date: '2026-01-26', isOptional: false },
  { id: 'h-2026-03', name: 'Holi', date: '2026-03-04', isOptional: false },
  { id: 'h-2026-04', name: 'Independence Day', date: '2026-08-15', isOptional: false },
  { id: 'h-2026-05', name: 'Raksha Bandhan', date: '2026-08-28', isOptional: false },
  { id: 'h-2026-06', name: 'Diwali', date: '2026-11-08', isOptional: false },
  { id: 'h-2026-07', name: 'Diwali (Rama Shama)', date: '2026-11-09', isOptional: false },
  { id: 'h-2026-08', name: 'Christmas', date: '2026-12-25', isOptional: false },
];

export async function GET() {
  const db = getDbData();

  // Ensure all 8 official 2026 holidays exist in DB
  OFFICIAL_2026_HOLIDAYS.forEach((official) => {
    const exists = db.holidays.some((h) => h.date === official.date || h.name.toLowerCase() === official.name.toLowerCase());
    if (!exists) {
      db.holidays.push(official);
    }
  });

  return NextResponse.json(db.holidays);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = getDbData();

    // 1. Bulk Import Holidays from spreadsheet (.csv, .xls, .xlsx)
    if (body.action === 'BULK_IMPORT') {
      const rows = body.rows || [];
      const importedHolidays: Holiday[] = [];

      if (Array.isArray(rows) && rows.length > 0) {
        rows.forEach((row: any) => {
          if (!row) return;

          let name =
            row['Holiday Name'] ||
            row['Name'] ||
            row.name ||
            row.HolidayName ||
            row.Title ||
            row['title'];

          let date =
            row['Holiday Date'] ||
            row['Date'] ||
            row.date ||
            row.HolidayDate ||
            row.dateStr;

          if (!name || !date) {
            const vals = Object.values(row).filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
            if (vals.length >= 2) {
              name = name || String(vals[0]);
              date = date || String(vals[1]);
            }
          }

          const isOptional = Boolean(row.isOptional || row.Optional || row['Is Optional'] || row.optional);

          if (name && date) {
            let formattedDate = String(date).trim();
            if (formattedDate.includes('/')) {
              const parts = formattedDate.split('/');
              if (parts.length === 3) {
                if (parts[2].length === 4) {
                  formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
              }
            }

            const newHoliday: Holiday = {
              id: `h-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              name: String(name).trim(),
              date: formattedDate,
              isOptional,
            };

            db.holidays.push(newHoliday);
            importedHolidays.push(newHoliday);
          }
        });
      }

      logAudit('Import Holidays List', 'Holiday', `count-${importedHolidays.length}`, undefined, `${importedHolidays.length} holidays imported`);
      saveDbData(db);

      return NextResponse.json({
        success: true,
        message: `Successfully imported ${importedHolidays.length} holidays into calendar!`,
        importedCount: importedHolidays.length,
        holidays: db.holidays,
      });
    }

    // 2. Single Holiday Addition
    const { name, date, isOptional } = body;
    if (!name || !date) {
      return NextResponse.json({ error: 'Name and date are required' }, { status: 400 });
    }

    const newHoliday: Holiday = {
      id: `h-${Date.now()}`,
      name,
      date,
      isOptional: Boolean(isOptional),
    };

    db.holidays.push(newHoliday);
    logAudit('Add Holiday', 'Holiday', newHoliday.id, undefined, JSON.stringify(newHoliday));
    saveDbData(db);

    return NextResponse.json({ success: true, holiday: newHoliday, holidays: db.holidays });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error adding holiday' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Holiday ID required' }, { status: 400 });
    }

    const db = getDbData();
    const index = db.holidays.findIndex((h) => h.id === id);

    if (index !== -1) {
      const deletedHoliday = db.holidays[index];
      db.holidays.splice(index, 1);
      logAudit('Delete Holiday', 'Holiday', id, JSON.stringify(deletedHoliday), undefined);
      saveDbData(db);
      return NextResponse.json({ success: true, message: `Holiday ${deletedHoliday.name} deleted`, holidays: db.holidays });
    }

    return NextResponse.json({ error: 'Holiday not found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error deleting holiday' }, { status: 500 });
  }
}
