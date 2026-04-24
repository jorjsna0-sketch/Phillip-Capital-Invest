import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Link } from 'react-router-dom';
import { 
  Settings,
  Mail,
  Building,
  FileText,
  ArrowRight
} from 'lucide-react';

export function AdminSettings() {
  const { t } = useLanguage();

  const settingsLinks = [
    {
      title: 'Настройки компании',
      description: 'Реквизиты, подпись, печать, банковские данные',
      icon: Building,
      link: '/admin/company',
      color: 'text-blue-600 bg-blue-100'
    },
    {
      title: 'Настройки почты',
      description: 'SendGrid/SMTP, email отправителя, тестирование',
      icon: Mail,
      link: '/admin/company',
      tab: 'email',
      color: 'text-green-600 bg-green-100'
    },
    {
      title: 'Шаблоны писем',
      description: 'Шаблоны уведомлений для клиентов',
      icon: FileText,
      link: '/admin/email-templates',
      color: 'text-purple-600 bg-purple-100'
    }
  ];

  return (
    <div className="p-8" data-testid="admin-settings">
      <div className="mb-8">
        <h1 className="text-h2 text-primary">{t('admin_settings')}</h1>
        <p className="text-muted-foreground">Системные настройки и интеграции</p>
      </div>

      <div className="max-w-3xl grid gap-4">
        {settingsLinks.map((item, index) => (
          <Link key={index} to={item.link}>
            <Card className="card-premium hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg ${item.color} flex items-center justify-center`}>
                      <item.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-medium text-lg">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default AdminSettings;
