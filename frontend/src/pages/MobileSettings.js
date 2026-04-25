import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage, LANGUAGES, CURRENCIES } from '../i18n/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  User,
  Globe,
  Shield,
  Upload,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  Phone,
  ChevronRight,
  LogOut,
  Lock,
  X,
  Check,
  Award,
  Smartphone,
  Mail,
  HelpCircle
} from 'lucide-react';

export function MobileSettings() {
  const navigate = useNavigate();
  const { user, api, refreshUser, logout } = useAuth();
  const { t, language, setLanguage, currency, setCurrency } = useLanguage();
  
  const [activeSection, setActiveSection] = useState(null);
  
  // Profile state
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [phoneVerified, setPhoneVerified] = useState(user?.phone_verified || false);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // KYC state
  const [kycStatus, setKycStatus] = useState(user?.kyc_status || 'none');
  const [kycDocuments, setKycDocuments] = useState([]);
  const [kycUploading, setKycUploading] = useState({});
  
  // Security 2FA state
  const [securityStatus, setSecurityStatus] = useState({ totp_enabled: false, email_2fa_enabled: false });
  const [totpSetup, setTotpSetup] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  
  const passportInputRef = useRef(null);
  const addressInputRef = useRef(null);
  const selfieInputRef = useRef(null);

  useEffect(() => {
    fetchKycStatus();
    fetchSecurityStatus();
    if (user) {
      setPhone(user.phone || '');
      setPhoneVerified(user.phone_verified || false);
      setName(user.name || '');
    }
  }, [user]);

  const fetchSecurityStatus = async () => {
    try {
      const response = await api.get('/security/2fa/status');
      setSecurityStatus(response.data);
    } catch (error) {
      console.error('Error fetching security status:', error);
    }
  };

  const fetchKycStatus = async () => {
    try {
      const response = await api.get('/kyc/status');
      setKycStatus(response.data.status);
      setKycDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Error fetching KYC status:', error);
    }
  };

  const handleSendCode = async () => {
    if (!phone) return;
    setSendingCode(true);
    try {
      if (phone !== user?.phone) {
        await api.put('/user/settings', { phone });
      }
      await api.post('/user/phone/send-code');
      setCodeSent(true);
    } catch (error) {
      alert(error.response?.data?.detail || 'Ошибка');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) return;
    setVerifyingCode(true);
    try {
      await api.post('/user/phone/verify', { code: verificationCode });
      setPhoneVerified(true);
      setCodeSent(false);
      setVerificationCode('');
      await refreshUser();
    } catch (error) {
      alert(error.response?.data?.detail || 'Неверный код');
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleKycUpload = async (type, file) => {
    if (!file) return;
    setKycUploading(prev => ({ ...prev, [type]: true }));
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', type);
    
    try {
      await api.post('/kyc/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await fetchKycStatus();
    } catch (error) {
      alert(error.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      setKycUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.put('/user/settings', { name });
      await refreshUser();
      setActiveSection(null);
    } catch (error) {
      alert(error.response?.data?.detail || 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getKycStatusConfig = () => {
    switch (kycStatus) {
      case 'approved':
        return { icon: CheckCircle, color: 'text-green-600 bg-green-100', label: language === 'ru' ? 'Подтверждено' : 'Verified' };
      case 'pending':
        return { icon: Clock, color: 'text-amber-600 bg-amber-100', label: language === 'ru' ? 'На проверке' : 'Pending' };
      case 'rejected':
        return { icon: XCircle, color: 'text-red-600 bg-red-100', label: language === 'ru' ? 'Отклонено' : 'Rejected' };
      default:
        return { icon: Shield, color: 'text-gray-600 bg-gray-100', label: language === 'ru' ? 'Не пройдена' : 'Not verified' };
    }
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'platinum': return 'from-gray-400 to-gray-600';
      case 'gold': return 'from-yellow-400 to-amber-600';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  const kycConfig = getKycStatusConfig();
  const KycIcon = kycConfig.icon;

  const getDocStatus = (type) => {
    const doc = kycDocuments.find(d => d.document_type === type);
    return doc?.status || 'none';
  };

  // Main Settings View
  if (!activeSection) {
    return (
      <div className="h-full flex flex-col" data-testid="mobile-settings">
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
                </div>
              </div>
              <button onClick={() => setActiveSection('profile')} className="p-2 rounded-lg bg-gray-100">
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto px-3 space-y-2">
          {/* KYC Status */}
          <button onClick={() => setActiveSection('kyc')} className="w-full bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${kycConfig.color} flex items-center justify-center`}>
              <KycIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">{language === 'ru' ? 'Верификация' : 'Verification'}</p>
              <p className="text-xs text-gray-500">{kycConfig.label}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          {/* Phone */}
          <button onClick={() => setActiveSection('phone')} className="w-full bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${phoneVerified ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
              <Phone className="w-4 h-4" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">{language === 'ru' ? 'Телефон' : 'Phone'}</p>
              <p className="text-xs text-gray-500">{phoneVerified ? (language === 'ru' ? 'Подтверждён' : 'Verified') : (language === 'ru' ? 'Не подтверждён' : 'Not verified')}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          {/* Language */}
          <button onClick={() => setActiveSection('language')} className="w-full bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">{language === 'ru' ? 'Язык и валюта' : 'Language'}</p>
              <p className="text-xs text-gray-500">{LANGUAGES.find(l => l.code === language)?.name}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          {/* Security */}
          <button onClick={() => setActiveSection('security')} className="w-full bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              securityStatus.totp_enabled || securityStatus.email_2fa_enabled 
                ? 'bg-green-100 text-green-600' 
                : 'bg-red-100 text-red-600'
            }`}>
              <Lock className="w-4 h-4" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">{language === 'ru' ? 'Безопасность' : 'Security'}</p>
              <p className="text-xs text-gray-500">
                {securityStatus.totp_enabled || securityStatus.email_2fa_enabled 
                  ? (language === 'ru' ? '2FA включена' : '2FA enabled')
                  : (language === 'ru' ? '2FA не настроена' : '2FA not configured')}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          {/* Support */}
          <button onClick={() => navigate('/support')} className="w-full bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">{language === 'ru' ? 'Поддержка' : 'Support'}</p>
              <p className="text-xs text-gray-500">{language === 'ru' ? 'Помощь 24/7' : 'Help 24/7'}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          {/* Logout */}
          <button onClick={handleLogout} className="w-full bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 text-red-600">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="font-medium text-sm">{language === 'ru' ? 'Выйти' : 'Logout'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Profile Section
  if (activeSection === 'profile') {
    return (
      <div className="h-full flex flex-col bg-white" data-testid="profile-section">
        <div className="border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setActiveSection(null)} className="p-1"><X className="w-5 h-5" /></button>
          <h2 className="font-semibold">{language === 'ru' ? 'Профиль' : 'Profile'}</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-10 h-10 text-primary" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">{language === 'ru' ? 'Имя' : 'Name'}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Email</label>
            <Input value={user?.email || ''} disabled className="h-10 bg-gray-50" />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">{language === 'ru' ? 'Номер счёта' : 'Account'}</label>
            <Input value={user?.account_number || ''} disabled className="h-10 bg-gray-50 font-mono" />
          </div>
        </div>
        
        <div className="p-4 border-t flex-shrink-0">
          <Button className="w-full h-11" onClick={handleSaveProfile} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {language === 'ru' ? 'Сохранить' : 'Save'}
          </Button>
        </div>
      </div>
    );
  }

  // KYC Section
  if (activeSection === 'kyc') {
    const docTypes = [
      { type: 'passport', label: language === 'ru' ? 'Паспорт / ID' : 'Passport / ID', ref: passportInputRef },
      { type: 'address', label: language === 'ru' ? 'Подтверждение адреса' : 'Proof of Address', ref: addressInputRef },
      { type: 'selfie', label: language === 'ru' ? 'Селфи с документом' : 'Selfie with ID', ref: selfieInputRef },
    ];

    return (
      <div className="h-full flex flex-col bg-white" data-testid="kyc-section">
        <div className="border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setActiveSection(null)} className="p-1"><X className="w-5 h-5" /></button>
          <h2 className="font-semibold">{language === 'ru' ? 'Верификация' : 'Verification'}</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className={`p-3 rounded-xl ${kycConfig.color}`}>
            <div className="flex items-center gap-2">
              <KycIcon className="w-5 h-5" />
              <span className="font-medium">{kycConfig.label}</span>
            </div>
          </div>

          {docTypes.map(({ type, label, ref }) => {
            const status = getDocStatus(type);
            return (
              <div key={type} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{label}</span>
                  {status === 'approved' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {status === 'pending' && <Clock className="w-4 h-4 text-amber-500" />}
                  {status === 'rejected' && <XCircle className="w-4 h-4 text-red-500" />}
                </div>
                <input type="file" ref={ref} className="hidden" accept="image/*" onChange={(e) => handleKycUpload(type, e.target.files[0])} />
                <Button variant="outline" size="sm" className="w-full" disabled={kycUploading[type] || status === 'approved' || status === 'pending'} onClick={() => ref.current?.click()}>
                  {kycUploading[type] ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  {status === 'none' ? (language === 'ru' ? 'Загрузить' : 'Upload') : (language === 'ru' ? 'Заменить' : 'Replace')}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Phone Section
  if (activeSection === 'phone') {
    return (
      <div className="h-full flex flex-col bg-white" data-testid="phone-section">
        <div className="border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setActiveSection(null)} className="p-1"><X className="w-5 h-5" /></button>
          <h2 className="font-semibold">{language === 'ru' ? 'Телефон' : 'Phone'}</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {phoneVerified ? (
            <div className="p-4 bg-green-50 rounded-xl text-center">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="font-medium text-green-800">{language === 'ru' ? 'Подтверждён' : 'Verified'}</p>
              <p className="text-sm text-green-600 mt-1">{phone}</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">{language === 'ru' ? 'Номер телефона' : 'Phone Number'}</label>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 (999) 123-45-67" className="h-10" />
              </div>

              {!codeSent ? (
                <Button className="w-full h-10" onClick={handleSendCode} disabled={sendingCode || !phone}>
                  {sendingCode && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {language === 'ru' ? 'Отправить код' : 'Send Code'}
                </Button>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">{language === 'ru' ? 'Код подтверждения' : 'Code'}</label>
                    <Input type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} placeholder="123456" className="h-10 text-center text-lg tracking-widest" maxLength={6} />
                  </div>
                  <Button className="w-full h-10" onClick={handleVerifyCode} disabled={verifyingCode || !verificationCode}>
                    {verifyingCode && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {language === 'ru' ? 'Подтвердить' : 'Verify'}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Language Section
  if (activeSection === 'language') {
    return (
      <div className="h-full flex flex-col bg-white" data-testid="language-section">
        <div className="border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setActiveSection(null)} className="p-1"><X className="w-5 h-5" /></button>
          <h2 className="font-semibold">{language === 'ru' ? 'Язык' : 'Language'}</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-2 block">{language === 'ru' ? 'Язык' : 'Language'}</label>
            <div className="space-y-2">
              {LANGUAGES.map(lang => (
                <button key={lang.code} onClick={() => setLanguage(lang.code)} className={`w-full p-3 rounded-xl flex items-center justify-between ${language === lang.code ? 'bg-primary/10 border-2 border-primary' : 'bg-gray-50'}`}>
                  <span className="font-medium text-sm">{lang.name}</span>
                  {language === lang.code && <Check className="w-5 h-5 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Security Section
  if (activeSection === 'security') {
    const handleSetupTotp = async () => {
      setSecurityLoading(true);
      try {
        const response = await api.get('/security/2fa/totp/setup');
        setTotpSetup(response.data);
      } catch (error) {
        alert(error.response?.data?.detail || 'Ошибка');
      } finally {
        setSecurityLoading(false);
      }
    };

    const handleVerifyTotp = async () => {
      if (!totpCode || totpCode.length !== 6) return;
      setSecurityLoading(true);
      try {
        await api.post('/security/2fa/totp/verify', { code: totpCode, method: 'totp' });
        setTotpSetup(null);
        setTotpCode('');
        await fetchSecurityStatus();
        alert(language === 'ru' ? 'Google Authenticator включён!' : 'Google Authenticator enabled!');
      } catch (error) {
        alert(error.response?.data?.detail || 'Неверный код');
      } finally {
        setSecurityLoading(false);
      }
    };

    const handleDisableTotp = async () => {
      if (!totpCode || totpCode.length !== 6) {
        alert(language === 'ru' ? 'Введите код из приложения' : 'Enter code from app');
        return;
      }
      setSecurityLoading(true);
      try {
        await api.post('/security/2fa/totp/disable', { code: totpCode, method: 'totp' });
        setTotpCode('');
        await fetchSecurityStatus();
        alert(language === 'ru' ? 'Google Authenticator отключён' : 'Google Authenticator disabled');
      } catch (error) {
        alert(error.response?.data?.detail || 'Ошибка');
      } finally {
        setSecurityLoading(false);
      }
    };

    const handleSetupEmail2FA = async () => {
      setSecurityLoading(true);
      try {
        await api.post('/security/2fa/email/setup');
        alert(language === 'ru' ? 'Код отправлен на вашу почту' : 'Code sent to your email');
      } catch (error) {
        alert(error.response?.data?.detail || 'Ошибка');
      } finally {
        setSecurityLoading(false);
      }
    };

    const handleVerifyEmail2FA = async () => {
      if (!emailCode || emailCode.length !== 6) return;
      setSecurityLoading(true);
      try {
        await api.post('/security/2fa/email/verify', { code: emailCode, method: 'email' });
        setEmailCode('');
        await fetchSecurityStatus();
        alert(language === 'ru' ? 'Email 2FA включена!' : 'Email 2FA enabled!');
      } catch (error) {
        alert(error.response?.data?.detail || 'Неверный код');
      } finally {
        setSecurityLoading(false);
      }
    };

    const handleDisableEmail2FA = async () => {
      setSecurityLoading(true);
      try {
        await api.post('/security/2fa/email/disable', { code: emailCode || '', method: 'email' });
        setEmailCode('');
        await fetchSecurityStatus();
      } catch (error) {
        if (error.response?.data?.detail?.includes('Verification code sent')) {
          alert(language === 'ru' ? 'Код отправлен на почту. Введите его для отключения.' : 'Code sent. Enter it to disable.');
        } else {
          alert(error.response?.data?.detail || 'Ошибка');
        }
      } finally {
        setSecurityLoading(false);
      }
    };

    return (
      <div className="h-full flex flex-col bg-white" data-testid="security-section">
        <div className="border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => { setActiveSection(null); setTotpSetup(null); setTotpCode(''); setEmailCode(''); }} className="p-1">
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-semibold">{language === 'ru' ? 'Безопасность' : 'Security'}</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Google Authenticator */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${securityStatus.totp_enabled ? 'bg-green-100' : 'bg-gray-200'}`}>
                <Smartphone className={`w-5 h-5 ${securityStatus.totp_enabled ? 'text-green-600' : 'text-gray-500'}`} />
              </div>
              <div className="flex-1">
                <p className="font-medium">Google Authenticator</p>
                <p className="text-xs text-gray-500">
                  {securityStatus.totp_enabled 
                    ? (language === 'ru' ? 'Включено' : 'Enabled')
                    : (language === 'ru' ? 'Не настроено' : 'Not configured')}
                </p>
              </div>
              {securityStatus.totp_enabled && <CheckCircle className="w-5 h-5 text-green-500" />}
            </div>

            {!securityStatus.totp_enabled && !totpSetup && (
              <Button onClick={handleSetupTotp} disabled={securityLoading} className="w-full">
                {securityLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {language === 'ru' ? 'Настроить' : 'Setup'}
              </Button>
            )}

            {totpSetup && (
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-2">
                    {language === 'ru' ? 'Отсканируйте QR-код в Google Authenticator' : 'Scan QR code in Google Authenticator'}
                  </p>
                  <img src={totpSetup.qr_code} alt="QR Code" className="mx-auto w-40 h-40" />
                  <p className="text-xs text-gray-400 mt-2 break-all">
                    {language === 'ru' ? 'Или введите вручную:' : 'Or enter manually:'} <span className="font-mono">{totpSetup.secret}</span>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    {language === 'ru' ? 'Введите код из приложения' : 'Enter code from app'}
                  </label>
                  <Input 
                    type="text" 
                    value={totpCode} 
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-lg tracking-widest"
                    maxLength={6}
                  />
                </div>
                <Button onClick={handleVerifyTotp} disabled={securityLoading || totpCode.length !== 6} className="w-full">
                  {securityLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {language === 'ru' ? 'Подтвердить' : 'Verify'}
                </Button>
              </div>
            )}

            {securityStatus.totp_enabled && (
              <div className="space-y-3 mt-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    {language === 'ru' ? 'Код для отключения' : 'Code to disable'}
                  </label>
                  <Input 
                    type="text" 
                    value={totpCode} 
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-lg tracking-widest"
                    maxLength={6}
                  />
                </div>
                <Button variant="destructive" onClick={handleDisableTotp} disabled={securityLoading} className="w-full">
                  {securityLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {language === 'ru' ? 'Отключить' : 'Disable'}
                </Button>
              </div>
            )}
          </div>

          {/* Email 2FA */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${securityStatus.email_2fa_enabled ? 'bg-green-100' : 'bg-gray-200'}`}>
                <Mail className={`w-5 h-5 ${securityStatus.email_2fa_enabled ? 'text-green-600' : 'text-gray-500'}`} />
              </div>
              <div className="flex-1">
                <p className="font-medium">{language === 'ru' ? '2FA через Email' : 'Email 2FA'}</p>
                <p className="text-xs text-gray-500">
                  {securityStatus.email_2fa_enabled 
                    ? (language === 'ru' ? 'Включено' : 'Enabled')
                    : (language === 'ru' ? 'Не настроено' : 'Not configured')}
                </p>
              </div>
              {securityStatus.email_2fa_enabled && <CheckCircle className="w-5 h-5 text-green-500" />}
            </div>

            {!securityStatus.email_2fa_enabled && (
              <div className="space-y-3">
                <Button onClick={handleSetupEmail2FA} disabled={securityLoading} variant="outline" className="w-full">
                  {securityLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {language === 'ru' ? 'Отправить код' : 'Send Code'}
                </Button>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    {language === 'ru' ? 'Код из письма' : 'Code from email'}
                  </label>
                  <Input 
                    type="text" 
                    value={emailCode} 
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-lg tracking-widest"
                    maxLength={6}
                  />
                </div>
                <Button onClick={handleVerifyEmail2FA} disabled={securityLoading || emailCode.length !== 6} className="w-full">
                  {securityLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {language === 'ru' ? 'Включить' : 'Enable'}
                </Button>
              </div>
            )}

            {securityStatus.email_2fa_enabled && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    {language === 'ru' ? 'Код для отключения (придёт на почту)' : 'Code to disable (will be sent to email)'}
                  </label>
                  <Input 
                    type="text" 
                    value={emailCode} 
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-lg tracking-widest"
                    maxLength={6}
                  />
                </div>
                <Button variant="destructive" onClick={handleDisableEmail2FA} disabled={securityLoading} className="w-full">
                  {securityLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {language === 'ru' ? 'Отключить' : 'Disable'}
                </Button>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              {language === 'ru' 
                ? 'Двухфакторная аутентификация добавляет дополнительный уровень защиты вашего аккаунта. При входе вам потребуется ввести код помимо пароля.'
                : 'Two-factor authentication adds an extra layer of security to your account. You will need to enter a code in addition to your password when logging in.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Notifications Section
  return null;
}

export default MobileSettings;
