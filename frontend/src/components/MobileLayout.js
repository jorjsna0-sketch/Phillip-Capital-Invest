import React from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileHeader } from './MobileHeader';

// Pages that should show mobile navigation
const MOBILE_NAV_PAGES = [
  '/dashboard',
  '/portfolios',
  '/portfolio',
  '/wallet',
  '/history',
  '/settings',
  '/support',
  '/more'
];

// Pages with custom headers (title, showBack)
// Uses i18n keys instead of hardcoded strings
// titleKey: null means show logo + user greeting (for dashboard)
const PAGE_CONFIG = {
  '/dashboard': { titleKey: null, showBack: false },
  '/portfolios': { titleKey: 'nav_portfolios', showBack: false },
  '/wallet': { titleKey: 'nav_wallet', showBack: false },
  '/history': { titleKey: 'nav_history', showBack: true },
  '/support': { titleKey: 'nav_support', showBack: true },
  '/settings': { titleKey: 'nav_settings', showBack: true },
  '/more': { titleKey: 'nav_more', showBack: false },
  '/invest': { titleKey: 'invest_now', showBack: true },
  '/portfolio': { titleKey: 'nav_portfolios', showBack: true }
};

export function MobileLayout({ children }) {
  const location = useLocation();
  const { t } = useLanguage();
  const pathname = location.pathname;
  
  // Check if we should show mobile nav
  const showMobileNav = MOBILE_NAV_PAGES.some(page => 
    pathname === page || pathname.startsWith(page + '/')
  );
  
  // Get page config
  const pageConfig = Object.entries(PAGE_CONFIG).find(([path]) => 
    pathname === path || pathname.startsWith(path + '/')
  )?.[1] || { titleKey: null, showBack: false };
  
  // Translate title if key exists
  const title = pageConfig.titleKey ? t(pageConfig.titleKey) : null;
  
  // Hide mobile layout on admin pages and auth pages
  const isAdminPage = pathname.startsWith('/admin');
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/';
  
  if (isAdminPage || isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="mobile-layout md:hidden" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f9fafb',
      overflow: 'hidden'
    }}>
      {/* Mobile Header - Fixed at top */}
      <div style={{ flexShrink: 0, zIndex: 40 }}>
        <MobileHeader 
          title={title} 
          showBack={pageConfig.showBack}
        />
      </div>
      
      {/* Main Content - Scrollable area */}
      <main style={{
        flex: '1 1 0%',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain'
      }}>
        {children}
      </main>
      
      {/* Bottom Navigation - Fixed at bottom */}
      {showMobileNav && (
        <div style={{ 
          flexShrink: 0, 
          zIndex: 40,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}>
          <MobileBottomNav />
        </div>
      )}
    </div>
  );
}

export default MobileLayout;
