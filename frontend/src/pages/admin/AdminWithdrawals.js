import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  Check,
  X,
  Loader2
} from 'lucide-react';

export function AdminWithdrawals() {
  const { api } = useAuth();
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  const fetchWithdrawals = useCallback(async () => {
    try {
      const response = await api.get('/admin/withdrawals/pending');
      setWithdrawals(response.data);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const handleProcess = async (transactionId, status) => {
    setProcessing(transactionId);
    try {
      await api.put(`/admin/withdrawals/${transactionId}`, { status });
      fetchWithdrawals();
    } catch (error) {
      console.error('Error processing withdrawal:', error);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="admin-withdrawals">
      <div className="mb-8">
        <h1 className="text-h2 text-primary">{t('admin_withdrawals')}</h1>
        <p className="text-muted-foreground">Обработка запросов на вывод средств</p>
      </div>

      <Card className="card-premium">
        <CardHeader>
          <CardTitle>Ожидают обработки ({withdrawals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawals.length > 0 ? (
            <div className="space-y-4">
              {withdrawals.map((tx) => (
                <div key={tx.transaction_id} className="p-4 border border-gray-100 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-mono text-sm">{tx.transaction_id}</p>
                        <Badge className="status-pending">Ожидает</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Пользователь: {tx.user_id}
                      </p>
                      <p className="text-lg font-semibold text-primary mt-1">
                        {formatCurrency(tx.amount, tx.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(tx.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-green-500 hover:bg-green-600"
                        onClick={() => handleProcess(tx.transaction_id, 'completed')}
                        disabled={processing === tx.transaction_id}
                      >
                        {processing === tx.transaction_id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <Check className="w-4 h-4 mr-1" />
                        )}
                        Одобрить
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleProcess(tx.transaction_id, 'failed')}
                        disabled={processing === tx.transaction_id}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Отклонить
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-12">
              Нет запросов на вывод
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminWithdrawals;
