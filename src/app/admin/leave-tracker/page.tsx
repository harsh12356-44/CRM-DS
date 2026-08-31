import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import LeaveTrackerTab from '@/components/LeaveTrackerTab';

export default function LeaveTrackerPage() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans antialiased text-slate-100 flex flex-col">
      <Navbar currentRole="ADMIN" />
      <div className="flex flex-1">
        <Sidebar currentTab="leave-tracker" />
        <main className="flex-1 p-4 md:p-8 w-full overflow-y-auto overflow-x-hidden">
          <LeaveTrackerTab />
        </main>
      </div>
    </div>
  );
}
