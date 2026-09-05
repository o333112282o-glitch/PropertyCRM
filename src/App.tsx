import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import Login from '@/components/Login';
import Layout, { Page } from '@/components/Layout';
import Dashboard from '@/components/Dashboard';
import Leads from '@/components/Leads';
import Analytics from '@/components/Analytics';
import UserManagement from '@/components/UserManagement';
import ProjectsManagement from '@/components/ProjectsManagement';
import Profile from '@/components/Profile';
import DealerDashboard from '@/components/DealerDashboard';
import NotificationsPage from '@/components/NotificationsPage';
import ActivityLogsPage from '@/components/ActivityLogsPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [deepLinkLeadId, setDeepLinkLeadId] = useState<string | null>(null);

  // Listen for deep-link navigation from PWA push notifications
  useEffect(() => {
    const handler = (e: Event) => {
      const leadId = (e as CustomEvent<string>).detail;
      setDeepLinkLeadId(leadId);
      setPage('leads');
    };
    window.addEventListener('open-lead-detail', handler as EventListener);
    return () => window.removeEventListener('open-lead-detail', handler as EventListener);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 border-3 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const handleNavigate = (p: Page) => {
    if (p === 'analytics' && user.role === 'agent') return;
    if (p === 'users' && user.role !== 'super_admin') return;
    if (p === 'projects' && user.role !== 'super_admin') return;
    if (p === 'activity-logs' && user.role !== 'super_admin') return;
    if (p === 'dashboard' && (user.role === 'dealer' || user.role === 'dealer_manager')) {
      setPage('dealer-submit');
      return;
    }
    setPage(p);
  };

  // Dealer & Dealer Manager routing
  if (user.role === 'dealer' || user.role === 'dealer_manager') {
    return (
      <Layout currentPage={page} onNavigate={handleNavigate}>
        {page === 'dealer-submit' && <DealerDashboard mode="submit" />}
        {page === 'dealer-leads' && <DealerDashboard mode="leads" deepLinkLeadId={deepLinkLeadId} onDeepLinkConsumed={() => setDeepLinkLeadId(null)} />}
        {page === 'profile' && <Profile />}
      </Layout>
    );
  }

  return (
    <Layout currentPage={page} onNavigate={handleNavigate}>
      {page === 'dashboard' && <Dashboard onNavigate={(p) => setPage(p as Page)} />}
      {page === 'leads' && <Leads deepLinkLeadId={deepLinkLeadId} onDeepLinkConsumed={() => setDeepLinkLeadId(null)} />}
      {page === 'analytics' && <Analytics />}
      {page === 'users' && <UserManagement />}
      {page === 'projects' && <ProjectsManagement />}
      {page === 'activity-logs' && <ActivityLogsPage />}
      {page === 'notifications' && <NotificationsPage />}
      {page === 'profile' && <Profile />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
