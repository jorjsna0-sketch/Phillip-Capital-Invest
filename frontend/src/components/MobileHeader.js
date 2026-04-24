import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { 
  Menu, 
  X,
  LogOut,
  Settings,
  Shield,
  History,
  HelpCircle,
  ChevronLeft,
  User
} from 'lucide-react';

export function MobileHeader({ title, showBack = false, showMenu = true }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  
  const isAdmin = user?.role === 'admin';
  
  const getTierColor = (tier) => {
    switch (tier) {
      case 'platinum': return 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800';
      case 'gold': return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white';
      default: return 'bg-gradient-to-r from-gray-400 to-gray-500 text-white';
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Haptic feedback
  const triggerHaptic = () => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  return (
    <header 
      className="bg-white border-b border-gray-100 flex-shrink-0"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      data-testid="mobile-header"
    >
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left section */}
        <div className="flex items-center gap-3">
          {showBack ? (
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-1 -ml-1"
              onClick={() => {
                triggerHaptic();
                navigate(-1);
              }}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          ) : (
            <Link to="/dashboard" className="flex items-center gap-2" onClick={triggerHaptic}>
              <img 
                src="/icons/icon-72x72.png" 
                alt="AltynContract" 
                className="w-8 h-8 rounded-lg"
              />
            </Link>
          )}
          
          {title ? (
            <h1 className="text-lg font-semibold text-gray-900 truncate max-w-[180px]">
              {title}
            </h1>
          ) : (
            <div>
              <p className="text-xs text-gray-500">{t('mobile_greeting')}</p>
              <p className="text-sm font-semibold text-gray-900 truncate max-w-[140px]">
                {user?.name?.split(' ')[0] || t('mobile_investor')}
              </p>
            </div>
          )}
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Tier Badge */}
          {user?.tier && !title && (
            <Badge className={`${getTierColor(user.tier)} text-[10px] px-2 py-0.5`}>
              {user.tier.toUpperCase()}
            </Badge>
          )}
          
          {/* Notifications */}
          {/* Menu */}
          {showMenu && (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-2"
                  onClick={triggerHaptic}
                >
                  {menuOpen ? (
                    <X className="w-5 h-5 text-gray-600" />
                  ) : (
                    <Menu className="w-5 h-5 text-gray-600" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2 border-b">
                  <p className="font-medium text-sm">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                
                <DropdownMenuItem onClick={() => { triggerHaptic(); navigate('/history'); }}>
                  <History className="w-4 h-4 mr-3" />
                  {t('nav_history')}
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => { triggerHaptic(); navigate('/support'); }}>
                  <HelpCircle className="w-4 h-4 mr-3" />
                  {t('nav_support')}
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => { triggerHaptic(); navigate('/settings'); }}>
                  <Settings className="w-4 h-4 mr-3" />
                  {t('nav_settings')}
                </DropdownMenuItem>
                
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { triggerHaptic(); navigate('/admin'); }}>
                      <Shield className="w-4 h-4 mr-3" />
                      {t('nav_admin')}
                    </DropdownMenuItem>
                  </>
                )}
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  className="text-red-600 focus:text-red-600" 
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}

export default MobileHeader;
