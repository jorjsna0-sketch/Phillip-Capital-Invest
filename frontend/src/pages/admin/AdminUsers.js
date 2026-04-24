import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { 
  Search,
  Loader2,
  User,
  Award,
  Eye,
  ChevronRight,
  Users,
  TrendingUp,
  Shield,
  Filter
} from 'lucide-react';

export function AdminUsers() {
  const { api } = useAuth();
  const { t, formatCurrency, formatDate } = useLanguage();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState('all');
  const [filterKyc, setFilterKyc] = useState('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase()) ||
      user.user_id?.toLowerCase().includes(search.toLowerCase());
    
    const matchesTier = filterTier === 'all' || user.tier === filterTier;
    const matchesKyc = filterKyc === 'all' || user.kyc_status === filterKyc;
    
    return matchesSearch && matchesTier && matchesKyc;
  });

  const getTierBadge = (tier) => {
    switch (tier) {
      case 'platinum': return { class: 'bg-purple-100 text-purple-700', label: 'Elite' };
      case 'gold': return { class: 'bg-amber-100 text-amber-700', label: 'Premium' };
      default: return { class: 'bg-gray-100 text-gray-700', label: 'Private' };
    }
  };

  const getKycBadge = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  // Stats
  const stats = {
    total: users.length,
    verified: users.filter(u => u.kyc_status === 'approved').length,
    pending: users.filter(u => u.kyc_status === 'pending').length,
    totalBalance: users.reduce((sum, u) => sum + (u.available_balance?.USD || 0) + (u.portfolio_balance?.USD || 0), 0)
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="admin-users">
      <div className="mb-8">
        <h1 className="text-h2 text-primary">{t('admin_users')}</h1>
        <p className="text-muted-foreground">Полное управление аккаунтами клиентов</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Всего клиентов</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Верифицированы</p>
                <p className="text-2xl font-bold">{stats.verified}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ожидают KYC</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Общий баланс</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalBalance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-premium">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Список клиентов ({filteredUsers.length})</CardTitle>
            <div className="flex flex-wrap gap-3">
              {/* Search */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по имени, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="user-search"
                />
              </div>
              
              {/* Tier Filter */}
              <select 
                className="border rounded-lg px-3 py-2 text-sm"
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
              >
                <option value="all">Все уровни</option>
                <option value="silver">Private</option>
                <option value="gold">Premium</option>
                <option value="platinum">Elite</option>
              </select>
              
              {/* KYC Filter */}
              <select 
                className="border rounded-lg px-3 py-2 text-sm"
                value={filterKyc}
                onChange={(e) => setFilterKyc(e.target.value)}
              >
                <option value="all">Все KYC</option>
                <option value="approved">Верифицированы</option>
                <option value="pending">Ожидают</option>
                <option value="rejected">Отклонены</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Клиент</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Уровень</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Балансы</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">KYC</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Регистрация</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const tierInfo = getTierBadge(user.tier);
                  return (
                    <tr 
                      key={user.user_id} 
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/admin/users/${user.user_id}`)}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {user.picture ? (
                            <img src={user.picture} alt="" className="w-10 h-10 rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{user.name || 'Без имени'}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={tierInfo.class}>
                          <Award className="w-3 h-3 mr-1" />
                          {tierInfo.label}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="text-sm font-medium">{formatCurrency(user.available_balance?.USD || 0)}</p>
                          <p className="text-xs text-muted-foreground">
                            В портфелях: {formatCurrency(user.portfolio_balance?.USD || 0)}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={getKycBadge(user.kyc_status)}>
                          {user.kyc_status || 'none'}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/users/${user.user_id}`);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Детали
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Клиенты не найдены</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminUsers;
