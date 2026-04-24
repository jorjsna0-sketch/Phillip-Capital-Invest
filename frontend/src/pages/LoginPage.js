import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Mail, Lock, Loader2, Smartphone, ArrowLeft } from 'lucide-react';
import { Logo } from '../components/Logo';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export function LoginPage() {
  const { login, api, checkAuth } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 2FA states
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [email2FAEnabled, setEmail2FAEnabled] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(email, password);
      
      // Check if 2FA is required
      if (result.requires_2fa) {
        setRequires2FA(true);
        setTotpEnabled(result.totp_enabled);
        setEmail2FAEnabled(result.email_2fa_enabled);
        setMaskedEmail(result.email_masked);
        return;
      }
      
      // Wait a bit for state to update, then navigate
      await new Promise(resolve => setTimeout(resolve, 100));
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      // More descriptive error messages
      let errorMessage = 'Ошибка входа';
      if (err.message) {
        if (err.message.includes('Network') || err.message.includes('network')) {
          errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
        } else if (err.message.includes('Invalid credentials')) {
          errorMessage = 'Неверный email или пароль';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login/2fa', {
        email,
        password,
        totp_code: totpCode || null,
        email_code: emailCode || null
      });
      
      // Store session
      if (response.data.session_token) {
        localStorage.setItem('session_token', response.data.session_token);
      }
      
      navigate('/dashboard');
      window.location.reload(); // Refresh to update auth context
    } catch (err) {
      setError(err.response?.data?.detail || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setRequires2FA(false);
    setTotpCode('');
    setEmailCode('');
    setError('');
  };

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  // 2FA verification screen
  if (requires2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-background">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center mb-6">
              <Logo variant="dark" size={40} />
            </div>
            <h1 className="text-h3 text-primary mb-2">
              {language === 'ru' ? 'Двухфакторная аутентификация' : language === 'tr' ? 'İki Faktörlü Doğrulama' : '2FA Verification'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'ru' ? 'Введите код для входа' : language === 'tr' ? 'Giriş için kodu girin' : 'Enter code to login'}
            </p>
          </div>

          <div className="card-premium">
            <button 
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-primary"
            >
              <ArrowLeft className="w-4 h-4" />
              {language === 'ru' ? 'Назад' : language === 'tr' ? 'Geri' : 'Back'}
            </button>

            <form onSubmit={handle2FASubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-sm bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              {totpEnabled && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    {language === 'ru' ? 'Код из Google Authenticator' : language === 'tr' ? 'Google Authenticator Kodu' : 'Google Authenticator Code'}
                  </Label>
                  <Input
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                    maxLength={6}
                    autoFocus
                    data-testid="2fa-totp-input"
                  />
                </div>
              )}

              {email2FAEnabled && !totpEnabled && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {language === 'ru' ? 'Код из письма' : language === 'tr' ? 'E-posta Kodu' : 'Email Code'}
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    {language === 'ru' ? `Код отправлен на ${maskedEmail}` : language === 'tr' ? `Kod ${maskedEmail} adresine gönderildi` : `Code sent to ${maskedEmail}`}
                  </p>
                  <Input
                    type="text"
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                    maxLength={6}
                    autoFocus
                    data-testid="2fa-email-input"
                  />
                </div>
              )}

              {email2FAEnabled && totpEnabled && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {language === 'ru' ? 'Или код из письма' : language === 'tr' ? 'Veya E-posta Kodu' : 'Or Email Code'}
                  </Label>
                  <Input
                    type="text"
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-lg tracking-widest font-mono"
                    maxLength={6}
                    data-testid="2fa-email-input"
                  />
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full btn-primary" 
                disabled={loading || (totpEnabled ? totpCode.length !== 6 : emailCode.length !== 6)}
                data-testid="2fa-submit"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('loading')}
                  </>
                ) : (
                  language === 'ru' ? 'Подтвердить' : language === 'tr' ? 'Onayla' : 'Verify'
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center mb-6">
            <Logo variant="dark" size={40} />
          </Link>
          <h1 className="text-h3 text-primary mb-2">{t('login')}</h1>
          <p className="text-muted-foreground">
            {language === 'ru' ? 'Вход в личный кабинет' : language === 'tr' ? 'Hesabınıza erişin' : 'Access your account'}
          </p>
        </div>

        <div className="card-premium">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-sm bg-destructive/10 text-destructive text-sm" data-testid="login-error">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-10"
                  required
                  data-testid="login-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  required
                  data-testid="login-password"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full btn-primary" 
              disabled={loading}
              data-testid="login-submit"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('loading')}
                </>
              ) : (
                t('login')
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-muted-foreground">или</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              data-testid="login-google"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t('login_with_google')}
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t('dont_have_account')}{' '}
            <Link to="/register" className="text-primary hover:underline font-medium" data-testid="register-link">
              {t('register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
