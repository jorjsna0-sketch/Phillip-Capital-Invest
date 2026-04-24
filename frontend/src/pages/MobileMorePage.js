import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  History,
  Shield,
  LogOut,
  ChevronRight,
  User,
  Award,
  MessageSquare
} from 'lucide-react';

export function MobileMorePage() {
  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const getTierColor = (tier) => {
    switch (tier) {
      case 'platinum': return 'from-gray-400 to-gray-600';
      case 'gold': return 'from-yellow-400 to-amber-600';
      default: return 'from-gray-400 to-gray-500';
    }
  };
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/history', icon: History, label: language === 'ru' ? 'История' : 'History', color: 'bg-blue-100 text-blue-600' },
    { path: '/settings', icon: User, label: language === 'ru' ? 'Профиль' : 'Profile', color: 'bg-emerald-100 text-emerald-600' },
    { path: '/support', icon: MessageSquare, label: language === 'ru' ? 'Поддержка' : 'Support', color: 'bg-purple-100 text-purple-600' },
  ];

  return (
    <div className="h-full flex flex-col" data-testid="mobile-more-page">
      {/* User Card */}
      <div className="p-3 flex-shrink-0">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              {user?.picture ? (
                <img src={user.picture} alt="" className="w-12 h-12 rounded-full" />
              ) : (
                <User className="w-7 h-7 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900 truncate">{user?.name}</h2>
              <p className="text-sm text-gray-500 truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r ${getTierColor(user?.tier)} text-white flex items-center gap-1`}>
                  <Award className="w-3 h-3" />
                  {user?.tier?.toUpperCase() || 'SILVER'}
                </span>
                {user?.account_number && (
                  <span className="text-xs text-gray-400">№ {user.account_number}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto px-3 space-y-2">
        {menuItems.map((item, idx) => (
          <Link
            key={idx}
            to={item.path}
            className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3"
          >
            <div className={`w-9 h-9 rounded-lg ${item.color} flex items-center justify-center`}>
              <item.icon className="w-4 h-4" />
            </div>
            <span className="flex-1 font-medium text-sm">{item.label}</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        ))}

        {/* Admin Link */}
        {user?.role === 'admin' && (
          <Link to="/admin" className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <span className="flex-1 font-medium text-sm">{language === 'ru' ? 'Админ панель' : 'Admin Panel'}</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        )}

        {/* Logout */}
        <button onClick={handleLogout} className="w-full bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 text-red-600">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
            <LogOut className="w-4 h-4" />
          </div>
          <span className="font-medium text-sm">{language === 'ru' ? 'Выйти' : 'Logout'}</span>
        </button>
      </div>

      {/* App Version */}
      <div className="p-3 text-center flex-shrink-0">
        <p className="text-xs text-gray-400">Phillip Capital Invest v1.0.0</p>
      </div>
    </div>
  );
}

export default MobileMorePage;
