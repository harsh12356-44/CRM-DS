import { Employee } from './types';

export interface RequestUser {
  role: string;
  id: string;
  email: string;
  companyId: string;
}

function readCookie(cookieHeader: string, name: string): string {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

// Identity comes from cookies or custom headers set by client
export function getRequestUser(request: Request): RequestUser {
  const cookieHeader = request.headers.get('cookie') || '';
  const role = (readCookie(cookieHeader, 'hrm_user_role') || request.headers.get('x-user-role') || '').trim();
  const id = (readCookie(cookieHeader, 'hrm_user_id') || request.headers.get('x-user-id') || '').trim();
  const email = (readCookie(cookieHeader, 'hrm_user_email') || request.headers.get('x-user-email') || '').toLowerCase().trim();
  const companyId = (readCookie(cookieHeader, 'hrm_user_company') || request.headers.get('x-user-company') || 'company-main').trim();

  return {
    role,
    id,
    email,
    companyId,
  };
}

export function isAdmin(user: RequestUser, emp?: Employee): boolean {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
  if (emp && (emp.role === 'SUPER_ADMIN' || emp.role === 'ADMIN')) return true;
  if (emp && (emp.department?.toLowerCase() === 'human resources' || emp.designation?.toLowerCase().includes('hr'))) return true;
  return false;
}

export function isSuperAdmin(user: RequestUser): boolean {
  return user.role === 'SUPER_ADMIN';
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
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
  if (isSameEmployee(user, emp)) return true;
  return isManagerOf(viewer, emp);
}
