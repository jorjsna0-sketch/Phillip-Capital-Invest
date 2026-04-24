import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../components/ui/dialog';
import { Switch } from '../../components/ui/switch';
import { toast } from 'sonner';
import { 
  Loader2,
  Building,
  Stamp,
  PenTool,
  Upload,
  Trash2,
  Plus,
  Edit,
  Save,
  CheckCircle,
  Landmark,
  CreditCard,
  Image as ImageIcon,
  X,
  Mail,
  Eye,
  EyeOff
} from 'lucide-react';

export function AdminCompanySettings() {
  const { api } = useAuth();
  const { t } = useLanguage();
  
  const [settings, setSettings] = useState({
    company_name: 'Phillip Capital Invest LLP',
    company_director: '',
    company_director_title: 'Генеральный директор',
    company_license: '',
    company_bin: '',
    company_address: 'г. Алматы',
    company_signature: null,
    company_stamp: null,
    company_bank_name: '',
    company_bank_account: '',
    company_bank_iban: '',
    // Email settings
    email_enabled: false,
    email_provider: 'sendgrid',
    sendgrid_api_key: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    email_from: '',
    email_from_name: 'Phillip Capital Invest',
  });
  const [brokers, setBrokers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [brokerDialogOpen, setBrokerDialogOpen] = useState(false);
  const [editingBroker, setEditingBroker] = useState(null);
  const [brokerForm, setBrokerForm] = useState({ name: '', account_template: '', instructions: { ru: '', en: '' } });

  const signatureInputRef = useRef(null);
  const stampInputRef = useRef(null);

  useEffect(() => {
    fetchSettings();
    fetchBrokers();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/admin/settings');
      setSettings(prev => ({ ...prev, ...response.data }));
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrokers = async () => {
    try {
      const response = await api.get('/admin/brokers');
      setBrokers(response.data);
    } catch (error) {
      console.error('Error fetching brokers:', error);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/admin/settings', settings);
      alert('Настройки сохранены');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 500000) { // 500KB limit
      alert('Файл слишком большой. Максимум 500KB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSettings(prev => ({ ...prev, [field]: event.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddBroker = async () => {
    try {
      if (editingBroker) {
        await api.put(`/admin/brokers/${editingBroker.broker_id}`, brokerForm);
        toast.success('Брокер обновлён');
      } else {
        await api.post('/admin/brokers', brokerForm);
        toast.success('Брокер добавлен');
      }
      setBrokerDialogOpen(false);
      setBrokerForm({ name: '', account_template: '', instructions: { ru: '', en: '' } });
      setEditingBroker(null);
      fetchBrokers();
    } catch (error) {
      console.error('Error saving broker:', error);
      toast.error('Ошибка сохранения брокера');
    }
  };

  const handleDeleteBroker = async (brokerId) => {
    if (!confirm('Удалить брокера?')) return;
    try {
      await api.delete(`/admin/brokers/${brokerId}`);
      toast.success('Брокер удалён');
      fetchBrokers();
    } catch (error) {
      console.error('Error deleting broker:', error);
      toast.error('Ошибка удаления');
    }
  };

  const openEditBroker = (broker) => {
    setEditingBroker(broker);
    setBrokerForm({
      name: broker.name,
      account_template: broker.account_template || '',
      instructions: broker.instructions || { ru: '', en: '' }
    });
    setBrokerDialogOpen(true);
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const response = await api.post('/admin/test-email', {});
      alert(response.data.message || 'Тестовое письмо отправлено!');
    } catch (error) {
      alert('Ошибка: ' + (error.response?.data?.detail || 'Не удалось отправить'));
    } finally {
      setTestingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl" data-testid="admin-company-settings">
      <div className="mb-8">
        <h1 className="text-h2 text-primary">Настройки компании</h1>
        <p className="text-muted-foreground">Реквизиты, подпись, печать и брокеры</p>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList>
          <TabsTrigger value="company">
            <Building className="w-4 h-4 mr-2" />
            Компания
          </TabsTrigger>
          <TabsTrigger value="signature">
            <PenTool className="w-4 h-4 mr-2" />
            Подпись и печать
          </TabsTrigger>
          <TabsTrigger value="bank">
            <Landmark className="w-4 h-4 mr-2" />
            Банковские реквизиты
          </TabsTrigger>
          <TabsTrigger value="brokers">
            <CreditCard className="w-4 h-4 mr-2" />
            Брокеры
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="w-4 h-4 mr-2" />
            Почта
          </TabsTrigger>
        </TabsList>

        {/* Company Info Tab */}
        <TabsContent value="company">
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Реквизиты компании
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название компании</Label>
                  <Input
                    value={settings.company_name}
                    onChange={(e) => setSettings({...settings, company_name: e.target.value})}
                    placeholder="Phillip Capital Invest LLP"
                  />
                </div>
                <div className="space-y-2">
                  <Label>БИН</Label>
                  <Input
                    value={settings.company_bin}
                    onChange={(e) => setSettings({...settings, company_bin: e.target.value})}
                    placeholder="123456789012"
                  />
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ФИО директора</Label>
                  <Input
                    value={settings.company_director}
                    onChange={(e) => setSettings({...settings, company_director: e.target.value})}
                    placeholder="Иванов Иван Иванович"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Должность директора</Label>
                  <Input
                    value={settings.company_director_title}
                    onChange={(e) => setSettings({...settings, company_director_title: e.target.value})}
                    placeholder="Генеральный директор"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Лицензия</Label>
                <Input
                  value={settings.company_license}
                  onChange={(e) => setSettings({...settings, company_license: e.target.value})}
                  placeholder="Лицензия НБ РК №1.2.34/567"
                />
              </div>

              <div className="space-y-2">
                <Label>Адрес</Label>
                <Input
                  value={settings.company_address}
                  onChange={(e) => setSettings({...settings, company_address: e.target.value})}
                  placeholder="г. Алматы, ул. Примерная, 123"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signature & Stamp Tab */}
        <TabsContent value="signature">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Director's Signature */}
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PenTool className="w-5 h-5" />
                  Подпись директора
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Загрузите изображение подписи директора (PNG с прозрачным фоном рекомендуется)
                </p>
                
                <input
                  type="file"
                  ref={signatureInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, 'company_signature')}
                />
                
                {settings.company_signature ? (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <img 
                      src={settings.company_signature} 
                      alt="Подпись директора" 
                      className="max-h-24 mx-auto"
                    />
                    <div className="flex justify-center gap-2 mt-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => signatureInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Заменить
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-red-600"
                        onClick={() => setSettings({...settings, company_signature: null})}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Удалить
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full h-32 border-dashed"
                    onClick={() => signatureInputRef.current?.click()}
                  >
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p>Загрузить подпись</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG до 500KB</p>
                    </div>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Company Stamp */}
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stamp className="w-5 h-5" />
                  Печать компании
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Загрузите изображение печати компании (PNG с прозрачным фоном рекомендуется)
                </p>
                
                <input
                  type="file"
                  ref={stampInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, 'company_stamp')}
                />
                
                {settings.company_stamp ? (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <img 
                      src={settings.company_stamp} 
                      alt="Печать компании" 
                      className="max-h-32 mx-auto"
                    />
                    <div className="flex justify-center gap-2 mt-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => stampInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Заменить
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-red-600"
                        onClick={() => setSettings({...settings, company_stamp: null})}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Удалить
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full h-32 border-dashed"
                    onClick={() => stampInputRef.current?.click()}
                  >
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p>Загрузить печать</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG до 500KB</p>
                    </div>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Bank Details Tab */}
        <TabsContent value="bank">
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="w-5 h-5" />
                Банковские реквизиты для пополнений
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Эти реквизиты будут показаны клиентам при создании заявки на пополнение
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название банка</Label>
                  <Input
                    value={settings.company_bank_name}
                    onChange={(e) => setSettings({...settings, company_bank_name: e.target.value})}
                    placeholder="Народный банк Казахстана"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Номер счёта</Label>
                  <Input
                    value={settings.company_bank_account}
                    onChange={(e) => setSettings({...settings, company_bank_account: e.target.value})}
                    placeholder="KZ1234567890123456"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>IBAN</Label>
                <Input
                  value={settings.company_bank_iban}
                  onChange={(e) => setSettings({...settings, company_bank_iban: e.target.value})}
                  placeholder="KZ1234567890123456789012"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Brokers Tab */}
        <TabsContent value="brokers">
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Брокеры для вывода средств
                </div>
                <Dialog open={brokerDialogOpen} onOpenChange={setBrokerDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingBroker(null);
                      setBrokerForm({ name: '', account_template: '', instructions: { ru: '', en: '' } });
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Добавить брокера
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingBroker ? 'Редактировать брокера' : 'Добавить брокера'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Название брокера *</Label>
                        <Input
                          value={brokerForm.name}
                          onChange={(e) => setBrokerForm({...brokerForm, name: e.target.value})}
                          placeholder="Freedom Finance, Halyk Finance..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Шаблон номера счёта</Label>
                        <Input
                          value={brokerForm.account_template}
                          onChange={(e) => setBrokerForm({...brokerForm, account_template: e.target.value})}
                          placeholder="Например: XXXX-XXXX-XXXX"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Инструкция для клиента (RU)</Label>
                        <Textarea
                          value={brokerForm.instructions.ru}
                          onChange={(e) => setBrokerForm({
                            ...brokerForm, 
                            instructions: {...brokerForm.instructions, ru: e.target.value}
                          })}
                          rows={3}
                          placeholder="Укажите номер брокерского счёта..."
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setBrokerDialogOpen(false)}>Отмена</Button>
                      <Button onClick={handleAddBroker} disabled={!brokerForm.name}>
                        {editingBroker ? 'Сохранить' : 'Добавить'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {brokers.length > 0 ? (
                <div className="space-y-3">
                  {brokers.map((broker) => (
                    <div 
                      key={broker.broker_id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{broker.name}</p>
                          {broker.account_template && (
                            <p className="text-sm text-muted-foreground">Формат: {broker.account_template}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={broker.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                          {broker.is_active !== false ? 'Активен' : 'Неактивен'}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => openEditBroker(broker)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600"
                          onClick={() => handleDeleteBroker(broker.broker_id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Брокеры не добавлены</p>
                  <p className="text-sm">Добавьте брокеров для возможности вывода средств</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings Tab */}
        <TabsContent value="email">
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Настройки почты
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Включить отправку писем</p>
                  <p className="text-sm text-muted-foreground">Уведомления о депозитах, выводах, начислениях</p>
                </div>
                <Switch
                  checked={settings.email_enabled}
                  onCheckedChange={(checked) => setSettings({...settings, email_enabled: checked})}
                />
              </div>

              {/* Provider Selection */}
              <div className="space-y-2">
                <Label>Провайдер отправки</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="email_provider"
                      value="sendgrid"
                      checked={settings.email_provider === 'sendgrid'}
                      onChange={(e) => setSettings({...settings, email_provider: e.target.value})}
                      className="w-4 h-4"
                    />
                    <span>SendGrid</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="email_provider"
                      value="smtp"
                      checked={settings.email_provider === 'smtp'}
                      onChange={(e) => setSettings({...settings, email_provider: e.target.value})}
                      className="w-4 h-4"
                    />
                    <span>SMTP</span>
                  </label>
                </div>
              </div>

              {/* SendGrid Settings */}
              {settings.email_provider === 'sendgrid' && (
                <div className="p-4 border rounded-lg space-y-4 bg-gray-50">
                  <h4 className="font-medium flex items-center gap-2">
                    <img src="https://sendgrid.com/favicon.ico" alt="SendGrid" className="w-4 h-4" />
                    Настройки SendGrid
                  </h4>
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.sendgrid_api_key}
                        onChange={(e) => setSettings({...settings, sendgrid_api_key: e.target.value})}
                        placeholder="SG.xxxxxxxxxxxxx"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Получить ключ: <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">SendGrid Dashboard</a>
                    </p>
                  </div>
                </div>
              )}

              {/* SMTP Settings */}
              {settings.email_provider === 'smtp' && (
                <div className="p-4 border rounded-lg space-y-4 bg-gray-50">
                  <h4 className="font-medium">Настройки SMTP</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SMTP сервер</Label>
                      <Input
                        value={settings.smtp_host}
                        onChange={(e) => setSettings({...settings, smtp_host: e.target.value})}
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Порт</Label>
                      <Input
                        value={settings.smtp_port}
                        onChange={(e) => setSettings({...settings, smtp_port: e.target.value})}
                        placeholder="587"
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Логин</Label>
                      <Input
                        value={settings.smtp_user}
                        onChange={(e) => setSettings({...settings, smtp_user: e.target.value})}
                        placeholder="user@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Пароль</Label>
                      <div className="relative">
                        <Input
                          type={showSmtpPassword ? 'text' : 'password'}
                          value={settings.smtp_password}
                          onChange={(e) => setSettings({...settings, smtp_password: e.target.value})}
                          placeholder="••••••••"
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                        >
                          {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sender Settings */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email отправителя</Label>
                  <Input
                    type="email"
                    value={settings.email_from}
                    onChange={(e) => setSettings({...settings, email_from: e.target.value})}
                    placeholder="noreply@altyncontract.kz"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Имя отправителя</Label>
                  <Input
                    value={settings.email_from_name}
                    onChange={(e) => setSettings({...settings, email_from_name: e.target.value})}
                    placeholder="Phillip Capital Invest"
                  />
                </div>
              </div>

              {/* Test Email Button */}
              <div className="flex items-center gap-4 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={handleTestEmail}
                  disabled={testingEmail || !settings.email_enabled || (!settings.sendgrid_api_key && settings.email_provider === 'sendgrid')}
                >
                  {testingEmail ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  Отправить тестовое письмо
                </Button>
                <p className="text-sm text-muted-foreground">
                  Письмо будет отправлено на email администратора
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <Button onClick={handleSaveSettings} disabled={saving} size="lg">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Сохранить настройки
        </Button>
      </div>
    </div>
  );
}

export default AdminCompanySettings;
