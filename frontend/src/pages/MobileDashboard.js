import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { PullToRefresh } from '../components/PullToRefresh';
import {
  MobileBalanceCard,
  MobileActionButton,
  MobileStatItem,
  MobileTransactionItem,
  MobileContractCard,
  MobileSectionHeader,
  MobileSkeleton
} from '../components/MobileUIComponents';
import { 
  Wallet, 
  Briefcase, 
  TrendingUp,
  Plus,
  Minus,
  ChevronRight
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

export function MobileDashboard() {
  const { user, api, refreshUser } = useAuth();
  const { t, formatCurrency, convertCurrency, formatDate, language } = useLanguage();
  const navigate = useNavigate();
  
  const [investments, setInvestments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [profitAnalytics, setProfitAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [invRes, txRes, profitRes] = await Promise.all([
        api.get('/investments'),
        api.get('/user/transactions'),
        api.get('/user/profit-analytics').catch(() => ({ data: null }))
      ]);
      setInvestments(invRes.data);
      setTransactions(txRes.data.slice(0, 5));
      setProfitAnalytics(profitRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), refreshUser()]);
    setRefreshing(false);
  };

  // Calculate totals - always from USD (internal), display as TRY.
  const availableBalanceUsd = user?.available_balance?.USD || 0;
  const portfolioBalanceUsd = user?.portfolio_balance?.USD || 0;
  const availableBalance = convertCurrency(availableBalanceUsd, 'USD', 'TRY');
  const portfolioBalance = convertCurrency(portfolioBalanceUsd, 'USD', 'TRY');
  const expectedProfit = investments.reduce((sum, inv) => sum + (inv.remaining_profit || inv.expected_return || 0), 0);
  const activeContracts = investments.filter(i => i.status === 'active').length;

  // Chart data
  const chartData = profitAnalytics?.monthly?.length > 0 
    ? profitAnalytics.monthly.map(m => ({
        month: m.month_name?.slice(0, 3) || m.month,
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

  // Download contract
  const downloadContract = async (investmentId) => {
    try {
      const response = await api.get(`/investments/${investmentId}/contract?lang=${language}`, { responseType: 'blob' });
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
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col p-3 gap-3">
        <MobileSkeleton variant="balance" />
        <div className="grid grid-cols-2 gap-2">
          <MobileSkeleton variant="card" />
          <MobileSkeleton variant="card" />
        </div>
        <MobileSkeleton variant="card" />
        <MobileSkeleton variant="list" />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="h-full overflow-y-auto p-3 space-y-3" data-testid="mobile-dashboard">
        {/* Main Balance Card */}
        <MobileBalanceCard
          title={t('available_balance')}
          amount={formatCurrency(availableBalance)}
          subtitle={language === 'ru' ? 'Доступно для инвестирования' : 'Available for investment'}
          icon={Wallet}
          variant="primary"
          action={
            <div className="flex gap-2">
              <MobileActionButton
                icon={Plus}
                label={t('deposit')}
                onClick={() => navigate('/wallet')}
                variant="default"
              />
              <MobileActionButton
                icon={Minus}
                label={t('withdraw')}
                onClick={() => navigate('/wallet')}
                variant="outline"
              />
            </div>
          }
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <MobileStatItem
            label={t('portfolio_balance')}
            value={formatCurrency(portfolioBalance)}
            icon={Briefcase}
          />
          <MobileStatItem
            label={t('expected_profit')}
            value={`+${formatCurrency(expectedProfit)}`}
            icon={TrendingUp}
            trend={expectedProfit > 0 ? "up" : undefined}
            trendValue={portfolioBalance > 0 && expectedProfit > 0 ? `${((expectedProfit / portfolioBalance) * 100).toFixed(1)}%` : ''}
          />
        </div>

        {/* Quick Actions */}
        <div className="mobile-card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-gray-900">{activeContracts} {language === 'ru' ? 'активных контрактов' : 'active contracts'}</p>
              <p className="text-xs text-gray-500">{language === 'ru' ? 'Нажмите чтобы добавить' : 'Tap to add more'}</p>
            </div>
            <Link 
              to="/portfolios"
              className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20"
            >
              <Plus className="w-5 h-5 text-white" />
            </Link>
          </div>
        </div>

        {/* Profit Chart */}
        {chartData.length > 0 && (
          <div className="mobile-card p-3">
            <MobileSectionHeader 
              title={profitAnalytics?.total_profit > 0 ? (language === 'ru' ? 'История доходов' : 'Profit History') : t('profit_forecast')}
            />
            <div className="h-32 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  />
                  <YAxis 
                    hide 
                    domain={['dataMin', 'dataMax']}
                  />
                  <Tooltip 
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{ 
                      borderRadius: 12, 
                      border: 'none', 
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)' 
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="profit" 
                    stroke="#064E3B" 
                    strokeWidth={2}
                    dot={{ fill: '#064E3B', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5, fill: '#064E3B' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {profitAnalytics?.total_profit > 0 && (
              <p className="text-center text-xs text-gray-500 mt-1">
                {language === 'ru' ? 'Общий доход' : 'Total profit'}: <span className="font-semibold text-green-600">+{formatCurrency(profitAnalytics.total_profit)}</span>
              </p>
            )}
          </div>
        )}

        {/* Active Contracts */}
        {investments.length > 0 && (
          <div>
            <MobileSectionHeader 
              title={language === 'ru' ? 'Мои контракты' : 'My Contracts'}
              action={() => navigate('/history')}
              actionLabel={language === 'ru' ? 'Все' : 'All'}
            />
            <div className="space-y-3">
              {investments.slice(0, 2).map((inv) => {
                const endDate = inv.end_date ? new Date(inv.end_date) : null;
                const now = new Date();
                
                // Calculate time remaining based on duration_unit
                const durationUnit = inv.duration_unit || 'months';
                let timeLeftLabel = '';
                let progress = 0;
                
                if (endDate) {
                  const msLeft = endDate - now;
                  if (durationUnit === 'hours') {
                    const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
                    timeLeftLabel = hoursLeft > 0 ? `${hoursLeft} ${language === 'ru' ? 'ч.' : 'h'}` : (language === 'ru' ? 'Завершён' : 'Completed');
                    const totalHours = inv.duration_months || 1;
                    progress = ((totalHours - hoursLeft) / totalHours) * 100;
                  } else if (durationUnit === 'days') {
                    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
                    timeLeftLabel = daysLeft > 0 ? `${daysLeft} ${language === 'ru' ? 'дн.' : 'd'}` : (language === 'ru' ? 'Завершён' : 'Completed');
                    const totalDays = inv.duration_months || 1;
                    progress = ((totalDays - daysLeft) / totalDays) * 100;
                  } else {
                    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
                    timeLeftLabel = daysLeft > 0 ? `${daysLeft} ${language === 'ru' ? 'дн.' : 'd'}` : (language === 'ru' ? 'Завершён' : 'Completed');
                    const totalDays = (inv.duration_months || 1) * 30;
                    progress = ((totalDays - daysLeft) / totalDays) * 100;
                  }
                }
                
                // Use remaining profit instead of expected return
                const displayProfit = inv.remaining_profit || inv.expected_return || 0;
                
                return (
                  <MobileContractCard
                    key={inv.investment_id}
                    contractId={inv.investment_id.slice(-8).toUpperCase()}
                    portfolioName={inv.portfolio_name || inv.portfolio_id}
                    amount={formatCurrency(inv.amount, inv.currency)}
                    expectedReturn={formatCurrency(displayProfit, inv.currency)}
                    progress={Math.min(Math.max(progress, 0), 100)}
                    daysLeft={timeLeftLabel}
                    status={inv.status}
                    onDownload={() => downloadContract(inv.investment_id)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        {transactions.length > 0 && (
          <div className="mobile-card p-4">
            <MobileSectionHeader 
              title={t('recent_transactions')}
              action={() => navigate('/history')}
              actionLabel={language === 'ru' ? 'Все' : 'All'}
            />
            <div>
              {transactions.slice(0, 4).map((tx) => {
                const isIncome = tx.type === 'deposit' || tx.type === 'return' || tx.type === 'profit' || tx.type === 'income';
                const getTypeLabel = (type) => {
                  switch (type) {
                    case 'profit':
                    case 'income': return language === 'ru' ? 'Доход' : 'Income';
                    case 'deposit': return language === 'ru' ? 'Пополнение' : 'Deposit';
                    case 'withdrawal': return language === 'ru' ? 'Вывод' : 'Withdrawal';
                    case 'investment': return language === 'ru' ? 'Инвестиция' : 'Investment';
                    default: return type;
                  }
                };
                const getStatusLabel = (status) => {
                  switch (status) {
                    case 'completed': return language === 'ru' ? 'Выполнено' : 'Completed';
                    case 'pending': return language === 'ru' ? 'В обработке' : 'Pending';
                    default: return status;
                  }
                };
                
                return (
                  <MobileTransactionItem
                    key={tx.transaction_id}
                    type={getTypeLabel(tx.type)}
                    amount={formatCurrency(tx.amount, tx.currency)}
                    date={formatDate(tx.created_at)}
                    status={getStatusLabel(tx.status)}
                    isIncome={isIncome}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {investments.length === 0 && transactions.length === 0 && (
          <div className="mobile-card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              {language === 'ru' ? 'Начните инвестировать' : 'Start Investing'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {language === 'ru' ? 'Выберите портфель и начните получать доход' : 'Choose a portfolio and start earning'}
            </p>
            <Link 
              to="/portfolios"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium"
            >
              {t('invest_now')}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}

export default MobileDashboard;
