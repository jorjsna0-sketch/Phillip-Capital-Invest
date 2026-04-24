import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { MobileSkeleton } from '../components/MobileUIComponents';
import { 
  ArrowLeft,
  Check,
  Loader2,
  Download,
  AlertCircle,
  Wallet,
  Clock,
  FileText,
  Pen,
  ChevronRight,
  TrendingUp,
  Shield,
  CheckCircle,
  X,
  RefreshCw
} from 'lucide-react';

// Step indicator component - compact version
function StepIndicator({ currentStep, totalSteps = 4 }) {
  return (
    <div className="flex items-center justify-center gap-1 py-3 px-2">
      {[1, 2, 3, 4].map((step) => (
        <div key={step} className="flex items-center">
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
              step < currentStep 
                ? 'bg-green-500 text-white' 
                : step === currentStep 
                  ? 'bg-primary text-white ring-2 ring-primary/30 ring-offset-1' 
                  : 'bg-gray-200 text-gray-500'
            }`}
          >
            {step < currentStep ? <Check className="w-3.5 h-3.5" /> : step}
          </div>
          {step < totalSteps && (
            <div 
              className={`w-5 h-0.5 mx-0.5 rounded transition-all duration-300 ${
                step < currentStep ? 'bg-green-500' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function MobileInvestWizard() {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
  const { api, user, refreshUser } = useAuth();
  const { t, formatCurrency, convertCurrency, getLocalizedText, language } = useLanguage();
  const canvasRef = useRef(null);
  
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [investmentId, setInvestmentId] = useState(null);
  
  // Form state - always USD
  const [amount, setAmount] = useState('');
  const selectedCurrency = 'USD'; // Fixed to USD
  const [duration, setDuration] = useState('');
  const [autoReinvest, setAutoReinvest] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // Check if user can invest
  const canInvest = user?.kyc_status === 'approved' || user?.phone_verified || user?.can_invest_without_kyc;

  useEffect(() => {
    fetchPortfolio();
  }, [portfolioId]);

  useEffect(() => {
    if (canvasRef.current && step === 3) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#1a365d';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [step]);

  const fetchPortfolio = async () => {
    try {
      const response = await api.get(`/portfolios/${portfolioId}`);
      setPortfolio(response.data);
      if (response.data.duration_months?.length > 0) {
        setDuration(response.data.duration_months[0].toString());
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      navigate('/portfolios');
    } finally {
      setLoading(false);
    }
  };

  // Canvas drawing handlers
  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      canvasRef.current?.getContext('2d')?.closePath();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a365d';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const getCanvasSignature = () => {
    if (!canvasRef.current) return '';
    return canvasRef.current.toDataURL('image/png');
  };

  // Calculate expected return
  // Note: Rate is for the FULL TERM (not annual)
  const calculateSimpleReturn = useCallback(() => {
    if (!portfolio || !duration || !amount) return 0;
    const numAmount = parseFloat(amount) || 0;
    const rate = portfolio.returns_by_term?.[duration] || portfolio.returns_by_term?.[parseInt(duration)] || portfolio.expected_return;
    // Simple interest: profit = amount * (rate / 100)
    return numAmount * (rate / 100);
  }, [portfolio, duration, amount]);
  
  // Calculate compound return based on accrual intervals
  const calculateCompoundReturn = useCallback(() => {
    if (!portfolio || !duration || !amount) return 0;
    const principal = parseFloat(amount) || 0;
    const durationValue = parseInt(duration);
    const rate = portfolio.returns_by_term?.[duration] || portfolio.returns_by_term?.[durationValue] || portfolio.expected_return;
    const accrualInterval = portfolio.profit_accrual_interval || 'monthly';
    const durationUnit = portfolio.duration_unit || 'months';
    
    // Calculate total periods
    let totalPeriods = 1;
    if (durationUnit === 'days') {
      if (accrualInterval === 'hourly') totalPeriods = durationValue * 24;
      else if (accrualInterval === 'daily') totalPeriods = durationValue;
      else if (accrualInterval === 'weekly') totalPeriods = Math.max(1, Math.floor(durationValue / 7));
      else if (accrualInterval === 'monthly') totalPeriods = Math.max(1, Math.floor(durationValue / 30));
    } else if (durationUnit === 'hours') {
      if (accrualInterval === 'hourly') totalPeriods = durationValue;
      else if (accrualInterval === 'daily') totalPeriods = Math.max(1, Math.floor(durationValue / 24));
    } else if (durationUnit === 'years') {
      if (accrualInterval === 'hourly') totalPeriods = durationValue * 8760;
      else if (accrualInterval === 'daily') totalPeriods = durationValue * 365;
      else if (accrualInterval === 'weekly') totalPeriods = durationValue * 52;
      else if (accrualInterval === 'monthly') totalPeriods = durationValue * 12;
    } else {
      // months
      if (accrualInterval === 'hourly') totalPeriods = durationValue * 720;
      else if (accrualInterval === 'daily') totalPeriods = durationValue * 30;
      else if (accrualInterval === 'weekly') totalPeriods = durationValue * 4;
      else if (accrualInterval === 'monthly') totalPeriods = durationValue;
    }
    
    // Per-period rate
    const periodRate = rate / totalPeriods / 100;
    
    // Compound formula: A = P * (1 + r)^n - P
    const finalAmount = principal * Math.pow(1 + periodRate, totalPeriods);
    return finalAmount - principal;
  }, [portfolio, duration, amount]);
  
  // Use compound for display when auto-reinvest is on
  const expectedReturn = useCallback(() => {
    if (autoReinvest) return calculateCompoundReturn();
    return calculateSimpleReturn();
  }, [autoReinvest, calculateCompoundReturn, calculateSimpleReturn]);

  const currentRate = portfolio?.returns_by_term?.[duration] || portfolio?.returns_by_term?.[parseInt(duration)] || portfolio?.expected_return || 0;
  const availableBalanceUsd = user?.available_balance?.USD || 0;
  const availableBalanceTry = convertCurrency(availableBalanceUsd, 'USD', 'TRY');

  // Validation
  const validateStep1 = () => {
    const numAmountTry = parseFloat(amount);
    if (!amount || numAmountTry <= 0) {
      setError(language === 'ru' ? 'Введите сумму инвестиции' : 'Enter investment amount');
      return false;
    }
    // Convert user's TRY input to USD (portfolio limits & balance are USD-based).
    const numAmountUsd = convertCurrency(numAmountTry, 'TRY', 'USD');
    if (numAmountUsd < portfolio.min_investment) {
      setError(`${language === 'ru' ? 'Минимальная сумма' : 'Minimum amount'}: ${formatCurrency(portfolio.min_investment)}`);
      return false;
    }
    if (numAmountUsd > portfolio.max_investment) {
      setError(`${language === 'ru' ? 'Максимальная сумма' : 'Maximum amount'}: ${formatCurrency(portfolio.max_investment)}`);
      return false;
    }
    if (numAmountUsd > availableBalanceUsd) {
      setError(`${language === 'ru' ? 'Недостаточно средств. Доступно' : 'Insufficient funds. Available'}: ${formatCurrency(availableBalanceUsd)}`);
      return false;
    }
    if (!duration) {
      setError(language === 'ru' ? 'Выберите срок' : 'Select duration');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep2 = () => {
    if (!termsAccepted) {
      setError(language === 'ru' ? 'Примите условия соглашения' : 'Accept the terms');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep3 = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setError(language === 'ru' ? 'Поставьте подпись' : 'Please sign');
      return false;
    }
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let hasDrawing = false;
    for (let i = 0; i < data.length; i += 400) {
      if (data[i] < 250 || data[i+1] < 250 || data[i+2] < 250) {
        hasDrawing = true;
        break;
      }
    }
    if (!hasDrawing) {
      setError(language === 'ru' ? 'Нарисуйте подпись' : 'Draw your signature');
      return false;
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (navigator.vibrate) navigator.vibrate(10);
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const handleBack = () => {
    if (navigator.vibrate) navigator.vibrate(10);
    if (step > 1) setStep(step - 1);
    else navigate(-1);
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    if (navigator.vibrate) navigator.vibrate(20);

    setSubmitting(true);
    setError('');

    try {
      const signature = getCanvasSignature();
      const amountTry = parseFloat(amount);
      const amountUsd = convertCurrency(amountTry, 'TRY', 'USD');
      const response = await api.post('/investments', {
        portfolio_id: portfolioId,
        amount: amountUsd,
        currency: selectedCurrency,
        duration_months: parseInt(duration),
        auto_reinvest: autoReinvest,
        terms_accepted: termsAccepted,
        signature,
        signature_type: 'canvas'
      });

      setInvestmentId(response.data.investment_id);
      setSuccess(true);
      setStep(4);
      await refreshUser();
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    } catch (error) {
      setError(error.response?.data?.detail || (language === 'ru' ? 'Ошибка создания инвестиции' : 'Investment creation failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const downloadContract = async () => {
    if (!investmentId) return;
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
      <div className="p-4 space-y-4">
        <div className="h-12 skeleton rounded-xl" />
        <MobileSkeleton variant="card" />
        <MobileSkeleton variant="card" />
      </div>
    );
  }

  // Not allowed to invest
  if (!canInvest) {
    return (
      <div className="fixed inset-0 flex flex-col bg-gray-50">
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="mobile-card p-6 text-center max-w-sm">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">
              {language === 'ru' ? 'Верификация требуется' : 'Verification Required'}
            </h2>
            <p className="text-gray-500 mb-6 text-sm">
              {language === 'ru' 
                ? 'Для инвестирования пройдите верификацию KYC или подтвердите номер телефона.'
                : 'Please complete KYC or verify your phone to invest.'}
            </p>
            <Button onClick={() => navigate('/settings')} className="w-full">
              {language === 'ru' ? 'Пройти верификацию' : 'Verify Now'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-50" data-testid="mobile-invest-wizard">
      {/* Header - fixed height */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-2">
        <div className="flex items-center justify-between">
          <button onClick={handleBack} className="p-2 -ml-2">
            {step === 4 ? <X className="w-6 h-6" /> : <ArrowLeft className="w-6 h-6" />}
          </button>
          <h1 className="font-semibold text-sm">
            {step === 4 
              ? (language === 'ru' ? 'Успешно!' : 'Success!') 
              : (language === 'ru' ? 'Инвестирование' : 'Investment')}
          </h1>
          <div className="w-10" />
        </div>
        {step < 4 && <StepIndicator currentStep={step} />}
      </div>

      {/* Content - fills remaining space */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Step 1: Amount & Duration */}
        {step === 1 && (
          <div className="flex-1 flex flex-col p-3 overflow-hidden animate-fadeIn">
            {/* Top section - scrollable if needed */}
            <div className="flex-1 overflow-y-auto space-y-3 pb-2">
              {/* Portfolio Info + Balance */}
              <div className="mobile-card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-sm">{getLocalizedText(portfolio?.name)}</h2>
                      <p className="text-xs text-green-600">{currentRate}%</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{language === 'ru' ? 'Доступно' : 'Available'}</p>
                    <p className="font-semibold text-sm">{formatCurrency(availableBalanceUsd)}</p>
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="mobile-card p-3 space-y-2">
                <label className="text-xs text-gray-500">
                  {language === 'ru' ? 'Сумма инвестиции' : 'Investment Amount'}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="text-xl font-bold h-12"
                  />
                  <div className="flex items-center justify-center w-20 h-12 bg-gray-100 rounded-md text-sm font-medium">
                    ₺ TRY
                  </div>
                </div>
                {/* Quick amounts */}
                <div className="flex gap-2">
                  {[1000, 5000, 10000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setAmount(amt.toString())}
                      className="flex-1 py-1.5 text-xs font-medium bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      ₺{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Selection */}
              <div className="mobile-card p-3">
                <label className="text-xs text-gray-500 mb-2 block">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {language === 'ru' ? 'Срок' : 'Duration'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {portfolio?.duration_months?.map(d => {
                    const rate = portfolio.returns_by_term?.[d.toString()] || portfolio.returns_by_term?.[d] || portfolio.expected_return;
                    const unitLabel = portfolio.duration_unit === 'days' ? (language === 'ru' ? 'дн' : 'd') : 
                                     portfolio.duration_unit === 'hours' ? (language === 'ru' ? 'ч' : 'h') : 
                                     portfolio.duration_unit === 'years' ? (language === 'ru' ? 'г' : 'y') : 
                                     (language === 'ru' ? 'мес' : 'mo');
                    return (
                      <button
                        key={d}
                        onClick={() => setDuration(d.toString())}
                        className={`p-3 rounded-xl text-center transition-all ${
                          duration === d.toString()
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <span className="text-lg font-bold block">{d}</span>
                        <span className="text-[10px] opacity-80 block">{unitLabel}</span>
                        <span className={`text-xs font-semibold block mt-1 ${duration === d.toString() ? 'text-green-200' : 'text-green-600'}`}>
                          {rate}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payout Frequency Info */}
              <div className="mobile-card p-3 bg-blue-50 border border-blue-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-800">
                    {language === 'ru' ? 'Частота начисления' : 'Payout Frequency'}
                  </span>
                  <span className="text-sm font-medium text-blue-900">
                    {portfolio?.profit_accrual_interval === 'hourly' ? (language === 'ru' ? 'Ежечасно' : 'Hourly') :
                     portfolio?.profit_accrual_interval === 'daily' ? (language === 'ru' ? 'Ежедневно' : 'Daily') :
                     portfolio?.profit_accrual_interval === 'weekly' ? (language === 'ru' ? 'Еженедельно' : 'Weekly') :
                     portfolio?.profit_accrual_interval === 'yearly' ? (language === 'ru' ? 'Ежегодно' : 'Yearly') : 
                     (language === 'ru' ? 'Ежемесячно' : 'Monthly')}
                  </span>
                </div>
              </div>

              {/* Auto-reinvest */}
              <div className="mobile-card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{language === 'ru' ? 'Капитализация' : 'Compound'}</p>
                    <p className="text-xs text-gray-500">
                      {language === 'ru' ? 'Сложный процент' : 'Compound interest'}
                    </p>
                  </div>
                  <Switch checked={autoReinvest} onCheckedChange={setAutoReinvest} />
                </div>
              </div>
            </div>

            {/* Expected Return - fixed at bottom before button */}
            {amount && parseFloat(amount) > 0 && (
              <div className="flex-shrink-0 mobile-balance-card mt-2">
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-xs">
                      {language === 'ru' ? 'Ожидаемая прибыль' : 'Expected Profit'}
                      {autoReinvest && (language === 'ru' ? ' (сложн. %)' : ' (compound)')}
                    </p>
                    <p className="text-2xl font-bold text-white">+{formatCurrency(expectedReturn(), 'TRY', null)}</p>
                  </div>
                  <div className="text-right text-white/60 text-xs">
                    <p>{duration} {portfolio?.duration_unit === 'days' ? (language === 'ru' ? 'дн.' : 'd') : portfolio?.duration_unit === 'hours' ? (language === 'ru' ? 'ч.' : 'h') : portfolio?.duration_unit === 'years' ? (language === 'ru' ? 'г.' : 'y') : (language === 'ru' ? 'мес.' : 'mo')}</p>
                    <p>{currentRate}%</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Terms & Conditions */}
        {step === 2 && (
          <div className="flex-1 flex flex-col p-3 overflow-hidden animate-fadeIn">
            <div className="flex-1 overflow-y-auto space-y-3">
              <div className="mobile-card p-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <h2 className="font-semibold text-sm">{language === 'ru' ? 'Условия договора' : 'Contract Terms'}</h2>
                </div>

                {/* Summary */}
                <div className="space-y-2 mb-3 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">{language === 'ru' ? 'Портфель' : 'Portfolio'}</span>
                    <span className="font-medium">{getLocalizedText(portfolio?.name)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">{language === 'ru' ? 'Сумма' : 'Amount'}</span>
                    <span className="font-medium">{formatCurrency(parseFloat(amount), 'TRY', null)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">{language === 'ru' ? 'Срок' : 'Duration'}</span>
                    <span className="font-medium">{duration} {portfolio?.duration_unit === 'days' ? (language === 'ru' ? 'дн.' : 'd') : portfolio?.duration_unit === 'hours' ? (language === 'ru' ? 'ч.' : 'h') : portfolio?.duration_unit === 'years' ? (language === 'ru' ? 'г.' : 'y') : (language === 'ru' ? 'мес.' : 'mo')}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">{language === 'ru' ? 'Ставка' : 'Rate'}</span>
                    <span className="font-medium text-green-600">{currentRate}%</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">{language === 'ru' ? 'Начисление' : 'Payout'}</span>
                    <span className="font-medium">
                      {portfolio?.profit_accrual_interval === 'hourly' ? (language === 'ru' ? 'Ежечасно' : 'Hourly') :
                       portfolio?.profit_accrual_interval === 'daily' ? (language === 'ru' ? 'Ежедневно' : 'Daily') :
                       portfolio?.profit_accrual_interval === 'weekly' ? (language === 'ru' ? 'Еженедельно' : 'Weekly') :
                       portfolio?.profit_accrual_interval === 'yearly' ? (language === 'ru' ? 'Ежегодно' : 'Yearly') : 
                       (language === 'ru' ? 'Ежемесячно' : 'Monthly')}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-gray-500">{language === 'ru' ? 'Капитализация' : 'Compound'}</span>
                    <span className="font-medium">{autoReinvest ? (language === 'ru' ? 'Да' : 'Yes') : (language === 'ru' ? 'Нет' : 'No')}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500">{language === 'ru' ? 'Прибыль' : 'Profit'}</span>
                    <span className="font-bold text-green-600">+{formatCurrency(expectedReturn(), 'TRY', null)}</span>
                  </div>
                </div>
              </div>

              {/* Terms text */}
              <div className="mobile-card p-3">
                <div className="bg-gray-50 rounded-xl p-3 max-h-32 overflow-y-auto text-xs text-gray-600 mb-3">
                  {language === 'ru' ? (
                    <>
                      <p className="mb-2 font-medium">Подписывая договор, я подтверждаю:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Ознакомлен с условиями инвестирования</li>
                        <li>Понимаю риски, связанные с инвестициями</li>
                        <li>Согласен с условиями досрочного расторжения</li>
                        <li>Подтверждаю достоверность предоставленных данных</li>
                      </ul>
                    </>
                  ) : (
                    <>
                      <p className="mb-2 font-medium">By signing, I confirm that:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>I have read the investment terms</li>
                        <li>I understand the risks involved</li>
                        <li>I agree to early termination conditions</li>
                        <li>I confirm the accuracy of provided data</li>
                      </ul>
                    </>
                  )}
                </div>

                {/* Checkbox */}
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={setTermsAccepted}
                    className="mt-0.5"
                  />
                  <label htmlFor="terms" className="text-xs">
                    {language === 'ru' 
                      ? 'Я прочитал и принимаю условия соглашения'
                      : 'I have read and accept the terms'}
                  </label>
                </div>
              </div>

              {/* Guarantees */}
              <div className="mobile-card p-3">
                <h3 className="font-medium text-sm mb-2">{language === 'ru' ? 'Гарантии' : 'Guarantees'}</h3>
                <div className="space-y-1.5">
                  {[
                    { icon: Shield, text: language === 'ru' ? 'Юридически оформленный контракт' : 'Legal contract' },
                    { icon: CheckCircle, text: language === 'ru' ? 'Страхование инвестиций' : 'Investment insurance' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <item.icon className="w-3.5 h-3.5 text-green-500" />
                      {item.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Signature */}
        {step === 3 && (
          <div className="flex-1 flex flex-col p-3 overflow-hidden animate-fadeIn">
            <div className="flex-1 flex flex-col space-y-3">
              <div className="mobile-card p-3 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Pen className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-sm">{language === 'ru' ? 'Электронная подпись' : 'Digital Signature'}</h2>
                    <p className="text-xs text-gray-500">{language === 'ru' ? 'Нарисуйте подпись' : 'Draw your signature'}</p>
                  </div>
                </div>

                {/* Canvas - flex grow */}
                <div className="relative flex-1 min-h-[120px]">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={300}
                    className="absolute inset-0 w-full h-full border-2 border-dashed border-gray-300 rounded-xl bg-white touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  <button
                    onClick={clearCanvas}
                    className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-lg shadow-sm"
                  >
                    <RefreshCw className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 text-center mt-2">
                  {language === 'ru' ? 'Подпись будет использована в контракте' : 'Signature will be used in the contract'}
                </p>
              </div>

              {/* Final Summary */}
              <div className="flex-shrink-0 bg-gradient-to-br from-primary to-emerald-700 rounded-2xl p-3 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-xs">{language === 'ru' ? 'Итого' : 'Total'}</p>
                    <p className="text-2xl font-bold">{formatCurrency(parseFloat(amount), 'TRY', null)}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-white/60">{duration} {portfolio?.duration_unit === 'days' ? (language === 'ru' ? 'дн.' : 'd') : portfolio?.duration_unit === 'hours' ? (language === 'ru' ? 'ч.' : 'h') : portfolio?.duration_unit === 'years' ? (language === 'ru' ? 'г.' : 'y') : (language === 'ru' ? 'мес.' : 'mo')}</p>
                    <p className="text-white font-medium">+{formatCurrency(expectedReturn(), 'TRY', null)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && success && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 animate-fadeIn">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-center">
              {language === 'ru' ? 'Инвестиция создана!' : 'Investment Created!'}
            </h2>
            <p className="text-gray-500 text-sm text-center mb-4">
              {language === 'ru' 
                ? 'Контракт готов к скачиванию'
                : 'Contract is ready to download'}
            </p>

            <div className="mobile-card p-3 w-full max-w-sm mb-4">
              <div className="flex justify-between py-1.5 border-b border-gray-100 text-sm">
                <span className="text-gray-500">{language === 'ru' ? 'Сумма' : 'Amount'}</span>
                <span className="font-medium">{formatCurrency(parseFloat(amount), 'TRY', null)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 text-sm">
                <span className="text-gray-500">{language === 'ru' ? 'Срок' : 'Duration'}</span>
                <span className="font-medium">{duration} {portfolio?.duration_unit === 'days' ? (language === 'ru' ? 'дн.' : 'd') : portfolio?.duration_unit === 'hours' ? (language === 'ru' ? 'ч.' : 'h') : portfolio?.duration_unit === 'years' ? (language === 'ru' ? 'г.' : 'y') : (language === 'ru' ? 'мес.' : 'mo')}</span>
              </div>
              <div className="flex justify-between py-1.5 text-sm">
                <span className="text-gray-500">{language === 'ru' ? 'Прибыль' : 'Profit'}</span>
                <span className="font-bold text-green-600">+{formatCurrency(expectedReturn(), 'TRY', null)}</span>
              </div>
            </div>

            <div className="space-y-2 w-full max-w-sm">
              <Button onClick={downloadContract} variant="outline" className="w-full h-11">
                <Download className="w-4 h-4 mr-2" />
                {language === 'ru' ? 'Скачать контракт' : 'Download Contract'}
              </Button>
              <Button onClick={() => navigate('/dashboard')} className="w-full h-11">
                {language === 'ru' ? 'На главную' : 'Go to Dashboard'}
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex-shrink-0 mx-3 mb-2 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Bottom CTA - fixed */}
      {step < 4 && (
        <div className="flex-shrink-0 p-3 bg-white border-t border-gray-100" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
          {step === 3 ? (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-12 text-base font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {language === 'ru' ? 'Оформление...' : 'Processing...'}
                </>
              ) : (
                <>
                  {language === 'ru' ? 'Подписать и инвестировать' : 'Sign & Invest'}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext} className="w-full h-12 text-base font-semibold">
              {language === 'ru' ? 'Продолжить' : 'Continue'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease forwards;
        }
      `}</style>
    </div>
  );
}

export default MobileInvestWizard;
