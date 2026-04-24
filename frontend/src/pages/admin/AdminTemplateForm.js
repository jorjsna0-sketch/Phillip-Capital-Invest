import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  ArrowLeft,
  Loader2,
  FileText,
  Save,
  Languages,
  Download,
  Eye,
  Copy,
  CheckCircle
} from 'lucide-react';

export function AdminTemplateForm() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const { formatDateTime } = useLanguage();
  
  const isEditing = !!templateId;
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: { ru: '', tr: '', en: '' },
    is_default: false
  });

  const variables = [
    { name: '{{contract_id}}', desc: 'ID контракта' },
    { name: '{{client_name}}', desc: 'Имя клиента' },
    { name: '{{client_email}}', desc: 'Email клиента' },
    { name: '{{portfolio_name}}', desc: 'Название портфеля' },
    { name: '{{amount}}', desc: 'Сумма инвестиции' },
    { name: '{{currency}}', desc: 'Валюта' },
    { name: '{{duration}}', desc: 'Срок' },
    { name: '{{expected_return}}', desc: 'Ожидаемая доходность' },
    { name: '{{annual_rate}}', desc: 'Годовая ставка %' },
    { name: '{{start_date}}', desc: 'Дата начала' },
    { name: '{{end_date}}', desc: 'Дата окончания' },
    { name: '{{auto_reinvest}}', desc: 'Автопродление (Да/Нет)' },
    { name: '{{company_name}}', desc: 'Название компании' },
    { name: '{{company_director}}', desc: 'Директор компании' },
    { name: '{{company_license}}', desc: 'Лицензия' },
    { name: '{{company_bin}}', desc: 'БИН компании' },
  ];

  const defaultTemplate = `ИНВЕСТИЦИОННЫЙ ДОГОВОР №{{contract_id}}

г. Алматы                                                           {{start_date}}

Компания {{company_name}}, в лице {{company_director}}, именуемая в дальнейшем "Управляющая компания", и {{client_name}}, именуемый(ая) в дальнейшем "Инвестор", заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА

1.1. Инвестор передает Управляющей компании денежные средства в размере {{amount}} {{currency}} для управления в соответствии с инвестиционным портфелем "{{portfolio_name}}".

1.2. Срок действия договора: {{duration}} месяцев.

1.3. Ожидаемая доходность: {{expected_return}} {{currency}} ({{annual_rate}}% годовых).

2. ПРАВА И ОБЯЗАННОСТИ СТОРОН

2.1. Управляющая компания обязуется:
- Осуществлять управление средствами Инвестора в соответствии с выбранной стратегией
- Предоставлять отчетность о состоянии инвестиций
- Соблюдать конфиденциальность персональных данных Инвестора

2.2. Инвестор обязуется:
- Предоставить достоверные персональные данные
- Не выводить средства до окончания срока договора без согласования

3. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ

3.1. Договор вступает в силу с момента подписания.
3.2. Дата окончания договора: {{end_date}}.
3.3. Автоматическое продление: {{auto_reinvest}}.

ПОДПИСИ СТОРОН

Управляющая компания:                    Инвестор:
{{company_name}}                         {{client_name}}
{{company_director}}                     {{client_email}}
                                         
_____________________                    _____________________
        М.П.`;

  useEffect(() => {
    if (isEditing) {
      fetchTemplate();
    }
  }, [templateId]);

  const fetchTemplate = async () => {
    try {
      const response = await api.get('/admin/contract-templates');
      const template = response.data.find(t => t.template_id === templateId);
      if (template) {
        setFormData({
          name: template.name || '',
          description: template.description || '',
          content: template.content || { ru: '', tr: '', en: '' },
          is_default: template.is_default || false
        });
      } else {
        navigate('/admin/templates');
      }
    } catch (error) {
      console.error('Error fetching template:', error);
      navigate('/admin/templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.content.ru) {
      alert('Заполните название и текст договора на русском языке');
      return;
    }
    
    setSubmitting(true);
    try {
      if (isEditing) {
        await api.put(`/admin/contract-templates/${templateId}`, formData);
      } else {
        await api.post('/admin/contract-templates', formData);
      }
      navigate('/admin/templates');
    } catch (error) {
      console.error('Error saving template:', error);
      alert(error.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTranslate = async () => {
    if (!formData.content.ru) {
      alert('Сначала введите текст договора на русском языке');
      return;
    }
    
    setTranslating(true);
    try {
      const response = await api.post('/translate', {
        text: formData.content.ru,
        source_lang: 'ru',
        target_langs: ['tr', 'en']
      });
      
      setFormData({
        ...formData,
        content: {
          ...formData.content,
          tr: response.data.translations.tr || '',
          en: response.data.translations.en || ''
        }
      });
      
      alert('Перевод выполнен успешно!');
    } catch (error) {
      console.error('Translation error:', error);
      alert('Ошибка перевода: ' + (error.response?.data?.detail || error.message));
    } finally {
      setTranslating(false);
    }
  };

  const handlePreview = async () => {
    if (!isEditing) {
      alert('Сначала сохраните шаблон');
      return;
    }
    
    setPreviewLoading(true);
    try {
      const response = await api.get(`/admin/contract-templates/${templateId}/preview`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (error) {
      console.error('Preview error:', error);
      alert('Ошибка предпросмотра');
    } finally {
      setPreviewLoading(false);
    }
  };

  const copyVariable = (variable) => {
    navigator.clipboard.writeText(variable);
  };

  const insertDefaultTemplate = () => {
    setFormData({
      ...formData,
      content: { ...formData.content, ru: defaultTemplate }
    });
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl" data-testid="admin-template-form">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => navigate('/admin/templates')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>
        <div className="flex-1">
          <h1 className="text-h2 text-primary">
            {isEditing ? 'Редактирование шаблона' : 'Создание шаблона'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? formData.name : 'Создайте новый шаблон договора'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEditing && (
            <Button 
              variant="outline" 
              onClick={handlePreview}
              disabled={previewLoading}
            >
              {previewLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              Предпросмотр PDF
            </Button>
          )}
          <Button 
            onClick={handleSubmit} 
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isEditing ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Основная информация
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Название шаблона *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Стандартный инвестиционный договор"
                />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Краткое описание шаблона"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({...formData, is_default: checked})}
              />
              <Label htmlFor="is_default">Использовать по умолчанию для новых портфелей</Label>
            </div>
          </CardContent>
        </Card>

        {/* Contract Text */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3 bg-primary/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-primary">
                <FileText className="w-4 h-4" />
                Текст договора
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleTranslate}
                disabled={translating || !formData.content.ru}
                className="text-blue-700 border-blue-300"
              >
                {translating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Languages className="w-4 h-4 mr-2" />
                )}
                Автоперевод на TR/EN
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <Tabs defaultValue="ru">
              <TabsList>
                <TabsTrigger value="ru">Русский *</TabsTrigger>
                <TabsTrigger value="tr">
                  Türkçe
                  {formData.content.tr && <CheckCircle className="w-3 h-3 ml-1 text-green-600" />}
                </TabsTrigger>
                <TabsTrigger value="en">
                  English
                  {formData.content.en && <CheckCircle className="w-3 h-3 ml-1 text-green-600" />}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="ru" className="space-y-3">
                <div className="flex justify-end">
                  {!formData.content.ru && (
                    <Button variant="ghost" size="sm" onClick={insertDefaultTemplate}>
                      <Copy className="w-3 h-3 mr-1" />
                      Вставить шаблон по умолчанию
                    </Button>
                  )}
                </div>
                <Textarea
                  value={formData.content.ru}
                  onChange={(e) => setFormData({
                    ...formData, 
                    content: {...formData.content, ru: e.target.value}
                  })}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder={defaultTemplate}
                />
              </TabsContent>
              
              <TabsContent value="tr">
                <Textarea
                  value={formData.content.tr || ''}
                  onChange={(e) => setFormData({
                    ...formData, 
                    content: {...formData.content, tr: e.target.value}
                  })}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="'Автоперевод на TR/EN' для автоматического перевода с русского..."
                />
              </TabsContent>
              
              <TabsContent value="en">
                <Textarea
                  value={formData.content.en}
                  onChange={(e) => setFormData({
                    ...formData, 
                    content: {...formData.content, en: e.target.value}
                  })}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="Click 'Auto-translate to KZ/EN' to translate from Russian..."
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Variables Reference */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-blue-800">Доступные переменные</CardTitle>
            <p className="text-xs text-blue-600">Нажмите на переменную, чтобы скопировать</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {variables.map((v) => (
                <Button
                  key={v.name}
                  variant="outline"
                  size="sm"
                  className="justify-start h-auto py-2 font-mono text-xs hover:bg-blue-100"
                  onClick={() => copyVariable(v.name)}
                  title={v.desc}
                >
                  <span className="truncate">{v.name}</span>
                  <Copy className="w-3 h-3 ml-auto opacity-50" />
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AdminTemplateForm;
