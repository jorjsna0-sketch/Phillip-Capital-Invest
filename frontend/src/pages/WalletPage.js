import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { MobileWallet } from './MobileWallet';
import { 
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  Building,
  CreditCard,
  AlertCircle,
  Info
} from 'lucide-react';

// Check if we're on mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
}

export function WalletPage() {
  const isMobile = useIsMobile();
  
  // Render mobile version
  if (isMobile) {
    return <MobileWallet />;
  }
  
  // Desktop version continues below
  return <DesktopWallet />;
}

function DesktopWallet() {
  const { api, user } = useAuth();
  const { t, formatCurrency, formatDate, convertCurrency } = useLanguage();
  
  const [depositRequests, setDepositRequests] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [companyBankInfo, setCompanyBankInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Deposit dialog
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState(false);
  
  // Withdrawal dialog
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [selectedBroker, setSelectedBroker] = useState(null);
  const [brokerAccount, setBrokerAccount] = useState('');
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [depositsRes, withdrawalsRes, brokersRes, bankInfoRes] = await Promise.all([
        api.get('/deposit-requests'),
        api.get('/withdrawal-requests'),
        api.get('/brokers'),
        api.get('/company-bank-info')
      ]);
      setDepositRequests(depositsRes.data);
      setWithdrawalRequests(withdrawalsRes.data);
      setBrokers(brokersRes.data);
      setCompanyBankInfo(bankInfoRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    
    setDepositSubmitting(true);
    try {
      // User enters amount in TRY; backend stores balances in USD (internal).
      const amountTry = parseFloat(depositAmount);
      const amountUsd = convertCurrency(amountTry, 'TRY', 'USD');
      await api.post('/deposit-requests', {
        amount: amountUsd,
        currency: 'USD'
      });
      setDepositSuccess(true);
      fetchData();
    } catch (error) {
      console.error('Error creating deposit:', error);
      alert(error.response?.data?.detail || 'Ошибка создания заявки');
    } finally {
      setDepositSubmitting(false);
    }
  };

  const handleWithdrawal = async () => {
    if (!withdrawalAmount || !selectedBroker || !brokerAccount) return;
    
    // Amount user entered is in TRY. Compare with USD balance after converting.
    const amountTry = parseFloat(withdrawalAmount);
    const amountUsd = convertCurrency(amountTry, 'TRY', 'USD');
    const availableUsd = user?.available_balance?.USD || 0;
    
    if (amountUsd > availableUsd) {
      alert('Недостаточно средств на балансе');
      return;
    }
    
    setWithdrawalSubmitting(true);
    try {
      const broker = brokers.find(b => b.broker_id === selectedBroker);
      await api.post('/withdrawal-requests', {
        amount: amountUsd,
        currency: 'USD',
        broker_id: selectedBroker,
        broker_name: broker?.name,
        broker_account: brokerAccount
      });
      setWithdrawalDialogOpen(false);
      setWithdrawalAmount('');
      setSelectedBroker(null);
      setBrokerAccount('');
      fetchData();
      alert('Заявка на вывод создана');
    } catch (error) {
      console.error('Error creating withdrawal:', error);
      alert(error.response?.data?.detail || 'Ошибка создания заявки');
    } finally {
      setWithdrawalSubmitting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Одобрено</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Отклонено</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" />На рассмотрении</Badge>;
    }
  };

  // Backend stores balances in USD (internal base). Display converts to TRY via formatCurrency.
  const availableBalance = user?.available_balance?.USD || 0;
  const portfolioBalance = user?.portfolio_balance?.USD || 0;
  // TRY-equivalent of available balance for validation vs user input (which is in TRY).
  const availableBalanceTry = convertCurrency(availableBalance, 'USD', 'TRY');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8" data-testid="wallet-page">
      <div className="container-premium">
        <h1 className="text-h2 text-primary mb-8">Кошелёк</h1>

        {/* Balance Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="card-premium bg-gradient-to-br from-primary to-primary/80 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-sm mb-1">Доступный баланс</p>
                  <p className="text-3xl font-bold">{formatCurrency(availableBalance)}</p>
                  <p className="text-white/60 text-xs mt-2">Доступно для инвестирования и вывода</p>
                </div>
                <Wallet className="w-12 h-12 text-white/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-premium bg-gradient-to-br from-green-600 to-green-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-sm mb-1">В портфелях</p>
                  <p className="text-3xl font-bold">{formatCurrency(portfolioBalance)}</p>
                  <p className="text-white/60 text-xs mt-2">Активные инвестиции</p>
                </div>
                <ArrowUpCircle className="w-12 h-12 text-white/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <Dialog open={depositDialogOpen} onOpenChange={(open) => {
            setDepositDialogOpen(open);
            if (!open) {
              setDepositSuccess(false);
              setDepositAmount('');
            }
          }}>
            <DialogTrigger asChild>
              <Button className="btn-primary" size="lg">
                <ArrowDownCircle className="w-5 h-5 mr-2" />
                Пополнить
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Пополнение счёта</DialogTitle>
                <DialogDescription>
                  Создайте заявку на пополнение и переведите средства на указанные реквизиты
                </DialogDescription>
              </DialogHeader>
              
              {!depositSuccess ? (
                <div className="space-y-6 py-4">
                  {/* Client Account Number */}
                  {user?.account_number && (
                    <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                      <p className="text-sm font-medium text-primary mb-2">Ваш номер счёта для пополнения:</p>
                      <p className="text-2xl font-mono font-bold text-primary tracking-wider flex items-center justify-between">
                        {user.account_number}
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => copyToClipboard(user.account_number)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Укажите этот номер в назначении платежа для быстрого зачисления
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label>Сумма пополнения (TRY)</Label>
                    <Input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="10000"
                      min="100"
                      data-testid="deposit-amount-input"
                    />
                    <p className="text-xs text-muted-foreground">Минимальная сумма: ₺100</p>
                  </div>

                </div>
              ) : (
                <div className="py-8 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Заявка создана!</h3>
                  <p className="text-muted-foreground mb-4">
                    Переведите {formatCurrency(parseFloat(depositAmount))} на указанные реквизиты.<br/>
                    Средства будут зачислены после подтверждения.
                  </p>
                </div>
              )}

              <DialogFooter>
                {!depositSuccess ? (
                  <>
                    <Button variant="outline" onClick={() => setDepositDialogOpen(false)}>Отмена</Button>
                    <Button 
                      onClick={handleDeposit} 
                      disabled={depositSubmitting || !depositAmount || parseFloat(depositAmount) < 100}
                    >
                      {depositSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Создать заявку
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setDepositDialogOpen(false)}>Закрыть</Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="lg">
                <ArrowUpCircle className="w-5 h-5 mr-2" />
                Вывести
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Вывод средств</DialogTitle>
                <DialogDescription>
                  Выберите брокера и укажите номер счёта для вывода
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Доступно для вывода:</p>
                  <p className="text-2xl font-bold">{formatCurrency(availableBalance)}</p>
                </div>

                <div className="space-y-2">
                  <Label>Сумма вывода (TRY)</Label>
                  <Input
                    type="number"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    placeholder="1000"
                    max={availableBalanceTry}
                    data-testid="withdrawal-amount-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Брокер</Label>
                  <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите брокера" />
                    </SelectTrigger>
                    <SelectContent>
                      {brokers.map(broker => (
                        <SelectItem key={broker.broker_id} value={broker.broker_id}>
                          {broker.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedBroker && (
                  <>
                    <div className="space-y-2">
                      <Label>Номер вашего счёта у брокера</Label>
                      <Input
                        value={brokerAccount}
                        onChange={(e) => setBrokerAccount(e.target.value)}
                        placeholder={brokers.find(b => b.broker_id === selectedBroker)?.account_template || 'Введите номер счёта'}
                      />
                    </div>
                    
                    {brokers.find(b => b.broker_id === selectedBroker)?.instructions?.ru && (
                      <div className="p-3 bg-blue-50 rounded-lg flex gap-2">
                        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-800">
                          {brokers.find(b => b.broker_id === selectedBroker)?.instructions?.ru}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {withdrawalAmount && parseFloat(withdrawalAmount) > availableBalanceTry && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-700">Сумма превышает доступный баланс</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setWithdrawalDialogOpen(false)}>Отмена</Button>
                <Button 
                  onClick={handleWithdrawal} 
                  disabled={
                    withdrawalSubmitting || 
                    !withdrawalAmount || 
                    !selectedBroker || 
                    !brokerAccount ||
                    parseFloat(withdrawalAmount) > availableBalanceTry ||
                    parseFloat(withdrawalAmount) <= 0
                  }
                >
                  {withdrawalSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Создать заявку
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Requests History */}
        <Tabs defaultValue="deposits" className="space-y-6">
          <TabsList>
            <TabsTrigger value="deposits">
              <ArrowDownCircle className="w-4 h-4 mr-2" />
              Пополнения ({depositRequests.length})
            </TabsTrigger>
            <TabsTrigger value="withdrawals">
              <ArrowUpCircle className="w-4 h-4 mr-2" />
              Выводы ({withdrawalRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deposits">
            <Card className="card-premium">
              <CardHeader>
                <CardTitle>История пополнений</CardTitle>
              </CardHeader>
              <CardContent>
                {depositRequests.length > 0 ? (
                  <div className="space-y-3">
                    {depositRequests.map((req) => (
                      <div key={req.request_id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <ArrowDownCircle className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">{formatCurrency(req.amount)}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(req.created_at)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(req.status)}
                          {req.admin_notes && (
                            <p className="text-xs text-muted-foreground mt-1">{req.admin_notes}</p>
                          )}
                        </div>
                      </div>
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
                <CardTitle>История выводов</CardTitle>
              </CardHeader>
              <CardContent>
                {withdrawalRequests.length > 0 ? (
                  <div className="space-y-3">
                    {withdrawalRequests.map((req) => (
                      <div key={req.request_id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <ArrowUpCircle className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{formatCurrency(req.amount)}</p>
                            <p className="text-sm text-muted-foreground">
                              {req.broker_name} • {req.broker_account}
                            </p>
                            <p className="text-xs text-muted-foreground">{formatDate(req.created_at)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(req.status)}
                          {req.admin_notes && (
                            <p className="text-xs text-muted-foreground mt-1">{req.admin_notes}</p>
                          )}
                        </div>
                      </div>
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
      </div>
    </div>
  );
}

export default WalletPage;
