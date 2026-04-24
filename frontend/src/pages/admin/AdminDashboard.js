import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  Users, 
  Briefcase, 
  Shield, 
  Wallet,
  MessageCircle,
  TrendingUp,
  Loader2,
  Clock,
  Play,
  CheckCircle,
  RefreshCw
} from 'lucide-react';

export function AdminDashboard() {
  const { api } = useAuth();
  const { t, formatDateTime } = useLanguage();
  const [stats, setStats] = useState(null);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningAccrual, setRunningAccrual] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchSchedulerStatus();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/dashboard');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedulerStatus = async () => {
    try {
      const response = await api.get('/scheduler/status');
      setSchedulerStatus(response.data);
    } catch (error) {
      console.error('Error fetching scheduler status:', error);
    }
  };

  const runProfitAccrual = async () => {
    setRunningAccrual(true);
    try {
      await api.post('/scheduler/run-now');
      // Wait a bit for the job to complete
      setTimeout(() => {
        fetchSchedulerStatus();
        setRunningAccrual(false);
      }, 3000);
    } catch (error) {
      console.error('Error running profit accrual:', error);
      setRunningAccrual(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    { 
      title: 'Всего пользователей', 
      value: stats?.total_users || 0, 
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-100'
    },
    { 
      title: 'Активные инвестиции', 
      value: stats?.total_investments || 0, 
      icon: Briefcase,
      color: 'text-green-500',
      bg: 'bg-green-100'
    },
    { 
      title: 'Ожидают KYC', 
      value: stats?.pending_kyc || 0, 
      icon: Shield,
      color: 'text-amber-500',
      bg: 'bg-amber-100'
    },
    { 
      title: 'Ожидают вывода', 
      value: stats?.pending_withdrawals || 0, 
      icon: Wallet,
      color: 'text-purple-500',
      bg: 'bg-purple-100'
    },
    { 
      title: 'Открытые тикеты', 
      value: stats?.open_tickets || 0, 
      icon: MessageCircle,
      color: 'text-red-500',
      bg: 'bg-red-100'
    },
  ];

  return (
    <div className="p-8" data-testid="admin-dashboard">
      <div className="mb-8">
        <h1 className="text-h2 text-primary">{t('admin_dashboard')}</h1>
        <p className="text-muted-foreground">Общая статистика платформы</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {statCards.map((stat, index) => (
          <Card key={index} className="card-premium" data-testid={`stat-card-${index}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-heading font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-full ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-h3">Требуют внимания</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.pending_kyc > 0 && (
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-sm">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-amber-500" />
                    <span>Ожидают верификации KYC</span>
                  </div>
                  <span className="font-medium">{stats.pending_kyc}</span>
                </div>
              )}
              {stats?.pending_withdrawals > 0 && (
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-sm">
                  <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-purple-500" />
                    <span>Запросы на вывод</span>
                  </div>
                  <span className="font-medium">{stats.pending_withdrawals}</span>
                </div>
              )}
              {stats?.open_tickets > 0 && (
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-sm">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-red-500" />
                    <span>Открытые обращения</span>
                  </div>
                  <span className="font-medium">{stats.open_tickets}</span>
                </div>
              )}
              {!stats?.pending_kyc && !stats?.pending_withdrawals && !stats?.open_tickets && (
                <p className="text-center text-muted-foreground py-4">
                  Нет срочных задач
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-h3 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Планировщик начислений
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Статус:</span>
                <Badge variant={schedulerStatus?.running ? 'default' : 'destructive'}>
                  {schedulerStatus?.running ? 'Активен' : 'Остановлен'}
                </Badge>
              </div>
              
              {schedulerStatus?.jobs?.map((job, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-medium">{job.name}</span>
                  </div>
                  {job.next_run && (
                    <p className="text-sm text-muted-foreground">
                      Следующий запуск: {new Date(job.next_run).toLocaleString('ru-RU')}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Триггер: {job.trigger}
                  </p>
                </div>
              ))}
              
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchSchedulerStatus}
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Обновить
                </Button>
                <Button 
                  size="sm" 
                  onClick={runProfitAccrual}
                  disabled={runningAccrual}
                  className="flex-1"
                >
                  {runningAccrual ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {runningAccrual ? 'Выполняется...' : 'Запустить сейчас'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-h3">Быстрая статистика</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Активность</p>
                  <p className="text-xl font-semibold">Платформа работает</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AdminDashboard;
