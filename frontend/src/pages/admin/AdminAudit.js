import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Loader2 } from 'lucide-react';

export function AdminAudit() {
  const { api } = useAuth();
  const { t, formatDateTime } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await api.get('/admin/audit-logs');
      setLogs(response.data);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    if (action.includes('create')) return 'bg-green-100 text-green-700';
    if (action.includes('update')) return 'bg-blue-100 text-blue-700';
    if (action.includes('delete')) return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="admin-audit">
      <div className="mb-8">
        <h1 className="text-h2 text-primary">{t('admin_audit')}</h1>
        <p className="text-muted-foreground">Журнал действий администраторов</p>
      </div>

      <Card className="card-premium">
        <CardHeader>
          <CardTitle>История действий ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.log_id} className="p-4 border border-gray-100 rounded-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {log.target_type} / {log.target_id}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Admin: {log.admin_id}
                      </p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {log.timestamp ? formatDateTime(log.timestamp) : (log.created_at ? formatDateTime(log.created_at) : '-')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-12">
              Журнал пуст
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminAudit;
