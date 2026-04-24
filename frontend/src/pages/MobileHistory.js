import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { MobileSkeleton } from '../components/MobileUIComponents';
import { Badge } from '../components/ui/badge';
import { 
  ArrowUpRight, 
  ArrowDownRight,
  FileText,
  Download,
  Clock,
  Calendar,
  Filter,
  ChevronDown
} from 'lucide-react';

export function MobileHistory() {
  const { api } = useAuth();
  const { t, formatCurrency, formatDate, formatDateTime, language } = useLanguage();
  
  const [transactions, setTransactions] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('transactions');
  const [filterType, setFilterType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [txRes, invRes] = await Promise.all([
        api.get('/user/transactions'),
        api.get('/investments')
      ]);
      setTransactions(txRes.data);
      setInvestments(invRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const downloadContract = async (investmentId) => {
    try {
      const response = await api.get(`/investments/${investmentId}/contract`, {
        responseType: 'blob'
      });
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
      console.error('Download error:', error);
    }
  };

  // Get transaction type label
  const getTypeLabel = (type, description) => {
    // For income/profit - use description if it contains portfolio info
    if ((type === 'profit' || type === 'income') && description) {
      return description;
    }
    
    // For investment - use description or try to find portfolio name
    if (type === 'investment') {
      if (description) {
        // Russian format: "Инвестиция в «Name»"
        if (description.includes('«')) {
          return description;
        }
        // English format: "Investment in Name"
        if (description.includes('Investment in ')) {
          const name = description.replace('Investment in ', '');
          return `${language === 'ru' ? 'Инвестиция в ' : 'Investment in '}«${name}»`;
        }
      }
      return language === 'ru' ? 'Инвестиция' : 'Investment';
    }
    
    const labels = {
      profit: language === 'ru' ? 'Доход' : 'Profit',
      income: language === 'ru' ? 'Доход' : 'Income',
      deposit: language === 'ru' ? 'Пополнение' : 'Deposit',
      withdrawal: language === 'ru' ? 'Вывод' : 'Withdrawal',
      return: language === 'ru' ? 'Возврат' : 'Return'
    };
    return labels[type] || type;
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'completed':
      case 'active':
        return { label: language === 'ru' ? 'Выполнено' : 'Completed', color: 'bg-green-100 text-green-700' };
      case 'pending':
        return { label: language === 'ru' ? 'В обработке' : 'Pending', color: 'bg-amber-100 text-amber-700' };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-700' };
    }
  };

  const isIncome = (type) => ['deposit', 'return', 'profit', 'income'].includes(type);

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    if (filterType === 'all') return true;
    if (filterType === 'income') return isIncome(tx.type);
    if (filterType === 'expense') return !isIncome(tx.type);
    return tx.type === filterType;
  });

  // Group transactions by date
  const groupedTransactions = filteredTransactions.reduce((groups, tx) => {
    const date = formatDate(tx.created_at);
    if (!groups[date]) groups[date] = [];
    groups[date].push(tx);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-12 skeleton rounded-xl" />
        <MobileSkeleton variant="list" />
        <MobileSkeleton variant="list" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid="mobile-history">
      {/* Tabs - прижаты к хедеру */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex-shrink-0">
        <div className="mobile-tabs">
          <button
            className={`mobile-tab ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            {language === 'ru' ? 'Операции' : 'Transactions'}
          </button>
          <button
            className={`mobile-tab ${activeTab === 'contracts' ? 'active' : ''}`}
            onClick={() => setActiveTab('contracts')}
          >
            {language === 'ru' ? 'Контракты' : 'Contracts'}
          </button>
        </div>
      </div>

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-20">
            {/* Filter */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 mb-4 text-sm text-gray-600"
            >
              <Filter className="w-4 h-4" />
              {language === 'ru' ? 'Фильтр' : 'Filter'}
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {showFilters && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4">
                {[
                  { value: 'all', label: language === 'ru' ? 'Все' : 'All' },
                  { value: 'income', label: language === 'ru' ? 'Доходы' : 'Income' },
                  { value: 'expense', label: language === 'ru' ? 'Расходы' : 'Expenses' },
                  { value: 'profit', label: language === 'ru' ? 'Прибыль' : 'Profit' },
                ].map(filter => (
                  <button
                    key={filter.value}
                    onClick={() => setFilterType(filter.value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      filterType === filter.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}

            {/* Transactions grouped by date */}
            {Object.keys(groupedTransactions).length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {language === 'ru' ? 'Нет операций' : 'No transactions'}
                </p>
              </div>
            ) : (
              Object.entries(groupedTransactions).map(([date, txs]) => (
                <div key={date} className="mb-6">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1 flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {date}
                  </h3>
                  <div className="mobile-card overflow-hidden">
                    {txs.map((tx) => {
                      const statusConfig = getStatusConfig(tx.status);
                      const income = isIncome(tx.type);
                      
                      // Parse description for portfolio and destination info
                      let portfolioName = '';
                      let destination = '';
                      let typeLabel = '';
                      
                      if (tx.type === 'profit' || tx.type === 'income') {
                        typeLabel = language === 'ru' ? 'Доход' : 'Income';
                        if (tx.description && tx.description.includes('→')) {
                          const parts = tx.description.split('→');
                          // Extract portfolio name from "Доход от портфеля «Name»"
                          const match = parts[0].match(/«([^»]+)»/);
                          if (match) portfolioName = match[1];
                          destination = parts[1]?.trim() || '';
                        }
                      } else if (tx.type === 'investment') {
                        typeLabel = language === 'ru' ? 'Инвестирование' : 'Investment';
                        if (tx.description) {
                          // Russian format: "Инвестиция в «Name»"
                          const matchRu = tx.description.match(/«([^»]+)»/);
                          if (matchRu) {
                            portfolioName = matchRu[1];
                          } else if (tx.description.includes('Investment in ')) {
                            // English format
                            portfolioName = tx.description.replace('Investment in ', '');
                          }
                        }
                      } else {
                        typeLabel = getTypeLabel(tx.type, tx.description);
                      }
                      
                      return (
                        <div 
                          key={tx.transaction_id} 
                          className="flex items-center justify-between p-4 border-b border-gray-100 last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              income ? 'bg-green-100' : 'bg-amber-100'
                            }`}>
                              {income ? (
                                <ArrowDownRight className="w-5 h-5 text-green-600" />
                              ) : (
                                <ArrowUpRight className="w-5 h-5 text-amber-600" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900">{typeLabel}</p>
                              {(tx.type === 'profit' || tx.type === 'income') && portfolioName ? (
                                <div className="text-xs text-gray-500">
                                  <span className="text-primary font-medium">{portfolioName}</span>
                                  <span> →</span>
                                  <br />
                                  <span>{destination}</span>
                                </div>
                              ) : tx.type === 'investment' && portfolioName ? (
                                <div className="text-xs text-gray-500">
                                  <span>{language === 'ru' ? 'Инвестиция в ' : 'Investment in '}«{portfolioName}»</span>
                                  <br />
                                  <span>{formatDateTime(tx.created_at)}</span>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500">{formatDateTime(tx.created_at)}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`font-semibold ${income ? 'text-green-600' : 'text-gray-900'}`}>
                              {income ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                            </p>
                            <Badge className={`text-xs ${statusConfig.color}`}>
                              {statusConfig.label}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Contracts Tab */}
        {activeTab === 'contracts' && (
          <div className="flex-1 overflow-y-auto px-4 pt-3 pb-20">
            {investments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {language === 'ru' ? 'Нет контрактов' : 'No contracts'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {investments.map((inv) => {
                  const statusConfig = getStatusConfig(inv.status);
                  const endDate = inv.end_date ? new Date(inv.end_date) : null;
                  const now = new Date();
                  
                  // Get duration unit from investment
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
                    <div key={inv.investment_id} className="mobile-card p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-primary">
                            {inv.portfolio_name || inv.portfolio_id}
                          </p>
                          <p className="text-xs text-gray-500">#{inv.investment_id.slice(-8).toUpperCase()}</p>
                        </div>
                        <Badge className={statusConfig.color}>
                          {inv.status === 'active' 
                            ? (language === 'ru' ? 'Активный' : 'Active') 
                            : statusConfig.label}
                        </Badge>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-500 mb-1">
                            {language === 'ru' ? 'Сумма' : 'Amount'}
                          </p>
                          <p className="font-semibold">{formatCurrency(inv.amount, inv.currency)}</p>
                        </div>
                        <div className="bg-green-50 rounded-xl p-3">
                          <p className="text-xs text-gray-500 mb-1">
                            {language === 'ru' ? 'Ожид. доход' : 'Expected'}
                          </p>
                          <p className="font-semibold text-green-600">
                            +{formatCurrency(inv.expected_return || 0, inv.currency)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Profit breakdown */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-blue-50 rounded-xl p-2 text-center">
                          <p className="text-xs text-gray-500">
                            {inv.auto_reinvest 
                              ? (language === 'ru' ? 'Реинвест' : 'Reinvest')
                              : (language === 'ru' ? 'Выплачено' : 'Paid')}
                          </p>
                          <p className="font-semibold text-blue-600 text-sm">
                            {formatCurrency(inv.auto_reinvest ? (inv.accrued_profit || 0) : (inv.paid_profit || 0), inv.currency)}
                          </p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-2 text-center">
                          <p className="text-xs text-gray-500">{language === 'ru' ? 'Осталось' : 'Left'}</p>
                          <p className="font-semibold text-amber-600 text-sm">{formatCurrency(inv.remaining_profit || 0, inv.currency)}</p>
                        </div>
                        <div className="bg-primary/10 rounded-xl p-2 text-center">
                          <p className="text-xs text-gray-500">{language === 'ru' ? 'Баланс' : 'Balance'}</p>
                          <p className="font-semibold text-primary text-sm">{formatCurrency(inv.current_balance || inv.amount || 0, inv.currency)}</p>
                        </div>
                      </div>

                      {/* Progress */}
                      {inv.status === 'active' && (
                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-500">{language === 'ru' ? 'Прогресс' : 'Progress'}</span>
                            <span className="font-medium">{timeLeftLabel}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Dates */}
                      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(inv.start_date)}
                        </div>
                        <span>→</span>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {inv.end_date ? formatDate(inv.end_date) : '-'}
                        </div>
                      </div>

                      {/* Actions */}
                      <button
                        onClick={() => downloadContract(inv.investment_id)}
                        className="w-full py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        {language === 'ru' ? 'Скачать контракт' : 'Download Contract'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
    </div>
  );
}

export default MobileHistory;
