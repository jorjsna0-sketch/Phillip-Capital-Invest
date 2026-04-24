import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { MobilePortfolios } from './MobilePortfolios';
import { 
  TrendingUp, 
  Clock, 
  Shield, 
  AlertTriangle,
  ChevronRight,
  Loader2,
  Target,
  Eye
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

export function PortfoliosPage() {
  const isMobile = useIsMobile();
  
  // Render mobile version
  if (isMobile) {
    return <MobilePortfolios />;
  }
  
  // Desktop version continues below
  return <DesktopPortfolios />;
}

function DesktopPortfolios() {
  const { api, user } = useAuth();
  const { t, language, formatCurrency, getLocalizedText } = useLanguage();
  const navigate = useNavigate();
  
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortfolios();
  }, []);

  const fetchPortfolios = async () => {
    try {
      const response = await api.get('/portfolios');
      setPortfolios(response.data);
    } catch (error) {
      console.error('Error fetching portfolios:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskIcon = (risk) => {
    switch (risk) {
      case 'low': return <Shield className="w-4 h-4 text-green-500" />;
      case 'medium': return <Target className="w-4 h-4 text-amber-500" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Get duration unit label - short version for cards (language-aware)
  const getDurationUnitLabel = (unit) => {
    const units = {
      tr: { hours: 's.', days: 'gün', months: 'ay', years: 'yıl' },
      ru: { hours: 'ч.', days: 'дн.', months: 'мес.', years: 'г.' },
      en: { hours: 'h', days: 'd', months: 'mo.', years: 'y' }
    };
    const set = units[language] || units.en;
    return set[unit] || set.months;
  };

  // Calculate rate per unit
  const getRatePerUnit = (annualRate, unit) => {
    switch (unit) {
      case 'hours': return (annualRate / 8760).toFixed(4);
      case 'days': return (annualRate / 365).toFixed(3);
      case 'months': return (annualRate / 12).toFixed(2);
      case 'years': return annualRate.toFixed(1);
      default: return (annualRate / 12).toFixed(2);
    }
  };

  const handleViewDetails = (portfolioId) => {
    navigate(`/portfolio/${portfolioId}`);
  };

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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 md:py-12" data-testid="portfolios-page">
      <div className="container-premium">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-h1 text-primary mb-4">{t('portfolios_title')}</h1>
          <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
            {t('portfolios_subtitle')}
          </p>
        </div>

        {/* Portfolios Grid */}
        {portfolios.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portfolios.map((portfolio) => (
              <Card 
                key={portfolio.portfolio_id} 
                className="card-premium group cursor-pointer"
                onClick={() => handleViewDetails(portfolio.portfolio_id)}
                data-testid={`portfolio-card-${portfolio.portfolio_id}`}
              >
                {/* Banner Image */}
                {portfolio.banner_url && (
                  <div className="relative h-40 -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-md">
                    <img 
                      src={portfolio.banner_url} 
                      alt="" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 left-4">
                      <Badge className={`${getRiskColor(portfolio.risk_level)}`}>
                        {getRiskIcon(portfolio.risk_level)}
                        <span className="ml-1">{t(`risk_${portfolio.risk_level}`)}</span>
                      </Badge>
                    </div>
                  </div>
                )}

                <CardHeader className={portfolio.banner_url ? 'pt-0' : ''}>
                  <CardTitle className="text-h3 group-hover:text-primary transition-colors">
                    {getLocalizedText(portfolio.name)}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {getLocalizedText(portfolio.description)}
                  </p>

                  {/* Returns Stats */}
                  <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-green-700 font-medium mb-1">Мин. срок</p>
                        <p className="text-lg font-bold text-green-600 flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {portfolio.duration_months?.[0] || 1} {getDurationUnitLabel(portfolio.duration_unit || 'months', portfolio.duration_months?.[0] || 1)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-green-700 font-medium mb-1">Доходность</p>
                        <p className="text-lg font-bold text-green-600 flex items-center">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          {portfolio.returns_by_term?.[portfolio.duration_months?.[0]] || portfolio.expected_return}%
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Duration & Risk */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>
                        {portfolio.duration_months?.map(d => 
                          `${d} ${getDurationUnitLabel(portfolio.duration_unit || 'months', d)}`
                        ).join(', ')}
                      </span>
                    </div>
                    {!portfolio.banner_url && (
                      <Badge className={`${getRiskColor(portfolio.risk_level)}`}>
                        {getRiskIcon(portfolio.risk_level)}
                        <span className="ml-1">{t(`risk_${portfolio.risk_level}`)}</span>
                      </Badge>
                    )}
                  </div>

                  {/* Investment Range & Payout Frequency */}
                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('portfolio_min')}</span>
                      <span className="font-medium">{formatCurrency(portfolio.min_investment)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">{t('portfolio_max')}</span>
                      <span className="font-medium">{formatCurrency(portfolio.max_investment)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Начисление</span>
                      <span className="font-medium text-blue-600">
                        {portfolio.profit_accrual_interval === 'hourly' ? 'Ежечасно' :
                         portfolio.profit_accrual_interval === 'daily' ? 'Ежедневно' :
                         portfolio.profit_accrual_interval === 'weekly' ? 'Еженедельно' :
                         portfolio.profit_accrual_interval === 'yearly' ? 'Ежегодно' : 'Ежемесячно'}
                      </span>
                    </div>
                  </div>

                  {/* Assets */}
                  <div className="flex flex-wrap gap-1">
                    {portfolio.assets.slice(0, 4).map((asset, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {asset}
                      </Badge>
                    ))}
                    {portfolio.assets.length > 4 && (
                      <Badge variant="secondary" className="text-xs">
                        +{portfolio.assets.length - 4}
                      </Badge>
                    )}
                  </div>

                  {/* CTAs */}
                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="outline"
                      className="flex-1" 
                      data-testid={`view-btn-${portfolio.portfolio_id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(portfolio.portfolio_id);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      {t('view')}
                    </Button>
                    <Button 
                      className="flex-1 btn-primary" 
                      data-testid={`invest-btn-${portfolio.portfolio_id}`}
                      onClick={(e) => handleInvest(e, portfolio.portfolio_id)}
                    >
                      {t('invest_now')}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">Портфели скоро появятся</h3>
            <p className="text-muted-foreground">
              Мы работаем над созданием инвестиционных портфелей
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PortfoliosPage;
