import { NextResponse } from 'next/server';

// Server build version timestamp
const SERVER_VERSION = process.env.NEXT_BUILD_ID || Date.now().toString();

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { version: SERVER_VERSION },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}
