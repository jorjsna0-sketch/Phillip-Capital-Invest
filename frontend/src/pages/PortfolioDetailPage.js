import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { MobilePortfolioDetail } from './MobilePortfolioDetail';
import { 
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Shield,
  Clock,
  Target,
  AlertTriangle,
  ChevronRight,
  Loader2,
  PieChart,
  BarChart3,
  Newspaper,
  Lock,
  CheckCircle,
  Calculator,
  DollarSign,
  Calendar
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const ASSET_COLORS = ['#0d4a4a', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

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

export function PortfolioDetailPage() {
  const isMobile = useIsMobile();
  
  // Render mobile version
  if (isMobile) {
    return <MobilePortfolioDetail />;
  }
  
  // Desktop version continues below
  return <DesktopPortfolioDetail />;
}

function DesktopPortfolioDetail() {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
  const { api, user } = useAuth();
  const { t, formatCurrency, getLocalizedText, currency, language } = useLanguage();
  
  const [portfolio, setPortfolio] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [investAmount, setInvestAmount] = useState('');

  useEffect(() => {
    fetchPortfolioData();
  }, [portfolioId]);

  const fetchPortfolioData = async () => {
    try {
      const [portfolioRes, statsRes] = await Promise.all([
        api.get(`/portfolios/${portfolioId}`),
        api.get(`/portfolios/${portfolioId}/stats`)
      ]);
      setPortfolio(portfolioRes.data);
      setStats(statsRes.data);
      
      // Set default duration
      if (portfolioRes.data.duration_months?.length > 0) {
        setSelectedDuration(portfolioRes.data.duration_months[0]);
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      navigate('/portfolios');
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (risk) => {
    switch (risk) {
      case 'low': return { icon: <Shield className="w-4 h-4" />, class: 'bg-green-100 text-green-700', text: t('risk_low') };
      case 'medium': return { icon: <Target className="w-4 h-4" />, class: 'bg-amber-100 text-amber-700', text: t('risk_medium') };
      case 'high': return { icon: <AlertTriangle className="w-4 h-4" />, class: 'bg-red-100 text-red-700', text: t('risk_high') };
      default: return { icon: null, class: 'bg-gray-100', text: '' };
    }
  };

  // Get duration unit label based on portfolio's duration_unit
  const getDurationLabel = (value) => {
    const unit = portfolio?.duration_unit || 'months';
    const labelMap = {
      tr: { hours: 's.', days: 'gün', months: 'ay', years: 'yıl' },
      ru: { hours: 'ч.', days: 'дн.', months: 'мес.', years: 'г.' },
      en: { hours: 'h', days: 'd', months: 'mo', years: 'y' }
    };
    const set = labelMap[language] || labelMap.en;
    return `${value} ${set[unit] || set.months}`;
  };

  const getDurationUnitShort = () => {
    const unit = portfolio?.duration_unit || 'months';
    const labelMap = {
      tr: { hours: 's.', days: 'gün', months: 'ay', years: 'yıl' },
      ru: { hours: 'ч.', days: 'дн.', months: 'мес.', years: 'г.' },
      en: { hours: 'h', days: 'd', months: 'mo', years: 'y' }
    };
    const set = labelMap[language] || labelMap.en;
    return set[unit] || set.months;
  };

  // Calculate expected return based on selected duration - now term-based (not annual)
  const expectedReturn = useMemo(() => {
    if (!portfolio || !selectedDuration || !investAmount) return 0;
    const amount = parseFloat(investAmount) || 0;
    const returnsByTerm = portfolio.returns_by_term || {};
    const rate = returnsByTerm[selectedDuration.toString()] || portfolio.expected_return;
    // Rate is for the full term, not annual
    return amount * (rate / 100);
  }, [portfolio, selectedDuration, investAmount]);

  const currentReturnRate = useMemo(() => {
    if (!portfolio || !selectedDuration) return portfolio?.expected_return || 0;
    const returnsByTerm = portfolio.returns_by_term || {};
    return returnsByTerm[selectedDuration.toString()] || portfolio.expected_return;
  }, [portfolio, selectedDuration]);

  // Generate demo price history if not available
  const priceHistory = useMemo(() => {
    if (portfolio?.price_history?.length > 0) {
      return portfolio.price_history;
    }
    // Generate last 12 months demo data
    const data = [];
    let baseValue = 100;
    const returnRate = (portfolio?.expected_return || 10) / 100;
    const monthlyReturn = returnRate / 12;
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const variation = (Math.random() - 0.3) * 2;
      baseValue = baseValue * (1 + monthlyReturn + variation / 100);
      data.push({
        date: date.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
        value: Math.round(baseValue * 100) / 100,
        profit: Math.round((baseValue - 100) * 100) / 100
      });
    }
    return data;
  }, [portfolio]);

  // Prepare assets for pie chart
  const assetsForChart = useMemo(() => {
    if (portfolio?.detailed_assets?.length > 0) {
      return portfolio.detailed_assets.map((asset, index) => ({
        name: getLocalizedText(asset.name) || asset.symbol,
        value: asset.allocation_percent,
        symbol: asset.symbol,
        color: ASSET_COLORS[index % ASSET_COLORS.length]
      }));
    }
    // Fallback to simple assets with equal distribution
    const assets = portfolio?.assets || [];
    const allocation = 100 / assets.length;
    return assets.map((asset, index) => ({
      name: asset,
      value: Math.round(allocation),
      symbol: asset,
      color: ASSET_COLORS[index % ASSET_COLORS.length]
    }));
  }, [portfolio, getLocalizedText]);

  const handleInvest = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(`/invest/${portfolioId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!portfolio) return null;

  const risk = getRiskBadge(portfolio.risk_level);

  return (
    <div className="min-h-screen bg-background" data-testid="portfolio-detail-page">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-primary via-primary/95 to-primary/90 text-white">
        {portfolio.banner_url && (
          <div className="absolute inset-0 opacity-20">
            <img src={portfolio.banner_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="container-premium relative z-10 py-8 md:py-12">
          {/* Back Button */}
          <Button 
            variant="ghost" 
            className="mb-6 text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => navigate('/portfolios')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('back_to_portfolios')}
          </Button>

          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Left Column - Info */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Badge className={`${risk.class} border-none`}>
                  {risk.icon}
                  <span className="ml-1">{risk.text}</span>
                </Badge>
                <Badge className="bg-white/20 text-white border-none">
                  {portfolio.status === 'active' ? 'Активный' : portfolio.status}
                </Badge>
              </div>

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold mb-4">
                {getLocalizedText(portfolio.name)}
              </h1>
              
              <p className="text-lg text-white/80 mb-6 max-w-xl">
                {getLocalizedText(portfolio.description)}
              </p>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 min-w-0">
                  <div className="flex items-center gap-1.5 text-white/70 text-xs mb-1">
                    <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{t('annual_return')}</span>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-accent whitespace-nowrap">
                    до {Math.max(...Object.values(portfolio.returns_by_term || {[0]: portfolio.expected_return}))}%
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 min-w-0">
                  <div className="flex items-center gap-1.5 text-white/70 text-xs mb-1">
                    <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{t('total_invested')}</span>
                  </div>
                  <div className="text-lg md:text-xl font-bold whitespace-nowrap">
                    ${(stats?.total_invested || 0).toLocaleString('ru-RU')}
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 min-w-0">
                  <div className="flex items-center gap-1.5 text-white/70 text-xs mb-1">
                    <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{t('total_profit')}</span>
                  </div>
                  <div className="text-lg md:text-xl font-bold text-accent whitespace-nowrap">
                    +${(stats?.total_profit || 0).toLocaleString('ru-RU')}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Quick Calculator */}
            <div className="bg-white rounded-xl p-6 text-foreground shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">{t('profit_calculator')}</h3>
              </div>

              {/* Duration Selection */}
              <div className="mb-4">
                <label className="text-sm text-muted-foreground mb-2 block">{t('select_duration')}</label>
                <div className="grid grid-cols-2 gap-3">
                  {portfolio.duration_months.map(months => {
                    const rate = portfolio.returns_by_term?.[months.toString()] || portfolio.expected_return;
                    return (
                      <button
                        key={months}
                        onClick={() => setSelectedDuration(months)}
                        className={`px-6 py-5 rounded-xl text-center transition-all ${
                          selectedDuration === months
                            ? 'bg-primary text-white ring-2 ring-primary ring-offset-2 shadow-lg'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        <div className="text-3xl font-bold leading-none">{months}</div>
                        <div className="text-sm opacity-70 mt-1">{getDurationUnitShort()}</div>
                        <div className={`text-base font-semibold mt-2 ${selectedDuration === months ? 'text-accent' : 'text-green-600'}`}>
                          {rate}%
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <label className="text-sm text-muted-foreground mb-2 block">{t('investment_amount')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={investAmount}
                    onChange={(e) => setInvestAmount(e.target.value)}
                    placeholder={portfolio.min_investment.toLocaleString()}
                    className="w-full pl-8 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    min={portfolio.min_investment}
                    max={portfolio.max_investment}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('portfolio_min')}: {formatCurrency(portfolio.min_investment)} | {t('portfolio_max')}: {formatCurrency(portfolio.max_investment)}
                </p>
              </div>

              {/* Result */}
              {investAmount && parseFloat(investAmount) >= portfolio.min_investment && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="text-sm text-green-700 mb-1">{t('expected_profit')}</div>
                  <div className="text-3xl font-bold text-green-600">
                    +{formatCurrency(expectedReturn)}
                  </div>
                  <div className="text-xs text-green-600/70">
                    {currentReturnRate}% • {getDurationLabel(selectedDuration)}
                  </div>
                </div>
              )}

              <Button 
                className="w-full btn-primary py-6 text-lg"
                onClick={handleInvest}
                data-testid="invest-btn-hero"
              >
                {t('invest_now')}
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container-premium py-8 md:py-12">
        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList className="w-full justify-start border-b bg-transparent h-auto p-0 space-x-8">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3"
            >
              <PieChart className="w-4 h-4 mr-2" />
              {t('tab_overview')}
            </TabsTrigger>
            <TabsTrigger 
              value="assets"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              {t('tab_assets')}
            </TabsTrigger>
            <TabsTrigger 
              value="performance"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              {t('tab_performance')}
            </TabsTrigger>
            {portfolio.news?.length > 0 && (
              <TabsTrigger 
                value="news"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3"
              >
                <Newspaper className="w-4 h-4 mr-2" />
                {t('tab_news')}
              </TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Strategy */}
              <Card className="card-premium lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    {t('investment_strategy')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {getLocalizedText(portfolio.strategy)}
                  </p>
                </CardContent>
              </Card>

              {/* Asset Allocation Pie */}
              <Card className="card-premium">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PieChart className="w-5 h-5 text-primary" />
                    {t('asset_allocation')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={assetsForChart}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {assetsForChart.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => [`${value}%`, '']}
                          contentStyle={{ borderRadius: '8px' }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {assetsForChart.map((asset, index) => (
                      <div key={index} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: asset.color }} />
                        <span>{asset.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sales Text */}
            {getLocalizedText(portfolio.sales_text) && (
              <Card className="card-premium border-l-4 border-l-primary">
                <CardContent className="py-6">
                  <div className="prose prose-sm max-w-none">
                    <p className="text-lg leading-relaxed text-muted-foreground whitespace-pre-line">
                      {getLocalizedText(portfolio.sales_text)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Safety Guarantee */}
            {getLocalizedText(portfolio.safety_guarantee) && (
              <Card className="card-premium bg-green-50/50 border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <Shield className="w-5 h-5" />
                    {t('safety_guarantee')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-6">
                    <div className="flex-1">
                      <p className="text-green-800/80 whitespace-pre-line">
                        {getLocalizedText(portfolio.safety_guarantee)}
                      </p>
                    </div>
                    <div className="hidden md:flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">Лицензия НБ РК</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-700">
                        <Lock className="w-4 h-4" />
                        <span className="text-sm">Защита капитала</span>
                      </div>
                      <div className="flex items-center gap-2 text-green-700">
                        <Shield className="w-4 h-4" />
                        <span className="text-sm">Страхование</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Returns by Term */}
            {Object.keys(portfolio.returns_by_term || {}).length > 0 && (
              <Card className="card-premium">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    {t('returns_by_term')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(portfolio.returns_by_term)
                      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                      .map(([term, rate]) => (
                        <div 
                          key={term} 
                          className="p-4 bg-gradient-to-br from-green-50 to-white rounded-lg border border-green-100 text-center"
                        >
                          <div className="text-sm text-muted-foreground mb-1">{getDurationLabel(term)}</div>
                          <div className="text-2xl font-bold text-green-600">{rate}%</div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets" className="space-y-6">
            <Card className="card-premium">
              <CardHeader>
                <CardTitle>{t('portfolio_assets')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(portfolio.detailed_assets?.length > 0 ? portfolio.detailed_assets : 
                    portfolio.assets.map((a, i) => ({ 
                      symbol: a, 
                      name: { ru: a, en: a, kz: a }, 
                      allocation_percent: Math.round(100 / portfolio.assets.length),
                      asset_type: 'stock',
                      price_change_24h: (Math.random() * 10 - 3).toFixed(2)
                    }))
                  ).map((asset, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: ASSET_COLORS[index % ASSET_COLORS.length] }}
                        >
                          {asset.symbol?.slice(0, 2).toUpperCase() || 'A'}
                        </div>
                        <div>
                          <div className="font-medium">{getLocalizedText(asset.name) || asset.symbol}</div>
                          <div className="text-sm text-muted-foreground">
                            {asset.symbol} • {asset.asset_type || 'Asset'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{asset.allocation_percent}%</div>
                        <div className={`text-sm flex items-center justify-end gap-1 ${
                          parseFloat(asset.price_change_24h) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {parseFloat(asset.price_change_24h) >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {asset.price_change_24h > 0 ? '+' : ''}{asset.price_change_24h}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{t('portfolio_performance')}</span>
                  {priceHistory.length > 0 && (
                    <Badge className="bg-green-100 text-green-700">
                      +{priceHistory[priceHistory.length - 1]?.profit?.toFixed(2) || 0}%
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        domain={['dataMin - 5', 'dataMax + 5']}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                        formatter={(value, name) => [
                          name === 'value' ? value.toFixed(2) : `+${value.toFixed(2)}%`,
                          name === 'value' ? t('value') : t('profit')
                        ]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#0d4a4a" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6, fill: '#0d4a4a' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  * {t('past_performance_disclaimer')}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* News Tab */}
          {portfolio.news?.length > 0 && (
            <TabsContent value="news" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {portfolio.news.map((item, index) => (
                  <Card key={item.news_id || index} className="card-premium hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Calendar className="w-4 h-4" />
                        {new Date(item.published_at).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                        {item.source && (
                          <>
                            <span>•</span>
                            <span>{item.source}</span>
                          </>
                        )}
                      </div>
                      <CardTitle className="text-lg">
                        {getLocalizedText(item.title)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground line-clamp-4">
                        {getLocalizedText(item.content)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <Card className="card-premium bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
            <CardContent className="py-8">
              <h3 className="text-2xl font-heading font-bold text-primary mb-3">
                {t('ready_to_invest')}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                {t('start_investing_description')}
              </p>
              <Button 
                className="btn-primary px-8 py-6 text-lg"
                onClick={handleInvest}
                data-testid="invest-btn-bottom"
              >
                {t('invest_now')}
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default PortfolioDetailPage;
