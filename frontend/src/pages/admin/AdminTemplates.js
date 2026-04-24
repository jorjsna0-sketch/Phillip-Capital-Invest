import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { 
  Plus,
  Edit,
  Loader2,
  FileText,
  Trash2,
  Star,
  Eye,
  Download
} from 'lucide-react';

export function AdminTemplates() {
  const navigate = useNavigate();
  const { api } = useAuth();
  const { t, formatDateTime } = useLanguage();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/admin/contract-templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId) => {
    try {
      await api.delete(`/admin/contract-templates/${templateId}`);
      setDeleteConfirmId(null);
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Ошибка удаления шаблона');
    }
  };

  const handleSetDefault = async (templateId) => {
    try {
      await api.put(`/admin/contract-templates/${templateId}`, { is_default: true });
      fetchTemplates();
    } catch (error) {
      console.error('Error setting default:', error);
    }
  };

  const handlePreview = async (template) => {
    setPreviewLoading(template.template_id);
    try {
      const response = await api.get(`/admin/contract-templates/${template.template_id}/preview`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (error) {
      console.error('Preview error:', error);
      alert('Ошибка предпросмотра');
    } finally {
      setPreviewLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="admin-templates">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-h2 text-primary">{t('admin_templates')}</h1>
          <p className="text-muted-foreground">Шаблоны контрактов для генерации PDF</p>
        </div>
        
        <Button 
          className="btn-primary" 
          onClick={() => navigate('/admin/templates/create')}
          data-testid="create-template-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Создать шаблон
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="card-glass">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Всего шаблонов</p>
                <p className="text-2xl font-bold text-primary">{templates.length}</p>
              </div>
              <FileText className="w-8 h-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">По умолчанию</p>
                <p className="text-2xl font-bold text-amber-600">
                  {templates.filter(t => t.is_default).length}
                </p>
              </div>
              <Star className="w-8 h-8 text-amber-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Активные</p>
                <p className="text-2xl font-bold text-green-600">
                  {templates.filter(t => t.is_active !== false).length}
                </p>
              </div>
              <FileText className="w-8 h-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Шаблоны ({templates.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length > 0 ? (
            <div className="space-y-4">
              {templates.map((template) => (
                <div 
                  key={template.template_id} 
                  className={`p-4 border rounded-lg hover:bg-gray-50/50 transition-colors ${
                    template.is_default ? 'border-primary/30 bg-primary/5' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-5 h-5 text-primary" />
                        <h3 className="font-medium">{template.name}</h3>
                        {template.is_default && (
                          <Badge className="bg-primary/10 text-primary">
                            <Star className="w-3 h-3 mr-1 fill-current" />
                            По умолчанию
                          </Badge>
                        )}
                        {template.is_active !== false && (
                          <Badge className="bg-green-100 text-green-700">Активный</Badge>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mb-2">
                        ID: {template.template_id} • Создан: {formatDateTime(template.created_at)}
                      </p>
                      <div className="bg-gray-50 rounded p-3 max-h-24 overflow-hidden relative">
                        <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap">
                          {template.content?.ru?.substring(0, 300)}...
                        </pre>
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 to-transparent" />
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2 ml-4">
                      {!template.is_default && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSetDefault(template.template_id)}
                          title="Установить по умолчанию"
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handlePreview(template)}
                        disabled={previewLoading === template.template_id}
                        title="Предпросмотр PDF"
                      >
                        {previewLoading === template.template_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => navigate(`/admin/templates/edit/${template.template_id}`)} 
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteConfirmId(template.template_id)}
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Нет шаблонов контрактов</p>
              <Button onClick={() => navigate('/admin/templates/create')}>
                <Plus className="w-4 h-4 mr-2" />
                Создать первый шаблон
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить шаблон?</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-muted-foreground">
            Вы уверены, что хотите удалить этот шаблон? Это действие нельзя отменить.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Отмена</Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={() => handleDelete(deleteConfirmId)}
            >
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminTemplates;
