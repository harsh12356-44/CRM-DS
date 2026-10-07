import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import FeedbackAdminTab from '@/components/FeedbackAdminTab';

export default function AdminFeedbackPage() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans antialiased text-slate-100 flex flex-col">
      <Navbar currentRole="ADMIN" />
      <div className="flex flex-1">
        <Sidebar currentTab="feedback" role="ADMIN" />
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto overflow-y-auto min-w-0">
          <FeedbackAdminTab />
        </main>
      </div>
    </div>
  );
}
