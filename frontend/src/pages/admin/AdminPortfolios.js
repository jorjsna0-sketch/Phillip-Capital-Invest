import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Label } from '../../components/ui/label';
import { 
  Plus,
  Edit,
  Trash2,
  Loader2,
  Star,
  TrendingUp,
  Eye,
  Briefcase,
  AlertTriangle
} from 'lucide-react';

export function AdminPortfolios() {
  const navigate = useNavigate();
  const { api } = useAuth();
  const { t, formatCurrency, getLocalizedText } = useLanguage();
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteOption, setDeleteOption] = useState('with_payout');
  const [deleting, setDeleting] = useState(false);
  const [activeInvestmentsCount, setActiveInvestmentsCount] = useState(0);

  useEffect(() => {
    fetchPortfolios();
  }, []);

  const fetchPortfolios = async () => {
    try {
      const response = await api.get('/admin/portfolios');
      setPortfolios(response.data);
    } catch (error) {
      console.error('Error fetching portfolios:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = async (portfolioId) => {
    // Check active investments count for this portfolio
    try {
      const response = await api.get(`/admin/portfolios/${portfolioId}/investments`);
      const activeCount = (response.data || []).filter(inv => inv.status === 'active').length;
      setActiveInvestmentsCount(activeCount);
    } catch (error) {
      setActiveInvestmentsCount(0);
    }
    setDeleteId(portfolioId);
    setDeleteOption('with_payout');
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    
    setDeleting(true);
    try {
      const withPayout = deleteOption === 'with_payout';
      await api.delete(`/admin/portfolios/${deleteId}?force=true&with_payout=${withPayout}`);
      setDeleteId(null);
      fetchPortfolios();
    } catch (error) {
      console.error('Error deleting portfolio:', error);
      alert(error.response?.data?.detail || 'Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  };

  const toggleFeatured = async (portfolio) => {
    try {
      await api.put(`/portfolios/${portfolio.portfolio_id}`, {
        ...portfolio,
        featured_on_landing: !portfolio.featured_on_landing
      });
      fetchPortfolios();
    } catch (error) {
      console.error('Error updating portfolio:', error);
      alert(error.response?.data?.detail || 'Максимум 3 портфеля на лендинге');
    }
  };

  const getRiskBadge = (level) => {
    switch (level) {
      case 'low': return <Badge className="bg-green-100 text-green-700">Низкий</Badge>;
      case 'medium': return <Badge className="bg-yellow-100 text-yellow-700">Средний</Badge>;
      case 'high': return <Badge className="bg-red-100 text-red-700">Высокий</Badge>;
      default: return <Badge variant="outline">{level}</Badge>;
    }
  };

  const getDurationLabel = (portfolio) => {
    const unit = portfolio.duration_unit || 'months';
    const durations = portfolio.duration_months || [];
    const unitLabels = {
      hours: 'ч.',
      days: 'дн.',
      months: 'мес.',
      years: 'г.'
    };
    return durations.map(d => `${d} ${unitLabels[unit]}`).join(', ') || '-';
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="admin-portfolios">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-h2 text-primary">{t('admin_portfolios')}</h1>
          <p className="text-muted-foreground">Управление инвестиционными портфелями</p>
        </div>
        <Button 
          className="btn-primary" 
          onClick={() => navigate('/admin/portfolios/create')}
          data-testid="create-portfolio-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Создать портфель
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="card-glass">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Всего портфелей</p>
                <p className="text-2xl font-bold text-primary">{portfolios.length}</p>
              </div>
              <Briefcase className="w-8 h-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">На главной</p>
                <p className="text-2xl font-bold text-amber-600">
                  {portfolios.filter(p => p.featured_on_landing).length}/3
                </p>
              </div>
              <Star className="w-8 h-8 text-amber-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Активные</p>
                <p className="text-2xl font-bold text-green-600">
                  {portfolios.filter(p => p.is_active !== false).length}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="card-glass">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ср. доходность</p>
                <p className="text-2xl font-bold text-primary">
                  {portfolios.length > 0 
                    ? (portfolios.reduce((sum, p) => sum + (p.expected_return || 0), 0) / portfolios.length).toFixed(1) 
                    : 0}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio List */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Список портфелей ({portfolios.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {portfolios.length > 0 ? (
            <div className="space-y-4">
              {portfolios.map((portfolio) => (
                <div 
                  key={portfolio.portfolio_id}
                  className={`p-4 border rounded-lg hover:bg-gray-50/50 transition-colors ${
                    portfolio.featured_on_landing ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {portfolio.featured_on_landing && (
                          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                        )}
                        <h3 className="font-semibold text-lg">{getLocalizedText(portfolio.name)}</h3>
                        {getRiskBadge(portfolio.risk_level)}
                        {portfolio.status !== 'inactive' ? (
                          <Badge className="bg-green-100 text-green-700">Активный</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700">Удалён</Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {getLocalizedText(portfolio.description)}
                      </p>
                      
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Доходность:</span>{' '}
                          <span className="font-medium text-green-600">{portfolio.expected_return}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Сроки:</span>{' '}
                          <span className="font-medium">{getDurationLabel(portfolio)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Сумма:</span>{' '}
                          <span className="font-medium">
                            {formatCurrency(portfolio.min_investment, 'USD')} - {formatCurrency(portfolio.max_investment, 'USD')}
                          </span>
                        </div>
                        {portfolio.profit_accrual_interval && (
                          <div>
                            <span className="text-muted-foreground">Начисление:</span>{' '}
                            <span className="font-medium">
                              {portfolio.profit_accrual_interval === 'hourly' && 'Ежечасно'}
                              {portfolio.profit_accrual_interval === 'daily' && 'Ежедневно'}
                              {portfolio.profit_accrual_interval === 'weekly' && 'Еженедельно'}
                              {portfolio.profit_accrual_interval === 'monthly' && 'Ежемесячно'}
                              {portfolio.profit_accrual_interval === 'yearly' && 'Ежегодно'}
                              {portfolio.profit_accrual_time && ` в ${portfolio.profit_accrual_time}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => toggleFeatured(portfolio)}
                        title={portfolio.featured_on_landing ? 'Убрать с главной' : 'Показать на главной'}
                      >
                        <Star className={`w-4 h-4 ${portfolio.featured_on_landing ? 'fill-amber-500 text-amber-500' : ''}`} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => window.open(`/portfolio/${portfolio.portfolio_id}`, '_blank')}
                        title="Просмотр"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigate(`/admin/portfolios/edit/${portfolio.portfolio_id}`)}
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {portfolio.status !== 'inactive' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => openDeleteDialog(portfolio.portfolio_id)}
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Нет портфелей</p>
              <Button onClick={() => navigate('/admin/portfolios/create')}>
                <Plus className="w-4 h-4 mr-2" />
                Создать первый портфель
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => !deleting && setDeleteId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Удалить портфель?
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {activeInvestmentsCount > 0 ? (
              <>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Внимание!</strong> В этом портфеле {activeInvestmentsCount} активных инвестиций.
                    Выберите способ удаления:
                  </p>
                </div>
                
                <RadioGroup value={deleteOption} onValueChange={setDeleteOption} className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value="with_payout" id="with_payout" />
                    <div className="flex-1">
                      <Label htmlFor="with_payout" className="font-medium cursor-pointer">
                        С выплатой
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Инвесторам будет возвращён вложенный капитал + оставшаяся прибыль
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value="without_payout" id="without_payout" />
                    <div className="flex-1">
                      <Label htmlFor="without_payout" className="font-medium cursor-pointer">
                        Без выплаты
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Инвестиции будут терминированы без возврата средств
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </>
            ) : (
              <p className="text-muted-foreground">
                В этом портфеле нет активных инвестиций. Вы уверены, что хотите его удалить?
              </p>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              Отмена
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminPortfolios;
