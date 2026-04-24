import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { 
  ArrowLeft,
  Loader2,
  User,
  Award,
  Wallet,
  FileText,
  History,
  Shield,
  Plus,
  Minus,
  Edit,
  Download,
  Eye,
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Calendar,
  Mail,
  Phone,
  MapPin,
  AlertTriangle,
  RefreshCw,
  Send,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  KeyRound
} from 'lucide-react';

export function AdminUserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const { formatCurrency, formatDate } = useLanguage();
  
  // Safe date formatter
  const safeFormatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return '-';
    }
  };
  
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceOperation, setBalanceOperation] = useState('add');
  const [balanceReason, setBalanceReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({});
  
  // Contract termination state
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState(null);
  const [terminateWithPayout, setTerminateWithPayout] = useState(true);
  const [terminateReason, setTerminateReason] = useState('');

  const fetchUserData = useCallback(async () => {
    try {
      const response = await api.get(`/admin/users/${userId}`);
      setUserData(response.data);
      setEditData({
        name: response.data.name || '',
        phone: response.data.phone || '',
        tier: response.data.tier || 'silver'
      });
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  }, [api, userId]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleBalanceUpdate = async () => {
    if (!balanceAmount || parseFloat(balanceAmount) <= 0) return;
    
    setSubmitting(true);
    try {
      await api.put(`/admin/users/${userId}/balance`, {
        amount: parseFloat(balanceAmount),
        currency: 'USD',
        operation: balanceOperation,  // 'add' or 'subtract'
        reason: balanceReason || (balanceOperation === 'add' ? 'Пополнение администратором' : 'Списание администратором')
      });
      
      setBalanceDialogOpen(false);
      setBalanceAmount('');
      setBalanceReason('');
      fetchUserData();
    } catch (error) {
      console.error('Error updating balance:', error);
      alert(error.response?.data?.detail || 'Ошибка обновления баланса');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUserUpdate = async () => {
    setSubmitting(true);
    try {
      await api.put(`/admin/users/${userId}`, editData);
      setEditDialogOpen(false);
      fetchUserData();
    } catch (error) {
      console.error('Error updating user:', error);
      alert(error.response?.data?.detail || 'Ошибка обновления');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKycAction = async (action) => {
    if (!userData?.kyc_documents?.length) return;
    
    const kycId = userData.kyc_documents[0].kyc_id;
    try {
      await api.put(`/admin/kyc/${kycId}`, {
        status: action,
        notes: action === 'approved' ? 'Одобрено администратором' : 'Отклонено администратором'
      });
      fetchUserData();
    } catch (error) {
      console.error('Error updating KYC:', error);
    }
  };

  // Delete user state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteWithPayout, setDeleteWithPayout] = useState(true);

  const handleDeleteUser = async () => {
    setSubmitting(true);
    try {
      const activeCount = investments?.filter(inv => inv.status === 'active')?.length || 0;
      const withPayout = deleteWithPayout;
      
      await api.delete(`/admin/users/${userId}?force=true&with_payout=${withPayout}`);
      alert('Пользователь удалён');
      navigate('/admin/users');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(error.response?.data?.detail || 'Ошибка удаления пользователя');
    } finally {
      setSubmitting(false);
      setDeleteDialogOpen(false);
    }
  };

  const openDeleteDialog = () => {
    setDeleteWithPayout(true);
    setDeleteDialogOpen(true);
  };

  const handleToggleInvestWithoutKyc = async () => {
    setSubmitting(true);
    try {
      const newValue = !user?.can_invest_without_kyc;
      await api.put(`/admin/users/${userId}`, {
        can_invest_without_kyc: newValue
      });
      fetchUserData();
    } catch (error) {
      console.error('Error updating user:', error);
      alert(error.response?.data?.detail || 'Ошибка обновления');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable2FA = async (method) => {
    const methodName = method === 'totp' ? 'Google Authenticator' : 'Email 2FA';
    if (!confirm(`Вы уверены, что хотите отключить ${methodName} для этого пользователя?`)) return;
    
    setSubmitting(true);
    try {
      await api.post(`/admin/users/${userId}/disable-2fa`, { method });
      alert(`${methodName} отключён`);
      fetchUserData();
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      alert(error.response?.data?.detail || 'Ошибка отключения 2FA');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTerminateInvestment = async () => {
    if (!selectedInvestment) return;
    
    if (!terminateWithPayout && !terminateReason) {
      alert('Укажите причину для завершения без выплаты');
      return;
    }
    
    setSubmitting(true);
    try {
      const response = await api.post(`/admin/investments/${selectedInvestment.investment_id}/terminate`, {
        with_payout: terminateWithPayout,
        reason: terminateReason
      });
      
      alert(response.data.message + (terminateWithPayout ? ` Возвращено: ${response.data.returned_amount}` : ''));
      setTerminateDialogOpen(false);
      setSelectedInvestment(null);
      setTerminateReason('');
      fetchUserData();
    } catch (error) {
      console.error('Error terminating investment:', error);
      alert(error.response?.data?.detail || 'Ошибка завершения контракта');
    } finally {
      setSubmitting(false);
    }
  };

  const openTerminateDialog = (investment, withPayout) => {
    setSelectedInvestment(investment);
    setTerminateWithPayout(withPayout);
    setTerminateReason('');
    setTerminateDialogOpen(true);
  };

  const getTierBadge = (tier) => {
    switch (tier) {
      case 'platinum': return { class: 'bg-purple-100 text-purple-700', label: 'Elite' };
      case 'gold': return { class: 'bg-amber-100 text-amber-700', label: 'Premium' };
      default: return { class: 'bg-gray-100 text-gray-700', label: 'Private' };
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active': return { class: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> };
      case 'completed': return { class: 'bg-blue-100 text-blue-700', icon: <CheckCircle className="w-3 h-3" /> };
      case 'pending': return { class: 'bg-amber-100 text-amber-700', icon: <Clock className="w-3 h-3" /> };
      case 'approved': return { class: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> };
      case 'rejected': return { class: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> };
      default: return { class: 'bg-gray-100 text-gray-700', icon: null };
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="p-8">
        <p>Пользователь не найден</p>
      </div>
    );
  }

  const { investments = [], transactions = [], kyc_documents = [], ...user } = userData || {};
  const tierInfo = getTierBadge(user?.tier);
  const totalInvested = investments?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
  const totalProfit = investments?.reduce((sum, inv) => sum + (inv.expected_return || 0), 0) || 0;

  return (
    <div className="p-8 max-w-7xl mx-auto" data-testid="admin-user-detail">
      {/* Header */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => navigate('/admin/users')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к списку
        </Button>
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {user?.picture ? (
              <img src={user.picture} alt="" className="w-20 h-20 rounded-full border-4 border-white shadow-lg" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-4 border-white shadow-lg">
                <User className="w-10 h-10 text-primary" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{user?.name || 'Без имени'}</h1>
                <Badge className={tierInfo.class}>
                  <Award className="w-3 h-3 mr-1" />
                  {tierInfo.label}
                </Badge>
                {user?.role === 'admin' && (
                  <Badge className="bg-red-100 text-red-700">Admin</Badge>
                )}
              </div>
              <p className="text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">ID: {user?.user_id}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Edit className="w-4 h-4 mr-2" />
                  Редактировать
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Редактировать пользователя</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Имя</Label>
                    <Input 
                      value={editData.name}
                      onChange={(e) => setEditData({...editData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Телефон</Label>
                    <Input 
                      value={editData.phone}
                      onChange={(e) => setEditData({...editData, phone: e.target.value})}
                      placeholder="+7 XXX XXX XX XX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Уровень</Label>
                    <select 
                      className="w-full border rounded-lg p-2"
                      value={editData.tier}
                      onChange={(e) => setEditData({...editData, tier: e.target.value})}
                    >
                      <option value="silver">Private (Silver)</option>
                      <option value="gold">Premium (Gold)</option>
                      <option value="platinum">Elite (Platinum)</option>
                    </select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Отмена</Button>
                  <Button onClick={handleUserUpdate} disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Сохранить
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" onClick={fetchUserData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            
            {/* Allow invest without KYC */}
            <Button 
              variant={user?.can_invest_without_kyc ? "default" : "outline"}
              className={user?.can_invest_without_kyc ? "bg-green-600 hover:bg-green-700" : "border-red-300 text-red-600 hover:bg-red-50"}
              onClick={handleToggleInvestWithoutKyc}
              disabled={submitting}
              title={user?.can_invest_without_kyc ? "Нажмите чтобы отключить" : "Нажмите чтобы разрешить"}
            >
              {user?.can_invest_without_kyc ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Инвестирование разрешено
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Инвестирование запрещено
                </>
              )}
            </Button>
            
            {/* Delete user button */}
            {user?.role !== 'admin' && (
              <Button 
                variant="destructive" 
                onClick={openDeleteDialog}
                disabled={submitting}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Удалить пользователя?
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {investments?.filter(inv => inv.status === 'active')?.length > 0 ? (
              <>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Внимание!</strong> У пользователя {investments.filter(inv => inv.status === 'active').length} активных инвестиций.
                    Выберите способ удаления:
                  </p>
                </div>
                
                <RadioGroup value={deleteWithPayout ? 'with_payout' : 'without_payout'} onValueChange={(v) => setDeleteWithPayout(v === 'with_payout')} className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value="with_payout" id="delete_with_payout" />
                    <div className="flex-1">
                      <Label htmlFor="delete_with_payout" className="font-medium cursor-pointer">
                        С выплатой
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Вернуть капитал + оставшуюся прибыль на баланс
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value="without_payout" id="delete_without_payout" />
                    <div className="flex-1">
                      <Label htmlFor="delete_without_payout" className="font-medium cursor-pointer">
                        Без выплаты
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Терминировать инвестиции без возврата
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </>
            ) : (
              <p className="text-muted-foreground">
                Вы уверены, что хотите удалить пользователя <strong>{user?.email}</strong>? Это действие необратимо.
              </p>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={submitting}>
              Отмена
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteUser}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Доступно</p>
                <p className="text-xl font-bold">{formatCurrency(user?.available_balance?.USD || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">В портфелях</p>
                <p className="text-xl font-bold">{formatCurrency(user?.portfolio_balance?.USD || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Всего инвестировано</p>
                <p className="text-xl font-bold">{formatCurrency(totalInvested)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ожид. прибыль</p>
                <p className="text-xl font-bold text-green-600">+{formatCurrency(totalProfit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance Actions */}
      <Card className="card-premium mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Управление балансом
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => setBalanceOperation('add')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Пополнить баланс
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {balanceOperation === 'add' ? 'Пополнить баланс' : 'Списать с баланса'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Текущий баланс</p>
                    <p className="text-2xl font-bold">{formatCurrency(user?.available_balance?.USD || 0)}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Сумма (USD)</Label>
                    <Input 
                      type="number"
                      value={balanceAmount}
                      onChange={(e) => setBalanceAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Причина</Label>
                    <Textarea 
                      value={balanceReason}
                      onChange={(e) => setBalanceReason(e.target.value)}
                      placeholder="Укажите причину операции..."
                      rows={3}
                    />
                  </div>

                  {balanceAmount && (
                    <div className={`p-4 rounded-lg ${balanceOperation === 'add' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <p className="text-sm text-muted-foreground">Новый баланс будет:</p>
                      <p className={`text-2xl font-bold ${balanceOperation === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(
                          (user?.available_balance?.USD || 0) + 
                          (balanceOperation === 'add' ? parseFloat(balanceAmount) || 0 : -(parseFloat(balanceAmount) || 0))
                        )}
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBalanceDialogOpen(false)}>Отмена</Button>
                  <Button 
                    onClick={handleBalanceUpdate} 
                    disabled={submitting || !balanceAmount}
                    className={balanceOperation === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {balanceOperation === 'add' ? 'Пополнить' : 'Списать'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Button 
              variant="outline" 
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => {
                setBalanceOperation('subtract');
                setBalanceDialogOpen(true);
              }}
            >
              <Minus className="w-4 h-4 mr-2" />
              Списать с баланса
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Section - 2FA Management */}
      <Card className="card-premium mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Безопасность (2FA)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Google Authenticator */}
            <div className={`p-4 rounded-lg border ${user?.totp_enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user?.totp_enabled ? 'bg-green-100' : 'bg-gray-200'}`}>
                    <Smartphone className={`w-5 h-5 ${user?.totp_enabled ? 'text-green-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <p className="font-medium">Google Authenticator</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.totp_enabled ? 'Включён' : 'Не настроен'}
                    </p>
                  </div>
                </div>
                {user?.totp_enabled && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDisable2FA('totp')}
                    disabled={submitting}
                  >
                    {submitting && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                    Отключить
                  </Button>
                )}
              </div>
            </div>

            {/* Email 2FA */}
            <div className={`p-4 rounded-lg border ${user?.email_2fa_enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user?.email_2fa_enabled ? 'bg-green-100' : 'bg-gray-200'}`}>
                    <Mail className={`w-5 h-5 ${user?.email_2fa_enabled ? 'text-green-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <p className="font-medium">Email 2FA</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email_2fa_enabled ? 'Включён' : 'Не настроен'}
                    </p>
                  </div>
                </div>
                {user?.email_2fa_enabled && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDisable2FA('email')}
                    disabled={submitting}
                  >
                    {submitting && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                    Отключить
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Disable all 2FA */}
          {(user?.totp_enabled || user?.email_2fa_enabled) && (
            <div className="mt-4 pt-4 border-t">
              <Button 
                variant="outline" 
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => handleDisable2FA('all')}
                disabled={submitting}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                <ShieldOff className="w-4 h-4 mr-2" />
                Отключить всю 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="investments" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="investments">
            <FileText className="w-4 h-4 mr-2" />
            Инвестиции ({investments?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <History className="w-4 h-4 mr-2" />
            Транзакции ({transactions?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="kyc">
            <Shield className="w-4 h-4 mr-2" />
            KYC/Верификация
          </TabsTrigger>
          <TabsTrigger value="info">
            <User className="w-4 h-4 mr-2" />
            Информация
          </TabsTrigger>
        </TabsList>

        {/* Investments Tab */}
        <TabsContent value="investments">
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>Инвестиции клиента</CardTitle>
            </CardHeader>
            <CardContent>
              {investments?.length > 0 ? (
                <div className="space-y-4">
                  {investments.map((inv) => {
                    const status = getStatusBadge(inv.status);
                    // Calculate remaining profit (expected - already paid)
                    const paidProfit = inv.paid_profit || 0;
                    const remainingProfit = inv.remaining_profit || Math.max(0, (inv.expected_return || 0) - paidProfit);
                    
                    return (
                      <div key={inv.investment_id} className="p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{inv.portfolio_name || inv.portfolio_id}</span>
                              <Badge className={status.class}>
                                {status.icon}
                                <span className="ml-1">{inv.status}</span>
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground font-mono">{inv.investment_id}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold">{formatCurrency(inv.amount)}</p>
                            <p className="text-sm text-green-600">+{formatCurrency(remainingProfit)} ожид. прибыль</p>
                            {paidProfit > 0 && (
                              <p className="text-xs text-gray-500">Выплачено: {formatCurrency(paidProfit)}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t text-sm">
                          <div>
                            <p className="text-muted-foreground">Срок</p>
                            <p className="font-medium">{inv.duration_months || inv.term_months} мес.</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Ставка</p>
                            <p className="font-medium">{inv.annual_rate}% годовых</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Начало</p>
                            <p className="font-medium">{safeFormatDate(inv.start_date)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Окончание</p>
                            <p className="font-medium">{safeFormatDate(inv.end_date)}</p>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                          <Button variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-1" />
                            Контракт PDF
                          </Button>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-1" />
                            Детали
                          </Button>
                          {inv.status === 'active' && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => openTerminateDialog(inv, true)}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Завершить с выплатой
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => openTerminateDialog(inv, false)}
                              >
                                <Ban className="w-4 h-4 mr-1" />
                                Завершить без выплаты
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>У клиента нет активных инвестиций</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>История транзакций</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Дата</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Тип</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Описание</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Сумма</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => {
                        const status = getStatusBadge(tx.status);
                        const isPositive = ['deposit', 'profit', 'refund'].includes(tx.type);
                        return (
                          <tr key={tx.transaction_id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm">{safeFormatDate(tx.created_at)}</td>
                            <td className="py-3 px-4">
                              <Badge variant="secondary">{tx.type}</Badge>
                            </td>
                            <td className="py-3 px-4 text-sm">{tx.description || '-'}</td>
                            <td className={`py-3 px-4 text-right font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                              {isPositive ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={status.class}>
                                {status.icon}
                                <span className="ml-1">{tx.status}</span>
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Нет транзакций</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* KYC Tab */}
        <TabsContent value="kyc">
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Верификация KYC</span>
                <Badge className={getStatusBadge(user?.kyc_status || 'none').class}>
                  {user?.kyc_status || 'Не подана'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {kyc_documents?.length > 0 ? (
                <div className="space-y-4">
                  {kyc_documents.map((doc) => (
                    <div key={doc.kyc_id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="font-medium">Документ: {doc.document_type}</p>
                          <p className="text-sm text-muted-foreground">Загружен: {safeFormatDate(doc.uploaded_at)}</p>
                        </div>
                        <Badge className={getStatusBadge(doc.status).class}>{doc.status}</Badge>
                      </div>
                      
                      {doc.file_url && (
                        <div className="mb-4">
                          <a 
                            href={doc.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-primary hover:underline"
                          >
                            <Eye className="w-4 h-4" />
                            Просмотреть документ
                          </a>
                        </div>
                      )}

                      {doc.status === 'pending' && (
                        <div className="flex gap-2 pt-4 border-t">
                          <Button 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleKycAction('approved')}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Одобрить
                          </Button>
                          <Button 
                            variant="outline" 
                            className="text-red-600 border-red-200"
                            onClick={() => handleKycAction('rejected')}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Отклонить
                          </Button>
                        </div>
                      )}

                      {doc.admin_notes && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Примечание:</p>
                          <p className="text-sm">{doc.admin_notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Документы не загружены</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info">
          <Card className="card-premium">
            <CardHeader>
              <CardTitle>Информация об аккаунте</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{user?.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Phone className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Телефон</p>
                      <p className="font-medium">{user?.phone || 'Не указан'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Дата регистрации</p>
                      <p className="font-medium">{safeFormatDate(user?.created_at)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Award className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Уровень</p>
                      <Badge className={tierInfo.class}>{tierInfo.label}</Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Shield className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Статус KYC</p>
                      <Badge className={getStatusBadge(user?.kyc_status || 'none').class}>
                        {user?.kyc_status || 'Не подана'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Роль</p>
                      <Badge variant="secondary">{user?.role || 'user'}</Badge>
                    </div>
                  </div>
                </div>
              </div>

              {user?.auth_provider && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    Авторизация через: <strong>{user.auth_provider}</strong>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Terminate Investment Dialog */}
      <Dialog open={terminateDialogOpen} onOpenChange={setTerminateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {terminateWithPayout ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Завершить контракт с выплатой
                </>
              ) : (
                <>
                  <Ban className="w-5 h-5 text-red-600" />
                  Завершить контракт без выплаты
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedInvestment && (() => {
            // Calculate remaining profit for display
            const paidProfit = selectedInvestment.paid_profit || 0;
            const expectedReturn = selectedInvestment.expected_return || 0;
            const remainingProfit = selectedInvestment.remaining_profit || Math.max(0, expectedReturn - paidProfit);
            const principal = selectedInvestment.amount || 0;
            
            // Calculate return amount
            let returnAmount;
            if (selectedInvestment.auto_reinvest) {
              returnAmount = selectedInvestment.current_balance || principal;
            } else {
              returnAmount = principal + remainingProfit;
            }
            
            return (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Контракт:</span>
                  <span className="font-medium">{selectedInvestment.portfolio_name || selectedInvestment.portfolio_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Сумма инвестиции:</span>
                  <span className="font-medium">{formatCurrency(principal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Общая ожид. прибыль:</span>
                  <span className="font-medium">{formatCurrency(expectedReturn)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Уже выплачено:</span>
                  <span className="font-medium text-blue-600">+{formatCurrency(paidProfit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Осталось выплатить:</span>
                  <span className="font-medium text-green-600">+{formatCurrency(remainingProfit)}</span>
                </div>
                {selectedInvestment.auto_reinvest && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Текущий баланс:</span>
                    <span className="font-medium">{formatCurrency(selectedInvestment.current_balance || principal)}</span>
                  </div>
                )}
                {terminateWithPayout && (
                  <div className="flex justify-between pt-2 border-t font-semibold text-lg">
                    <span>К возврату:</span>
                    <span className="text-green-600">
                      {formatCurrency(returnAmount)}
                    </span>
                  </div>
                )}
              </div>

              {terminateWithPayout ? (
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-green-800">
                    {selectedInvestment.auto_reinvest 
                      ? "Клиенту будет возвращён текущий баланс (инвестиция + реинвестированная прибыль)."
                      : `Клиенту будет возвращена сумма инвестиции (${formatCurrency(principal)}) + оставшаяся прибыль (${formatCurrency(remainingProfit)}).`}
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <p className="text-sm text-red-800">
                      ⚠️ Контракт будет аннулирован без возврата средств. Используйте только в случаях нарушения правил.
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Причина завершения *</Label>
                    <Input
                      value={terminateReason}
                      onChange={(e) => setTerminateReason(e.target.value)}
                      placeholder="Укажите причину..."
                      className="mt-1"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setTerminateDialogOpen(false)}
                >
                  Отмена
                </Button>
                <Button 
                  variant={terminateWithPayout ? "default" : "destructive"}
                  className="flex-1"
                  onClick={handleTerminateInvestment}
                  disabled={submitting || (!terminateWithPayout && !terminateReason)}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {terminateWithPayout ? 'Завершить с выплатой' : 'Аннулировать'}
                </Button>
              </div>
            </div>
          );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminUserDetail;
