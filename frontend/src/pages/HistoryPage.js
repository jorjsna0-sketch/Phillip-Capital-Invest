import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { MobileHistory } from './MobileHistory';
import { 
  ArrowUpRight, 
  ArrowDownRight,
  Loader2,
  FileText,
  Download
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

export function HistoryPage() {
  const isMobile = useIsMobile();
  
  // Render mobile version
  if (isMobile) {
    return <MobileHistory />;
  }
  
  // Desktop version continues below
  return <DesktopHistory />;
}

function DesktopHistory() {
  const { api } = useAuth();
  const { t, language, formatCurrency, formatDateTime } = useLanguage();
  
  const [transactions, setTransactions] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
  };

  const handleDownloadContract = async (investmentId) => {
    try {
      const response = await api.get(`/investments/${investmentId}/contract?lang=${language}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
      case 'active':
        return 'status-approved';
      case 'pending':
        return 'status-pending';
      default:
        return 'status-rejected';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8" data-testid="history-page">
      <div className="container-premium">
        <h1 className="text-h2 text-primary mb-8">{t('nav_history')}</h1>

        <Tabs defaultValue="transactions" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="transactions">{t('transactions_title')}</TabsTrigger>
            <TabsTrigger value="contracts">{t('contracts_title')}</TabsTrigger>
          </TabsList>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="text-h3">{t('transactions_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length > 0 ? (
                  <div className="space-y-3">
                    {transactions.map((tx) => {
                      const isIncome = tx.type === 'deposit' || tx.type === 'return' || tx.type === 'profit' || tx.type === 'income';
                      
                      // Parse description for portfolio and destination info
                      let typeLabel = '';
                      let detailLine = '';
                      let portfolioName = '';
                      let destination = '';
                      
                      if (tx.type === 'profit' || tx.type === 'income') {
                        typeLabel = language === 'ru' ? 'Доход' : language === 'tr' ? 'Gelir' : 'Income';
                        if (tx.description && tx.description.includes('→')) {
                          detailLine = tx.description;
                        } else if (tx.description) {
                          detailLine = tx.description;
                        }
                      } else if (tx.type === 'investment') {
                        typeLabel = language === 'ru' ? 'Инвестирование' : language === 'tr' ? 'Yatırım' : 'Investment';
                        if (tx.description) {
                          // Russian format: "Инвестиция в «Name»"
                          if (tx.description.includes('«')) {
                            detailLine = tx.description;
                          } else if (tx.description.includes('Investment in ')) {
                            // English format - convert to Russian
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
                      } else if (tx.type === 'deposit') {
                        typeLabel = t('tx_deposit');
                      } else if (tx.type === 'withdrawal') {
                        typeLabel = t('tx_withdrawal');
                      } else if (tx.type === 'return') {
                        typeLabel = t('tx_return');
                      } else {
                        typeLabel = t(`tx_${tx.type}`);
                      }
                      
                      return (
                        <div 
                          key={tx.transaction_id} 
                          className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0"
                          data-testid={`transaction-${tx.transaction_id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              isIncome 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-amber-100 text-amber-600'
                            }`}>
                              {isIncome 
                                ? <ArrowDownRight className="w-6 h-6" />
                                : <ArrowUpRight className="w-6 h-6" />
                              }
                            </div>
                            <div>
                              <p className="font-semibold">{typeLabel}</p>
                              {detailLine && (
                                <p className="text-sm text-muted-foreground">{detailLine}</p>
                              )}
                              <p className="text-xs text-muted-foreground">{formatDateTime(tx.created_at)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-medium ${
                              isIncome ? 'text-green-600' : 'text-gray-900'
                            }`}>
                              {isIncome ? '+' : '-'}
                              {formatCurrency(tx.amount, tx.currency)}
                            </p>
                            <Badge className={getStatusBadge(tx.status)}>
                              {t(`status_${tx.status}`)}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-12">
                    Нет транзакций
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts">
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="text-h3">{t('contracts_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                {investments.length > 0 ? (
                  <div className="space-y-4">
                    {investments.map((inv) => {
                      // Get duration label based on duration_unit
                      const getDurationLabel = () => {
                        const unit = inv.duration_unit || 'months';
                        const value = inv.duration_months;
                        switch (unit) {
                          case 'hours': return `${value} ч.`;
                          case 'days': return `${value} дн.`;
                          case 'years': return `${value} г.`;
                          default: return `${value} мес.`;
                        }
                      };
                      
                      return (
                        <div 
                          key={inv.investment_id} 
                          className="p-4 border border-gray-100 rounded-md hover:border-primary/20 transition-colors"
                          data-testid={`investment-${inv.investment_id}`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/10 rounded-sm flex items-center justify-center">
                                <FileText className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{inv.portfolio_name || inv.portfolio_id}</p>
                                <p className="text-xs text-muted-foreground">
                                  #{inv.investment_id.slice(-8).toUpperCase()} • {formatDateTime(inv.created_at)}
                                </p>
                              </div>
                            </div>
                            <Badge className={getStatusBadge(inv.status)}>
                              {inv.status === 'active' ? 'Активен' : inv.status === 'completed' ? 'Завершен' : 'Отменен'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Сумма</p>
                              <p className="font-medium">{formatCurrency(inv.amount, inv.currency)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Срок</p>
                              <p className="font-medium">{getDurationLabel()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Ожидаемый доход</p>
                              <p className="font-medium text-green-600">+{formatCurrency(inv.expected_return, inv.currency)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Дата окончания</p>
                              <p className="font-medium">{new Date(inv.end_date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          
                          {/* Profit details */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mt-3 pt-3 border-t border-dashed border-gray-200">
                            <div>
                              <p className="text-muted-foreground">
                                {inv.auto_reinvest ? 'Реинвестировано' : 'Выплачено'}
                              </p>
                              <p className="font-medium text-blue-600">
                                {formatCurrency(inv.auto_reinvest ? (inv.accrued_profit || 0) : (inv.paid_profit || 0), inv.currency)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Осталось получить</p>
                              <p className="font-medium text-amber-600">{formatCurrency(inv.remaining_profit || 0, inv.currency)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Текущий баланс</p>
                              <p className="font-medium">{formatCurrency(inv.current_balance || inv.amount || 0, inv.currency)}</p>
                            </div>
                          </div>
                        
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                          <p className="text-xs text-muted-foreground">
                            Автопродление: {inv.auto_reinvest ? 'Да (сложный %)' : 'Нет'}
                          </p>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDownloadContract(inv.investment_id)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Контракт
                          </Button>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-12">
                    Нет контрактов
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default HistoryPage;
