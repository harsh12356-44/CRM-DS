import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userRole = request.cookies.get('hrm_user_role')?.value;

  // 1. Unauthenticated users trying to access protected areas
  const isProtectedAdmin = pathname.startsWith('/admin');
  const isProtectedManager = pathname.startsWith('/manager');
  const isProtectedEmployee = pathname.startsWith('/employee');

  if (isProtectedAdmin || isProtectedManager || isProtectedEmployee) {
    if (!userRole) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Role-Based Access Control (RBAC) Enforcement
  // ADMIN has full access to /admin, /manager, and /employee
  // MANAGER has access to /manager and /employee
  // EMPLOYEE has access to /employee
  if (isProtectedAdmin && userRole !== 'ADMIN') {
    const target = userRole === 'MANAGER' ? '/manager' : '/employee';
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (isProtectedManager && userRole !== 'MANAGER' && userRole !== 'ADMIN') {
    return NextResponse.redirect(new URL('/employee', request.url));
  }

  // 3. Authenticated users opening /login -> redirect to their role dashboard
  if (pathname === '/login' && userRole) {
    const target = userRole === 'ADMIN' ? '/admin' : userRole === 'MANAGER' ? '/manager' : '/employee';
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/manager/:path*', '/employee/:path*', '/login'],
};
