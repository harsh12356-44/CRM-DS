import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import PayrollTab from '@/components/PayrollTab';

export default function AdminPayrollPage() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans antialiased text-slate-100 flex flex-col">
      <Navbar currentRole="ADMIN" />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto overflow-y-auto">
          <PayrollTab />
        </main>
      </div>
    </div>
  );
}
