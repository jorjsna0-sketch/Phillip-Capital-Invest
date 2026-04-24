import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { MobileInvestWizard } from './MobileInvestWizard';
import { 
  ArrowLeft,
  Check,
  Loader2,
  Download,
  AlertCircle,
  Pen
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

export function InvestPage() {
  const isMobile = useIsMobile();
  
  // Render mobile version
  if (isMobile) {
    return <MobileInvestWizard />;
  }
  
  // Desktop version continues below
  return <DesktopInvestPage />;
}

function DesktopInvestPage() {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
  const { api, user, refreshUser } = useAuth();
  const { t, formatCurrency, formatUsdWithEquivalent, getLocalizedText, currency } = useLanguage();
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

  useEffect(() => {
    fetchPortfolio();
  }, [portfolioId]);

  // Initialize canvas when step 3 is reached
  useEffect(() => {
    if (canvasRef.current && step === 3) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      // Clear canvas with white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Set drawing style for smooth signature
      ctx.strokeStyle = '#1a365d'; // Dark blue for professional look
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.imageSmoothingEnabled = true;
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

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factor for CSS-scaled canvas
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
    e.preventDefault(); // Prevent scrolling on touch
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factor for CSS-scaled canvas
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
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.closePath();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Reset drawing style
    ctx.strokeStyle = '#1a365d';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const getCanvasSignature = () => {
    if (!canvasRef.current) return '';
    return canvasRef.current.toDataURL('image/png');
  };

  const validateStep1 = () => {
    const numAmount = parseFloat(amount);
    if (!amount || numAmount <= 0) {
      setError('Введите сумму инвестиции');
      return false;
    }
    if (numAmount < portfolio.min_investment) {
      setError(`Минимальная сумма: ${formatCurrency(portfolio.min_investment)}`);
      return false;
    }
    if (numAmount > portfolio.max_investment) {
      setError(`Максимальная сумма: ${formatCurrency(portfolio.max_investment)}`);
      return false;
    }
    const availableBalance = user?.available_balance?.[selectedCurrency] || 0;
    if (numAmount > availableBalance) {
      setError(`Недостаточно средств. Доступно: ${formatCurrency(availableBalance, selectedCurrency)}`);
      return false;
    }
    if (!duration) {
      setError('Выберите срок инвестирования');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep2 = () => {
    if (!termsAccepted) {
      setError('Необходимо принять условия соглашения');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep3 = () => {
    // Check if canvas has any drawing (not just white)
    const canvas = canvasRef.current;
    if (!canvas) {
      setError('Пожалуйста, поставьте подпись');
      return false;
    }
    
    // Check if canvas is empty (all white)
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let hasDrawing = false;
    
    // Check every 100th pixel for performance
    for (let i = 0; i < data.length; i += 400) {
      // If pixel is not white (255,255,255)
      if (data[i] < 250 || data[i+1] < 250 || data[i+2] < 250) {
        hasDrawing = true;
        break;
      }
    }
    
    if (!hasDrawing) {
      setError('Пожалуйста, нарисуйте вашу подпись в поле');
      return false;
    }
    
    setError('');
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;

    setSubmitting(true);
    setError('');

    try {
      const signature = getCanvasSignature();
      
      const response = await api.post('/investments', {
        portfolio_id: portfolioId,
        amount: parseFloat(amount),
        currency: selectedCurrency,
        duration_months: parseInt(duration),
        auto_reinvest: autoReinvest,
        terms_accepted: termsAccepted,
        signature,
        signature_type: 'canvas' // Always canvas now
      });

      setInvestmentId(response.data.investment_id);
      setSuccess(true);
      setStep(4);
      await refreshUser();
    } catch (error) {
      setError(error.response?.data?.detail || 'Ошибка создания инвестиции');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadContract = async () => {
    if (!investmentId) return;
    try {
      const response = await api.get(`/investments/${investmentId}/contract`, {
        responseType: 'blob'
      });
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

  // Get current rate based on selected duration
  // Note: currentRate is for the FULL TERM (not annual)
  const currentRate = portfolio?.returns_by_term?.[duration] || portfolio?.returns_by_term?.[parseInt(duration)] || portfolio?.expected_return || 0;
  
  // Calculate expected return based on term rate (not annual)
  // For simple interest: profit = amount * (rate / 100)
  const simpleReturn = portfolio && amount && duration
    ? parseFloat(amount) * (currentRate / 100)
    : 0;
  
  // For compound interest: calculate based on accrual intervals
  const calculateCompoundReturn = () => {
    if (!portfolio || !amount || !duration) return 0;
    const principal = parseFloat(amount);
    const durationValue = parseInt(duration);
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
    const periodRate = currentRate / totalPeriods / 100;
    
    // Compound formula: A = P * (1 + r)^n - P
    const finalAmount = principal * Math.pow(1 + periodRate, totalPeriods);
    return finalAmount - principal;
  };
  
  // Use compound for display when auto-reinvest is on
  const expectedReturn = autoReinvest ? calculateCompoundReturn() : simpleReturn;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!portfolio) return null;

  return (
    <div className="min-h-screen bg-background py-8" data-testid="invest-page">
      <div className="container-premium max-w-2xl">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          className="mb-6"
          onClick={() => navigate('/portfolios')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('back')}
        </Button>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                step >= s 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {step > s ? <Check className="w-5 h-5" /> : s}
              </div>
              {s < 4 && (
                <div className={`w-12 sm:w-20 h-1 mx-2 ${
                  step > s ? 'bg-primary' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* KYC Warning */}
        {!user?.can_invest_without_kyc && (user?.kyc_status !== 'approved' || !user?.phone_verified) && step < 4 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Требуется верификация</p>
                <p className="text-sm text-amber-700 mt-1">
                  {user?.kyc_status !== 'approved' && 'Для инвестирования необходимо пройти KYC верификацию. '}
                  {!user?.phone_verified && 'Также требуется подтвердить номер телефона. '}
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => navigate('/settings')}
                >
                  Пройти верификацию
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step Labels */}
        <div className="flex justify-between mb-8 text-xs sm:text-sm">
          <span className={step >= 1 ? 'text-primary font-medium' : 'text-muted-foreground'}>
            {t('invest_step_1')}
          </span>
          <span className={step >= 2 ? 'text-primary font-medium' : 'text-muted-foreground'}>
            {t('invest_step_2')}
          </span>
          <span className={step >= 3 ? 'text-primary font-medium' : 'text-muted-foreground'}>
            {t('invest_step_3')}
          </span>
          <span className={step >= 4 ? 'text-primary font-medium' : 'text-muted-foreground'}>
            {t('invest_step_4')}
          </span>
        </div>

        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-h3">
              {step === 4 ? t('investment_success') : getLocalizedText(portfolio.name)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-sm bg-destructive/10 text-destructive text-sm flex items-center" data-testid="invest-error">
                <AlertCircle className="w-4 h-4 mr-2" />
                {error}
              </div>
            )}

            {/* Step 1: Select Terms */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Валюта операции</Label>
                  <div className="p-3 bg-gray-50 rounded-md border">
                    <span className="font-medium">$ USD</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Доступно: {formatUsdWithEquivalent(user?.available_balance?.USD || 0)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t('select_amount')}</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min={portfolio.min_investment}
                    max={portfolio.max_investment}
                    data-testid="invest-amount-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('portfolio_min')}: {formatUsdWithEquivalent(portfolio.min_investment)} | {t('portfolio_max')}: {formatUsdWithEquivalent(portfolio.max_investment)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t('select_duration')}</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger data-testid="invest-duration-select">
                      <SelectValue placeholder="Выберите срок" />
                    </SelectTrigger>
                    <SelectContent>
                      {portfolio.duration_months.map(m => {
                        const rate = portfolio.returns_by_term?.[m.toString()] || portfolio.returns_by_term?.[m] || portfolio.expected_return;
                        const unitLabel = portfolio.duration_unit === 'days' ? 'дн.' : 
                                         portfolio.duration_unit === 'hours' ? 'ч.' : 
                                         portfolio.duration_unit === 'years' ? 'г.' : 'мес.';
                        return (
                          <SelectItem key={m} value={m.toString()}>
                            {m} {unitLabel} — {rate}%
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Payout Frequency Info */}
                <div className="p-3 bg-blue-50 rounded-sm border border-blue-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-800">Частота начисления</span>
                    <span className="text-sm font-medium text-blue-900">
                      {portfolio.profit_accrual_interval === 'hourly' ? 'Ежечасно' :
                       portfolio.profit_accrual_interval === 'daily' ? 'Ежедневно' :
                       portfolio.profit_accrual_interval === 'weekly' ? 'Еженедельно' :
                       portfolio.profit_accrual_interval === 'yearly' ? 'Ежегодно' : 'Ежемесячно'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-b border-gray-100">
                  <div>
                    <Label>{t('auto_reinvest')}</Label>
                    <p className="text-xs text-muted-foreground">{t('auto_reinvest_desc')}</p>
                  </div>
                  <Switch
                    checked={autoReinvest}
                    onCheckedChange={setAutoReinvest}
                    data-testid="auto-reinvest-switch"
                  />
                </div>

                {amount && duration && (
                  <div className="p-4 bg-green-50 rounded-sm">
                    <p className="text-sm text-muted-foreground">{t('expected_profit')}</p>
                    <p className="text-2xl font-heading font-bold text-green-600">
                      +{formatUsdWithEquivalent(expectedReturn)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {currentRate}% за {duration} {portfolio.duration_unit === 'days' ? 'дн.' : portfolio.duration_unit === 'hours' ? 'ч.' : portfolio.duration_unit === 'years' ? 'г.' : 'мес.'}
                      {autoReinvest && ' (сложный процент)'}
                    </p>
                  </div>
                )}

                <Button 
                  className="w-full btn-primary" 
                  onClick={handleNext}
                  data-testid="invest-next-step1"
                >
                  {t('next')}
                </Button>
              </div>
            )}

            {/* Step 2: Confirmation */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-muted-foreground">Портфель</span>
                    <span className="font-medium">{getLocalizedText(portfolio.name)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-muted-foreground">Сумма</span>
                    <span className="font-medium">{formatUsdWithEquivalent(parseFloat(amount))}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-muted-foreground">Срок</span>
                    <span className="font-medium">{duration} {portfolio.duration_unit === 'days' ? 'дн.' : portfolio.duration_unit === 'hours' ? 'ч.' : portfolio.duration_unit === 'years' ? 'г.' : 'мес.'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-muted-foreground">Доходность</span>
                    <span className="font-medium text-green-600">{currentRate}%</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-muted-foreground">Частота начисления</span>
                    <span className="font-medium">
                      {portfolio.profit_accrual_interval === 'hourly' ? 'Ежечасно' :
                       portfolio.profit_accrual_interval === 'daily' ? 'Ежедневно' :
                       portfolio.profit_accrual_interval === 'weekly' ? 'Еженедельно' :
                       portfolio.profit_accrual_interval === 'yearly' ? 'Ежегодно' : 'Ежемесячно'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-muted-foreground">Ожидаемая прибыль</span>
                    <span className="font-medium text-green-600">+{formatUsdWithEquivalent(expectedReturn)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-muted-foreground">Капитализация</span>
                    <span className="font-medium">{autoReinvest ? 'Да (сложный %)' : 'Нет'}</span>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-sm">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={setTermsAccepted}
                    data-testid="terms-checkbox"
                  />
                  <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                    {t('terms_accept')}
                  </label>
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setStep(1)}
                  >
                    {t('back')}
                  </Button>
                  <Button 
                    className="flex-1 btn-primary" 
                    onClick={handleNext}
                    data-testid="invest-next-step2"
                  >
                    {t('next')}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Signature */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-2">{t('signature_title')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Нарисуйте вашу подпись в поле ниже
                  </p>
                </div>

                {/* Canvas signature only */}
                <div className="space-y-3">
                  <div className="border-2 border-primary/30 rounded-xl overflow-hidden bg-white shadow-sm">
                    <div className="bg-gray-50 px-4 py-2 border-b text-sm text-muted-foreground flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Pen className="w-4 h-4" />
                        Поле для подписи
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={clearCanvas}
                        className="h-7 text-xs"
                      >
                        Очистить
                      </Button>
                    </div>
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={200}
                      className="cursor-crosshair touch-none block w-full"
                      style={{ 
                        width: '100%', 
                        height: '200px',
                        touchAction: 'none'
                      }}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      data-testid="canvas-signature"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Используйте мышь или касание для рисования подписи
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setStep(2)}
                  >
                    {t('back')}
                  </Button>
                  <Button 
                    className="flex-1 btn-primary" 
                    onClick={handleSubmit}
                    disabled={submitting}
                    data-testid="invest-submit"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('loading')}
                      </>
                    ) : (
                      t('submit')
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Success */}
            {step === 4 && success && (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-10 h-10 text-green-600" />
                </div>
                
                <div>
                  <h3 className="text-xl font-medium text-primary mb-2">
                    {t('investment_success')}
                  </h3>
                  <p className="text-muted-foreground">
                    Ваша инвестиция в размере {formatCurrency(parseFloat(amount), selectedCurrency)} успешно создана
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={handleDownloadContract}
                    className="w-full"
                    data-testid="download-contract-btn"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {t('download_contract')}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/dashboard')}
                    className="w-full"
                  >
                    {t('nav_dashboard')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default InvestPage;
