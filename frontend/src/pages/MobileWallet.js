import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Wallet,
  Plus,
  Minus,
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  Loader2,
  X
} from 'lucide-react';

export function MobileWallet() {
  const { api, user } = useAuth();
  const { t, formatCurrency, formatDate, convertCurrency, language } = useLanguage();
  
  const [depositRequests, setDepositRequests] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [companyBankInfo, setCompanyBankInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedBroker, setSelectedBroker] = useState('');
  const [brokerAccount, setBrokerAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('deposits');

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
    setSubmitting(true);
    try {
      // User enters TRY; convert to USD (backend internal base).
      const amountUsd = convertCurrency(parseFloat(depositAmount), 'TRY', 'USD');
      await api.post('/deposit-requests', {
        amount: amountUsd,
        currency: 'USD'
      });
      setDepositAmount('');
      setShowDepositModal(false);
      fetchData();
    } catch (error) {
      console.error('Error creating deposit request:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0 || !selectedBroker) return;
    setSubmitting(true);
    try {
      const amountUsd = convertCurrency(parseFloat(withdrawAmount), 'TRY', 'USD');
      await api.post('/withdrawal-requests', {
        amount: amountUsd,
        currency: 'USD',
        broker_id: selectedBroker,
        broker_account: brokerAccount
      });
      setWithdrawAmount('');
      setBrokerAccount('');
      setSelectedBroker('');
      setShowWithdrawModal(false);
      fetchData();
    } catch (error) {
      console.error('Error creating withdrawal request:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved': return language === 'ru' ? 'Одобрено' : 'Approved';
      case 'rejected': return language === 'ru' ? 'Отклонено' : 'Rejected';
      default: return language === 'ru' ? 'В обработке' : 'Pending';
    }
  };

  const availableBalance = user?.available_balance?.USD || 0;
  const portfolioBalance = user?.portfolio_balance?.USD || 0;
  const availableBalanceTry = convertCurrency(availableBalance, 'USD', 'TRY');
  const currentRequests = activeTab === 'deposits' ? depositRequests : withdrawalRequests;

  if (loading) {
    return (
      <div className="h-full flex flex-col p-3 gap-3">
        <div className="h-28 bg-gray-200 rounded-2xl animate-pulse" />
        <div className="h-12 bg-gray-200 rounded-xl animate-pulse" />
        <div className="flex-1 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid="mobile-wallet">
      {/* Balance Section - Fixed */}
      <div className="p-3 space-y-2 flex-shrink-0">
        {/* Main Balance Card */}
        <div className="bg-gradient-to-br from-primary via-emerald-700 to-emerald-800 rounded-2xl p-4 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/70 text-xs">{t('available_balance')}</span>
              <Wallet className="w-4 h-4 text-white/50" />
            </div>
            <div className="text-2xl font-bold mb-3">{formatCurrency(availableBalance)}</div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                data-testid="deposit-btn"
                onClick={() => setShowDepositModal(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium text-sm bg-white text-gray-900"
              >
                <Plus className="w-4 h-4" />
                <span>{t('deposit')}</span>
              </button>
              <button
                data-testid="withdraw-btn"
                onClick={() => setShowWithdrawModal(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium text-sm border-2 border-white/30 text-white"
              >
                <Minus className="w-4 h-4" />
                <span>{t('withdraw')}</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Portfolio Balance */}
        <div className="bg-white rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <ArrowUpCircle className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('portfolio_balance')}</p>
              <p className="font-semibold text-sm text-gray-900">{formatCurrency(portfolioBalance)}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('deposits')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'deposits' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {language === 'ru' ? 'Пополнения' : 'Deposits'} ({depositRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'withdrawals' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {language === 'ru' ? 'Выводы' : 'Withdrawals'} ({withdrawalRequests.length})
          </button>
        </div>
      </div>

      {/* Scrollable Requests List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {currentRequests.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-400">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{language === 'ru' ? 'Нет заявок' : 'No requests'}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {currentRequests.map((request) => (
              <div 
                key={request.request_id} 
                className="bg-white rounded-xl p-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      activeTab === 'deposits' ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      {activeTab === 'deposits' 
                        ? <ArrowDownCircle className="w-4 h-4 text-green-600" />
                        : <ArrowUpCircle className="w-4 h-4 text-blue-600" />
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {formatCurrency(request.amount)}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(request.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(request.status)}
                    <span className="text-xs text-gray-600">{getStatusText(request.status)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold">{t('deposit_funds')}</h2>
              <button onClick={() => setShowDepositModal(false)} className="p-2 -mr-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {user?.account_number && (
                <div className="p-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl">
                  <p className="text-xs text-primary mb-1">{language === 'ru' ? 'Ваш номер счёта' : 'Your Account'}:</p>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-mono font-bold text-primary">{user.account_number}</span>
                    <button onClick={() => copyToClipboard(user.account_number)} className="p-1.5 hover:bg-primary/10 rounded-lg">
                      <Copy className="w-4 h-4 text-primary" />
                    </button>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs mb-1 block">{t('enter_amount')} (₺ TRY)</Label>
                <Input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="text-lg h-10"
                  data-testid="mobile-deposit-amount-input"
                />
              </div>
            </div>
            
            <div className="px-4 py-3 border-t flex-shrink-0">
              <Button className="w-full h-11" onClick={handleDeposit} disabled={submitting || !depositAmount}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {language === 'ru' ? 'Создать заявку' : 'Submit'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold">{t('withdraw_funds')}</h2>
              <button onClick={() => setShowWithdrawModal(false)} className="p-2 -mr-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <Label className="text-xs mb-1 block">{t('enter_amount')} (₺ TRY)</Label>
                <Input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="text-lg h-10"
                  data-testid="mobile-withdraw-amount-input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'ru' ? 'Доступно' : 'Available'}: {formatCurrency(availableBalance)}
                </p>
              </div>

              <div>
                <Label className="text-xs mb-1 block">{language === 'ru' ? 'Брокер' : 'Broker'} *</Label>
                <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={language === 'ru' ? 'Выберите...' : 'Select...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {brokers.map(broker => (
                      <SelectItem key={broker.broker_id} value={broker.broker_id}>{broker.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs mb-1 block">{language === 'ru' ? 'Номер счёта' : 'Account'}</Label>
                <Input
                  value={brokerAccount}
                  onChange={(e) => setBrokerAccount(e.target.value)}
                  placeholder={language === 'ru' ? 'Ваш номер счёта' : 'Your account'}
                  className="h-10"
                />
              </div>
            </div>
            
            <div className="px-4 py-3 border-t flex-shrink-0">
              <Button className="w-full h-11" onClick={handleWithdraw} disabled={submitting || !withdrawAmount || !selectedBroker}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {language === 'ru' ? 'Создать заявку' : 'Submit'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileWallet;
