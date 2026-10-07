import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import TimeTrackingAdmin from '@/components/TimeTrackingAdmin';

export default function AdminTimeTrackingPage() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans antialiased text-slate-100 flex flex-col">
      <Navbar currentRole="ADMIN" />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto overflow-y-auto min-w-0">
          <TimeTrackingAdmin />
        </main>
      </div>
    </div>
  );
}
