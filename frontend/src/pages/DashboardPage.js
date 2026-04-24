import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { MobileDashboard } from './MobileDashboard';
import { 
  Wallet, 
  TrendingUp, 
  Briefcase, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus,
  Minus,
  Award,
  ChevronRight,
  Loader2,
  FileText,
  Download,
  Calendar,
  Clock
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

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

export function DashboardPage() {
  const isMobile = useIsMobile();
  
  // Render mobile version
  if (isMobile) {
    return <MobileDashboard />;
  }
  
  // Desktop version continues below
  return <DesktopDashboard />;
}

function DesktopDashboard() {
  const { user, api, refreshUser } = useAuth();
  const { t, formatCurrency, formatUsdWithEquivalent, convertCurrency, formatDate, currency, CURRENCIES, language } = useLanguage();
  
  const [investments, setInvestments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [profitAnalytics, setProfitAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [submitting, setSubmitting] = useState(false);

  const [depositRequests, setDepositRequests] = useState([]);
  const [withdrawRequests, setWithdrawRequests] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [selectedBroker, setSelectedBroker] = useState('');
  const [brokerAccount, setBrokerAccount] = useState('');
  const [companyBankInfo, setCompanyBankInfo] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invRes, txRes, depRes, withRes, brokersRes, bankRes, profitRes] = await Promise.all([
        api.get('/investments'),
        api.get('/user/transactions'),
        api.get('/deposit-requests').catch(() => ({ data: [] })),
        api.get('/withdrawal-requests').catch(() => ({ data: [] })),
        api.get('/brokers').catch(() => ({ data: [] })),
        api.get('/company-bank-info').catch(() => ({ data: {} })),
        api.get('/user/profit-analytics').catch(() => ({ data: null }))
      ]);
      setInvestments(invRes.data);
      setTransactions(txRes.data.slice(0, 5));
      setDepositRequests(depRes.data);
      setWithdrawRequests(withRes.data);
      setBrokers(brokersRes.data);
      setCompanyBankInfo(bankRes.data);
      setProfitAnalytics(profitRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setSubmitting(true);
    try {
      await api.post('/deposit-requests', { 
        amount: parseFloat(amount), 
        currency: selectedCurrency 
      });
      await refreshUser();
      setDepositOpen(false);
      setAmount('');
      fetchData();
    } catch (error) {
      console.error('Deposit error:', error);
      alert(error.response?.data?.detail || 'Ошибка создания заявки');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0 || !selectedBroker) {
      alert('Заполните все поля');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/withdrawal-requests', { 
        amount: parseFloat(amount), 
        currency: selectedCurrency,
        broker_id: selectedBroker,
        broker_account: brokerAccount
      });
      await refreshUser();
      setWithdrawOpen(false);
      setAmount('');
      setSelectedBroker('');
      setBrokerAccount('');
      fetchData();
    } catch (error) {
      console.error('Withdraw error:', error);
      alert(error.response?.data?.detail || 'Ошибка создания заявки');
    } finally {
      setSubmitting(false);
    }
  };

  // Download contract PDF
  const downloadContract = async (investmentId) => {
    try {
      const response = await api.get(`/investments/${investmentId}/contract`, {
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contract_${investmentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading contract:', error);
      alert(language === 'ru' ? 'Ошибка загрузки контракта' : 'Error downloading contract');
    }
  };

  // Calculate totals - always from USD, convert to user's currency for display
  const availableBalanceUsd = user?.available_balance?.USD || 0;
  const portfolioBalanceUsd = user?.portfolio_balance?.USD || 0;
  const totalBalanceUsd = availableBalanceUsd + portfolioBalanceUsd;
  
  // Convert to user's preferred currency for display
  const availableBalance = convertCurrency(availableBalanceUsd, 'USD', currency);
  const portfolioBalance = convertCurrency(portfolioBalanceUsd, 'USD', currency);
  const totalBalance = availableBalance + portfolioBalance;

  // Chart data
  const pieData = [
    { name: t('available_balance'), value: availableBalance, color: '#F59E0B' },
    { name: t('portfolio_balance'), value: portfolioBalance, color: '#064E3B' }
  ].filter(d => d.value > 0);

  // Real profit data from API or calculated forecast
  const forecastData = profitAnalytics?.monthly?.length > 0 
    ? profitAnalytics.monthly.map(m => ({
        month: m.month_name,
        profit: m.cumulative
      }))
    : [
        { month: 'Янв', profit: 0 },
        { month: 'Фев', profit: portfolioBalance * 0.02 },
        { month: 'Мар', profit: portfolioBalance * 0.04 },
        { month: 'Апр', profit: portfolioBalance * 0.06 },
        { month: 'Май', profit: portfolioBalance * 0.08 },
        { month: 'Июн', profit: portfolioBalance * 0.10 },
      ];
  
  const totalProfit = profitAnalytics?.total_profit || 0;

  const getTierBadgeClass = (tier) => {
    switch (tier) {
      case 'platinum': return 'tier-platinum';
      case 'gold': return 'tier-gold';
      case 'silver': return 'tier-silver';
      default: return 'tier-silver';
    }
  };

  const getTierName = (tier) => {
    switch (tier) {
      case 'platinum': return 'Platinum';
      case 'gold': return 'Gold';
      case 'silver': return 'Silver';
      default: return 'Silver';
    }
  };

  const getNextTier = (currentTier) => {
    switch (currentTier) {
      case 'silver': return { name: 'Gold', amount: 50000 };
      case 'gold': return { name: 'Platinum', amount: 100000 };
      default: return null;
    }
  };

  const nextTier = getNextTier(user?.tier);
  const tierProgress = nextTier ? Math.min((user?.total_invested || 0) / nextTier.amount * 100, 100) : 100;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8" data-testid="dashboard-page">
      <div className="container-premium">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <p className="text-muted-foreground">{t('welcome_back')},</p>
            <h1 className="text-h2 text-primary">{user?.name}</h1>
          </div>
          <div className="flex items-center gap-2 mt-4 md:mt-0">
            <span className={`px-3 py-1 rounded-sm text-sm font-medium ${getTierBadgeClass(user?.tier)}`}>
              <Award className="w-4 h-4 inline mr-1" />
              {getTierName(user?.tier)}
            </span>
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Available Balance */}
          <Card className="card-premium" data-testid="available-balance-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('available_balance')}
              </CardTitle>
              <Wallet className="w-5 h-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-heading font-bold text-primary">
                {formatCurrency(availableBalance)}
              </div>
              <div className="flex gap-2 mt-4">
                <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="flex-1" data-testid="deposit-btn">
                      <Plus className="w-4 h-4 mr-1" />
                      {t('deposit')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{t('deposit_funds')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {/* Client Account Number */}
                      {user?.account_number && (
                        <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                          <p className="text-sm font-medium text-primary mb-2">Ваш номер счёта для пополнения:</p>
                          <p className="text-2xl font-mono font-bold text-primary tracking-wider">{user.account_number}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Укажите этот номер при переводе для быстрого зачисления
                          </p>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label>{t('select_currency')}</Label>
                        <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                          <SelectTrigger data-testid="deposit-currency-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map(c => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.symbol} {c.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('enter_amount')}</Label>
                        <Input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          data-testid="deposit-amount-input"
                        />
                      </div>
                      
                      <Button 
                        className="w-full" 
                        onClick={handleDeposit} 
                        disabled={submitting || !amount}
                        data-testid="deposit-submit"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Создать заявку на пополнение
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="flex-1" data-testid="withdraw-btn">
                      <Minus className="w-4 h-4 mr-1" />
                      {t('withdraw')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{t('withdraw_funds')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>{t('select_currency')}</Label>
                        <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                          <SelectTrigger data-testid="withdraw-currency-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map(c => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.symbol} {c.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('enter_amount')}</Label>
                        <Input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          max={user?.balance_available?.[selectedCurrency] || 0}
                          data-testid="withdraw-amount-input"
                        />
                        <p className="text-xs text-muted-foreground">
                          Доступно: {formatCurrency(user?.balance_available?.[selectedCurrency] || 0, selectedCurrency)}
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Брокер для вывода *</Label>
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
                      
                      <div className="space-y-2">
                        <Label>Номер счёта у брокера</Label>
                        <Input
                          value={brokerAccount}
                          onChange={(e) => setBrokerAccount(e.target.value)}
                          placeholder="Ваш номер счёта"
                        />
                      </div>
                      
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="text-xs text-amber-800">
                          Вывод средств будет выполнен после подтверждения администратором в течение 1-3 рабочих дней.
                        </p>
                      </div>
                      
                      <Button 
                        className="w-full" 
                        onClick={handleWithdraw} 
                        disabled={submitting || !amount || !selectedBroker}
                        data-testid="withdraw-submit"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Создать заявку на вывод
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Portfolio Balance */}
          <Card className="card-premium" data-testid="portfolio-balance-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('portfolio_balance')}
              </CardTitle>
              <Briefcase className="w-5 h-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-heading font-bold text-primary">
                {formatCurrency(portfolioBalance)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {investments.filter(i => i.status === 'active').length} {t('active_investments')}
              </p>
              <Link to="/portfolios" className="mt-4 inline-block">
                <Button size="sm" variant="outline" data-testid="invest-more-btn">
                  {t('invest_now')}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Expected Profit */}
          <Card className="card-premium" data-testid="expected-profit-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('expected_profit')}
              </CardTitle>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-heading font-bold text-green-600">
                +{formatCurrency(investments.filter(inv => inv.status === 'active').reduce((sum, inv) => sum + (inv.remaining_profit || inv.expected_return || 0), 0))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                За все активные контракты
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Asset Distribution */}
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="text-h3">{t('asset_distribution')}</CardTitle>
            </CardHeader>
            <CardContent>
              {totalBalance > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-6 mt-4">
                    {pieData.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-muted-foreground">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Нет данных для отображения
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profit History */}
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-h3">
                  {profitAnalytics?.total_profit > 0 ? 'История доходов' : t('profit_forecast')}
                </CardTitle>
                {totalProfit > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Общий доход: <span className="font-medium text-green-600">+{formatCurrency(totalProfit)}</span>
                  </p>
                )}
              </div>
              {profitAnalytics?.monthly?.some(m => m.profit > 0) && (
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Реальные данные
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecastData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                    <YAxis stroke="#6B7280" fontSize={12} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Line 
                      type="monotone" 
                      dataKey="profit" 
                      stroke="#064E3B" 
                      strokeWidth={2}
                      dot={{ fill: '#064E3B' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tier Progress */}
        {nextTier && (
          <Card className="card-premium mb-8" data-testid="tier-progress-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{t('tier_progress')}: {nextTier.name}</span>
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(user?.total_invested || 0)} / {formatCurrency(nextTier.amount)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${tierProgress}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Contracts */}
        {investments.length > 0 && (
          <Card className="card-premium mb-8" data-testid="active-contracts-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-h3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {language === 'ru' ? 'Мои контракты' : language === 'tr' ? 'Sözleşmelerim' : 'My Contracts'}
              </CardTitle>
              <Badge variant="outline">{investments.length} {language === 'ru' ? 'активных' : 'active'}</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {investments.map((inv) => {
                  const endDate = inv.end_date ? new Date(inv.end_date) : null;
                  const now = new Date();
                  const durationUnit = inv.duration_unit || 'months';
                  
                  // Calculate time left based on duration_unit
                  let timeLeftLabel = '';
                  let progress = 0;
                  
                  if (endDate) {
                    const msLeft = endDate - now;
                    if (durationUnit === 'hours') {
                      const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
                      timeLeftLabel = hoursLeft > 0 ? `${hoursLeft} ${language === 'ru' ? 'ч.' : 'h'}` : (language === 'ru' ? 'Завершён' : 'Completed');
                      const totalHours = inv.duration_months || 1;
                      progress = ((totalHours - Math.max(hoursLeft, 0)) / totalHours) * 100;
                    } else if (durationUnit === 'days') {
                      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
                      timeLeftLabel = daysLeft > 0 ? `${daysLeft} ${language === 'ru' ? 'дн.' : 'd'}` : (language === 'ru' ? 'Завершён' : 'Completed');
                      const totalDays = inv.duration_months || 1;
                      progress = ((totalDays - Math.max(daysLeft, 0)) / totalDays) * 100;
                    } else {
                      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
                      timeLeftLabel = daysLeft > 0 ? `${daysLeft} ${language === 'ru' ? 'дн.' : 'd'}` : (language === 'ru' ? 'Завершён' : 'Completed');
                      const totalDays = (inv.duration_months || 1) * 30;
                      progress = ((totalDays - Math.max(daysLeft, 0)) / totalDays) * 100;
                    }
                  }
                  
                  return (
                    <div 
                      key={inv.investment_id} 
                      className="p-4 border border-gray-100 rounded-lg hover:border-primary/20 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-primary">
                            {inv.portfolio_name || inv.portfolio_id}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            #{inv.investment_id.slice(-8).toUpperCase()}
                          </p>
                        </div>
                        <Badge className={inv.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {inv.status === 'active' ? (language === 'ru' ? 'Активный' : 'Active') : inv.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground">{language === 'ru' ? 'Сумма' : 'Amount'}</p>
                          <p className="font-semibold">{formatCurrency(inv.amount, inv.currency)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{language === 'ru' ? 'Ожид. прибыль' : 'Expected'}</p>
                          <p className="font-semibold text-green-600">+{formatCurrency(inv.remaining_profit || inv.expected_return, inv.currency)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{language === 'ru' ? 'Выплачено' : 'Paid'}</p>
                          <p className="font-semibold text-amber-600">+{formatCurrency(inv.paid_profit || 0, inv.currency)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{language === 'ru' ? 'До окончания' : 'Time left'}</p>
                          <p className="font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeLeftLabel}
                          </p>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{language === 'ru' ? 'Прогресс' : 'Progress'}</span>
                          <span>{Math.min(Math.max(progress, 0), 100).toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Download Contract Button */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => downloadContract(inv.investment_id)}
                        data-testid={`download-contract-${inv.investment_id}`}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {language === 'ru' ? 'Скачать контракт (PDF)' : language === 'tr' ? 'Sözleşmeyi İndir (PDF)' : 'Download Contract (PDF)'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Transactions */}
        <Card className="card-premium" data-testid="recent-transactions-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-h3">{t('recent_transactions')}</CardTitle>
            <Link to="/history">
              <Button variant="ghost" size="sm">
                {t('view')} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <div className="space-y-4">
                {transactions.map((tx) => {
                  const isIncome = tx.type === 'deposit' || tx.type === 'return' || tx.type === 'profit' || tx.type === 'income';
                  
                  // Parse description for details
                  let typeLabel = '';
                  let detailLine = '';
                  
                  if (tx.type === 'profit' || tx.type === 'income') {
                    typeLabel = language === 'ru' ? 'Доход' : 'Income';
                    if (tx.description) {
                      detailLine = tx.description;
                    }
                  } else if (tx.type === 'investment') {
                    typeLabel = language === 'ru' ? 'Инвестирование' : 'Investment';
                    if (tx.description) {
                      if (tx.description.includes('«')) {
                        detailLine = tx.description;
                      } else if (tx.description.includes('Investment in ')) {
                        const name = tx.description.replace('Investment in ', '');
                        detailLine = `Инвестиция в «${name}»`;
                      }
                    }
                    // Try to find portfolio name from investments if not in description
                    if (!detailLine) {
                      const inv = investments.find(i => i.investment_id === tx.reference_id);
                      if (inv && inv.portfolio_name) {
                        detailLine = `Инвестиция в «${inv.portfolio_name}»`;
                      }
                    }
                  } else {
                    typeLabel = t(`tx_${tx.type}`);
                  }
                  
                  return (
                    <div key={tx.transaction_id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isIncome 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-amber-100 text-amber-600'
                        }`}>
                          {isIncome 
                            ? <ArrowDownRight className="w-5 h-5" />
                            : <ArrowUpRight className="w-5 h-5" />
                          }
                        </div>
                        <div>
                          <p className="font-semibold">{typeLabel}</p>
                          {detailLine && (
                            <p className="text-sm text-muted-foreground">{detailLine}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${
                          isIncome ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          {isIncome ? '+' : '-'}
                          {formatCurrency(tx.amount, tx.currency)}
                        </p>
                        <p className={`text-xs px-2 py-0.5 rounded-full inline-block ${
                          tx.status === 'completed' ? 'status-approved' :
                          tx.status === 'pending' ? 'status-pending' : 'status-rejected'
                        }`}>
                          {t(`status_${tx.status}`)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Нет транзакций
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DashboardPage;
