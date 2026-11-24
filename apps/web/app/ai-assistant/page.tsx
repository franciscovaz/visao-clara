'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Sparkles, Loader2, AlertCircle, Lock, ListChecks, FileText, TriangleAlert, Lightbulb, type LucideIcon } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useProjectStore } from '@/src/store/projectStore';
import { supabase } from '@/lib/supabase/client';
import { getProjectPhaseLabel, getProjectTypeLabel } from '@/src/utils/projectPresentation';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface QuickPrompt {
  id: string;
  label: string;
  icon: LucideIcon;
}

const quickPrompts: QuickPrompt[] = [
  { id: 'tasks-missing', label: 'Que tarefas faltam nesta fase?', icon: ListChecks },
  { id: 'documents-needed', label: 'Que documentos preciso agora?', icon: FileText },
  { id: 'common-mistakes', label: 'Erros comuns nesta etapa da obra', icon: TriangleAlert },
  { id: 'suggest-tasks', label: 'Sugerir tarefas para esta fase', icon: Lightbulb },
];

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
  const projectType = getProjectTypeLabel(project) || 'Casa';
  const projectPhase = getProjectPhaseLabel(project) || 'Planeamento';

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

  // Display only: limit state for the usage indicator (sending is still blocked only after a 429, as before)
  const isUsageLimitReached = quotaExceeded || (!!usage && usage.quota_limit > 0 && usage.message_count >= usage.quota_limit);

  return (
    <AppLayout 
      currentPage="ai-assistant"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      {/* Fills the space AppLayout's <main> leaves (mobile: pt-20 header + pb-24 bottom nav = 11rem; desktop: p-6 = 3rem).
          dvh follows the visible viewport on mobile browsers. Header, context and messages share one scroll area;
          only the composer stays pinned, so it is always reachable, even on short screens. */}
      <div className="flex h-[calc(100dvh-11rem)] min-h-[18rem] flex-col md:h-[calc(100dvh-3rem)]">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Header (Figma) */}
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-600" aria-hidden="true" />
              <h1 className="text-2xl font-bold text-gray-900">Assistente IA</h1>
              <Badge variant="secondary">Beta</Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500">Ajuda inteligente para o teu projeto</p>
          </div>

          {/* Project context */}
          <Card className="mb-4 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
            <dl className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
              <div className="flex min-w-0 items-center gap-2">
                <dt className="font-medium text-gray-700">Projeto:</dt>
                <dd className="min-w-0 break-words text-gray-900">{projectName}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="font-medium text-gray-700">Tipo:</dt>
                <dd className="text-gray-900">{projectType}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="font-medium text-gray-700">Fase:</dt>
                <dd><Badge variant="outline">{projectPhase}</Badge></dd>
              </div>
            </dl>
            <p className="mt-2 text-xs italic text-gray-600">As respostas têm em conta o contexto do teu projeto</p>
          </Card>

          {/* Conversation */}
          <div className="space-y-4 pb-4" aria-live="polite">
            {error && !quotaExceeded && (
              <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <p className="min-w-0 wrap-anywhere">{error}</p>
              </div>
            )}

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Spinner size="lg" label={null} className="border-purple-600" />
                <p className="mt-4 text-sm text-gray-600">A carregar conversa...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center px-2 py-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                  <Sparkles className="h-8 w-8 text-purple-600" aria-hidden="true" />
                </div>
                <h2 className="mb-2 text-xl font-semibold text-gray-900">Olá! Como posso ajudar hoje?</h2>
                <p className="mb-6 max-w-md text-sm text-gray-600">
                  Estou aqui para responder às tuas dúvidas sobre o projeto e sugerir próximos passos.
                </p>
                <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                  {quickPrompts.map(prompt => {
                    const PromptIcon = prompt.icon;
                    return (
                      <Button
                        key={prompt.id}
                        variant="outline"
                        onClick={() => handleQuickPrompt(prompt)}
                        disabled={isSending || quotaExceeded}
                        className="h-auto justify-start gap-3 px-4 py-3 text-left text-sm hover:border-purple-300 hover:bg-purple-50"
                      >
                        <PromptIcon className="h-4 w-4 flex-shrink-0 text-purple-600" aria-hidden="true" />
                        <span>{prompt.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {messages.map(message => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {message.role === 'user' ? (
                      <div className="max-w-[85%] rounded-lg bg-blue-600 p-4 text-white md:max-w-[75%]">
                        <p className="whitespace-pre-wrap wrap-anywhere text-sm">{message.content}</p>
                        <span className="mt-2 block text-right text-xs text-blue-100">{message.timestamp}</span>
                      </div>
                    ) : (
                      <div className="max-w-[90%] rounded-lg border border-border bg-white p-4 md:max-w-[75%]">
                        <div className="mb-2 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-600" aria-hidden="true" />
                          <span className="text-xs font-medium text-purple-600">Assistente IA</span>
                        </div>
                        <p className="whitespace-pre-wrap wrap-anywhere text-sm text-gray-900">{message.content}</p>
                        <span className="mt-2 block text-xs text-gray-500">{message.timestamp}</span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Response being generated */}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="rounded-lg border border-border bg-white p-4" aria-busy="true">
                      <div className="mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-600" aria-hidden="true" />
                        <span className="text-xs font-medium text-purple-600">Assistente IA</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        A pensar...
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Composer: pinned below the scroll area */}
        <div className="flex-shrink-0 space-y-3 border-t border-border bg-gray-50 pt-3">
          {/* Usage (backend-owned) */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2">
            <span className="min-w-0 flex-1 text-xs font-medium text-purple-900">
              {usage ? `${usage.message_count} de ${usage.quota_limit} mensagens usadas este mês` : 'A carregar utilização...'}
            </span>
            {isUsageLimitReached && <Badge variant="destructive">Limite atingido</Badge>}
            {isUsageLimitReached && (
              <Button size="sm" onClick={() => router.push(`/${projectId}/profile?tab=plans`)} className="h-8 px-3">
                Ver planos
              </Button>
            )}
          </div>

          {quotaExceeded && (
            <div role="alert" className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
              <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" aria-hidden="true" />
              <p>{error || 'Limite de mensagens atingido este mês. Faz upgrade para continuar a usar o assistente.'}</p>
            </div>
          )}

          <div className="flex gap-2">
            <label htmlFor="ai-chat-input" className="sr-only">Mensagem para o Assistente IA</label>
            <Input
              id="ai-chat-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
              placeholder={quotaExceeded ? 'Limite atingido. Faz upgrade para continuar.' : 'Faz uma pergunta sobre a tua obra...'}
              disabled={quotaExceeded || isSending}
              className="min-w-0 flex-1"
            />
            <Button
              onClick={() => handleSendMessage(inputValue)}
              disabled={!inputValue.trim() || quotaExceeded}
              loading={isSending}
              aria-label="Enviar mensagem"
              className="h-10 w-10 flex-shrink-0 p-0"
            >
              {!isSending && <Send className="h-4 w-4" aria-hidden="true" />}
            </Button>
          </div>
          <p className="text-xs text-gray-500">Podes pedir sugestões ou tirar dúvidas</p>
        </div>
      </div>
    </AppLayout>
  );
}
