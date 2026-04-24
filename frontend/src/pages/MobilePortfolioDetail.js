import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { PullToRefresh } from '../components/PullToRefresh';
import { MobileSkeleton } from '../components/MobileUIComponents';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { 
  ArrowLeft,
  TrendingUp,
  Shield,
  Target,
  AlertTriangle,
  Users,
  Clock,
  ChevronRight,
  Calculator,
  CheckCircle,
  Lock,
  PieChart,
  BarChart3
} from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer } from 'recharts';

const ASSET_COLORS = ['#064E3B', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6'];

export function MobilePortfolioDetail() {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
  const { api, user } = useAuth();
  const { t, formatCurrency, getLocalizedText, language } = useLanguage();
  
  const [portfolio, setPortfolio] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [investAmount, setInvestAmount] = useState('10000');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(async () => {
    try {
      const [portfolioRes, statsRes] = await Promise.all([
        api.get(`/portfolios/${portfolioId}`),
        api.get(`/portfolios/${portfolioId}/stats`)
      ]);
      setPortfolio(portfolioRes.data);
      setStats(statsRes.data);
      if (portfolioRes.data.duration_months?.length > 0) {
        setSelectedDuration(portfolioRes.data.duration_months[0]);
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      navigate('/portfolios');
    } finally {
      setLoading(false);
    }
  }, [api, portfolioId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getRiskConfig = (risk) => {
    const configs = {
      low: { icon: Shield, color: 'bg-green-100 text-green-700', label: t('risk_low') },
      medium: { icon: Target, color: 'bg-amber-100 text-amber-700', label: t('risk_medium') },
      high: { icon: AlertTriangle, color: 'bg-red-100 text-red-700', label: t('risk_high') }
    };
    return configs[risk] || configs.medium;
  };

  // Get duration unit label based on portfolio's duration_unit
  const getDurationLabel = (value) => {
    const unit = portfolio?.duration_unit || 'months';
    const labels = {
      hours: language === 'ru' ? 'ч.' : 'h',
      days: language === 'ru' ? 'дн.' : 'd',
      months: language === 'ru' ? 'мес.' : 'mo',
      years: language === 'ru' ? 'г.' : 'y'
    };
    return `${value} ${labels[unit] || labels.months}`;
  };

  // Calculate expected return - now term-based (not annual)
  const expectedReturn = useMemo(() => {
    if (!portfolio || !selectedDuration || !investAmount) return 0;
    const amount = parseFloat(investAmount) || 0;
    const returnsByTerm = portfolio.returns_by_term || {};
    const rate = returnsByTerm[selectedDuration.toString()] || portfolio.expected_return;
    // Rate is for the full term, not annual
    return amount * (rate / 100);
  }, [portfolio, selectedDuration, investAmount]);

  const currentRate = useMemo(() => {
    if (!portfolio || !selectedDuration) return portfolio?.expected_return || 0;
    return portfolio.returns_by_term?.[selectedDuration.toString()] || portfolio.expected_return;
  }, [portfolio, selectedDuration]);

  const handleInvest = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(`/invest/${portfolioId}`);
  };

  if (loading) {
    return (
      <div className="p-3 space-y-3 pb-20">
        <div className="h-40 skeleton rounded-xl" />
        <MobileSkeleton variant="card" />
        <MobileSkeleton variant="card" />
      </div>
    );
  }

  if (!portfolio) return null;

  const riskConfig = getRiskConfig(portfolio.risk_level);
  const RiskIcon = riskConfig.icon;
  
  // Handle both asset_allocation (structured) and assets (simple list)
  const assetData = portfolio.asset_allocation?.length > 0 
    ? portfolio.asset_allocation 
    : (portfolio.assets?.map((name, index) => ({
        name: typeof name === 'object' ? (name.ru || name.en || Object.values(name)[0]) : name,
        percentage: Math.round(100 / (portfolio.assets?.length || 1))
      })) || []);

  return (
    <PullToRefresh onRefresh={fetchData}>
      <div className="pb-20" data-testid="mobile-portfolio-detail">
        {/* Hero Section */}
        <div className="relative">
          {portfolio.banner_url ? (
            <div className="h-44 relative">
              <img 
                src={portfolio.banner_url} 
                alt="" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            </div>
          ) : (
            <div className="h-44 bg-gradient-to-br from-primary to-emerald-700" />
          )}
          
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-lg rounded-full text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Content Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <Badge className={`${riskConfig.color} mb-2`}>
              <RiskIcon className="w-3 h-3 mr-1" />
              {riskConfig.label}
            </Badge>
            <h1 className="text-2xl font-bold mb-1">{getLocalizedText(portfolio.name)}</h1>
            <div className="flex items-center gap-4 text-sm text-white/80">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {portfolio.expected_return}% {language === 'ru' ? 'годовых' : 'p.a.'}
              </span>
              {stats && (
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {stats.investor_count} {language === 'ru' ? 'инвесторов' : 'investors'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="p-4">
          <div className="mobile-tabs mb-4">
            {['overview', 'calculator', 'assets'].map(tab => (
              <button
                key={tab}
                className={`mobile-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'overview' && (language === 'ru' ? 'Обзор' : 'Overview')}
                {tab === 'calculator' && (language === 'ru' ? 'Калькулятор' : 'Calculator')}
                {tab === 'assets' && (language === 'ru' ? 'Активы' : 'Assets')}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="mobile-card p-4">
                  <p className="text-xs text-gray-500 mb-1">{t('portfolio_min')}</p>
                  <p className="font-bold text-lg">{formatCurrency(portfolio.min_investment)}</p>
                </div>
                <div className="mobile-card p-4">
                  <p className="text-xs text-gray-500 mb-1">{t('portfolio_max')}</p>
                  <p className="font-bold text-lg">{formatCurrency(portfolio.max_investment)}</p>
                </div>
              </div>

              {/* Duration Options */}
              <div className="mobile-card p-4">
                <p className="text-sm font-medium mb-3">{language === 'ru' ? 'Сроки инвестирования' : 'Investment Terms'}</p>
                <div className="flex flex-wrap gap-2">
                  {portfolio.duration_months?.map(duration => {
                    const rate = portfolio.returns_by_term?.[duration.toString()] || portfolio.expected_return;
                    return (
                      <button
                        key={duration}
                        onClick={() => setSelectedDuration(duration)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          selectedDuration === duration
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {getDurationLabel(duration)} • {rate}%
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div className="mobile-card p-4">
                <p className="text-sm font-medium mb-2">{language === 'ru' ? 'О портфеле' : 'About'}</p>
                <p className="text-sm text-gray-600">{getLocalizedText(portfolio.description)}</p>
              </div>

              {/* Strategy */}
              {portfolio.strategy && (
                <div className="mobile-card p-4">
                  <p className="text-sm font-medium mb-2">{t('investment_strategy')}</p>
                  <p className="text-sm text-gray-600">{getLocalizedText(portfolio.strategy)}</p>
                </div>
              )}

              {/* Safety Features */}
              <div className="mobile-card p-4">
                <p className="text-sm font-medium mb-3">{language === 'ru' ? 'Гарантии' : 'Guarantees'}</p>
                <div className="space-y-2">
                  {[
                    { icon: CheckCircle, text: language === 'ru' ? 'Юридически оформленный контракт' : 'Legally binding contract' },
                    { icon: Lock, text: language === 'ru' ? 'Страхование инвестиций' : 'Investment insurance' },
                    { icon: Shield, text: language === 'ru' ? 'Защита капитала' : 'Capital protection' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <item.icon className="w-4 h-4 text-green-500" />
                      {item.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Calculator Tab */}
          {activeTab === 'calculator' && (
            <div className="space-y-4">
              <div className="mobile-card p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Calculator className="w-5 h-5 text-primary" />
                  <p className="font-medium">{language === 'ru' ? 'Калькулятор прибыли' : 'Profit Calculator'}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">
                      {language === 'ru' ? 'Сумма инвестиции' : 'Investment Amount'}
                    </label>
                    <Input
                      type="number"
                      value={investAmount}
                      onChange={(e) => setInvestAmount(e.target.value)}
                      placeholder="10000"
                      className="text-lg"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-500 mb-2 block">
                      {language === 'ru' ? 'Срок' : 'Duration'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {portfolio.duration_months?.map(d => (
                        <button
                          key={d}
                          onClick={() => setSelectedDuration(d)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium ${
                            selectedDuration === d
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {getDurationLabel(d)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Result */}
              <div className="mobile-balance-card">
                <div className="relative z-10">
                  <p className="text-white/70 text-sm mb-1">
                    {language === 'ru' ? 'Ожидаемая прибыль' : 'Expected Profit'}
                  </p>
                  <p className="text-4xl font-bold text-white mb-2">
                    +{formatCurrency(expectedReturn)}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-white/60">
                    <span>{currentRate}%</span>
                    <span>{getDurationLabel(selectedDuration)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="mobile-card p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">{language === 'ru' ? 'Вложено' : 'Invested'}</p>
                  <p className="font-bold">{formatCurrency(parseFloat(investAmount) || 0)}</p>
                </div>
                <div className="mobile-card p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">{language === 'ru' ? 'Итого получите' : 'Total Return'}</p>
                  <p className="font-bold text-green-600">
                    {formatCurrency((parseFloat(investAmount) || 0) + expectedReturn)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Assets Tab */}
          {activeTab === 'assets' && (
            <div className="space-y-4">
              {assetData.length > 0 ? (
                <>
                  {/* Pie Chart */}
                  <div className="mobile-card p-4">
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={assetData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            dataKey="percentage"
                            nameKey="name"
                          >
                            {assetData.map((entry, index) => (
                              <Cell key={index} fill={ASSET_COLORS[index % ASSET_COLORS.length]} />
                            ))}
                          </Pie>
                        </RechartsPie>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Asset List */}
                  <div className="mobile-card overflow-hidden">
                    {assetData.map((asset, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: ASSET_COLORS[index % ASSET_COLORS.length] }}
                          />
                          <span className="font-medium">{asset.name}</span>
                        </div>
                        <span className="text-gray-600">{asset.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <PieChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">
                    {language === 'ru' ? 'Данные об активах недоступны' : 'Asset data not available'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-16 left-0 right-0 px-4 py-2 bg-white/95 backdrop-blur-lg border-t border-gray-100 z-40 md:hidden">
          <button
            onClick={handleInvest}
            className="w-full py-2.5 bg-primary text-white rounded-xl font-medium text-sm flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
            data-testid="invest-btn"
          >
            {t('invest_now')}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </PullToRefresh>
  );
}

export default MobilePortfolioDetail;
