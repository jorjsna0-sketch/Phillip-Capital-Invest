import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";

// Providers
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./i18n/LanguageContext";

// Components
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { AuthCallback, ProtectedRoute } from "./components/AuthCallback";
import { MobileLayout } from "./components/MobileLayout";

// Runtime translator — auto-translates hardcoded RU text to TR/EN
import { useRuntimeTranslator } from "./hooks/useRuntimeTranslator";

// Pages
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PortfoliosPage } from "./pages/PortfoliosPage";
import { PortfolioDetailPage } from "./pages/PortfolioDetailPage";
import { InvestPage } from "./pages/InvestPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SupportPage } from "./pages/SupportPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WalletPage } from "./pages/WalletPage";
import { MobileMorePage } from "./pages/MobileMorePage";

// Admin Pages
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminUserDetail } from "./pages/admin/AdminUserDetail";
import { AdminPortfolios } from "./pages/admin/AdminPortfolios";
import { AdminKYC } from "./pages/admin/AdminKYC";
import { AdminWithdrawals } from "./pages/admin/AdminWithdrawals";
import { AdminTickets } from "./pages/admin/AdminTickets";
import { AdminAudit } from "./pages/admin/AdminAudit";
import { AdminEmails } from "./pages/admin/AdminEmails";
import { AdminTemplates } from "./pages/admin/AdminTemplates";
import { AdminSettings } from "./pages/admin/AdminSettings";
import { AdminCompanySettings } from "./pages/admin/AdminCompanySettings";
import { AdminRequests } from "./pages/admin/AdminRequests";
import { AdminPortfolioForm } from "./pages/admin/AdminPortfolioForm";
import { AdminTemplateForm } from "./pages/admin/AdminTemplateForm";
import { AdminEmailTemplates } from "./pages/admin/AdminEmailTemplates";
import { AdminSiteContent } from "./pages/admin/AdminSiteContent";

// Layout wrapper component
function AppLayout({ children }) {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAuthRoute = ['/login', '/register'].includes(location.pathname);
  const isLandingPage = location.pathname === '/';

  // Don't show layout wrapper for admin routes
  if (isAdminRoute) {
    return children;
  }

  // Auth pages - single layout, works for both mobile and desktop
  if (isAuthRoute) {
    return (
      <div className="min-h-screen">
        {children}
      </div>
    );
  }

  // Landing page - desktop layout only (landing has its own mobile handling)
  if (isLandingPage) {
    return (
      <>
        <div className="min-h-screen flex flex-col hide-mobile">
          <Header className="desktop-header" />
          <main className="flex-grow">{children}</main>
          <Footer />
        </div>
        <div className="show-mobile">
          <Header />
          <main>{children}</main>
        </div>
      </>
    );
  }

  // Support page handles its own mobile layout
  const isSupportPage = location.pathname === '/support';
  if (isSupportPage) {
    return (
      <>
        {/* Desktop Layout */}
        <div className="min-h-screen flex flex-col hide-mobile">
          <Header className="desktop-header" />
          <main className="flex-grow">{children}</main>
          <Footer />
        </div>
        
        {/* Mobile - SupportPage renders MobileSupportPage directly */}
        <div className="show-mobile">
          {children}
        </div>
      </>
    );
  }

  // Main app pages - desktop and mobile layouts
  return (
    <>
      {/* Desktop Layout */}
      <div className="min-h-screen flex flex-col hide-mobile">
        <Header className="desktop-header" />
        <main className="flex-grow">{children}</main>
        <Footer />
      </div>
      
      {/* Mobile Layout */}
      <div className="show-mobile">
        <MobileLayout>{children}</MobileLayout>
      </div>
    </>
  );
}

// Router component that handles session_id in URL
function AppRouter() {
  const location = useLocation();
  useRuntimeTranslator();
  
  // Check for session_id in URL hash (OAuth callback)
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <AppLayout>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/portfolios" element={<PortfoliosPage />} />
        <Route path="/portfolio/:portfolioId" element={<PortfolioDetailPage />} />

        {/* Protected User Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/invest/:portfolioId" element={
          <ProtectedRoute>
            <InvestPage />
          </ProtectedRoute>
        } />
        <Route path="/history" element={
          <ProtectedRoute>
            <HistoryPage />
          </ProtectedRoute>
        } />
        <Route path="/support" element={
          <ProtectedRoute>
            <SupportPage />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } />
        <Route path="/wallet" element={
          <ProtectedRoute>
            <WalletPage />
          </ProtectedRoute>
        } />
        <Route path="/more" element={
          <ProtectedRoute>
            <MobileMorePage />
          </ProtectedRoute>
        } />

        {/* Admin Routes */}
        <Route path="/admin" element={
          <ProtectedRoute adminOnly>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:userId" element={<AdminUserDetail />} />
          <Route path="portfolios" element={<AdminPortfolios />} />
          <Route path="portfolios/create" element={<AdminPortfolioForm />} />
          <Route path="portfolios/edit/:portfolioId" element={<AdminPortfolioForm />} />
          <Route path="kyc" element={<AdminKYC />} />
          <Route path="withdrawals" element={<AdminRequests />} />
          <Route path="requests" element={<AdminRequests />} />
          <Route path="tickets" element={<AdminTickets />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="emails" element={<AdminEmails />} />
          <Route path="email-templates" element={<AdminEmailTemplates />} />
          <Route path="templates" element={<AdminTemplates />} />
          <Route path="templates/create" element={<AdminTemplateForm />} />
          <Route path="templates/edit/:templateId" element={<AdminTemplateForm />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="company" element={<AdminCompanySettings />} />
          <Route path="site-content" element={<AdminSiteContent />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </AppLayout>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <AppRouter />
            <Toaster />
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
