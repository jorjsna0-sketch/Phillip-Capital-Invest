import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import { 
  FileText,
  Phone,
  Mail,
  MapPin,
  Upload,
  Trash2,
  Save,
  Loader2,
  ExternalLink,
  Check,
  Clock
} from 'lucide-react';

const DOCUMENT_TYPES = [
  { type: 'legal_info', label: 'Правовая информация', labelEn: 'Legal Information' },
  { type: 'privacy_policy', label: 'Политика конфиденциальности', labelEn: 'Privacy Policy' },
  { type: 'disclosure', label: 'Раскрытие информации', labelEn: 'Disclosure' },
  { type: 'fees', label: 'Тарифы и комиссии', labelEn: 'Fees & Commissions' }
];

export function AdminSiteContent() {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [contactInfo, setContactInfo] = useState({
    phone: '',
    phone_hours: { ru: '', en: '', kz: '' },
    email: '',
    address: { ru: '', en: '', kz: '' }
  });
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const fileInputRefs = useRef({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [docsRes, contactRes] = await Promise.all([
        api.get('/admin/site-documents'),
        api.get('/admin/contact-info')
      ]);
      setDocuments(docsRes.data || []);
      if (contactRes.data) {
        setContactInfo({
          phone: contactRes.data.phone || '',
          phone_hours: contactRes.data.phone_hours || { ru: '', en: '', kz: '' },
          email: contactRes.data.email || '',
          address: contactRes.data.address || { ru: '', en: '', kz: '' }
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (docType, file) => {
    if (!file || file.type !== 'application/pdf') {
      toast.error('Пожалуйста, выберите PDF файл');
      return;
    }

    setUploadingDoc(docType);

    try {
      // Upload file to backend
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const fileUrl = uploadRes.data.url;

      // Save document reference
      await api.post('/admin/site-documents', {
        doc_type: docType,
        file_url: fileUrl,
        title: {
          ru: DOCUMENT_TYPES.find(d => d.type === docType)?.label || '',
          en: DOCUMENT_TYPES.find(d => d.type === docType)?.labelEn || ''
        }
      });

      toast.success('Документ загружен');
      fetchData();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Ошибка загрузки документа');
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleDeleteDocument = async (docType) => {
    if (!confirm('Удалить документ?')) return;

    try {
      await api.delete(`/admin/site-documents/${docType}`);
      toast.success('Документ удалён');
      fetchData();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Ошибка удаления');
    }
  };

  const handleSaveContactInfo = async () => {
    setSaving(true);
    try {
      await api.put('/admin/contact-info', contactInfo);
      toast.success('Контактная информация сохранена');
    } catch (error) {
      console.error('Error saving contact info:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const getDocumentByType = (docType) => {
    return documents.find(d => d.doc_type === docType);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="admin-site-content">
      <div className="mb-8">
        <h1 className="text-h2 text-primary">Контент сайта</h1>
        <p className="text-muted-foreground">Управление документами и контактной информацией</p>
      </div>

      <Tabs defaultValue="documents" className="max-w-4xl">
        <TabsList className="mb-6">
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Документы
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Контакты
          </TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>PDF Документы</CardTitle>
              <CardDescription>
                Загрузите PDF файлы для раздела "Документы" в футере сайта
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {DOCUMENT_TYPES.map((docType) => {
                const doc = getDocumentByType(docType.type);
                const isUploading = uploadingDoc === docType.type;

                return (
                  <div 
                    key={docType.type}
                    className="flex items-center justify-between p-4 border rounded-lg bg-gray-50/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc ? 'bg-green-100' : 'bg-gray-200'}`}>
                        {doc ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <FileText className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{docType.label}</p>
                        <p className="text-sm text-muted-foreground">{docType.labelEn}</p>
                        {doc && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Обновлено: {new Date(doc.updated_at).toLocaleDateString('ru-RU')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {doc && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Открыть
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDocument(docType.type)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        ref={el => fileInputRefs.current[docType.type] = el}
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleFileUpload(docType.type, e.target.files[0]);
                          }
                        }}
                      />
                      <Button
                        variant={doc ? "outline" : "default"}
                        size="sm"
                        onClick={() => fileInputRefs.current[docType.type]?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-1" />
                            {doc ? 'Заменить' : 'Загрузить'}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>Контактная информация</CardTitle>
              <CardDescription>
                Эта информация отображается в футере сайта
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Phone */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <Phone className="w-5 h-5" />
                  <Label className="text-base font-medium">Телефон</Label>
                </div>
                <div className="grid md:grid-cols-2 gap-4 pl-7">
                  <div>
                    <Label>Номер телефона</Label>
                    <Input
                      value={contactInfo.phone}
                      onChange={(e) => setContactInfo({...contactInfo, phone: e.target.value})}
                      placeholder="+7 (727) 123-45-67"
                    />
                  </div>
                  <div>
                    <Label>Часы работы (RU)</Label>
                    <Input
                      value={contactInfo.phone_hours?.ru || ''}
                      onChange={(e) => setContactInfo({
                        ...contactInfo, 
                        phone_hours: {...contactInfo.phone_hours, ru: e.target.value}
                      })}
                      placeholder="Пн-Пт: 9:00 - 18:00"
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <Mail className="w-5 h-5" />
                  <Label className="text-base font-medium">Email</Label>
                </div>
                <div className="pl-7">
                  <Input
                    type="email"
                    value={contactInfo.email}
                    onChange={(e) => setContactInfo({...contactInfo, email: e.target.value})}
                    placeholder="info@altyncontract.kz"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <MapPin className="w-5 h-5" />
                  <Label className="text-base font-medium">Адрес</Label>
                </div>
                <div className="space-y-3 pl-7">
                  <div>
                    <Label>Адрес (RU)</Label>
                    <Input
                      value={contactInfo.address?.ru || ''}
                      onChange={(e) => setContactInfo({
                        ...contactInfo, 
                        address: {...contactInfo.address, ru: e.target.value}
                      })}
                      placeholder="г. Алматы, пр. Аль-Фараби, 77/8"
                    />
                  </div>
                  <div>
                    <Label>Адрес (EN)</Label>
                    <Input
                      value={contactInfo.address?.en || ''}
                      onChange={(e) => setContactInfo({
                        ...contactInfo, 
                        address: {...contactInfo.address, en: e.target.value}
                      })}
                      placeholder="77/8 Al-Farabi Ave., Almaty"
                    />
                  </div>
                  <div>
                    <Label>Адрес (KZ)</Label>
                    <Input
                      value={contactInfo.address?.kz || ''}
                      onChange={(e) => setContactInfo({
                        ...contactInfo, 
                        address: {...contactInfo.address, kz: e.target.value}
                      })}
                      placeholder="Алматы қ., Әл-Фараби д., 77/8"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button onClick={handleSaveContactInfo} disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Сохранить контакты
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AdminSiteContent;
