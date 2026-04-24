import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { Button } from '../components/ui/button';
import axios from 'axios';
import { 
  Shield, 
  ArrowRight,
  Lock,
  BarChart3,
  Users,
  Clock,
  ChevronRight,
  Building,
  CheckCircle2,
  TrendingUp,
  Briefcase,
  PieChart,
  Target,
  Wallet,
  Loader2
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function LandingPage() {
  const { language, getLocalizedText } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [activeMetric, setActiveMetric] = useState(0);
  const [calcAmount, setCalcAmount] = useState('850000');
  const [selectedTerm, setSelectedTerm] = useState(12);
  const [selectedRate, setSelectedRate] = useState(18);
  const [featuredPortfolios, setFeaturedPortfolios] = useState([]);
  const [loadingPortfolios, setLoadingPortfolios] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setActiveMetric(prev => (prev + 1) % 3);
    }, 4000);
    
    // Fetch featured portfolios
    fetchFeaturedPortfolios();
    
    return () => clearInterval(interval);
  }, []);

  const fetchFeaturedPortfolios = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/portfolios/featured`);
      setFeaturedPortfolios(response.data);
    } catch (error) {
      console.error('Error fetching featured portfolios:', error);
    } finally {
      setLoadingPortfolios(false);
    }
  };

  // Get return rate for a specific term
  const getReturnForTerm = (portfolio, term) => {
    const returnsByTerm = portfolio.returns_by_term || {};
    const termKey = term.toString();
    if (returnsByTerm[termKey]) {
      return returnsByTerm[termKey];
    }
    return portfolio.expected_return || 12;
  };

  // Get all available terms from portfolios
  const getAvailableTerms = () => {
    const terms = new Set();
    featuredPortfolios.forEach(p => {
      (p.duration_months || []).forEach(t => terms.add(t));
    });
    return Array.from(terms).sort((a, b) => a - b);
  };

  const content = {
    ru: {
      badge: 'Лицензия №1.2.34/567',
      headline: 'Готовые инвестиционные',
      headlineSub: 'портфели',
      description: 'Профессионально составленные портфели для любого бюджета. Выберите подходящий уровень риска и доходности — мы позаботимся об остальном.',
      cta: 'Смотреть портфели',
      ctaSecondary: 'Как это работает',
      metrics: [
        { value: '₺4.2B', label: 'Активы под управлением', icon: Wallet },
        { value: '18.4%', label: 'Средняя доходность', icon: TrendingUp },
        { value: '2,847', label: 'Активных инвесторов', icon: Users }
      ],
      trustBadges: ['AML/KYC', 'SSL 256-bit', 'Global Member'],
      sectionTitle: 'Почему выбирают нас',
      features: [
        {
          icon: Shield,
          title: 'Защита инвестиций',
          desc: 'Segregated accounts, страхование до ₺17M, многоуровневая защита',
          highlight: 'Застраховано'
        },
        {
          icon: PieChart,
          title: 'Диверсификация',
          desc: 'Каждый портфель сбалансирован по секторам, географии и типам активов',
          highlight: 'Оптимизировано'
        },
        {
          icon: Clock,
          title: 'Прозрачность',
          desc: 'Ежедневная отчётность, онлайн-доступ 24/7, детализация операций',
          highlight: 'Real-time'
        },
        {
          icon: Target,
          title: 'Под ваши цели',
          desc: 'Портфели для разных целей: накопление, пассивный доход, рост капитала',
          highlight: '6 портфелей'
        }
      ],
      portfoliosTitle: 'Выберите свой портфель',
      portfoliosSubtitle: 'Каждый портфель — это готовое решение под определённый уровень риска',
      portfolios: [
        { 
          name: 'Стабильный', 
          tag: 'Консервативный',
          return: '12%', 
          risk: 'Минимальный риск',
          min: 'от ₺350,000',
          desc: 'Для тех, кто ценит стабильность и сохранность капитала',
          color: 'emerald'
        },
        { 
          name: 'Сбалансированный', 
          tag: 'Оптимальный',
          return: '18%', 
          risk: 'Умеренный риск',
          min: 'от ₺850,000',
          desc: 'Золотая середина между доходностью и надёжностью',
          color: 'amber',
          popular: true
        },
        { 
          name: 'Агрессивный', 
          tag: 'Максимум доходности',
          return: '28%', 
          risk: 'Высокий риск',
          min: 'от ₺1,700,000',
          desc: 'Для тех, кто готов к риску ради максимальной прибыли',
          color: 'slate'
        }
      ],
      howItWorks: 'Как это работает',
      steps: [
        { num: '01', title: 'Выберите портфель', desc: 'Изучите доступные портфели и выберите подходящий под ваши цели' },
        { num: '02', title: 'Откройте счёт', desc: 'Пройдите быструю регистрацию и верификацию за 15 минут' },
        { num: '03', title: 'Пополните баланс', desc: 'Переведите средства удобным способом: карта, банковский перевод' },
        { num: '04', title: 'Инвестируйте', desc: 'Выберите сумму и срок — контракт формируется автоматически' }
      ],
      ctaSection: {
        title: 'Готовы начать?',
        subtitle: 'Откройте счёт за 5 минут и получите доступ ко всем портфелям',
        button: 'Открыть счёт'
      },
      footer: {
        disclaimer: 'Информация на сайте не является публичной офертой. Инвестирование связано с риском. Прошлые результаты не гарантируют будущую доходность. Phillip Capital Invest ведёт деятельность по действующей лицензии.',
        rights: `© ${new Date().getFullYear()} Phillip Capital Invest. Все права защищены.`
      }
    },
    tr: {
      badge: 'Lisans No. №1.2.34/567',
      headline: 'Hazır yatırım',
      headlineSub: 'portföyleri',
      description: 'Her bütçe için profesyonel olarak oluşturulmuş portföyler. Uygun risk ve getiri seviyesini seçin — gerisini biz hallederiz.',
      cta: 'Portföyleri Görüntüle',
      ctaSecondary: 'Nasıl Çalışır',
      metrics: [
        { value: '₺4.2B', label: 'Yönetilen Varlıklar', icon: Wallet },
        { value: '18.4%', label: 'Ortalama Getiri', icon: TrendingUp },
        { value: '2,847', label: 'Aktif Yatırımcı', icon: Users }
      ],
      trustBadges: ['AML/KYC', 'SSL 256-bit', 'Global Member'],
      sectionTitle: 'Neden Bizi Seçmelisiniz',
      features: [
        {
          icon: Shield,
          title: 'Yatırım Koruması',
          desc: 'Ayrı hesaplar, ₺17M\'ye kadar sigorta, çok katmanlı güvenlik',
          highlight: 'Sigortalı'
        },
        {
          icon: PieChart,
          title: 'Çeşitlendirme',
          desc: 'Her portföy sektörler, coğrafya ve varlık türleri açısından dengelenmiştir',
          highlight: 'Optimize'
        },
        {
          icon: Clock,
          title: 'Şeffaflık',
          desc: 'Günlük raporlama, 7/24 çevrimiçi erişim, detaylı işlem kaydı',
          highlight: 'Real-time'
        },
        {
          icon: Target,
          title: 'Hedefleriniz İçin',
          desc: 'Farklı hedefler için portföyler: birikim, pasif gelir, sermaye büyümesi',
          highlight: '6 portföy'
        }
      ],
      portfoliosTitle: 'Portföyünüzü Seçin',
      portfoliosSubtitle: 'Her portföy belirli bir risk seviyesi için hazır bir çözümdür',
      portfolios: [
        {
          name: 'Kararlı',
          tag: 'Muhafazakar',
          return: '12%',
          risk: 'Minimum risk',
          min: '₺350,000\'den itibaren',
          desc: 'İstikrar ve sermaye korumasına değer verenler için',
          color: 'emerald'
        },
        {
          name: 'Dengeli',
          tag: 'Optimal',
          return: '18%',
          risk: 'Orta risk',
          min: '₺850,000\'den itibaren',
          desc: 'Getiri ve güvenilirlik arasındaki altın denge',
          color: 'amber',
          popular: true
        },
        {
          name: 'Agresif',
          tag: 'Maksimum getiri',
          return: '28%',
          risk: 'Yüksek risk',
          min: '₺1,700,000\'den itibaren',
          desc: 'Maksimum kâr için risk almaya hazır olanlar için',
          color: 'slate'
        }
      ],
      howItWorks: 'Nasıl Çalışır',
      steps: [
        { num: '01', title: 'Portföy Seçin', desc: 'Mevcut portföyleri inceleyin ve hedeflerinize uygun olanı seçin' },
        { num: '02', title: 'Hesap Açın', desc: '15 dakikada hızlı kayıt ve doğrulamayı tamamlayın' },
        { num: '03', title: 'Bakiyeyi Yükleyin', desc: 'Kolay yöntemle fon aktarın: kart, banka havalesi' },
        { num: '04', title: 'Yatırım Yapın', desc: 'Tutar ve süreyi seçin — sözleşme otomatik olarak oluşturulur' }
      ],
      ctaSection: {
        title: 'Başlamaya Hazır mısınız?',
        subtitle: '5 dakikada hesap açın ve tüm portföylere erişin',
        button: 'Hesap Aç'
      },
      footer: {
        disclaimer: 'Bu sitedeki bilgiler kamuya açık bir teklif teşkil etmez. Yatırım risk içerir. Geçmiş sonuçlar gelecekteki getirileri garanti etmez. Phillip Capital Invest geçerli lisans altında faaliyet göstermektedir.',
        rights: `© ${new Date().getFullYear()} Phillip Capital Invest. Tüm hakları saklıdır.`
      }
    },
    en: {
      badge: 'License №1.2.34/567',
      headline: 'Ready-made investment',
      headlineSub: 'portfolios',
      description: 'Professionally assembled portfolios for any budget. Choose your preferred risk and return level — we take care of the rest.',
      cta: 'View Portfolios',
      ctaSecondary: 'How It Works',
      metrics: [
        { value: '₺4.2B', label: 'Assets Under Management', icon: Wallet },
        { value: '18.4%', label: 'Average Return', icon: TrendingUp },
        { value: '2,847', label: 'Active Investors', icon: Users }
      ],
      trustBadges: ['AML/KYC', 'SSL 256-bit', 'Global Member'],
      sectionTitle: 'Why Choose Us',
      features: [
        {
          icon: Shield,
          title: 'Investment Protection',
          desc: 'Segregated accounts, insurance up to ₺17M, multi-layer security',
          highlight: 'Insured'
        },
        {
          icon: PieChart,
          title: 'Diversification',
          desc: 'Each portfolio is balanced by sectors, geography, and asset types',
          highlight: 'Optimized'
        },
        {
          icon: Clock,
          title: 'Transparency',
          desc: 'Daily reporting, 24/7 online access, detailed operations log',
          highlight: 'Real-time'
        },
        {
          icon: Target,
          title: 'For Your Goals',
          desc: 'Portfolios for different goals: savings, passive income, capital growth',
          highlight: '6 portfolios'
        }
      ],
      portfoliosTitle: 'Choose Your Portfolio',
      portfoliosSubtitle: 'Each portfolio is a ready solution for a specific risk level',
      portfolios: [
        { 
          name: 'Stable', 
          tag: 'Conservative',
          return: '12%', 
          risk: 'Minimal risk',
          min: 'from ₺350,000',
          desc: 'For those who value stability and capital preservation',
          color: 'emerald'
        },
        { 
          name: 'Balanced', 
          tag: 'Optimal',
          return: '18%', 
          risk: 'Moderate risk',
          min: 'from ₺850,000',
          desc: 'The golden mean between returns and reliability',
          color: 'amber',
          popular: true
        },
        { 
          name: 'Aggressive', 
          tag: 'Maximum returns',
          return: '28%', 
          risk: 'High risk',
          min: 'from ₺1,700,000',
          desc: 'For those ready to take risks for maximum profit',
          color: 'slate'
        }
      ],
      howItWorks: 'How It Works',
      steps: [
        { num: '01', title: 'Choose a Portfolio', desc: 'Explore available portfolios and select one matching your goals' },
        { num: '02', title: 'Open an Account', desc: 'Complete quick registration and verification in 15 minutes' },
        { num: '03', title: 'Fund Your Balance', desc: 'Transfer funds conveniently: card, wire transfer' },
        { num: '04', title: 'Invest', desc: 'Select amount and term — the contract is generated automatically' }
      ],
      ctaSection: {
        title: 'Ready to Start?',
        subtitle: 'Open an account in 5 minutes and get access to all portfolios',
        button: 'Open Account'
      },
      footer: {
        disclaimer: 'Information on this site does not constitute a public offer. Investing involves risk. Past results do not guarantee future returns. Phillip Capital Invest operates under a valid license.',
        rights: `© ${new Date().getFullYear()} Phillip Capital Invest. All rights reserved.`
      }
    }
  };

  const c = content[language] || content.en;

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02]">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
        </div>
        
        <div className="container-premium relative">
          <div className="min-h-[85vh] flex flex-col justify-center py-20">
            {/* License Badge */}
            <div 
              className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-950/5 border border-emerald-900/10 w-fit mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              <Building className="w-4 h-4 text-emerald-900" />
              <span className="text-xs font-medium text-emerald-900 tracking-wider">{c.badge}</span>
            </div>

            {/* Main Headline */}
            <div className={`max-w-3xl transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <h1 className="font-heading text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-emerald-950 leading-[1.1] mb-2 break-words">
                {c.headline}
              </h1>
              <h1 className="font-heading text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-amber-600 leading-[1.1] mb-8 break-words">
                {c.headlineSub}
              </h1>
              <p className="text-base md:text-xl text-slate-600 leading-relaxed max-w-2xl mb-10">
                {c.description}
              </p>
            </div>

            {/* CTA Buttons */}
            <div className={`flex flex-col sm:flex-row gap-4 mb-16 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <Link to="/portfolios">
                <Button 
                  className="bg-emerald-950 hover:bg-emerald-900 text-white px-8 py-6 text-base font-medium tracking-wide"
                  data-testid="hero-cta-primary"
                >
                  {c.cta}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button 
                  variant="outline" 
                  className="border-emerald-950/20 text-emerald-950 hover:bg-emerald-950/5 px-8 py-6 text-base"
                  data-testid="hero-cta-secondary"
                >
                  {c.ctaSecondary}
                </Button>
              </a>
            </div>

            {/* Trust Badges */}
            <div className={`flex flex-wrap items-center gap-6 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              {c.trustBadges.map((badge, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-500 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{badge}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Bar */}
      <section className="bg-emerald-950 py-12">
        <div className="container-premium">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {c.metrics.map((metric, index) => (
              <div 
                key={index} 
                className={`text-center p-6 rounded transition-all duration-500 ${
                  activeMetric === index ? 'bg-white/10' : ''
                }`}
              >
                <metric.icon className="w-6 h-6 text-amber-400 mx-auto mb-3" />
                <p className="text-4xl md:text-5xl font-heading font-bold text-white mb-2">{metric.value}</p>
                <p className="text-white/60 text-sm uppercase tracking-wider">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="container-premium">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-emerald-950 mb-4">{c.sectionTitle}</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {c.features.map((feature, index) => (
              <div 
                key={index} 
                className="group p-8 bg-slate-50/50 border border-slate-100 hover:bg-white hover:border-amber-200 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-emerald-950 flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-amber-400" />
                  </div>
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1">
                    {feature.highlight}
                  </span>
                </div>
                <h3 className="font-heading font-semibold text-xl text-emerald-950 mb-3">{feature.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Calculator Section - Beautiful Investment Calculator */}
      <section className="py-24 bg-slate-900">
        <div className="container-premium">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">{c.portfoliosTitle}</h2>
            <p className="text-lg text-slate-400">{c.portfoliosSubtitle}</p>
          </div>

          {/* Beautiful Calculator */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 border border-slate-700 rounded-2xl p-8 md:p-10">
              
              {/* Calculator Grid */}
              <div className="grid md:grid-cols-3 gap-6 md:gap-8 mb-8">
                
                {/* Amount Input */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                    <Wallet className="w-4 h-4" />
                    {language === 'ru' ? 'Сумма инвестиций' : language === 'tr' ? 'Yatırım tutarı' : 'Investment amount'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400 text-xl font-bold">₺</span>
                    <input
                      type="number"
                      value={calcAmount}
                      onChange={(e) => setCalcAmount(e.target.value)}
                      className="w-full bg-slate-900/80 border-2 border-slate-600 text-white text-2xl font-bold pl-10 pr-4 py-4 rounded-xl focus:outline-none focus:border-amber-400 transition-all"
                      data-testid="calc-amount-input"
                    />
                  </div>
                  <div className="flex gap-2">
                    {[350000, 850000, 1700000, 3500000].map(amount => (
                      <button
                        key={amount}
                        onClick={() => setCalcAmount(amount.toString())}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                          calcAmount === amount.toString() 
                            ? 'bg-amber-400 text-slate-900 shadow-lg shadow-amber-400/20' 
                            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        ₺{amount >= 1000000 ? `${amount/1000000}M` : `${amount/1000}K`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Term Selection */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                    <Clock className="w-4 h-4" />
                    {language === 'ru' ? 'Срок инвестирования' : language === 'tr' ? 'Yatırım süresi' : 'Investment term'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[3, 6, 12, 24].map(term => (
                      <button
                        key={term}
                        onClick={() => setSelectedTerm(term)}
                        className={`py-4 text-lg font-bold rounded-xl transition-all ${
                          selectedTerm === term 
                            ? 'bg-amber-400 text-slate-900 shadow-lg shadow-amber-400/20' 
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-600'
                        }`}
                      >
                        {term} {language === 'ru' ? 'мес' : language === 'tr' ? 'ay' : 'mo'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Return Rate Selection */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                    <TrendingUp className="w-4 h-4" />
                    {language === 'ru' ? 'Доходность (% годовых)' : language === 'tr' ? 'Getiri (% yıllık)' : 'Return rate (% p.a.)'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[12, 18, 24, 28].map(rate => (
                      <button
                        key={rate}
                        onClick={() => setSelectedRate(rate)}
                        className={`py-4 text-lg font-bold rounded-xl transition-all ${
                          selectedRate === rate 
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-600'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent mb-8" />

              {/* Results */}
              {parseFloat(calcAmount) > 0 && (
                <div className="grid md:grid-cols-4 gap-4 md:gap-6">
                  {/* Investment */}
                  <div className="bg-slate-900/50 rounded-xl p-5 text-center">
                    <p className="text-slate-500 text-sm mb-2">
                      {language === 'ru' ? 'Ваши инвестиции' : language === 'tr' ? 'Yatırımınız' : 'Your investment'}
                    </p>
                    <p className="text-2xl font-bold text-white">
                      ₺{parseFloat(calcAmount).toLocaleString()}
                    </p>
                  </div>

                  {/* Period Profit */}
                  <div className="bg-slate-900/50 rounded-xl p-5 text-center">
                    <p className="text-slate-500 text-sm mb-2">
                      {language === 'ru' ? `Прибыль за ${selectedTerm} мес` : language === 'tr' ? `${selectedTerm} aylık kâr` : `Profit for ${selectedTerm}mo`}
                    </p>
                    <p className="text-2xl font-bold text-emerald-400">
                      +₺{(parseFloat(calcAmount) * (selectedRate / 100) * (selectedTerm / 12)).toLocaleString('en-US', {maximumFractionDigits: 0})}
                    </p>
                  </div>

                  {/* Monthly */}
                  <div className="bg-slate-900/50 rounded-xl p-5 text-center">
                    <p className="text-slate-500 text-sm mb-2">
                      {language === 'ru' ? 'В месяц' : language === 'tr' ? 'Aylık' : 'Monthly'}
                    </p>
                    <p className="text-2xl font-bold text-slate-300">
                      +₺{((parseFloat(calcAmount) * (selectedRate / 100)) / 12).toLocaleString('en-US', {maximumFractionDigits: 0})}
                    </p>
                  </div>

                  {/* Total */}
                  <div className="bg-gradient-to-br from-amber-500/20 to-emerald-500/20 rounded-xl p-5 text-center border border-amber-400/30">
                    <p className="text-amber-400 text-sm mb-2 font-medium">
                      {language === 'ru' ? 'Итого получите' : language === 'tr' ? 'Toplam alacaksınız' : 'You will receive'}
                    </p>
                    <p className="text-3xl font-bold text-white">
                      ₺{(parseFloat(calcAmount) + parseFloat(calcAmount) * (selectedRate / 100) * (selectedTerm / 12)).toLocaleString('en-US', {maximumFractionDigits: 0})}
                    </p>
                  </div>
                </div>
              )}

              {/* CTA Button */}
              <div className="mt-8 text-center">
                <Link to="/portfolios">
                  <Button className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-12 py-6 text-lg rounded-xl shadow-lg shadow-amber-400/20 transition-all hover:shadow-amber-400/40">
                    {language === 'ru' ? 'Выбрать портфель' : language === 'tr' ? 'Portföy Seç' : 'Choose Portfolio'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center gap-6 mt-8 text-slate-500 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span>{language === 'ru' ? 'Застраховано до ₺17M' : language === 'tr' ? '₺17M\'ye kadar sigortalı' : 'Insured up to ₺17M'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-500" />
                <span>{language === 'ru' ? 'Безопасные транзакции' : language === 'tr' ? 'Güvenli işlemler' : 'Secure transactions'}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>{language === 'ru' ? 'Лицензировано' : language === 'tr' ? 'Lisanslı' : 'Licensed'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-emerald-950">
        <div className="container-premium">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-white text-center mb-16">{c.howItWorks}</h2>
          
          <div className="grid md:grid-cols-4 gap-8">
            {c.steps.map((step, index) => (
              <div key={index} className="relative text-center">
                <div className="w-16 h-16 bg-amber-400 text-emerald-950 font-heading font-bold text-2xl flex items-center justify-center mx-auto mb-6">
                  {step.num}
                </div>
                <h3 className="font-heading font-semibold text-xl text-white mb-2">{step.title}</h3>
                <p className="text-white/60 text-sm">{step.desc}</p>
                {index < 3 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-white/20" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-emerald-950 mb-4">{c.ctaSection.title}</h2>
            <p className="text-lg text-slate-600 mb-10">{c.ctaSection.subtitle}</p>
            <Link to="/register">
              <Button className="bg-amber-500 hover:bg-amber-400 text-emerald-950 font-semibold px-12 py-6 text-base">
                {c.ctaSection.button}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-8 bg-slate-100 border-t border-slate-200">
        <div className="container-premium">
          <p className="text-xs text-slate-500 text-center max-w-4xl mx-auto leading-relaxed">
            {c.footer.disclaimer}
          </p>
          <p className="text-xs text-slate-400 text-center mt-4">{c.footer.rights}</p>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
