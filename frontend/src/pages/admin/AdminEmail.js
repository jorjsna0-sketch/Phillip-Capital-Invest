import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  Mail,
  Settings,
  Send,
  Plus,
  Edit,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Users,
  FileText
} from 'lucide-react';

export function AdminEmail() {
  const { api } = useAuth();
  const [settings, setSettings] = useState({
    sendgrid_api_key: '',
    sender_email: '',
    sender_name: 'Phillip Capital Invest',
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    use_smtp: false
  });
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState(null);

  const [campaignForm, setCampaignForm] = useState({
    subject: { ru: '', en: '' },
    content: { ru: '', en: '' },
    filters: { tier: '', min_balance: '', kyc_status: '' }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, campaignsRes, templatesRes] = await Promise.all([
        api.get('/admin/settings'),
        api.get('/admin/email/campaigns'),
        api.get('/admin/email/templates')
      ]);
      setSettings(prev => ({ ...prev, ...settingsRes.data }));
      setCampaigns(campaignsRes.data);
      setTemplates(templatesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const dataToSend = { ...settings };
      // Don't send masked values
      if (dataToSend.sendgrid_api_key === '***configured***') {
        delete dataToSend.sendgrid_api_key;
      }
      await api.put('/admin/settings', dataToSend);
      setTestResult({ success: true, message: 'Настройки сохранены' });
    } catch (error) {
      setTestResult({ success: false, message: 'Ошибка сохранения' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await api.post('/admin/email/test', {});
      setTestResult({ success: true, message: 'Тестовое письмо отправлено!' });
    } catch (error) {
      setTestResult({ success: false, message: error.response?.data?.detail || 'Ошибка отправки' });
    } finally {
      setTesting(false);
    }
  };

  const handleCreateCampaign = async () => {
    try {
      const filters = {};
      if (campaignForm.filters.tier) filters.tier = campaignForm.filters.tier;
      if (campaignForm.filters.min_balance) filters.min_balance = parseFloat(campaignForm.filters.min_balance);
      if (campaignForm.filters.kyc_status) filters.kyc_status = campaignForm.filters.kyc_status;

      await api.post('/admin/email/campaigns', {
        subject: campaignForm.subject,
        content: campaignForm.content,
        filters
      });
      setCreateCampaignOpen(false);
      setCampaignForm({
        subject: { ru: '', en: '' },
        content: { ru: '', en: '' },
        filters: { tier: '', min_balance: '', kyc_status: '' }
      });
      fetchData();
    } catch (error) {
      console.error('Error creating campaign:', error);
    }
  };

  const handleSendCampaign = async (campaignId) => {
    if (!window.confirm('Отправить рассылку? Это действие нельзя отменить.')) return;
    
    setSendingCampaign(campaignId);
    try {
      const response = await api.post(`/admin/email/campaigns/${campaignId}/send`);
      alert(`Рассылка запущена! Получателей: ${response.data.recipients_count}`);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Ошибка отправки');
    } finally {
      setSendingCampaign(null);
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
    <div className="p-8" data-testid="admin-email">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Mail className="w-6 h-6" />
          Email рассылки
        </h1>
        <p className="text-muted-foreground">Настройки email и массовые рассылки</p>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Настройки
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            Рассылки
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Шаблоны
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Настройки Email</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Provider Selection */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-base font-medium">Использовать SMTP</Label>
                  <p className="text-sm text-muted-foreground">
                    Выключено = SendGrid API, Включено = SMTP сервер
                  </p>
                </div>
                <Switch
                  checked={settings.use_smtp}
                  onCheckedChange={(checked) => setSettings({ ...settings, use_smtp: checked })}
                />
              </div>

              {/* Sender Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email отправителя *</Label>
                  <Input
                    value={settings.sender_email || ''}
                    onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })}
                    placeholder="noreply@altyncontract.kz"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Имя отправителя</Label>
                  <Input
                    value={settings.sender_name || ''}
                    onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
                    placeholder="Phillip Capital Invest"
                  />
                </div>
              </div>

              {/* SendGrid or SMTP */}
              {!settings.use_smtp ? (
                <div className="p-4 border rounded-lg space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    SendGrid API
                  </h3>
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      value={settings.sendgrid_api_key || ''}
                      onChange={(e) => setSettings({ ...settings, sendgrid_api_key: e.target.value })}
                      placeholder="SG.xxxxxxxxxxxx"
                    />
                    <p className="text-xs text-muted-foreground">
                      Получить ключ: <a href="https://sendgrid.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">sendgrid.com</a>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 border rounded-lg space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    SMTP настройки
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SMTP Host</Label>
                      <Input
                        value={settings.smtp_host || ''}
                        onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SMTP Port</Label>
                      <Input
                        type="number"
                        value={settings.smtp_port || 587}
                        onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) })}
                        placeholder="587"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        value={settings.smtp_username || ''}
                        onChange={(e) => setSettings({ ...settings, smtp_username: e.target.value })}
                        placeholder="your@email.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={settings.smtp_password || ''}
                        onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Test Result */}
              {testResult && (
                <div className={`p-4 rounded-lg flex items-center gap-2 ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {testResult.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  {testResult.message}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <Button onClick={handleSaveSettings} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Сохранить
                </Button>
                <Button variant="outline" onClick={handleTestEmail} disabled={testing}>
                  {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Тестовое письмо
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Массовые рассылки</CardTitle>
              <Dialog open={createCampaignOpen} onOpenChange={setCreateCampaignOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Создать рассылку
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Новая рассылка</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                    <div className="space-y-2">
                      <Label>Тема письма (RU) *</Label>
                      <Input
                        value={campaignForm.subject.ru}
                        onChange={(e) => setCampaignForm({
                          ...campaignForm,
                          subject: { ...campaignForm.subject, ru: e.target.value }
                        })}
                        placeholder="Важное уведомление от Phillip Capital Invest"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Содержание письма (RU) *</Label>
                      <Textarea
                        value={campaignForm.content.ru}
                        onChange={(e) => setCampaignForm({
                          ...campaignForm,
                          content: { ...campaignForm.content, ru: e.target.value }
                        })}
                        rows={8}
                        placeholder="<html><body>Уважаемый(ая) {{client_name}}, ...</body></html>"
                      />
                      <p className="text-xs text-muted-foreground">
                        Доступные переменные: {'{{client_name}}'}
                      </p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Фильтры получателей
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Уровень</Label>
                          <Select 
                            value={campaignForm.filters.tier} 
                            onValueChange={(v) => setCampaignForm({
                              ...campaignForm,
                              filters: { ...campaignForm.filters, tier: v }
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Все" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Все</SelectItem>
                              <SelectItem value="silver">Silver</SelectItem>
                              <SelectItem value="gold">Gold</SelectItem>
                              <SelectItem value="platinum">Platinum</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Мин. инвестиции ($)</Label>
                          <Input
                            type="number"
                            value={campaignForm.filters.min_balance}
                            onChange={(e) => setCampaignForm({
                              ...campaignForm,
                              filters: { ...campaignForm.filters, min_balance: e.target.value }
                            })}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>KYC статус</Label>
                          <Select 
                            value={campaignForm.filters.kyc_status} 
                            onValueChange={(v) => setCampaignForm({
                              ...campaignForm,
                              filters: { ...campaignForm.filters, kyc_status: v }
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Все" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Все</SelectItem>
                              <SelectItem value="approved">Подтверждён</SelectItem>
                              <SelectItem value="pending">На проверке</SelectItem>
                              <SelectItem value="none">Не начат</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleCreateCampaign} className="w-full">
                      Создать рассылку
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaigns.map((campaign) => (
                  <div key={campaign.campaign_id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{campaign.subject?.ru || 'Без темы'}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          ID: {campaign.campaign_id}
                        </p>
                        {campaign.filters && Object.keys(campaign.filters).length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {campaign.filters.tier && <Badge variant="outline">Tier: {campaign.filters.tier}</Badge>}
                            {campaign.filters.min_balance && <Badge variant="outline">Min: ${campaign.filters.min_balance}</Badge>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={
                          campaign.status === 'sent' ? 'bg-green-100 text-green-700' :
                          campaign.status === 'sending' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-700'
                        }>
                          {campaign.status === 'sent' ? `Отправлено (${campaign.sent_count || campaign.recipients_count})` :
                           campaign.status === 'sending' ? 'Отправляется...' : 'Черновик'}
                        </Badge>
                        {campaign.status === 'draft' && (
                          <Button 
                            size="sm" 
                            onClick={() => handleSendCampaign(campaign.campaign_id)}
                            disabled={sendingCampaign === campaign.campaign_id}
                          >
                            {sendingCampaign === campaign.campaign_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {campaigns.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Нет рассылок. Создайте первую рассылку.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Шаблоны писем</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Подтверждение инвестиции</h4>
                      <p className="text-sm text-muted-foreground">investment_confirmation</p>
                    </div>
                    <Badge className="bg-green-100 text-green-700">Встроенный</Badge>
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Напоминание об окончании контракта</h4>
                      <p className="text-sm text-muted-foreground">contract_expiry</p>
                    </div>
                    <Badge className="bg-green-100 text-green-700">Встроенный</Badge>
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Новый портфель</h4>
                      <p className="text-sm text-muted-foreground">new_portfolio</p>
                    </div>
                    <Badge className="bg-green-100 text-green-700">Встроенный</Badge>
                  </div>
                </div>
                {templates.map((template) => (
                  <div key={template.template_id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{template.subject?.ru || template.name}</h4>
                        <p className="text-sm text-muted-foreground">{template.name}</p>
                      </div>
                      <Badge variant="outline">{template.is_active ? 'Активен' : 'Отключён'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AdminEmail;
