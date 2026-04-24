import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { 
  Plus,
  Send,
  Loader2,
  Mail
} from 'lucide-react';

export function AdminEmails() {
  const { api } = useAuth();
  const { t, formatDateTime } = useLanguage();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    subject: { ru: '', en: '' },
    content: { ru: '', en: '' },
    filters: { min_balance: '', tier: '' }
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/admin/email-campaigns');
      setCampaigns(response.data);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const filters = {};
      if (formData.filters.min_balance) {
        filters.min_balance = parseFloat(formData.filters.min_balance);
      }
      if (formData.filters.tier) {
        filters.tier = formData.filters.tier;
      }

      await api.post('/admin/email-campaigns', {
        subject: formData.subject,
        content: formData.content,
        filters
      });
      setCreateOpen(false);
      setFormData({
        subject: { ru: '', en: '' },
        content: { ru: '', en: '' },
        filters: { min_balance: '', tier: '' }
      });
      fetchCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSend = async (campaignId) => {
    if (!window.confirm('Отправить рассылку? Это действие нельзя отменить.')) return;
    try {
      await api.post(`/admin/email-campaigns/${campaignId}/send`);
      fetchCampaigns();
    } catch (error) {
      console.error('Error sending campaign:', error);
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
    <div className="p-8" data-testid="admin-emails">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-h2 text-primary">{t('admin_emails')}</h1>
          <p className="text-muted-foreground">Массовые email рассылки</p>
        </div>
        
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary" data-testid="create-campaign-btn">
              <Plus className="w-4 h-4 mr-2" />
              Создать рассылку
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Создать email рассылку</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Тема (RU)</Label>
                  <Input
                    value={formData.subject.ru}
                    onChange={(e) => setFormData({...formData, subject: {...formData.subject, ru: e.target.value}})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Тема (EN)</Label>
                  <Input
                    value={formData.subject.en}
                    onChange={(e) => setFormData({...formData, subject: {...formData.subject, en: e.target.value}})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Содержание (RU)</Label>
                <Textarea
                  value={formData.content.ru}
                  onChange={(e) => setFormData({...formData, content: {...formData.content, ru: e.target.value}})}
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label>Содержание (EN)</Label>
                <Textarea
                  value={formData.content.en}
                  onChange={(e) => setFormData({...formData, content: {...formData.content, en: e.target.value}})}
                  rows={5}
                />
              </div>

              <div className="border-t pt-4">
                <p className="font-medium mb-3">Фильтры получателей</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Мин. баланс (USD)</Label>
                    <Input
                      type="number"
                      value={formData.filters.min_balance}
                      onChange={(e) => setFormData({...formData, filters: {...formData.filters, min_balance: e.target.value}})}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Уровень</Label>
                    <Input
                      value={formData.filters.tier}
                      onChange={(e) => setFormData({...formData, filters: {...formData.filters, tier: e.target.value}})}
                      placeholder="silver, gold, platinum"
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleCreate} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Создать
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="card-premium">
        <CardHeader>
          <CardTitle>Рассылки ({campaigns.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length > 0 ? (
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <div key={campaign.campaign_id} className="p-4 border border-gray-100 rounded-md">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={campaign.status === 'sent' ? 'default' : 'secondary'}>
                          {campaign.status === 'sent' ? 'Отправлено' : 'Черновик'}
                        </Badge>
                        <span className="font-mono text-xs">{campaign.campaign_id}</span>
                      </div>
                      <h3 className="font-medium">{campaign.subject?.ru || campaign.subject?.en}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {campaign.content?.ru || campaign.content?.en}
                      </p>
                      {campaign.status === 'sent' && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Отправлено: {campaign.recipients_count} получателей • {formatDateTime(campaign.sent_at)}
                        </p>
                      )}
                    </div>
                    {campaign.status === 'draft' && (
                      <Button 
                        size="sm"
                        onClick={() => handleSend(campaign.campaign_id)}
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Отправить
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-muted-foreground">Нет рассылок</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminEmails;
