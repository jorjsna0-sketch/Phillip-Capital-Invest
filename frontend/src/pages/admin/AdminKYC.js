import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { 
  Check,
  X,
  Eye,
  Loader2
} from 'lucide-react';

export function AdminKYC() {
  const { api } = useAuth();
  const { t, formatDateTime } = useLanguage();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await api.get('/admin/kyc/pending');
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (kycId, status) => {
    setSubmitting(true);
    try {
      await api.put(`/admin/kyc/${kycId}`, {
        status,
        rejection_reason: status === 'rejected' ? rejectionReason : null
      });
      setSelectedDoc(null);
      setRejectionReason('');
      fetchDocuments();
    } catch (error) {
      console.error('Error reviewing KYC:', error);
    } finally {
      setSubmitting(false);
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
    <div className="p-8" data-testid="admin-kyc">
      <div className="mb-8">
        <h1 className="text-h2 text-primary">{t('admin_kyc')}</h1>
        <p className="text-muted-foreground">Проверка документов пользователей</p>
      </div>

      <Card className="card-premium">
        <CardHeader>
          <CardTitle>Ожидают проверки ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length > 0 ? (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc.kyc_id} className="p-4 border border-gray-100 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{doc.user_name || doc.user_id}</p>
                      <p className="text-sm text-primary">{doc.user_email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">
                          {doc.document_type === 'passport' ? 'Паспорт' : 'Подтв. адреса'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDateTime(doc.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDoc(doc)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Просмотр
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-500 hover:bg-green-600"
                        onClick={() => handleReview(doc.kyc_id, 'approved')}
                        disabled={submitting}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Одобрить
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setSelectedDoc({...doc, action: 'reject'})}
                        disabled={submitting}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Отклонить
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-12">
              Нет документов на проверке
            </p>
          )}
        </CardContent>
      </Card>

      {/* View/Reject Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDoc?.action === 'reject' ? 'Отклонить документ' : 'Просмотр документа'}
            </DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4 py-4">
              <div>
                <p className="text-sm text-muted-foreground">Пользователь</p>
                <p className="font-medium">{selectedDoc.user_name || selectedDoc.user_id}</p>
                <p className="text-sm text-primary">{selectedDoc.user_email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Тип документа</p>
                <p className="font-medium">
                  {selectedDoc.document_type === 'passport' ? 'Паспорт' : 'Подтверждение адреса'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ссылка на документ</p>
                <a 
                  href={selectedDoc.document_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {selectedDoc.document_url}
                </a>
              </div>

              {selectedDoc.action === 'reject' && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Причина отклонения</p>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Укажите причину отклонения..."
                    rows={3}
                  />
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => handleReview(selectedDoc.kyc_id, 'rejected')}
                    disabled={submitting || !rejectionReason.trim()}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Отклонить
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminKYC;
