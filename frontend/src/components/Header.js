import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Button } from './ui/button';
import { Logo } from './Logo';
import { LanguageSwitcher } from './LanguageSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { 
  Menu, 
  X, 
  User, 
  LogOut, 
  Settings, 
  LayoutDashboard,
  Briefcase,
  History,
  HelpCircle,
  Shield,
  ChevronDown,
  Wallet
} from 'lucide-react';

export function Header() {
  const { user, logout, isAdmin } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const navLinks = user ? [
    { path: '/dashboard', label: t('nav_dashboard'), icon: LayoutDashboard },
    { path: '/portfolios', label: t('nav_portfolios'), icon: Briefcase },
    { path: '/wallet', label: t('nav_wallet'), icon: Wallet },
    { path: '/history', label: t('nav_history'), icon: History },
    { path: '/support', label: t('nav_support'), icon: HelpCircle },
  ] : [
    { path: '/', label: t('nav_home') },
    { path: '/portfolios', label: t('nav_portfolios') },
  ];

  return (
    <header className="sticky top-0 left-0 right-0 z-50 w-full bg-white border-b border-gray-100 shadow-sm">
      <div className="container-premium">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center" data-testid="logo-link">
            <Logo variant="dark" size={36} />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                data-testid={`nav-${link.path.replace('/', '') || 'home'}`}
                className={`px-4 py-2 rounded-sm text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user && isAdmin && (
              <Link
                to="/admin"
                data-testid="nav-admin"
                className={`px-4 py-2 rounded-sm text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/admin')
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Shield className="w-4 h-4 inline mr-1" />
                {t('nav_admin')}
              </Link>
            )}
          </nav>

          {/* Right Side */}
          <div className="flex items-center space-x-2">
            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* User Menu / Auth Buttons */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center" data-testid="user-menu">
                    {user.picture ? (
                      <img src={user.picture} alt="" className="w-7 h-7 rounded-full mr-2" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mr-2">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <span className="hidden sm:block max-w-24 truncate">{user.name}</span>
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 text-sm">
                    <p className="font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    {t('nav_dashboard')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="w-4 h-4 mr-2" />
                    {t('nav_settings')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    {t('logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm" data-testid="login-btn">
                    {t('login')}
                  </Button>
                </Link>
                <Link to="/register" className="hidden sm:block">
                  <Button size="sm" className="btn-primary text-sm px-4 py-2" data-testid="register-btn">
                    {t('register')}
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-btn"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 animate-fade-in">
            <nav className="flex flex-col space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-sm text-sm font-medium transition-colors flex items-center ${
                    isActive(link.path)
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {link.icon && <link.icon className="w-4 h-4 mr-2" />}
                  {link.label}
                </Link>
              ))}
              {user && isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-sm text-sm font-medium transition-colors flex items-center ${
                    location.pathname.startsWith('/admin')
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {t('nav_admin')}
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
