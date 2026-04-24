import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  Loader2,
  Plus,
  Edit,
  Trash2,
  Mail,
  FileText,
  Save,
  X,
  Eye
} from 'lucide-react';

const DEFAULT_TEMPLATES = [
  { name: 'investment_confirmation', label: 'Подтверждение инвестиции', description: 'Отправляется при создании новой инвестиции' },
  { name: 'deposit_confirmed', label: 'Депозит подтверждён', description: 'Отправляется при одобрении депозита' },
  { name: 'withdrawal_confirmed', label: 'Вывод подтверждён', description: 'Отправляется при одобрении вывода' },
  { name: 'profit_accrued', label: 'Начисление прибыли', description: 'Отправляется при начислении прибыли' },
  { name: 'kyc_approved', label: 'KYC одобрен', description: 'Отправляется при одобрении верификации' },
  { name: 'kyc_rejected', label: 'KYC отклонён', description: 'Отправляется при отклонении верификации' },
  { name: 'welcome', label: 'Приветствие', description: 'Отправляется при регистрации' }
];

export function AdminEmailTemplates() {
  const { api } = useAuth();
  const { t } = useLanguage();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    subject: { ru: '', en: '', tr: '' },
    content: { ru: '', en: '', tr: '' },
    is_active: true
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/admin/email/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingTemplate) {
        await api.put(`/admin/email/templates/${editingTemplate.template_id}`, form);
      } else {
        await api.post('/admin/email/templates', form);
      }
      setDialogOpen(false);
      resetForm();
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId) => {
    if (!confirm('Удалить шаблон?')) return;
    try {
      await api.delete(`/admin/email/templates/${templateId}`);
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const openEdit = (template) => {
    setEditingTemplate(template);
    setForm({
      name: template.name,
      description: template.description || '',
      subject: template.subject || { ru: '', en: '', tr: '' },
      content: template.content || { ru: '', en: '', tr: '' },
      is_active: template.is_active !== false
    });
    setDialogOpen(true);
  };

  const openCreate = (preset = null) => {
    setEditingTemplate(null);
    if (preset) {
      setForm({
        name: preset.name,
        description: preset.description,
        subject: { ru: '', en: '', tr: '' },
        content: { ru: '', en: '', tr: '' },
        is_active: true
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      subject: { ru: '', en: '', tr: '' },
      content: { ru: '', en: '', tr: '' },
      is_active: true
    });
    setEditingTemplate(null);
  };

  const openPreview = (content) => {
    setPreviewContent(content);
    setPreviewOpen(true);
  };

  const getTemplateLabel = (name) => {
    const preset = DEFAULT_TEMPLATES.find(t => t.name === name);
    return preset ? preset.label : name;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Find which default templates are missing
  const existingNames = templates.map(t => t.name);
  const missingTemplates = DEFAULT_TEMPLATES.filter(t => !existingNames.includes(t.name));

  return (
    <div className="p-8" data-testid="admin-email-templates">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-h2 text-primary">Шаблоны писем</h1>
          <p className="text-muted-foreground">Настройка email уведомлений</p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus className="w-4 h-4 mr-2" />
          Создать шаблон
        </Button>
      </div>

      {/* Suggest missing templates */}
      {missingTemplates.length > 0 && (
        <Card className="mb-6 border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Рекомендуемые шаблоны
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {missingTemplates.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => openCreate(preset)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {preset.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates list */}
      <div className="grid gap-4">
        {templates.length > 0 ? (
          templates.map((template) => (
            <Card key={template.template_id} className="card-premium">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mt-1">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{getTemplateLabel(template.name)}</h3>
                        <Badge variant={template.is_active ? 'default' : 'secondary'}>
                          {template.is_active ? 'Активен' : 'Неактивен'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description || `Код: ${template.name}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Тема (RU): {template.subject?.ru || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {template.content?.ru && (
                      <Button variant="ghost" size="sm" onClick={() => openPreview(template.content?.ru)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openEdit(template)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(template.template_id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="card-premium">
            <CardContent className="py-12 text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Шаблоны не созданы</p>
              <p className="text-sm text-muted-foreground">Создайте шаблоны для автоматических уведомлений</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Редактировать шаблон' : 'Создать шаблон'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Код шаблона *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  placeholder="investment_confirmation"
                  disabled={!!editingTemplate}
                />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  placeholder="Описание шаблона"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({...form, is_active: checked})}
              />
              <Label>Активен</Label>
            </div>

            <Tabs defaultValue="ru" className="mt-4">
              <TabsList>
                <TabsTrigger value="ru">🇷🇺 Русский</TabsTrigger>
                <TabsTrigger value="en">🇬🇧 English</TabsTrigger>
                <TabsTrigger value="tr">🇹🇷 Türkçe</TabsTrigger>
              </TabsList>

              {['ru', 'en', 'tr'].map((lang) => (
                <TabsContent key={lang} value={lang} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Тема письма</Label>
                    <Input
                      value={form.subject[lang] || ''}
                      onChange={(e) => setForm({
                        ...form, 
                        subject: {...form.subject, [lang]: e.target.value}
                      })}
                      placeholder={lang === 'ru' ? 'Тема письма' : lang === 'en' ? 'Email subject' : 'E-posta konusu'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Содержимое (HTML)</Label>
                    <Textarea
                      value={form.content[lang] || ''}
                      onChange={(e) => setForm({
                        ...form, 
                        content: {...form.content, [lang]: e.target.value}
                      })}
                      rows={12}
                      placeholder={`HTML содержимое письма...

Доступные переменные:
{{user_name}} - Имя пользователя
{{user_email}} - Email пользователя
{{amount}} - Сумма
{{currency}} - Валюта
{{portfolio_name}} - Название портфеля
{{date}} - Дата`}
                      className="font-mono text-sm"
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Предпросмотр</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg p-4 bg-white">
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewContent || '', {
              ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'blockquote', 'code', 'pre', 'hr'],
              ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'style', 'class', 'width', 'height'],
              ALLOW_DATA_ATTR: false
            }) }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminEmailTemplates;
