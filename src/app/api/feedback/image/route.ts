export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ATTACHMENT_DIR = path.join(process.cwd(), 'data', 'feedback_attachments');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) {
      return new NextResponse('Invalid ID', { status: 400 });
    }

    if (!fs.existsSync(ATTACHMENT_DIR)) {
      return new NextResponse('Not found', { status: 404 });
    }

    const files = fs.readdirSync(ATTACHMENT_DIR);
    const target = files.find(f => f.startsWith(`${id}.`));

    if (!target) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const ext = target.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      svg: 'image/svg+xml',
    };
    const contentType = mimeTypes[ext || 'jpg'] || 'image/jpeg';

    const fileBuffer = fs.readFileSync(path.join(ATTACHMENT_DIR, target));

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('[GET /api/feedback/image] Error:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
