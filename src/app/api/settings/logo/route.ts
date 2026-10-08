export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDbData, saveDbDataAsync, ensureCloudSync } from '@/lib/store';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');
const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  gif: 'image/gif',
};

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function findExistingLogoFile(): { filename: string; ext: string; filePath: string } | null {
  if (!fs.existsSync(UPLOAD_DIR)) return null;
  const files = fs.readdirSync(UPLOAD_DIR);
  const logoFile = files.find(f => f.startsWith('company_logo.'));
  if (!logoFile) return null;
  const ext = logoFile.split('.').pop()?.toLowerCase() || 'png';
  return {
    filename: logoFile,
    ext,
    filePath: path.join(UPLOAD_DIR, logoFile),
  };
}

function removeExistingLogoFiles() {
  if (!fs.existsSync(UPLOAD_DIR)) return;
  const files = fs.readdirSync(UPLOAD_DIR);
  for (const f of files) {
    if (f.startsWith('company_logo.')) {
      try {
        fs.unlinkSync(path.join(UPLOAD_DIR, f));
      } catch (e) {
        console.warn('[logo] Could not unlink prior logo file:', e);
      }
    }
  }
}

// GET: Serve the active company logo
export async function GET() {
  try {
    const existing = findExistingLogoFile();
    if (existing && fs.existsSync(existing.filePath)) {
      const fileBuffer = fs.readFileSync(existing.filePath);
      const contentType = MIME_TYPES[existing.ext] || 'image/png';
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      });
    }

    // Fallback: check if db.settings.companyLogoUrl contains an embedded data URL
    const db = getDbData();
    const storedUrl = db.settings?.companyLogoUrl;
    if (storedUrl && storedUrl.startsWith('data:image/')) {
      const match = storedUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (match) {
        const ext = match[1].toLowerCase();
        const buffer = Buffer.from(match[2], 'base64');
        const contentType = MIME_TYPES[ext] || `image/${ext}`;
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    }

    return new NextResponse('Logo not found', { status: 404 });
  } catch (error) {
    console.error('[GET /api/settings/logo] Error:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

// POST: Upload a new company logo (FormData or JSON Base64)
export async function POST(request: Request) {
  try {
    await ensureCloudSync();
    ensureUploadDir();

    let buffer: Buffer | null = null;
    let ext = 'png';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = (formData.get('file') || formData.get('logo')) as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
      }

      const originalName = file.name || 'logo.png';
      const fileExt = originalName.split('.').pop()?.toLowerCase();
      if (fileExt && ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(fileExt)) {
        ext = fileExt;
      } else if (file.type) {
        const typeMatch = file.type.split('/')[1]?.toLowerCase();
        if (typeMatch && ['png', 'jpeg', 'jpg', 'webp', 'svg+xml', 'gif'].includes(typeMatch)) {
          ext = typeMatch === 'svg+xml' ? 'svg' : typeMatch === 'jpeg' ? 'jpg' : typeMatch;
        }
      }

      const bytes = await file.arrayBuffer();
      if (bytes.byteLength > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image file exceeds maximum 5 MB limit' }, { status: 400 });
      }

      buffer = Buffer.from(bytes);
    } else {
      // JSON payload
      const body = await request.json();
      const { imageBase64, imageName } = body;

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
      }

      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');

      if (buffer.length > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image exceeds maximum 5 MB limit' }, { status: 400 });
      }

      if (imageName && typeof imageName === 'string') {
        const nameExt = imageName.split('.').pop()?.toLowerCase();
        if (nameExt && ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(nameExt)) {
          ext = nameExt;
        }
      } else if (imageBase64.startsWith('data:image/')) {
        const match = imageBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
        if (match) {
          const typeMatch = match[1].toLowerCase();
          ext = typeMatch === 'svg+xml' ? 'svg' : typeMatch === 'jpeg' ? 'jpg' : typeMatch;
        }
      }
    }

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: 'Empty file payload' }, { status: 400 });
    }

    // Clean prior logos and write new file
    removeExistingLogoFiles();
    const targetFilename = `company_logo.${ext}`;
    const targetFilePath = path.join(UPLOAD_DIR, targetFilename);

    let logoUrl = `/api/settings/logo?v=${Date.now()}`;
    try {
      fs.writeFileSync(targetFilePath, buffer);
    } catch (e) {
      console.warn('[logo] File write to disk failed (e.g. read-only env), saving data URL fallback:', e);
      // Fallback: store data URL directly
      const mime = MIME_TYPES[ext] || 'image/png';
      logoUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    }

    // Update settings in database
    const db = getDbData();
    if (!db.settings) {
      db.settings = {
        companyName: 'HRM Pilot',
        companyLogoUrl: '',
        shiftStartTime: '09:00',
        lunchBreakMinutes: 60,
        halfDayThresholdMinutes: 240,
        loginUrl: '/login',
        employeePortalUrl: '/employee',
        managerPortalUrl: '/manager',
      };
    }

    db.settings.companyLogoUrl = logoUrl;
    await saveDbDataAsync(db);

    return NextResponse.json({
      success: true,
      companyLogoUrl: logoUrl,
      message: 'Company logo uploaded and updated successfully.',
    });
  } catch (error: unknown) {
    console.error('[POST /api/settings/logo] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload logo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Remove the custom logo and revert to default
export async function DELETE() {
  try {
    await ensureCloudSync();
    removeExistingLogoFiles();

    const db = getDbData();
    if (db.settings) {
      db.settings.companyLogoUrl = '';
    }
    await saveDbDataAsync(db);

    return NextResponse.json({
      success: true,
      message: 'Company logo removed successfully.',
    });
  } catch (error: unknown) {
    console.error('[DELETE /api/settings/logo] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete logo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
