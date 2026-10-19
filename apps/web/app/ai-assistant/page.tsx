'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Sparkles, ArrowRight } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useProjectStore } from '@/src/store/projectStore';
import { supabase } from '@/lib/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface QuickPrompt {
  id: string;
  label: string;
  icon: string;
}

const quickPrompts: QuickPrompt[] = [
  { id: 'tasks-missing', label: 'Que tarefas faltam nesta fase?', icon: '✨' },
  { id: 'documents-needed', label: 'Que documentos preciso agora?', icon: '📄' },
  { id: 'common-mistakes', label: 'Erros comuns nesta etapa da obra', icon: '⚠️' },
  { id: 'suggest-tasks', label: 'Sugerir tarefas para esta fase', icon: '💡' },
];

const phaseMap: Record<string, string> = {
  planning: 'Planeamento',
  design: 'Design',
  licenses: 'Licenças',
  construction: 'Construção',
  finishing: 'Acabamentos',
  completed: 'Concluído',
};

export default function AIAssistantPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ message_count: number; quota_limit: number; remaining: number } | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  
  const projectId = useProjectStore(s => s.activeProjectId);
  const { getActiveProject } = useProjectStore();
  const project = getActiveProject();
  
  const projectName = project?.name || 'Projeto';
  const projectType = project?.type || 'Casa';
  const projectPhase = project?.phase ? (phaseMap[project.phase] || project.phase) : 'Planeamento';

  // Load conversation on mount and when project changes
  useEffect(() => {
    const loadConversation = async () => {
      if (!projectId) {
        setMessages([]);
        setError('Projeto não selecionado');
        return;
      }

      setIsLoading(true);
      setError(null);
      setQuotaExceeded(false);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Sessão não encontrada. Por favor, faça login novamente.');
          return;
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const response = await fetch(
          `${supabaseUrl}/functions/v1/ai-chat-assistant?project_id=${projectId}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (response.status === 401) {
          setError('Não autorizado. Por favor, faça login novamente.');
          return;
        }

        if (response.status === 404) {
          setError('Projeto não encontrado ou acesso negado.');
          return;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Erro desconhecido');
          setError(`Erro ao carregar conversa: ${errorText}`);
          return;
        }

        const data = await response.json();
        
        if (data.usage) {
          setUsage(data.usage);
        }

        if (data.conversation && data.conversation.messages) {
          const mappedMessages: Message[] = data.conversation.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
          }));
          setMessages(mappedMessages);
        } else {
          setMessages([]);
        }
      } catch (err) {
        console.error('[AI Assistant] Error loading conversation:', err);
        setError('Erro de rede. Por favor, tente novamente.');
      } finally {
        setIsLoading(false);
      }
    };

    loadConversation();
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isSending || quotaExceeded || !projectId) return;
    
    setIsSending(true);
    setError(null);
    
    // Optimistically add user message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Sessão não encontrada. Por favor, faça login novamente.');
        setMessages(prev => prev.filter(m => m.id !== userMessage.id));
        return;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/ai-chat-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            project_id: projectId,
            message: text,
          }),
        }
      );

      if (response.status === 429) {
        setQuotaExceeded(true);
        setError('Limite de mensagens atingido este mês. Faz upgrade para continuar a usar o assistente.');
        // Refresh usage
        const usageResponse = await fetch(
          `${supabaseUrl}/functions/v1/ai-chat-assistant?project_id=${projectId}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );
        if (usageResponse.ok) {
          const usageData = await usageResponse.json();
          if (usageData.usage) {
            setUsage(usageData.usage);
          }
        }
        setMessages(prev => prev.filter(m => m.id !== userMessage.id));
        return;
      }

      if (response.status === 401) {
        setError('Não autorizado. Por favor, faça login novamente.');
        setMessages(prev => prev.filter(m => m.id !== userMessage.id));
        return;
      }

      if (response.status === 403) {
        setError('Permissões insuficientes.');
        setMessages(prev => prev.filter(m => m.id !== userMessage.id));
        return;
      }

      if (response.status === 404) {
        setError('Projeto não encontrado ou acesso negado.');
        setMessages(prev => prev.filter(m => m.id !== userMessage.id));
        return;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Erro desconhecido');
        setError(`Erro ao enviar mensagem: ${errorText}`);
        setMessages(prev => prev.filter(m => m.id !== userMessage.id));
        return;
      }

      const data = await response.json();
      
      if (data.usage) {
        setUsage(data.usage);
      }

      // Replace optimistic user message with persisted one
      const persistedUserMessage: Message = {
        id: data.user_message_id,
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      };
      
      const assistantMessage: Message = {
        id: data.assistant_message_id,
        role: 'assistant',
        content: data.assistant_response,
        timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      };
      
      setMessages(prev => [
        ...prev.filter(m => m.id !== userMessage.id),
        persistedUserMessage,
        assistantMessage,
      ]);
    } catch (err) {
      console.error('[AI Assistant] Error sending message:', err);
      setError('Erro de rede. Por favor, tente novamente.');
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickPrompt = (prompt: QuickPrompt) => {
    handleSendMessage(prompt.label);
  };

  const navigateToChecklist = () => {
    router.push(`/${projectId}/checklist`);
  };

  return (
    <AppLayout 
      currentPage="ai-assistant"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)]">
        {/* Header */}
        <div className="px-4 md:px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h1 className="text-xl font-semibold text-gray-900">Assistente IA</h1>
            <span className="px-2 py-0.5 text-xs font-medium text-purple-700 bg-purple-100 rounded-full">
              Beta
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-3">Ajuda inteligente para o teu projeto</p>
          
          {/* Context Bar */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500">Projeto:</span>
            <span className="font-medium text-gray-900">{projectName}</span>
            <span className="text-gray-300 hidden md:inline">•</span>
            <span className="text-gray-500 md:ml-2">Tipo:</span>
            <span className="font-medium text-gray-900">{projectType}</span>
            <span className="text-gray-300 hidden md:inline">•</span>
            <span className="text-gray-500 md:ml-2">Fase:</span>
            <span className="font-medium text-gray-900">{projectPhase}</span>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-600">A carregar conversa...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Olá! Como posso ajudar hoje?
              </h2>
              <p className="text-sm text-gray-600 mb-6 max-w-md">
                Estou aqui para responder às tuas dúvidas sobre o projeto e sugerir próximos passos.
              </p>
              
              {/* Quick Prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {quickPrompts.map(prompt => (
                  <button
                    key={prompt.id}
                    onClick={() => handleQuickPrompt(prompt)}
                    disabled={isSending || quotaExceeded}
                    className="flex items-center gap-3 p-4 text-left bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-lg">{prompt.icon}</span>
                    <span className="text-sm font-medium text-gray-700">{prompt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(message => (
                <div key={message.id} className="space-y-2">
                  {message.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] md:max-w-[60%] bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-br-md">
                        <p className="text-sm">{message.content}</p>
                        <span className="text-xs text-blue-200 mt-1 block text-right">
                          {message.timestamp}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div className="max-w-[90%] md:max-w-[70%] bg-white border border-gray-200 rounded-2xl rounded-bl-md shadow-sm overflow-hidden">
                        {/* Assistant Header */}
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-gray-900">Assistente IA</span>
                        </div>
                        
                        <div className="p-4">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{message.content}</p>
                        </div>
                        
                        <span className="text-xs text-gray-400 px-4 pb-3 block">
                          {message.timestamp}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Bottom Input Area */}
        <div className="border-t border-gray-200 bg-white px-4 md:px-6 py-4">
          {/* AI Usage Bar */}
          <div className="mb-3 text-center">
            <span className="text-xs text-purple-600 font-medium">
              {usage ? `${usage.message_count} de ${usage.quota_limit} mensagens usadas este mês` : 'A carregar...'}
            </span>
          </div>
          
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
              placeholder={quotaExceeded ? 'Limite atingido. Faz upgrade para continuar.' : 'Faz uma pergunta sobre a tua obra...'}
              disabled={quotaExceeded || isSending}
              className="w-full pl-4 pr-12 py-3 bg-gray-100 border-0 rounded-xl text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={() => handleSendMessage(inputValue)}
              disabled={!inputValue.trim() || isSending || quotaExceeded}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Podes pedir sugestões ou tirar dúvidas
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
