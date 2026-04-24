import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { 
  MessageCircle, 
  Plus,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  X,
  Send,
  ArrowLeft,
  Headphones
} from 'lucide-react';

export function MobileSupportPage() {
  const { api } = useAuth();
  const { language } = useLanguage();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
    if (!subject.trim() || !message.trim()) {
      setError(language === 'ru' ? 'Заполните все поля' : 'Fill all fields');
      return;
    }
    
    setSubmitting(true);
    setError('');
    try {
      await api.post('/support/tickets', { subject, message });
      setShowCreate(false);
      setSubject('');
      setMessage('');
      fetchTickets();
    } catch (error) {
      console.error('Error creating ticket:', error);
      setError(language === 'ru' ? 'Ошибка создания обращения' : 'Error creating ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'open': 
        return { 
          icon: Clock, 
          label: language === 'ru' ? 'Открыто' : 'Open',
          color: 'bg-blue-100 text-blue-700'
        };
      case 'in_progress': 
        return { 
          icon: MessageCircle, 
          label: language === 'ru' ? 'В работе' : 'In Progress',
          color: 'bg-amber-100 text-amber-700'
        };
      case 'resolved': 
        return { 
          icon: CheckCircle, 
          label: language === 'ru' ? 'Решено' : 'Resolved',
          color: 'bg-green-100 text-green-700'
        };
      case 'closed': 
        return { 
          icon: XCircle, 
          label: language === 'ru' ? 'Закрыто' : 'Closed',
          color: 'bg-gray-100 text-gray-700'
        };
      default: 
        return { 
          icon: Clock, 
          label: status,
          color: 'bg-gray-100 text-gray-700'
        };
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Create Ticket View
  if (showCreate) {
    return (
      <div className="fixed inset-0 flex flex-col bg-white" data-testid="create-ticket-view">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowCreate(false)} className="p-1">
              <X className="w-5 h-5" />
            </button>
            <h1 className="font-semibold">
              {language === 'ru' ? 'Новое обращение' : 'New Ticket'}
            </h1>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-sm text-gray-500 mb-2 block">
              {language === 'ru' ? 'Тема обращения' : 'Subject'}
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={language === 'ru' ? 'Кратко опишите проблему' : 'Brief description'}
              className="h-12"
            />
          </div>
          
          <div className="flex-1">
            <label className="text-sm text-gray-500 mb-2 block">
              {language === 'ru' ? 'Описание' : 'Description'}
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={language === 'ru' ? 'Опишите вашу проблему подробно...' : 'Describe your issue in detail...'}
              className="min-h-[200px] resize-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl">
              {error}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
          <Button 
            onClick={handleCreateTicket}
            disabled={submitting || !subject.trim() || !message.trim()}
            className="w-full h-12"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {language === 'ru' ? 'Отправить' : 'Submit'}
          </Button>
        </div>
      </div>
    );
  }

  // Ticket Detail View
  if (showDetail) {
    const status = getStatusConfig(showDetail.status);
    const StatusIcon = status.icon;

    return (
      <div className="fixed inset-0 flex flex-col bg-white" data-testid="ticket-detail-view">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowDetail(null)} className="p-1">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold truncate">{showDetail.subject}</h1>
              <p className="text-xs text-gray-500">{showDetail.ticket_id}</p>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Original Message */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-700">{showDetail.message}</p>
            <p className="text-xs text-gray-400 mt-2">{formatDate(showDetail.created_at)}</p>
          </div>

          {/* Responses */}
          {showDetail.responses?.map((response, index) => (
            <div 
              key={index} 
              className={`rounded-xl p-4 ${
                response.from === 'admin' 
                  ? 'bg-primary/10 ml-4' 
                  : 'bg-gray-50 mr-4'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">
                  {response.from === 'admin' 
                    ? (language === 'ru' ? 'Поддержка' : 'Support')
                    : (language === 'ru' ? 'Вы' : 'You')}
                </span>
                <span className="text-xs text-gray-400">{formatDate(response.created_at)}</span>
              </div>
              <p className="text-sm text-gray-700">{response.message}</p>
            </div>
          ))}

          {!showDetail.responses?.length && (
            <div className="text-center py-8">
              <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {language === 'ru' ? 'Ожидайте ответа...' : 'Waiting for response...'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Main List View
  return (
    <div className="fixed inset-0 flex flex-col bg-gray-50" data-testid="mobile-support-page">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Headphones className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">
                {language === 'ru' ? 'Поддержка' : 'Support'}
              </h1>
              <p className="text-xs text-gray-500">
                {language === 'ru' ? 'Помощь 24/7' : 'Help 24/7'}
              </p>
            </div>
          </div>
          <Button 
            onClick={() => setShowCreate(true)}
            size="sm"
            className="h-9"
          >
            <Plus className="w-4 h-4 mr-1" />
            {language === 'ru' ? 'Новое' : 'New'}
          </Button>
        </div>
      </div>

      {/* Tickets List */}
      <div className="flex-1 overflow-y-auto">
        {tickets.length > 0 ? (
          <div className="p-4 space-y-3">
            {tickets.map((ticket) => {
              const status = getStatusConfig(ticket.status);
              const StatusIcon = status.icon;
              
              return (
                <button
                  key={ticket.ticket_id}
                  onClick={() => setShowDetail(ticket)}
                  className="w-full bg-white rounded-xl p-4 text-left shadow-sm active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${status.color}`}>
                      <StatusIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{ticket.subject}</h3>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-1">{ticket.message}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">{formatDate(ticket.created_at)}</span>
                        {ticket.responses?.length > 0 && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {ticket.responses.length} {language === 'ru' ? 'ответ' : 'reply'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">
              {language === 'ru' ? 'Нет обращений' : 'No tickets'}
            </h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              {language === 'ru' 
                ? 'Создайте обращение, если у вас есть вопросы'
                : 'Create a ticket if you have questions'}
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {language === 'ru' ? 'Создать обращение' : 'Create Ticket'}
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}

export default MobileSupportPage;
