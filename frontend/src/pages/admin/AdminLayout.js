import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../../components/ui/button';
import { 
  LayoutDashboard,
  Users,
  Briefcase,
  Shield,
  Wallet,
  MessageCircle,
  FileText,
  Mail,
  Settings,
  Building,
  ChevronLeft,
  Menu,
  Globe
} from 'lucide-react';

export function AdminLayout() {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard');
    }
  }, [isAdmin, navigate]);

  const menuItems = [
    { path: '/admin', label: t('admin_dashboard'), icon: LayoutDashboard, exact: true },
    { path: '/admin/users', label: t('admin_users'), icon: Users },
    { path: '/admin/portfolios', label: t('admin_portfolios'), icon: Briefcase },
    { path: '/admin/kyc', label: t('admin_kyc'), icon: Shield },
    { path: '/admin/withdrawals', label: 'Заявки', icon: Wallet },
    { path: '/admin/tickets', label: t('admin_tickets'), icon: MessageCircle },
    { path: '/admin/audit', label: t('admin_audit'), icon: FileText },
    { path: '/admin/emails', label: t('admin_emails'), icon: Mail },
    { path: '/admin/templates', label: t('admin_templates'), icon: FileText },
    { path: '/admin/company', label: 'Компания', icon: Building },
    { path: '/admin/site-content', label: 'Контент сайта', icon: Globe },
    { path: '/admin/settings', label: t('admin_settings'), icon: Settings },
  ];

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex" data-testid="admin-layout">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-primary text-primary-foreground transition-all duration-300 flex flex-col`}>
        <div className="p-4 flex items-center justify-between border-b border-primary-foreground/10">
          {sidebarOpen && (
            <Link to="/admin" className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-sm bg-white flex items-center justify-center">
                <span className="text-primary font-heading font-bold text-lg">A</span>
              </div>
              <span className="font-heading font-semibold">Admin</span>
            </Link>
          )}
          <Button 
            variant="ghost" 
            size="sm"
            className="text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>
        
        <nav className="flex-1 py-4">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-3 text-sm transition-colors ${
                isActive(item.path, item.exact)
                  ? 'bg-primary-foreground/20 border-r-2 border-amber-400'
                  : 'hover:bg-primary-foreground/10'
              }`}
              data-testid={`admin-nav-${item.path.replace('/admin/', '') || 'dashboard'}`}
            >
              <item.icon className="w-5 h-5" />
              {sidebarOpen && <span className="ml-3">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-primary-foreground/10">
          <Link to="/dashboard">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ChevronLeft className="w-4 h-4" />
              {sidebarOpen && <span className="ml-2">Выйти из админки</span>}
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
