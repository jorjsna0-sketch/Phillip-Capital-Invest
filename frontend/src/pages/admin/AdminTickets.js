import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  MessageCircle,
  Send,
  Loader2
} from 'lucide-react';

export function AdminTickets() {
  const { api } = useAuth();
  const { t, formatDateTime } = useLanguage();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchTickets();
  }, [statusFilter]);

  const fetchTickets = async () => {
    try {
      const url = statusFilter === 'all' ? '/admin/tickets' : `/admin/tickets?status=${statusFilter}`;
      const res = await api.get(url);
      setTickets(res.data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async () => {
    if (!selectedTicket || !response.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/admin/tickets/${selectedTicket.ticket_id}/respond`, { message: response });
      setResponse('');
      fetchTickets();
      // Refresh selected ticket
      const updatedTickets = await api.get('/admin/tickets');
      const updated = updatedTickets.data.find(t => t.ticket_id === selectedTicket.ticket_id);
      setSelectedTicket(updated);
    } catch (error) {
      console.error('Error responding:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (ticketId, status) => {
    try {
      await api.put(`/admin/tickets/${ticketId}`, { status });
      fetchTickets();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-700';
      case 'in_progress': return 'bg-amber-100 text-amber-700';
      case 'resolved': return 'bg-green-100 text-green-700';
      case 'closed': return 'bg-gray-100 text-gray-700';
      default: return '';
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
    <div className="p-8" data-testid="admin-tickets">
      <div className="mb-8">
        <h1 className="text-h2 text-primary">{t('admin_tickets')}</h1>
        <p className="text-muted-foreground">Обработка обращений пользователей</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets List */}
        <div className="lg:col-span-1">
          <Card className="card-premium">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Обращения</CardTitle>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="open">Открытые</SelectItem>
                    <SelectItem value="in_progress">В работе</SelectItem>
                    <SelectItem value="resolved">Решены</SelectItem>
                    <SelectItem value="closed">Закрыты</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[60vh] overflow-auto">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.ticket_id}
                    className={`p-3 rounded-sm cursor-pointer transition-colors ${
                      selectedTicket?.ticket_id === ticket.ticket_id
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge className={getStatusBadge(ticket.status)}>
                        {t(`ticket_status_${ticket.status}`)}
                      </Badge>
                      {ticket.responses?.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {ticket.responses.length} отв.
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-sm truncate">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {ticket.user_name || ticket.user_id}
                    </p>
                    <p className="text-xs text-primary truncate">{ticket.user_email}</p>
                  </div>
                ))}
                {tickets.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Нет обращений
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ticket Details */}
        <div className="lg:col-span-2">
          <Card className="card-premium h-full">
            <CardContent className="pt-6">
              {selectedTicket ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-lg">{selectedTicket.subject}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedTicket.user_name || selectedTicket.user_id} • {formatDateTime(selectedTicket.created_at)}
                      </p>
                      <p className="text-sm text-primary">{selectedTicket.user_email}</p>
                    </div>
                    <Select 
                      value={selectedTicket.status}
                      onValueChange={(v) => handleUpdateStatus(selectedTicket.ticket_id, v)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Открыт</SelectItem>
                        <SelectItem value="in_progress">В работе</SelectItem>
                        <SelectItem value="resolved">Решен</SelectItem>
                        <SelectItem value="closed">Закрыт</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-sm">
                    <p className="text-sm text-muted-foreground mb-1">Сообщение:</p>
                    <p>{selectedTicket.message}</p>
                  </div>

                  {/* Responses */}
                  {selectedTicket.responses?.length > 0 && (
                    <div className="space-y-3">
                      <p className="font-medium">Ответы:</p>
                      {selectedTicket.responses.map((resp, index) => (
                        <div key={index} className="p-3 bg-primary/5 rounded-sm border-l-2 border-primary">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{resp.admin_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(resp.created_at)}
                            </span>
                          </div>
                          <p className="text-sm">{resp.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Response Form */}
                  <div className="space-y-2 pt-4 border-t">
                    <Textarea
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      placeholder="Введите ответ..."
                      rows={3}
                    />
                    <Button 
                      onClick={handleRespond}
                      disabled={submitting || !response.trim()}
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      Отправить ответ
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mb-4 opacity-30" />
                  <p>Выберите обращение для просмотра</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default AdminTickets;
