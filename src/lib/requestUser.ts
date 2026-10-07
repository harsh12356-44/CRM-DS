import { Employee } from './types';

export interface RequestUser {
  role: string;
  id: string;
  email: string;
}

function readCookie(cookieHeader: string, name: string): string {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

// Identity comes from the cookies set by /api/auth/login.
export function getRequestUser(request: Request): RequestUser {
  const cookieHeader = request.headers.get('cookie') || '';
  return {
    role: readCookie(cookieHeader, 'hrm_user_role'),
    id: readCookie(cookieHeader, 'hrm_user_id'),
    email: readCookie(cookieHeader, 'hrm_user_email').toLowerCase(),
  };
}

export function findRequestEmployee(user: RequestUser, employees: Employee[]): Employee | undefined {
  return employees.find(e =>
    (user.id && e.id === user.id) ||
    (user.email && (e.email || '').toLowerCase().trim() === user.email)
  );
}

export function isSameEmployee(user: RequestUser, emp?: Employee): boolean {
  if (!emp) return false;
  return Boolean(
    (user.id && emp.id === user.id) ||
    (user.email && (emp.email || '').toLowerCase().trim() === user.email)
  );
}

// Mirrors how the leave approval flow links employees to their managers (by name).
export function isManagerOf(manager: Employee | undefined, emp: Employee): boolean {
  if (!manager?.name) return false;
  const name = manager.name.toLowerCase().trim();
  return [emp.primaryManager, emp.secondaryManager, emp.reportingManager, emp.managerName, emp.manager1]
    .some(m => (m || '').toLowerCase().trim() === name);
}

// Self, HR admins, and the employee's own managers may view tracker data (time + screenshots).
export function canViewEmployee(user: RequestUser, viewer: Employee | undefined, emp: Employee): boolean {
  if (user.role === 'ADMIN') return true;
  if (isSameEmployee(user, emp)) return true;
  return isManagerOf(viewer, emp);
}
