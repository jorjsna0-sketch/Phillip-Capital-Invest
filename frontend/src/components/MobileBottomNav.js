import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  LayoutDashboard, 
  Briefcase, 
  Wallet, 
  User,
  MoreHorizontal
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'nav_dashboard', key: 'dashboard' },
  { path: '/portfolios', icon: Briefcase, label: 'nav_portfolios', key: 'portfolios' },
  { path: '/wallet', icon: Wallet, label: 'nav_wallet', key: 'wallet' },
  { path: '/settings', icon: User, label: 'nav_profile', key: 'profile' },
  { path: '/more', icon: MoreHorizontal, label: 'nav_more', key: 'more' }
];

export function MobileBottomNav() {
  const location = useLocation();
  const { t } = useLanguage();
  
  const isActive = (path) => {
    // "More" is active for history and support pages
    if (path === '/more') {
      return location.pathname === '/more' || 
             location.pathname.startsWith('/history') || 
             location.pathname.startsWith('/support');
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };
  
  // Haptic feedback
  const triggerHaptic = () => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  return (
    <nav 
      className="bg-white border-t border-gray-200 flex-shrink-0"
      data-testid="mobile-bottom-nav"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.key}
              to={item.path}
              onClick={triggerHaptic}
              className={`flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-xl transition-all duration-200 ${
                active 
                  ? 'text-primary' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              data-testid={`mobile-nav-${item.key}`}
            >
              <div className={`relative p-1.5 rounded-xl transition-all duration-200 ${
                active ? 'bg-primary/10' : ''
              }`}>
                <Icon className={`w-5 h-5 transition-transform duration-200 ${
                  active ? 'scale-110' : ''
                }`} />
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium transition-all duration-200 ${
                active ? 'opacity-100' : 'opacity-70'
              }`}>
                {t(item.label)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomNav;
