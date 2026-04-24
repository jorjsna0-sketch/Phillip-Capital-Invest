import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { MobileSupportPage } from './MobileSupportPage';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { 
  MessageCircle, 
  Plus,
  Loader2,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

// Hook to detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
}

export function SupportPage() {
  const isMobile = useIsMobile();
  const { api, user } = useAuth();
  const { t, formatDateTime, language } = useLanguage();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await api.get('/support/tickets');
      setTickets(response.data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!subject.trim() || !message.trim()) return;
    
    setSubmitting(true);
    try {
      await api.post('/support/tickets', { subject, message });
      setCreateOpen(false);
      setSubject('');
      setMessage('');
      fetchTickets();
    } catch (error) {
      console.error('Error creating ticket:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <Clock className="w-4 h-4" />;
      case 'in_progress': return <MessageCircle className="w-4 h-4" />;
      case 'resolved': return <CheckCircle className="w-4 h-4" />;
      case 'closed': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_progress': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'resolved': return 'bg-green-100 text-green-700 border-green-200';
      case 'closed': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return '';
    }
  };

  // Mobile version - MobileSupportPage handles its own full-screen layout
  if (isMobile) {
    return <MobileSupportPage />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8" data-testid="support-page">
      <div className="container-premium">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-h2 text-primary">{t('support_title')}</h1>
            <p className="text-muted-foreground">{t('support_subtitle')}</p>
          </div>
          
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary" data-testid="create-ticket-btn">
                <Plus className="w-4 h-4 mr-2" />
                {t('create_ticket')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('create_ticket')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t('ticket_subject')}</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Тема обращения"
                    data-testid="ticket-subject-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('ticket_message')}</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Опишите вашу проблему или вопрос..."
                    rows={5}
                    data-testid="ticket-message-input"
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleCreateTicket}
                  disabled={submitting}
                  data-testid="ticket-submit-btn"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('submit')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tickets List */}
        <div className="grid gap-4">
          {tickets.length > 0 ? (
            tickets.map((ticket) => (
              <Card 
                key={ticket.ticket_id} 
                className="card-premium cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedTicket(selectedTicket?.ticket_id === ticket.ticket_id ? null : ticket)}
                data-testid={`ticket-${ticket.ticket_id}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={`${getStatusBadge(ticket.status)} flex items-center gap-1`}>
                          {getStatusIcon(ticket.status)}
                          {t(`ticket_status_${ticket.status}`)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {ticket.ticket_id}
                        </span>
                      </div>
                      <h3 className="font-medium text-lg">{ticket.subject}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {ticket.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDateTime(ticket.created_at)}
                      </p>
                    </div>
                    {ticket.responses?.length > 0 && (
                      <Badge variant="secondary" className="ml-4">
                        {ticket.responses.length} ответ(ов)
                      </Badge>
                    )}
                  </div>

                  {/* Expanded View */}
                  {selectedTicket?.ticket_id === ticket.ticket_id && ticket.responses?.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      {ticket.responses.map((response, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{response.admin_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(response.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{response.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="card-premium">
              <CardContent className="py-12 text-center">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Нет обращений</h3>
                <p className="text-muted-foreground mb-4">
                  Создайте обращение, если у вас есть вопросы
                </p>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('create_ticket')}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupportPage;
