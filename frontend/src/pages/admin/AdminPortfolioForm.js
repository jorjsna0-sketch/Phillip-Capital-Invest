import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Star,
  TrendingUp,
  FileText,
  Settings,
  Image,
  Save,
  Languages,
  Calculator
} from 'lucide-react';

// Profit Calculator Component - Updated for term-based rates (not annual)
function ProfitCalculator({ expectedReturn, accrualInterval, durationUnit, durations }) {
  const [investAmount, setInvestAmount] = useState(100000);
  const [showCompound, setShowCompound] = useState(false);
  
  const getIntervalLabel = (interval) => {
    switch (interval) {
      case 'hourly': return 'час';
      case 'daily': return 'день';
      case 'weekly': return 'неделю';
      case 'monthly': return 'месяц';
      case 'yearly': return 'год';
      default: return 'период';
    }
  };
  
  // Get total periods for a given duration
  const getTotalPeriods = (durationValue, durationUnitType, interval) => {
    if (durationUnitType === 'days') {
      if (interval === 'hourly') return durationValue * 24;
      if (interval === 'daily') return durationValue;
      if (interval === 'weekly') return Math.max(1, Math.floor(durationValue / 7));
      if (interval === 'monthly') return Math.max(1, Math.floor(durationValue / 30));
    } else if (durationUnitType === 'hours') {
      if (interval === 'hourly') return durationValue;
      if (interval === 'daily') return Math.max(1, Math.floor(durationValue / 24));
    } else if (durationUnitType === 'years') {
      if (interval === 'hourly') return durationValue * 8760;
      if (interval === 'daily') return durationValue * 365;
      if (interval === 'weekly') return durationValue * 52;
      if (interval === 'monthly') return durationValue * 12;
    } else {
      // months
      if (interval === 'hourly') return durationValue * 720;
      if (interval === 'daily') return durationValue * 30;
      if (interval === 'weekly') return durationValue * 4;
      if (interval === 'monthly') return durationValue;
    }
    return Math.max(1, durationValue);
  };
  
  // Calculate profit for each duration
  // Simple interest: profit = amount * (rate / 100)
  // Compound interest: A = P * (1 + r/n)^n - P
  const calculateProfit = (durationValue, rate, isCompound = false) => {
    const termRate = parseFloat(rate) || expectedReturn;
    const totalPeriods = getTotalPeriods(parseInt(durationValue), durationUnit, accrualInterval);
    
    if (isCompound) {
      const periodRate = termRate / totalPeriods / 100;
      const finalAmount = investAmount * Math.pow(1 + periodRate, totalPeriods);
      return finalAmount - investAmount;
    } else {
      return investAmount * (termRate / 100);
    }
  };
  
  return (
    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-green-600" />
          <h4 className="font-semibold text-green-800">Калькулятор прибыли</h4>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={!showCompound ? 'text-green-700 font-medium' : 'text-gray-500'}>Простой %</span>
          <Switch checked={showCompound} onCheckedChange={setShowCompound} />
          <span className={showCompound ? 'text-green-700 font-medium' : 'text-gray-500'}>Сложный %</span>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Label className="whitespace-nowrap text-green-700">Сумма инвестиции:</Label>
          <Input
            type="number"
            value={investAmount}
            onChange={(e) => setInvestAmount(parseFloat(e.target.value) || 0)}
            className="w-32 bg-white"
          />
          <span className="text-green-700">$</span>
        </div>
        
        <div className="p-3 bg-white rounded-lg">
          <p className="text-xs text-muted-foreground mb-2">
            <strong>Логика:</strong> Ставка указывается за <u>весь срок</u>, а не годовая. 
            Например, 25% за 10 дней = 25% прибыли за 10 дней.
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Интервал начисления:</strong> {getIntervalLabel(accrualInterval)}
          </p>
        </div>
        
        {durations.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-green-700">Прибыль по срокам ({showCompound ? 'сложный %' : 'простой %'}):</p>
            <div className="grid grid-cols-2 gap-2">
              {durations.filter(d => d.value && d.rate).map((d, i) => {
                const profit = calculateProfit(d.value, d.rate, showCompound);
                const unitLabel = durationUnit === 'months' ? 'мес.' : durationUnit === 'days' ? 'дн.' : durationUnit === 'hours' ? 'ч.' : 'г.';
                return (
                  <div key={i} className="p-2 bg-white rounded border">
                    <p className="text-xs text-muted-foreground">{d.value} {unitLabel} ({d.rate}%)</p>
                    <p className="font-semibold text-green-600">${profit.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400">Итого: ${(investAmount + profit).toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminPortfolioForm() {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const { t, getLocalizedText } = useLanguage();
  
  const isEditing = !!portfolioId;
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [contractTemplates, setContractTemplates] = useState([]);

  // Duration units mapping
  const durationUnits = [
    { value: 'hours', label: 'Часы', singular: 'час', plural: 'часов' },
    { value: 'days', label: 'Дни', singular: 'день', plural: 'дней' },
    { value: 'months', label: 'Месяцы', singular: 'месяц', plural: 'месяцев' },
    { value: 'years', label: 'Годы', singular: 'год', plural: 'лет' }
  ];
  
  // Accrual intervals
  const accrualIntervals = [
    { value: 'hourly', label: 'Каждый час' },
    { value: 'daily', label: 'Ежедневно' },
    { value: 'weekly', label: 'Еженедельно' },
    { value: 'monthly', label: 'Ежемесячно' },
    { value: 'yearly', label: 'Ежегодно' }
  ];

  // Form state
  const [formData, setFormData] = useState({
    name: { ru: '', kz: '', en: '' },
    description: { ru: '', kz: '', en: '' },
    strategy: { ru: '', kz: '', en: '' },
    assets: '',
    min_investment: '',
    max_investment: '',
    expected_return: '',
    duration_unit: 'months',
    // Dynamic durations with rates
    durations: [{ value: '6', rate: '10' }, { value: '12', rate: '12' }],
    profit_accrual_interval: 'monthly',
    profit_accrual_time: '00:00',
    risk_level: 'medium',
    featured_on_landing: false,
    landing_order: 0,
    banner_url: '',
    contract_template: { ru: '', kz: '', en: '' },
    contract_template_id: '',
    detailed_assets: [],
    sales_text: { ru: '', kz: '', en: '' },
    safety_guarantee: { ru: '', kz: '', en: '' },
    // Display stats for marketing
    display_investor_count: undefined,
    display_total_invested: undefined,
    display_total_profit: undefined
  });

  useEffect(() => {
    fetchContractTemplates();
    if (isEditing) {
      fetchPortfolio();
    }
  }, [portfolioId]);

  const fetchPortfolio = async () => {
    try {
      const response = await api.get(`/portfolios/${portfolioId}`);
      const p = response.data;
      
      // Convert old format to new durations format
      let durations = p.durations || [];
      if (durations.length === 0 && p.duration_months?.length > 0) {
        const rbt = p.returns_by_term || {};
        durations = p.duration_months.map(val => ({
          value: val.toString(),
          rate: rbt[val.toString()]?.toString() || p.expected_return?.toString() || ''
        }));
      }
      
      setFormData({
        name: p.name || { ru: '', kz: '', en: '' },
        description: p.description || { ru: '', kz: '', en: '' },
        strategy: p.strategy || { ru: '', kz: '', en: '' },
        assets: p.assets?.join(', ') || '',
        min_investment: p.min_investment?.toString() || '',
        max_investment: p.max_investment?.toString() || '',
        expected_return: p.expected_return?.toString() || '',
        duration_unit: p.duration_unit || 'months',
        durations: durations.length > 0 ? durations : [{ value: '6', rate: '10' }],
        profit_accrual_interval: p.profit_accrual_interval || 'monthly',
        profit_accrual_time: p.profit_accrual_time || '00:00',
        risk_level: p.risk_level || 'medium',
        featured_on_landing: p.featured_on_landing || false,
        landing_order: p.landing_order || 0,
        banner_url: p.banner_url || '',
        contract_template: p.contract_template || { ru: '', kz: '', en: '' },
        contract_template_id: p.contract_template_id || '',
        detailed_assets: p.detailed_assets || [],
        sales_text: p.sales_text || { ru: '', kz: '', en: '' },
        safety_guarantee: p.safety_guarantee || { ru: '', kz: '', en: '' },
        // Display stats
        display_investor_count: p.display_investor_count || undefined,
        display_total_invested: p.display_total_invested || undefined,
        display_total_profit: p.display_total_profit || undefined
      });
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      navigate('/admin/portfolios');
    } finally {
      setLoading(false);
    }
  };

  const fetchContractTemplates = async () => {
    try {
      const response = await api.get('/admin/contract-templates');
      setContractTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  // Duration management
  const addDuration = () => {
    setFormData({
      ...formData,
      durations: [...formData.durations, { value: '', rate: '' }]
    });
  };

  const removeDuration = (index) => {
    setFormData({
      ...formData,
      durations: formData.durations.filter((_, i) => i !== index)
    });
  };

  const updateDuration = (index, field, value) => {
    const newDurations = [...formData.durations];
    newDurations[index][field] = value;
    setFormData({ ...formData, durations: newDurations });
  };

  // Build returns_by_term and duration_months from durations
  const buildLegacyFormats = () => {
    const returns_by_term = {};
    const duration_months = [];
    
    formData.durations.forEach(d => {
      if (d.value && d.rate) {
        const val = parseInt(d.value);
        if (!isNaN(val)) {
          duration_months.push(val);
          returns_by_term[d.value] = parseFloat(d.rate);
        }
      }
    });
    
    return { returns_by_term, duration_months };
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { returns_by_term, duration_months } = buildLegacyFormats();
      
      const payload = {
        name: formData.name,
        description: formData.description,
        strategy: formData.strategy,
        assets: formData.assets.split(',').map(a => a.trim()).filter(a => a),
        min_investment: parseFloat(formData.min_investment),
        max_investment: parseFloat(formData.max_investment),
        expected_return: parseFloat(formData.expected_return),
        returns_by_term,
        duration_months,
        duration_unit: formData.duration_unit,
        durations: formData.durations.map(d => ({
          value: parseInt(d.value),
          unit: formData.duration_unit,
          rate: parseFloat(d.rate)
        })),
        profit_accrual_interval: formData.profit_accrual_interval,
        profit_accrual_time: formData.profit_accrual_time,
        risk_level: formData.risk_level,
        featured_on_landing: formData.featured_on_landing,
        landing_order: formData.landing_order,
        banner_url: formData.banner_url || null,
        contract_template: formData.contract_template,
        contract_template_id: formData.contract_template_id || null,
        detailed_assets: formData.detailed_assets,
        sales_text: formData.sales_text,
        safety_guarantee: formData.safety_guarantee,
        // Display stats (for marketing)
        display_investor_count: formData.display_investor_count || null,
        display_total_invested: formData.display_total_invested || null,
        display_total_profit: formData.display_total_profit || null
      };

      if (isEditing) {
        await api.put(`/portfolios/${portfolioId}`, payload);
      } else {
        await api.post('/admin/portfolios', payload);
      }
      
      navigate('/admin/portfolios');
    } catch (error) {
      console.error('Error saving portfolio:', error);
      alert(error.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-translate contract template
  const handleTranslate = async () => {
    if (!formData.contract_template.ru) {
      alert('Сначала введите текст договора на русском языке');
      return;
    }
    
    setTranslating(true);
    try {
      const response = await api.post('/translate', {
        text: formData.contract_template.ru,
        source_lang: 'ru',
        target_langs: ['tr', 'en']
      });
      
      setFormData({
        ...formData,
        contract_template: {
          ...formData.contract_template,
          tr: response.data.translations.tr || '',
          en: response.data.translations.en || ''
        }
      });
      
      alert('Перевод выполнен успешно!');
    } catch (error) {
      console.error('Translation error:', error);
      alert('Ошибка перевода: ' + (error.response?.data?.detail || error.message));
    } finally {
      setTranslating(false);
    }
  };

  // Get unit label
  const getUnitLabel = (count) => {
    const unit = durationUnits.find(u => u.value === formData.duration_unit);
    if (!unit) return '';
    return count === 1 ? unit.singular : unit.plural;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl" data-testid="admin-portfolio-form">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => navigate('/admin/portfolios')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>
        <div className="flex-1">
          <h1 className="text-h2 text-primary">
            {isEditing ? 'Редактирование портфеля' : 'Создание портфеля'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? getLocalizedText(formData.name) : 'Заполните информацию о новом портфеле'}
          </p>
        </div>
        <Button 
          onClick={handleSubmit} 
          disabled={submitting}
          className="btn-primary"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isEditing ? 'Сохранить' : 'Создать'}
        </Button>
      </div>

      <Tabs defaultValue="main" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="main">Основное</TabsTrigger>
          <TabsTrigger value="returns">Доходность</TabsTrigger>
          <TabsTrigger value="presentation">Презентация</TabsTrigger>
          <TabsTrigger value="contract">Договор</TabsTrigger>
        </TabsList>

        {/* Main Tab */}
        <TabsContent value="main" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Основная информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name in 3 languages */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Название (RU) *</Label>
                  <Input
                    value={formData.name.ru}
                    onChange={(e) => setFormData({...formData, name: {...formData.name, ru: e.target.value}})}
                    placeholder="Сбалансированный портфель"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Название (KZ)</Label>
                  <Input
                    value={formData.name.kz}
                    onChange={(e) => setFormData({...formData, name: {...formData.name, kz: e.target.value}})}
                    placeholder="Теңгерімді портфель"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Название (EN)</Label>
                  <Input
                    value={formData.name.en}
                    onChange={(e) => setFormData({...formData, name: {...formData.name, en: e.target.value}})}
                    placeholder="Balanced Portfolio"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Описание (RU)</Label>
                <Textarea
                  value={formData.description.ru}
                  onChange={(e) => setFormData({...formData, description: {...formData.description, ru: e.target.value}})}
                  rows={3}
                  placeholder="Краткое описание портфеля..."
                />
              </div>

              {/* Investment Strategy */}
              <div className="space-y-2">
                <Label>Инвестиционная стратегия (RU)</Label>
                <Textarea
                  value={formData.strategy?.ru || ''}
                  onChange={(e) => setFormData({...formData, strategy: {...(formData.strategy || {}), ru: e.target.value}})}
                  rows={4}
                  placeholder="Подробное описание инвестиционной стратегии, подходов к управлению активами, методов минимизации рисков..."
                />
                <p className="text-xs text-muted-foreground">
                  Этот текст отображается в разделе «Инвестиционная стратегия» на странице портфеля
                </p>
              </div>

              {/* Assets & Risk */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Активы (через запятую)</Label>
                  <Input
                    value={formData.assets}
                    onChange={(e) => setFormData({...formData, assets: e.target.value})}
                    placeholder="Акции, Облигации, ETF"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Уровень риска</Label>
                  <Select value={formData.risk_level} onValueChange={(v) => setFormData({...formData, risk_level: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Низкий</SelectItem>
                      <SelectItem value="medium">Средний</SelectItem>
                      <SelectItem value="high">Высокий</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Investment limits */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Мин. сумма ($) *</Label>
                  <Input
                    type="number"
                    value={formData.min_investment}
                    onChange={(e) => setFormData({...formData, min_investment: e.target.value})}
                    placeholder="10000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Макс. сумма ($) *</Label>
                  <Input
                    type="number"
                    value={formData.max_investment}
                    onChange={(e) => setFormData({...formData, max_investment: e.target.value})}
                    placeholder="500000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Базовая доходность (%) *</Label>
                  <Input
                    type="number"
                    value={formData.expected_return}
                    onChange={(e) => setFormData({...formData, expected_return: e.target.value})}
                    placeholder="12"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Featured on landing */}
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium">Показывать на главной</p>
                    <p className="text-xs text-muted-foreground">Макс. 3 портфеля на главной странице</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {formData.featured_on_landing && (
                    <Input
                      type="number"
                      min="1"
                      max="3"
                      value={formData.landing_order}
                      onChange={(e) => setFormData({...formData, landing_order: parseInt(e.target.value) || 0})}
                      className="w-16"
                      placeholder="№"
                    />
                  )}
                  <Switch
                    checked={formData.featured_on_landing}
                    onCheckedChange={(checked) => setFormData({...formData, featured_on_landing: checked})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Returns Tab */}
        <TabsContent value="returns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                Сроки и доходность
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Duration unit selector */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Label className="whitespace-nowrap">Единица срока:</Label>
                <Select value={formData.duration_unit} onValueChange={(v) => setFormData({...formData, duration_unit: v})}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {durationUnits.map(unit => (
                      <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic durations */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Доступные сроки и ставки</Label>
                  <Button variant="outline" size="sm" onClick={addDuration}>
                    <Plus className="w-4 h-4 mr-1" />
                    Добавить срок
                  </Button>
                </div>
                
                {formData.durations.map((duration, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg bg-white">
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={duration.value}
                          onChange={(e) => updateDuration(index, 'value', e.target.value)}
                          placeholder="6"
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {getUnitLabel(parseInt(duration.value) || 1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={duration.rate}
                          onChange={(e) => updateDuration(index, 'rate', e.target.value)}
                          placeholder="12"
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">% за срок</span>
                      </div>
                    </div>
                    {formData.durations.length > 1 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600"
                        onClick={() => removeDuration(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Profit Accrual */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3 bg-primary/5">
              <CardTitle className="text-base flex items-center gap-2 text-primary">
                <Settings className="w-4 h-4" />
                Настройки начисления прибыли
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Интервал начисления</Label>
                  <Select 
                    value={formData.profit_accrual_interval} 
                    onValueChange={(v) => setFormData({...formData, profit_accrual_interval: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accrualIntervals.map(interval => (
                        <SelectItem key={interval.value} value={interval.value}>
                          {interval.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Время начисления (UTC)</Label>
                  <Input
                    type="time"
                    value={formData.profit_accrual_time}
                    onChange={(e) => setFormData({...formData, profit_accrual_time: e.target.value})}
                  />
                </div>
              </div>
              
              {/* Profit Calculator */}
              <ProfitCalculator 
                expectedReturn={parseFloat(formData.expected_return) || 12}
                accrualInterval={formData.profit_accrual_interval}
                durationUnit={formData.duration_unit}
                durations={formData.durations}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Presentation Tab */}
        <TabsContent value="presentation" className="space-y-6">
          {/* Display Stats - Editable */}
          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                <TrendingUp className="w-4 h-4" />
                Отображаемая статистика (для карточки портфеля)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-4">
                Эти значения отображаются на карточке портфеля. Если не заданы, используются реальные значения из БД.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Инвесторов</Label>
                  <Input
                    type="number"
                    value={formData.display_investor_count || ''}
                    onChange={(e) => setFormData({...formData, display_investor_count: e.target.value ? parseInt(e.target.value) : undefined})}
                    placeholder="Авто"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Инвестировано ($)</Label>
                  <Input
                    type="number"
                    value={formData.display_total_invested || ''}
                    onChange={(e) => setFormData({...formData, display_total_invested: e.target.value ? parseFloat(e.target.value) : undefined})}
                    placeholder="Авто"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Общая прибыль ($)</Label>
                  <Input
                    type="number"
                    value={formData.display_total_profit || ''}
                    onChange={(e) => setFormData({...formData, display_total_profit: e.target.value ? parseFloat(e.target.value) : undefined})}
                    placeholder="Авто"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="w-4 h-4" />
                Изображение баннера
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload option */}
              <div className="space-y-2">
                <Label>Загрузить изображение</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      if (file.size > 2000000) { // 2MB limit
                        alert('Файл слишком большой. Максимум 2MB');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setFormData({...formData, banner_url: event.target.result});
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">Рекомендуемый размер: 1200x400 пикселей, макс. 2MB</p>
              </div>
              
              {/* Or URL option */}
              <div className="space-y-2">
                <Label>Или вставьте URL</Label>
                <Input
                  value={formData.banner_url?.startsWith('data:') ? '' : formData.banner_url}
                  onChange={(e) => setFormData({...formData, banner_url: e.target.value})}
                  placeholder="https://example.com/banner.jpg"
                />
              </div>
              
              {/* Preview */}
              {formData.banner_url && (
                <div className="space-y-2">
                  <Label>Предпросмотр</Label>
                  <div className="rounded-lg overflow-hidden border relative">
                    <img src={formData.banner_url} alt="Preview" className="w-full h-40 object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => setFormData({...formData, banner_url: ''})}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Investment Strategy - Multilingual */}
          <Card className="border-blue-200">
            <CardHeader className="pb-3 bg-blue-50/50">
              <CardTitle className="text-base text-blue-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Инвестиционная стратегия (для страницы портфеля)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label>Русский (RU)</Label>
                <Textarea
                  value={formData.strategy?.ru || ''}
                  onChange={(e) => setFormData({...formData, strategy: {...(formData.strategy || {}), ru: e.target.value}})}
                  rows={4}
                  placeholder="Описание инвестиционной стратегии, методов управления рисками..."
                />
              </div>
              <div className="space-y-2">
                <Label>Türkçe (TR)</Label>
                <Textarea
                  value={formData.strategy?.tr || ''}
                  onChange={(e) => setFormData({...formData, strategy: {...(formData.strategy || {}), tr: e.target.value}})}
                  rows={4}
                  placeholder="Yatırım stratejisi açıklaması..."
                />
              </div>
              <div className="space-y-2">
                <Label>English (EN)</Label>
                <Textarea
                  value={formData.strategy?.en || ''}
                  onChange={(e) => setFormData({...formData, strategy: {...(formData.strategy || {}), en: e.target.value}})}
                  rows={4}
                  placeholder="Investment strategy description..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200">
            <CardHeader className="pb-3 bg-emerald-50/50">
              <CardTitle className="text-base text-emerald-800">Продающий текст</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Textarea
                value={formData.sales_text.ru}
                onChange={(e) => setFormData({...formData, sales_text: {...formData.sales_text, ru: e.target.value}})}
                rows={5}
                placeholder="Описание преимуществ портфеля для инвесторов..."
              />
            </CardContent>
          </Card>

          <Card className="border-green-200">
            <CardHeader className="pb-3 bg-green-50/50">
              <CardTitle className="text-base text-green-800">Гарантии безопасности</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Textarea
                value={formData.safety_guarantee.ru}
                onChange={(e) => setFormData({...formData, safety_guarantee: {...formData.safety_guarantee, ru: e.target.value}})}
                rows={3}
                placeholder="Информация о защите инвестиций..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contract Tab */}
        <TabsContent value="contract" className="space-y-6">
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Выбор шаблона договора
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select 
                value={formData.contract_template_id || 'none'} 
                onValueChange={(v) => setFormData({...formData, contract_template_id: v === 'none' ? '' : v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите шаблон или создайте свой" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без шаблона (ввести вручную)</SelectItem>
                  {contractTemplates.map(tmpl => (
                    <SelectItem key={tmpl.template_id} value={tmpl.template_id}>
                      {tmpl.name} {tmpl.is_default && '(по умолчанию)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {(!formData.contract_template_id || formData.contract_template_id === 'none') && (
            <Card className="border-blue-200">
              <CardHeader className="pb-3 bg-blue-50/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-blue-800 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Текст договора
                  </CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleTranslate}
                    disabled={translating || !formData.contract_template.ru}
                    className="text-blue-700 border-blue-300"
                  >
                    {translating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Languages className="w-4 h-4 mr-2" />
                    )}
                    Автоперевод на KZ/EN
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <Tabs defaultValue="ru">
                  <TabsList>
                    <TabsTrigger value="ru">Русский *</TabsTrigger>
                    <TabsTrigger value="tr">Türkçe</TabsTrigger>
                    <TabsTrigger value="en">English</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="ru">
                    <Textarea
                      value={formData.contract_template.ru}
                      onChange={(e) => setFormData({
                        ...formData, 
                        contract_template: {...formData.contract_template, ru: e.target.value}
                      })}
                      rows={15}
                      className="font-mono text-sm"
                      placeholder="ИНВЕСТИЦИОННЫЙ ДОГОВОР №{{contract_id}}..."
                    />
                  </TabsContent>
                  
                  <TabsContent value="tr">
                    <Textarea
                      value={formData.contract_template.tr || ''}
                      onChange={(e) => setFormData({
                        ...formData, 
                        contract_template: {...formData.contract_template, tr: e.target.value}
                      })}
                      rows={15}
                      className="font-mono text-sm"
                      placeholder="Türkçe çeviri için 'Otomatik çevir' düğmesine tıklayın..."
                    />
                  </TabsContent>
                  
                  <TabsContent value="en">
                    <Textarea
                      value={formData.contract_template.en}
                      onChange={(e) => setFormData({
                        ...formData, 
                        contract_template: {...formData.contract_template, en: e.target.value}
                      })}
                      rows={15}
                      className="font-mono text-sm"
                      placeholder="Click 'Auto-translate' to translate from Russian..."
                    />
                  </TabsContent>
                </Tabs>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium mb-2">Доступные переменные:</p>
                  <div className="flex flex-wrap gap-1">
                    {['{{contract_id}}', '{{client_name}}', '{{amount}}', '{{currency}}', '{{duration}}', '{{expected_return}}', '{{start_date}}', '{{end_date}}', '{{auto_reinvest}}'].map(v => (
                      <Badge key={v} variant="outline" className="font-mono text-xs">{v}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AdminPortfolioForm;
