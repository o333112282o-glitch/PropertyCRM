import { ReactNode, useState } from 'react';
import {
  Building2,
  LayoutDashboard,
  Users as UsersIcon,
  BarChart3,
  UserCircle,
  LogOut,
  Menu,
  X,
  Briefcase,
  Handshake,
  PlusCircle,
  Bell,
  ScrollText,
  FolderOpen,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/types';
import NotificationCenter from '@/components/NotificationCenter';

export type Page = 'dashboard' | 'leads' | 'analytics' | 'users' | 'projects' | 'profile' | 'dealer-submit' | 'dealer-leads' | 'notifications' | 'activity-logs';

interface LayoutProps {
  children: ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

interface NavItem {
  key: Page;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'manager', 'agent'] },
  { key: 'leads', label: 'Leads', icon: Briefcase, roles: ['super_admin', 'manager', 'agent'] },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, roles: ['super_admin', 'manager'] },
  { key: 'users', label: 'Team', icon: UsersIcon, roles: ['super_admin'] },
  { key: 'projects', label: 'Projects', icon: FolderOpen, roles: ['super_admin'] },
  { key: 'activity-logs', label: 'Activity Logs', icon: ScrollText, roles: ['super_admin'] },
  { key: 'notifications', label: 'Notifications', icon: Bell, roles: ['super_admin', 'manager', 'agent'] },
  { key: 'dealer-submit', label: 'Submit Lead', icon: PlusCircle, roles: ['dealer', 'dealer_manager'] },
  { key: 'dealer-leads', label: 'My Leads', icon: Briefcase, roles: ['dealer', 'dealer_manager'] },
  { key: 'profile', label: 'Profile', icon: UserCircle },
];

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, logout, isSuperAdmin, isManager, isAgent, isDealer } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  const bottomNavItems = visibleItems.slice(0, 5);

  const handleNav = (page: Page) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#1E293B] text-white fixed inset-y-0 left-0 z-30">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#D4AF37] flex items-center justify-center">
            <Building2 size={20} className="text-[#1E293B]" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Property Fy</h1>
            <p className="text-[10px] text-white/50 uppercase tracking-wider">Real Estate CRM</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-[#D4AF37] text-[#1E293B]'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={20} className={active ? 'text-[#1E293B]' : 'text-[#D4AF37]'} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between gap-3 px-3 py-2 mb-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold">
              {user.full_name?.[0] || user.username[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{user.full_name || user.username}</p>
              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold border ${ROLE_COLORS[user.role]}`}>
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            </div>
            <div className="flex-shrink-0">
              <NotificationCenter />
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-red-500/20 transition"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-[#1E293B] text-white flex items-center justify-between px-4 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#D4AF37] flex items-center justify-center">
            <Building2 size={18} className="text-[#1E293B]" />
          </div>
          <span className="text-base font-bold">Property Fy</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationCenter />
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* Mobile slide-out menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-[#1E293B] text-white flex flex-col animate-[slideIn_.2s_ease-out]">
            <div className="flex items-center justify-between px-5 h-14 border-b border-white/10">
              <span className="font-bold">Menu</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-white/10">
                <X size={20} />
              </button>
            </div>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold">
                {user.full_name?.[0] || user.username[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{user.full_name || user.username}</p>
                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold border ${ROLE_COLORS[user.role]}`}>
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNav(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition ${
                      active ? 'bg-[#D4AF37] text-[#1E293B]' : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon size={20} className={active ? 'text-[#1E293B]' : 'text-[#D4AF37]'} />
                    {item.label}
                  </button>
                );
              })}
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-red-500/20 transition"
              >
                <LogOut size={20} />
                Sign Out
              </button>
            </nav>
          </div>
          <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <main className="flex-1 pt-14 lg:pt-0 pb-20 lg:pb-8 px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 shadow-lg">
        <div className="flex items-center justify-around h-16 px-1">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg transition flex-1 ${
                  active ? 'text-[#D4AF37]' : 'text-slate-400'
                }`}
              >
                <Icon size={22} className={active ? 'fill-[#D4AF37]/10' : ''} />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
