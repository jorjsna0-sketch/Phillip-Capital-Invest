import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { 
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  DollarSign,
  CreditCard,
  RefreshCw,
  Eye,
  Filter
} from 'lucide-react';

export function AdminRequests() {
  const { api } = useAuth();
  const { formatCurrency, formatDate } = useLanguage();
  
  const [depositRequests, setDepositRequests] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  
  // Action dialog
  const [actionDialog, setActionDialog] = useState({ open: false, type: null, request: null });
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const [depositsRes, withdrawalsRes] = await Promise.all([
        api.get(`/admin/deposit-requests?status=${statusFilter === 'all' ? '' : statusFilter}`),
        api.get(`/admin/withdrawal-requests?status=${statusFilter === 'all' ? '' : statusFilter}`)
      ]);
      setDepositRequests(depositsRes.data);
      setWithdrawalRequests(withdrawalsRes.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const openActionDialog = (type, request, action) => {
    setActionDialog({ open: true, type, request, action });
    setAdminNotes('');
  };

  const handleAction = async () => {
    if (!actionDialog.request) return;
    
    setProcessing(true);
    try {
      const endpoint = actionDialog.type === 'deposit' 
        ? `/admin/deposit-requests/${actionDialog.request.request_id}`
        : `/admin/withdrawal-requests/${actionDialog.request.request_id}`;
      
      // Map action to status: "approve" -> "approved", "reject" -> "rejected"
      const status = actionDialog.action === 'approve' ? 'approved' : 'rejected';
      
      await api.put(endpoint, {
        status: status,
        admin_notes: adminNotes
      });
      
      setActionDialog({ open: false, type: null, request: null });
      fetchRequests();
    } catch (error) {
      console.error('Error processing request:', error);
      alert(error.response?.data?.detail || 'Ошибка обработки заявки');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Одобрено</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Отклонено</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" />Ожидает</Badge>;
    }
  };

  // Stats
  const pendingDeposits = depositRequests.filter(r => r.status === 'pending').length;
  const pendingWithdrawals = withdrawalRequests.filter(r => r.status === 'pending').length;
  const totalPendingDepositsAmount = depositRequests.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0);
  const totalPendingWithdrawalsAmount = withdrawalRequests.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const RequestCard = ({ request, type }) => (
    <div className={`p-4 border rounded-lg ${request.status === 'pending' ? 'border-amber-200 bg-amber-50/30' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            type === 'deposit' ? 'bg-green-100' : 'bg-blue-100'
          }`}>
            {type === 'deposit' 
              ? <ArrowDownCircle className="w-6 h-6 text-green-600" />
              : <ArrowUpCircle className="w-6 h-6 text-blue-600" />
            }
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xl font-bold">{formatCurrency(request.amount)}</p>
              {getStatusBadge(request.status)}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span className="font-medium text-foreground">{request.user_name || 'Клиент'}</span>
              {request.user_email && (
                <span className="text-xs">({request.user_email})</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ID: {request.request_id} • {formatDate(request.created_at)}
            </p>
            
            {type === 'withdrawal' && (
              <div className="mt-2 p-2 bg-gray-100 rounded text-sm">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <span><strong>{request.broker_name}</strong>: {request.broker_account}</span>
                </div>
              </div>
            )}

            {request.admin_notes && (
              <p className="text-sm text-muted-foreground mt-2 italic">
                Примечание: {request.admin_notes}
              </p>
            )}
          </div>
        </div>

        {request.status === 'pending' && (
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => openActionDialog(type, request, 'approve')}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Одобрить
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => openActionDialog(type, request, 'reject')}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Отклонить
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-8" data-testid="admin-requests">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-h2 text-primary">Заявки</h1>
          <p className="text-muted-foreground">Управление заявками на пополнение и вывод</p>
        </div>
        <Button variant="outline" onClick={fetchRequests}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Обновить
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="card-premium border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ожидают пополнения</p>
                <p className="text-xl font-bold">{pendingDeposits}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-premium border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Сумма пополнений</p>
                <p className="text-xl font-bold">{formatCurrency(totalPendingDepositsAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-premium border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ожидают вывода</p>
                <p className="text-xl font-bold">{pendingWithdrawals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-premium border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Сумма выводов</p>
                <p className="text-xl font-bold">{formatCurrency(totalPendingWithdrawalsAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Фильтр:</span>
        <div className="flex gap-2">
          {['pending', 'approved', 'rejected', 'all'].map(status => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status === 'pending' && 'Ожидающие'}
              {status === 'approved' && 'Одобренные'}
              {status === 'rejected' && 'Отклонённые'}
              {status === 'all' && 'Все'}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="deposits" className="space-y-6">
        <TabsList>
          <TabsTrigger value="deposits" className="relative">
            <ArrowDownCircle className="w-4 h-4 mr-2" />
            Пополнения
            {pendingDeposits > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                {pendingDeposits}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="relative">
            <ArrowUpCircle className="w-4 h-4 mr-2" />
            Выводы
            {pendingWithdrawals > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                {pendingWithdrawals}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deposits">
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>Заявки на пополнение</CardTitle>
            </CardHeader>
            <CardContent>
              {depositRequests.length > 0 ? (
                <div className="space-y-4">
                  {depositRequests.map((request) => (
                    <RequestCard key={request.request_id} request={request} type="deposit" />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ArrowDownCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Нет заявок на пополнение</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals">
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>Заявки на вывод</CardTitle>
            </CardHeader>
            <CardContent>
              {withdrawalRequests.length > 0 ? (
                <div className="space-y-4">
                  {withdrawalRequests.map((request) => (
                    <RequestCard key={request.request_id} request={request} type="withdrawal" />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ArrowUpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Нет заявок на вывод</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, type: null, request: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === 'approve' ? 'Одобрить заявку' : 'Отклонить заявку'}
            </DialogTitle>
          </DialogHeader>
          
          {actionDialog.request && (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Тип:</p>
                    <p className="font-medium">{actionDialog.type === 'deposit' ? 'Пополнение' : 'Вывод'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Сумма:</p>
                    <p className="font-medium text-lg">{formatCurrency(actionDialog.request.amount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Клиент:</p>
                    <p className="font-medium">{actionDialog.request.user_name || 'Клиент'}</p>
                    {actionDialog.request.user_email && (
                      <p className="text-sm text-muted-foreground">{actionDialog.request.user_email}</p>
                    )}
                  </div>
                  {actionDialog.type === 'withdrawal' && (
                    <div>
                      <p className="text-muted-foreground">Брокер:</p>
                      <p className="font-medium">{actionDialog.request.broker_name}</p>
                    </div>
                  )}
                </div>
              </div>

              {actionDialog.action === 'approve' && actionDialog.type === 'deposit' && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-800">
                    После одобрения <strong>{formatCurrency(actionDialog.request.amount)}</strong> будет 
                    зачислено на баланс клиента.
                  </p>
                </div>
              )}

              {actionDialog.action === 'approve' && actionDialog.type === 'withdrawal' && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    После одобрения <strong>{formatCurrency(actionDialog.request.amount)}</strong> будет 
                    списано с баланса клиента. Убедитесь, что перевод на счёт брокера выполнен.
                  </p>
                </div>
              )}

              {actionDialog.action === 'reject' && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-800">
                    Заявка будет отклонена. Рекомендуется указать причину в примечании.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Примечание (необязательно)</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={actionDialog.action === 'reject' ? 'Укажите причину отклонения...' : 'Комментарий...'}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, type: null, request: null })}>
              Отмена
            </Button>
            <Button 
              onClick={handleAction}
              disabled={processing}
              className={actionDialog.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {actionDialog.action === 'approve' ? 'Одобрить' : 'Отклонить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminRequests;
