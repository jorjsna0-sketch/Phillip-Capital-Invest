import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { PullToRefresh } from '../components/PullToRefresh';
import { MobileSkeleton, MobileSectionHeader } from '../components/MobileUIComponents';
import { Badge } from '../components/ui/badge';
import { 
  TrendingUp, 
  Clock, 
  Shield, 
  Target,
  AlertTriangle,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X
} from 'lucide-react';

export function MobilePortfolios() {
  const { api, user } = useAuth();
  const { t, formatCurrency, getLocalizedText, language } = useLanguage();
  const navigate = useNavigate();
  
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchPortfolios = useCallback(async () => {
    try {
      const response = await api.get('/portfolios');
      setPortfolios(response.data);
    } catch (error) {
      console.error('Error fetching portfolios:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchPortfolios();
  }, [fetchPortfolios]);

  const handleRefresh = async () => {
    await fetchPortfolios();
  };

  const getRiskConfig = (risk) => {
    const configs = {
      low: { 
        icon: Shield, 
        color: 'bg-green-100 text-green-700', 
        label: t('risk_low'),
        gradient: 'from-green-500 to-emerald-600'
      },
      medium: { 
        icon: Target, 
        color: 'bg-amber-100 text-amber-700', 
        label: t('risk_medium'),
        gradient: 'from-amber-500 to-orange-600'
      },
      high: { 
        icon: AlertTriangle, 
        color: 'bg-red-100 text-red-700', 
        label: t('risk_high'),
        gradient: 'from-red-500 to-rose-600'
      }
    };
    return configs[risk] || configs.medium;
  };

  const getDurationLabel = (months, unit = 'months') => {
    if (unit === 'days') return `${months} ${language === 'ru' ? 'дн.' : 'd'}`;
    if (unit === 'hours') return `${months} ${language === 'ru' ? 'ч.' : 'h'}`;
    return `${months} ${language === 'ru' ? 'мес.' : 'mo'}`;
  };

  // Filter portfolios
  const filteredPortfolios = portfolios.filter(p => {
    if (filterRisk && p.risk_level !== filterRisk) return false;
    if (searchQuery) {
      const name = getLocalizedText(p.name).toLowerCase();
      const desc = getLocalizedText(p.description).toLowerCase();
      return name.includes(searchQuery.toLowerCase()) || desc.includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const handleInvest = (e, portfolioId) => {
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(`/invest/${portfolioId}`);
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col p-3 gap-3">
        <div className="h-10 skeleton rounded-xl" />
        <MobileSkeleton variant="card" />
        <MobileSkeleton variant="card" />
        <MobileSkeleton variant="card" />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="h-full flex flex-col p-3" data-testid="mobile-portfolios">
        {/* Search & Filter - Fixed */}
        <div className="flex gap-2 mb-3 flex-shrink-0">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'ru' ? 'Поиск...' : 'Search...'}
              className="w-full pl-9 pr-3 py-2.5 bg-white rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl border transition-colors ${
              showFilters || filterRisk ? 'bg-primary text-white border-primary' : 'bg-white border-gray-200'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        {showFilters && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 flex-shrink-0">
            <button
              onClick={() => setFilterRisk(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                !filterRisk ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {language === 'ru' ? 'Все' : 'All'}
            </button>
            {['low', 'medium', 'high'].map(risk => {
              const config = getRiskConfig(risk);
              return (
                <button
                  key={risk}
                  onClick={() => setFilterRisk(filterRisk === risk ? null : risk)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                    filterRisk === risk ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <config.icon className="w-3 h-3" />
                  {config.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Portfolios List */}
        <div className="space-y-4">
          {filteredPortfolios.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {language === 'ru' ? 'Портфели не найдены' : 'No portfolios found'}
              </p>
            </div>
          ) : (
            filteredPortfolios.map((portfolio) => {
              const riskConfig = getRiskConfig(portfolio.risk_level);
              const RiskIcon = riskConfig.icon;
              
              return (
                <div
                  key={portfolio.portfolio_id}
                  onClick={() => navigate(`/portfolio/${portfolio.portfolio_id}`)}
                  className="mobile-card overflow-hidden touch-feedback"
                  data-testid={`mobile-portfolio-card-${portfolio.portfolio_id}`}
                >
                  {/* Banner */}
                  {portfolio.banner_url ? (
                    <div className="relative h-32 -mx-4 -mt-4 mb-3">
                      <img 
                        src={portfolio.banner_url} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-2 left-5 right-4">
                        <h3 className="text-white font-semibold text-base leading-snug line-clamp-2">
                          {getLocalizedText(portfolio.name)}
                        </h3>
                      </div>
                      <div className="absolute top-3 right-3">
                        <Badge className={riskConfig.color + " text-xs"}>
                          <RiskIcon className="w-3 h-3 mr-1" />
                          {riskConfig.label}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between mb-3 gap-2 px-4">
                      <h3 className="font-semibold text-gray-900 text-base flex-1">
                        {getLocalizedText(portfolio.name)}
                      </h3>
                      <Badge className={riskConfig.color + " text-xs shrink-0"}>
                        <RiskIcon className="w-3 h-3 mr-1" />
                        {riskConfig.label}
                      </Badge>
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3 px-4">
                    {getLocalizedText(portfolio.description)}
                  </p>

                  {/* Stats */}
                  <div className="px-4 pb-4">
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl mb-3">
                      <div>
                        <p className="text-xs text-green-600 font-medium">
                          {language === 'ru' ? 'Мин. срок' : 'Min. Term'}
                        </p>
                        <p className="text-lg font-bold text-green-600 flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {getDurationLabel(portfolio.duration_months?.[0] || 1, portfolio.duration_unit)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-green-600 font-medium">
                          {language === 'ru' ? 'Доходность' : 'Return'}
                        </p>
                        <p className="text-lg font-bold text-green-600 flex items-center justify-end">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          {portfolio.returns_by_term?.[portfolio.duration_months?.[0]] || portfolio.expected_return}%
                        </p>
                      </div>
                    </div>

                    {/* Min Investment */}
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-500">
                        {language === 'ru' ? 'Мин. сумма' : 'Min. amount'}
                      </span>
                      <span className="text-gray-700 font-medium">
                        {formatCurrency(portfolio.min_investment)}
                      </span>
                    </div>

                    {/* Payout Frequency */}
                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="text-gray-500">
                        {language === 'ru' ? 'Начисление' : 'Payout'}
                      </span>
                      <span className="text-blue-600 font-medium">
                        {portfolio.profit_accrual_interval === 'hourly' ? (language === 'ru' ? 'Ежечасно' : 'Hourly') :
                         portfolio.profit_accrual_interval === 'daily' ? (language === 'ru' ? 'Ежедневно' : 'Daily') :
                         portfolio.profit_accrual_interval === 'weekly' ? (language === 'ru' ? 'Еженедельно' : 'Weekly') :
                         portfolio.profit_accrual_interval === 'yearly' ? (language === 'ru' ? 'Ежегодно' : 'Yearly') : 
                         (language === 'ru' ? 'Ежемесячно' : 'Monthly')}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/portfolio/${portfolio.portfolio_id}`);
                        }}
                        className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                      >
                        {language === 'ru' ? 'Подробнее' : 'Details'}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleInvest(e, portfolio.portfolio_id)}
                        className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        {t('invest_now')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}

export default MobilePortfolios;
