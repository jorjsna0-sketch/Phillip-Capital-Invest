import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { Building2, Mail, MapPin, FileText } from 'lucide-react';
import axios from 'axios';

export function Footer() {
  const { t, language } = useLanguage();
  const currentYear = new Date().getFullYear();
  const [contactInfo, setContactInfo] = useState(null);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    // Fetch contact info and documents from API
    const fetchData = async () => {
      try {
        const [contactRes, docsRes] = await Promise.all([
          axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/contact-info`),
          axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/site-documents`)
        ]);
        setContactInfo(contactRes.data);
        setDocuments(docsRes.data || []);
      } catch (error) {
        console.error('Error fetching footer data:', error);
      }
    };
    fetchData();
  }, []);

  const companyInfo = {
    ru: {
      name: 'AltynContract Ltd.',
      license: 'Лицензия НБ РК №XXX от 01.01.2024',
    },
    kz: {
      name: 'AltynContract Ltd.',
      license: 'ҚР ҰБ лицензиясы №XXX 01.01.2024 ж.',
    },
    en: {
      name: 'AltynContract Ltd.',
      license: 'NBK License №XXX dated 01.01.2024',
    }
  };

  const info = companyInfo[language] || companyInfo.en;

  // Get document URL by type
  const getDocUrl = (docType) => {
    const doc = documents.find(d => d.doc_type === docType);
    if (!doc?.file_url) return null;
    
    // file_url содержит /api/uploads/..., добавляем базовый URL
    // Файлы раздаются на /api/uploads/, поэтому оставляем путь как есть
    return `${process.env.REACT_APP_BACKEND_URL}${doc.file_url}`;
  };

  // Document labels
  const docLabels = {
    legal_info: { ru: 'Правовая информация', kz: 'Құқықтық ақпарат', en: 'Legal Information' },
    privacy_policy: { ru: 'Политика конфиденциальности', kz: 'Құпиялылық саясаты', en: 'Privacy Policy' },
    disclosure: { ru: 'Раскрытие информации', kz: 'Ақпаратты ашу', en: 'Disclosure' },
    fees: { ru: 'Тарифы и комиссии', kz: 'Тарифтер мен комиссиялар', en: 'Fees & Commissions' }
  };

  // Contact info with fallbacks
  const email = contactInfo?.email || 'info@altyncontract.kz';
  const address = contactInfo?.address?.[language] || contactInfo?.address?.ru || 'г. Алматы, пр. Аль-Фараби, 77/8, БЦ "Esentai Tower"';

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container-premium py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 rounded-sm bg-white flex items-center justify-center">
                <span className="text-primary font-heading font-bold text-xl">A</span>
              </div>
              <div>
                <span className="font-heading font-semibold text-xl block">AltynContract</span>
                <span className="text-xs text-primary-foreground/60">{t('app_tagline')}</span>
              </div>
            </div>
            <p className="text-sm text-primary-foreground/70 mt-4 leading-relaxed">
              {info.name}
            </p>
            <p className="text-xs text-primary-foreground/50 mt-2">
              {info.license}
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-heading font-medium text-lg mb-4">
              {language === 'ru' ? 'Навигация' : language === 'kz' ? 'Навигация' : 'Navigation'}
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  {t('nav_home')}
                </Link>
              </li>
              <li>
                <Link to="/portfolios" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  {t('nav_portfolios')}
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  {t('nav_dashboard')}
                </Link>
              </li>
              <li>
                <Link to="/support" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  {t('nav_support')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Documents */}
          <div>
            <h4 className="font-heading font-medium text-lg mb-4">
              {language === 'ru' ? 'Документы' : language === 'kz' ? 'Құжаттар' : 'Legal'}
            </h4>
            <ul className="space-y-3 text-sm">
              {['legal_info', 'privacy_policy', 'disclosure', 'fees'].map((docType) => {
                const url = getDocUrl(docType);
                const label = docLabels[docType][language] || docLabels[docType].en;
                
                const handleClick = (e) => {
                  if (url) {
                    e.preventDefault();
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }
                };
                
                return (
                  <li key={docType}>
                    {url ? (
                      <a 
                        href={url} 
                        onClick={handleClick}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary-foreground/70 hover:text-primary-foreground transition-colors flex items-center gap-1"
                      >
                        {label}
                        <FileText className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-primary-foreground/40 cursor-not-allowed">
                        {label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading font-medium text-lg mb-4">{t('footer_contact')}</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3 text-primary-foreground/70">
                <Mail className="w-4 h-4 text-amber-400" />
                <a href={`mailto:${email}`} className="hover:text-primary-foreground transition-colors">
                  {email}
                </a>
              </li>
              <li className="flex items-start gap-3 text-primary-foreground/70">
                <MapPin className="w-4 h-4 mt-0.5 text-amber-400" />
                <span className="text-xs leading-relaxed">{address}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-primary-foreground/10 mt-12 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-primary-foreground/50">
              © {currentYear} AltynContract. {t('footer_rights')}.
            </p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-xs text-primary-foreground/50">
                <Building2 className="w-4 h-4" />
                <span>
                  {language === 'ru' ? 'Член KASE' : language === 'kz' ? 'KASE мүшесі' : 'KASE Member'}
                </span>
              </div>
              <div className="h-4 w-px bg-primary-foreground/20" />
              <span className="text-xs text-primary-foreground/50">
                {language === 'ru' ? 'Регулируется НБ РК' : language === 'kz' ? 'ҚР ҰБ реттейді' : 'Regulated by NBK'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
