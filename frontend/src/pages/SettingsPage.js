import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage, LANGUAGES, CURRENCIES } from '../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { MobileSettings } from './MobileSettings';
import { 
  User,
  Globe,
  Shield,
  Upload,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Camera,
  AlertCircle,
  Phone,
  Send,
  Key,
  Lock,
  Smartphone,
  Mail
} from 'lucide-react';

// Check if we're on mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
}

export function SettingsPage() {
  const isMobile = useIsMobile();
  
  // Render mobile version
  if (isMobile) {
    return <MobileSettings />;
  }
  
  // Desktop version continues below
  return <DesktopSettings />;
}

function DesktopSettings() {
  const { user, api, refreshUser } = useAuth();
  const { t, language, setLanguage, currency, setCurrency } = useLanguage();
  
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [phoneVerified, setPhoneVerified] = useState(user?.phone_verified || false);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kycUploading, setKycUploading] = useState({});
  const [kycStatus, setKycStatus] = useState(user?.kyc_status || 'none');
  const [kycDocuments, setKycDocuments] = useState([]);
  const [uploadError, setUploadError] = useState('');
  
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
    // Update phone state from user
    if (user) {
      setPhone(user.phone || '');
      setPhoneVerified(user.phone_verified || false);
    }
  }, [user]);

  const fetchKycStatus = async () => {
    try {
      const response = await api.get('/kyc/status');
      setKycStatus(response.data.status);
      setKycDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Error fetching KYC status:', error);
    }
  };

  const fetchSecurityStatus = async () => {
    try {
      const response = await api.get('/security/2fa/status');
      setSecurityStatus(response.data);
    } catch (error) {
      console.error('Error fetching security status:', error);
    }
  };

  // 2FA handlers
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
      alert('Google Authenticator включён!');
    } catch (error) {
      alert(error.response?.data?.detail || 'Неверный код');
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    if (!totpCode || totpCode.length !== 6) {
      alert('Введите код из приложения');
      return;
    }
    setSecurityLoading(true);
    try {
      await api.post('/security/2fa/totp/disable', { code: totpCode, method: 'totp' });
      setTotpCode('');
      await fetchSecurityStatus();
      alert('Google Authenticator отключён');
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
      alert('Код отправлен на вашу почту');
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
      alert('Email 2FA включена!');
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
        alert('Код отправлен на почту. Введите его для отключения.');
      } else {
        alert(error.response?.data?.detail || 'Ошибка');
      }
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleSavePhone = async () => {
    setSaving(true);
    try {
      await api.put('/user/settings', { phone });
      setPhoneVerified(false);
      setCodeSent(false);
      await refreshUser();
    } catch (error) {
      console.error('Error saving phone:', error);
      alert(error.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleSendCode = async () => {
    if (!phone) {
      alert('Сначала введите номер телефона');
      return;
    }
    
    // Save phone first if changed
    if (phone !== user?.phone) {
      await handleSavePhone();
    }
    
    setSendingCode(true);
    try {
      await api.post('/user/phone/send-code');
      setCodeSent(true);
      alert('Код отправлен на вашу почту');
    } catch (error) {
      console.error('Error sending code:', error);
      alert(error.response?.data?.detail || 'Ошибка отправки кода');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      alert('Введите код');
      return;
    }
    
    setVerifyingCode(true);
    try {
      await api.post('/user/phone/verify', { code: verificationCode });
      setPhoneVerified(true);
      setCodeSent(false);
      setVerificationCode('');
      await refreshUser();
      alert('Телефон успешно подтверждён!');
    } catch (error) {
      console.error('Error verifying code:', error);
      alert(error.response?.data?.detail || 'Неверный код');
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.put('/user/settings', {
        name,
        preferred_language: language,
        preferred_currency: currency
      });
      await refreshUser();
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleKycUpload = async (documentType, file) => {
    if (!file) return;
    
    setUploadError('');
    setKycUploading(prev => ({ ...prev, [documentType]: true }));
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      await api.post(`/kyc/upload?document_type=${documentType}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      await fetchKycStatus();
      await refreshUser();
    } catch (error) {
      console.error('Error uploading KYC:', error);
      setUploadError(error.response?.data?.detail || 'Ошибка загрузки файла');
    } finally {
      setKycUploading(prev => ({ ...prev, [documentType]: false }));
    }
  };

  const handleFileSelect = (documentType, inputRef) => {
    inputRef.current?.click();
  };

  const onFileChange = (documentType, e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleKycUpload(documentType, file);
    }
  };

  const getDocumentStatus = (documentType) => {
    const doc = kycDocuments.find(d => d.document_type === documentType);
    return doc?.status || 'none';
  };

  const getDocStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getKycStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'pending': return <Clock className="w-5 h-5 text-amber-500" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Shield className="w-5 h-5 text-gray-400" />;
    }
  };

  const getKycStatusBadge = (status) => {
    switch (status) {
      case 'approved': return 'status-approved';
      case 'pending': return 'status-pending';
      case 'rejected': return 'status-rejected';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-background py-8" data-testid="settings-page">
      <div className="container-premium max-w-3xl">
        <h1 className="text-h2 text-primary mb-8">{t('settings_title')}</h1>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Профиль</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span className="hidden sm:inline">Безопасность</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Настройки</span>
            </TabsTrigger>
            <TabsTrigger value="kyc" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">KYC</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="text-h3">Профиль</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  {user?.picture ? (
                    <img src={user.picture} alt="" className="w-20 h-20 rounded-full" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-10 h-10 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-lg">{user?.name}</p>
                    <p className="text-muted-foreground">{user?.email}</p>
                    <Badge className={`mt-2 ${
                      user?.tier === 'platinum' ? 'tier-platinum' :
                      user?.tier === 'gold' ? 'tier-gold' : 'tier-silver'
                    }`}>
                      {t(`tier_${user?.tier || 'silver'}`)}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">{t('name')}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="settings-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('email')}</Label>
                  <Input value={user?.email || ''} disabled className="bg-gray-50" />
                </div>

                <Button 
                  onClick={handleSaveProfile} 
                  disabled={saving}
                  data-testid="save-profile-btn"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('save')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="text-h3">{t('settings_language')} & {t('settings_currency')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>{t('settings_language')}</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger data-testid="language-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('settings_currency')}</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger data-testid="currency-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(curr => (
                        <SelectItem key={curr.code} value={curr.code}>
                          {curr.symbol} {curr.code} - {curr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleSaveProfile} 
                  disabled={saving}
                  data-testid="save-preferences-btn"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('save')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="text-h3 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Безопасность
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Google Authenticator */}
                <div className={`p-4 rounded-lg border ${securityStatus.totp_enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${securityStatus.totp_enabled ? 'bg-green-100' : 'bg-gray-200'}`}>
                      <Smartphone className={`w-6 h-6 ${securityStatus.totp_enabled ? 'text-green-600' : 'text-gray-500'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-lg">Google Authenticator</p>
                      <p className="text-sm text-muted-foreground">
                        {securityStatus.totp_enabled ? 'Включён' : 'Не настроен'}
                      </p>
                    </div>
                    {securityStatus.totp_enabled && <CheckCircle className="w-6 h-6 text-green-500" />}
                  </div>

                  {!securityStatus.totp_enabled && !totpSetup && (
                    <Button onClick={handleSetupTotp} disabled={securityLoading}>
                      {securityLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Настроить
                    </Button>
                  )}

                  {totpSetup && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-3">
                          Отсканируйте QR-код в Google Authenticator
                        </p>
                        <img src={totpSetup.qr_code} alt="QR Code" className="mx-auto w-48 h-48" />
                        <p className="text-xs text-gray-400 mt-3 break-all">
                          Или введите вручную: <code className="bg-gray-100 px-2 py-1 rounded">{totpSetup.secret}</code>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Input 
                          type="text" 
                          value={totpCode} 
                          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Введите код"
                          className="text-center text-lg tracking-widest"
                          maxLength={6}
                        />
                        <Button onClick={handleVerifyTotp} disabled={securityLoading || totpCode.length !== 6}>
                          {securityLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                          Подтвердить
                        </Button>
                      </div>
                    </div>
                  )}

                  {securityStatus.totp_enabled && (
                    <div className="flex gap-2">
                      <Input 
                        type="text" 
                        value={totpCode} 
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Код для отключения"
                        className="text-center tracking-widest"
                        maxLength={6}
                      />
                      <Button variant="destructive" onClick={handleDisableTotp} disabled={securityLoading}>
                        {securityLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Отключить
                      </Button>
                    </div>
                  )}
                </div>

                {/* Email 2FA */}
                <div className={`p-4 rounded-lg border ${securityStatus.email_2fa_enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${securityStatus.email_2fa_enabled ? 'bg-green-100' : 'bg-gray-200'}`}>
                      <Mail className={`w-6 h-6 ${securityStatus.email_2fa_enabled ? 'text-green-600' : 'text-gray-500'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-lg">2FA через Email</p>
                      <p className="text-sm text-muted-foreground">
                        {securityStatus.email_2fa_enabled ? 'Включён' : 'Не настроен'}
                      </p>
                    </div>
                    {securityStatus.email_2fa_enabled && <CheckCircle className="w-6 h-6 text-green-500" />}
                  </div>

                  {!securityStatus.email_2fa_enabled && (
                    <div className="space-y-3">
                      <Button variant="outline" onClick={handleSetupEmail2FA} disabled={securityLoading}>
                        {securityLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Отправить код
                      </Button>
                      <div className="flex gap-2">
                        <Input 
                          type="text" 
                          value={emailCode} 
                          onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Код из письма"
                          className="text-center tracking-widest"
                          maxLength={6}
                        />
                        <Button onClick={handleVerifyEmail2FA} disabled={securityLoading || emailCode.length !== 6}>
                          {securityLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                          Включить
                        </Button>
                      </div>
                    </div>
                  )}

                  {securityStatus.email_2fa_enabled && (
                    <div className="flex gap-2">
                      <Input 
                        type="text" 
                        value={emailCode} 
                        onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Код для отключения"
                        className="text-center tracking-widest"
                        maxLength={6}
                      />
                      <Button variant="destructive" onClick={handleDisableEmail2FA} disabled={securityLoading}>
                        {securityLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Отключить
                      </Button>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    Двухфакторная аутентификация добавляет дополнительный уровень защиты вашего аккаунта. 
                    При входе вам потребуется ввести код помимо пароля.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* KYC Tab */}
          <TabsContent value="kyc">
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="text-h3 flex items-center gap-2">
                  {getKycStatusIcon(kycStatus)}
                  {t('kyc_title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-sm">
                  <div>
                    <p className="font-medium">{t('kyc_status')}</p>
                    <p className="text-sm text-muted-foreground">{t('kyc_subtitle')}</p>
                  </div>
                  <Badge className={getKycStatusBadge(kycStatus)}>
                    {t(`kyc_${kycStatus === 'none' ? 'not_started' : kycStatus}`)}
                  </Badge>
                </div>

                {uploadError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-sm text-red-700 text-sm">
                    {uploadError}
                  </div>
                )}

                {/* Phone Verification Section */}
                <div className="p-4 border border-gray-200 rounded-sm space-y-4">
                  <div className="flex items-center gap-3">
                    {phoneVerified ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <Phone className="w-6 h-6 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium">Подтверждение телефона</p>
                      <p className="text-sm text-muted-foreground">
                        {phoneVerified ? 'Телефон подтверждён' : 'Необходимо для инвестирования'}
                      </p>
                    </div>
                    {phoneVerified && (
                      <Badge className="ml-auto bg-green-100 text-green-700">Подтверждён</Badge>
                    )}
                  </div>
                  
                  {!phoneVerified && (
                    <div className="space-y-4 pt-2 border-t">
                      <div className="flex gap-2">
                        <Input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+7 (___) ___-__-__"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          onClick={handleSendCode}
                          disabled={sendingCode || !phone}
                        >
                          {sendingCode ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Send className="w-4 h-4 mr-2" />
                          )}
                          Отправить код
                        </Button>
                      </div>
                      
                      {codeSent && (
                        <div className="space-y-2">
                          <p className="text-sm text-green-600">
                            Код отправлен на вашу почту {user?.email}
                          </p>
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              value={verificationCode}
                              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="Введите 6-значный код"
                              className="flex-1"
                              maxLength={6}
                            />
                            <Button
                              onClick={handleVerifyCode}
                              disabled={verifyingCode || verificationCode.length !== 6}
                            >
                              {verifyingCode ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <Key className="w-4 h-4 mr-2" />
                              )}
                              Подтвердить
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {kycStatus !== 'approved' && (
                  <div className="grid gap-4">
                    {/* Hidden file inputs */}
                    <input 
                      type="file" 
                      ref={passportInputRef} 
                      className="hidden" 
                      accept="image/*,application/pdf"
                      onChange={(e) => onFileChange('passport', e)}
                    />
                    <input 
                      type="file" 
                      ref={addressInputRef} 
                      className="hidden" 
                      accept="image/*,application/pdf"
                      onChange={(e) => onFileChange('address_proof', e)}
                    />
                    <input 
                      type="file" 
                      ref={selfieInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => onFileChange('selfie', e)}
                    />

                    {/* Passport Upload */}
                    <div className="p-4 border border-gray-200 rounded-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getDocStatusIcon(getDocumentStatus('passport'))}
                          <div>
                            <p className="font-medium">{t('kyc_upload_passport')}</p>
                            <p className="text-sm text-muted-foreground">
                              Паспорт или удостоверение личности
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant={getDocumentStatus('passport') === 'approved' ? 'secondary' : 'outline'}
                          onClick={() => handleFileSelect('passport', passportInputRef)}
                          disabled={kycUploading.passport || getDocumentStatus('passport') === 'approved'}
                          data-testid="upload-passport-btn"
                        >
                          {kycUploading.passport ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Upload className="w-4 h-4 mr-2" />
                          )}
                          {getDocumentStatus('passport') === 'approved' ? 'Загружен' : 
                           getDocumentStatus('passport') === 'pending' ? 'На проверке' : 'Загрузить'}
                        </Button>
                      </div>
                    </div>

                    {/* Address Proof Upload */}
                    <div className="p-4 border border-gray-200 rounded-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getDocStatusIcon(getDocumentStatus('address_proof'))}
                          <div>
                            <p className="font-medium">{t('kyc_upload_address')}</p>
                            <p className="text-sm text-muted-foreground">
                              Счёт за комм. услуги или выписка из банка
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant={getDocumentStatus('address_proof') === 'approved' ? 'secondary' : 'outline'}
                          onClick={() => handleFileSelect('address_proof', addressInputRef)}
                          disabled={kycUploading.address_proof || getDocumentStatus('address_proof') === 'approved'}
                          data-testid="upload-address-btn"
                        >
                          {kycUploading.address_proof ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Upload className="w-4 h-4 mr-2" />
                          )}
                          {getDocumentStatus('address_proof') === 'approved' ? 'Загружен' : 
                           getDocumentStatus('address_proof') === 'pending' ? 'На проверке' : 'Загрузить'}
                        </Button>
                      </div>
                    </div>

                    {/* Selfie Upload */}
                    <div className="p-4 border border-gray-200 rounded-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getDocStatusIcon(getDocumentStatus('selfie'))}
                          <div>
                            <p className="font-medium">Селфи с документом</p>
                            <p className="text-sm text-muted-foreground">
                              Фото с паспортом в руках
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant={getDocumentStatus('selfie') === 'approved' ? 'secondary' : 'outline'}
                          onClick={() => handleFileSelect('selfie', selfieInputRef)}
                          disabled={kycUploading.selfie || getDocumentStatus('selfie') === 'approved'}
                          data-testid="upload-selfie-btn"
                        >
                          {kycUploading.selfie ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Camera className="w-4 h-4 mr-2" />
                          )}
                          {getDocumentStatus('selfie') === 'approved' ? 'Загружен' : 
                           getDocumentStatus('selfie') === 'pending' ? 'На проверке' : 'Загрузить'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {kycStatus === 'approved' && (
                  <div className="p-4 bg-green-50 rounded-sm text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="font-medium text-green-700">
                      Верификация успешно пройдена
                    </p>
                  </div>
                )}

                {kycStatus === 'pending' && (
                  <div className="p-4 bg-amber-50 rounded-sm text-center">
                    <Clock className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                    <p className="font-medium text-amber-700">
                      Документы на проверке
                    </p>
                    <p className="text-sm text-amber-600 mt-1">
                      Обычно проверка занимает 1-2 рабочих дня
                    </p>
                  </div>
                )}

                {kycStatus === 'rejected' && (
                  <div className="p-4 bg-red-50 rounded-sm text-center">
                    <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                    <p className="font-medium text-red-700">
                      Документы отклонены
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      Пожалуйста, загрузите документы повторно
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default SettingsPage;
