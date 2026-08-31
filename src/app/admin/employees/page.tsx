import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import EmployeesTab from '@/components/EmployeesTab';

export default function AdminEmployeesPage() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans antialiased text-slate-100 flex flex-col">
      <Navbar currentRole="ADMIN" />
      <div className="flex flex-1">
        <Sidebar currentTab="employees" />
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto overflow-y-auto">
          <EmployeesTab />
        </main>
      </div>
    </div>
  );
}
