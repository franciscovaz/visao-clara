'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Sparkles, CheckSquare, ArrowRight, Plus } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useProjectStore } from '@/src/store/projectStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedTasks?: string[];
  tasksAdded?: number;
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

const mockAIResponses: Record<string, (projectName: string, phase: string, projectType: string) => { text: string; tasks: string[] }> = {
  'tasks-missing': (name, phase, type) => ({
    text: `Tens 5 tarefas pendentes na fase de ${phase} para o projeto ${name}. As tarefas mais importantes são:`,
    tasks: [
      `Finalizar especificações técnicas do ${type}`,
      `Revisar plano de execução da fase ${phase}`,
      `Agendar reunião de coordenação com equipa`,
      `Confirmar disponibilidade de materiais`,
      `Atualizar cronograma de trabalhos`,
    ],
  }),
  'documents-needed': (name, phase, type) => ({
    text: `Para a fase de ${phase} do projeto ${name}, precisas dos seguintes documentos:`,
    tasks: [
      `Licença de construção atualizada`,
      `Certificado de segurança das instalações`,
      `Relatório de impacte ambiental`,
      `Plano de segurança e saúde no trabalho`,
      `Seguro de responsabilidade civil da obra`,
    ],
  }),
  'common-mistakes': (name, phase, type) => ({
    text: `Na fase de ${phase} de um projeto tipo ${type}, os erros mais comuns a evitar são:`,
    tasks: [
      `Não verificar compatibilidade de materiais`,
      `Ignorar prazos de entrega de fornecedores`,
      `Esquecer documentação fotográfica do antes/depois`,
      `Falta de coordenação entre especialidades`,
      `Subestimar tempo de secagem/acabamento`,
    ],
  }),
  'suggest-tasks': (name, phase, type) => ({
    text: `Sugiro estas tarefas para a fase de ${phase} do teu projeto ${name}:`,
    tasks: [
      `Definir especificações detalhadas do ${type}`,
      `Solicitar orçamentos a 3 fornecedores`,
      `Preparar documentação para aprovações`,
      `Marcar inspeção técnica no local`,
      `Confirmar disponibilidade da equipa de trabalho`,
    ],
  }),
  default: (name, phase, type) => ({
    text: `Posso ajudar-te com o projeto ${name} na fase de ${phase}. Aqui estão algumas sugestões:`,
    tasks: [
      `Revisar checklist da fase atual`,
      `Verificar documentação necessária`,
      `Consultar próximos passos recomendados`,
      `Analisar potenciais riscos`,
      `Sugerir melhorias no planeamento`,
    ],
  }),
};

function generateMockResponse(prompt: string, projectName: string, phase: string, projectType: string): { text: string; tasks: string[] } {
  const key = Object.keys(mockAIResponses).find(k => prompt.toLowerCase().includes(k.replace('-', ' '))) || 'default';
  const responseFn = mockAIResponses[key] || mockAIResponses.default;
  return responseFn(projectName, phase, projectType);
}

export default function AIAssistantPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const projectId = useProjectStore(s => s.activeProjectId);
  const { getActiveProject, addTask } = useProjectStore();
  const project = getActiveProject();
  
  const projectName = project?.name || 'Projeto';
  const projectType = project?.type || 'Casa';
  const projectPhase = project?.phase ? (phaseMap[project.phase] || project.phase) : 'Planeamento';
  
  const aiCreditsUsed = 0;
  const aiCreditsTotal = 10;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    setTimeout(() => {
      const response = generateMockResponse(text, projectName, projectPhase, projectType);
      const assistantMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: response.text,
        timestamp: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        suggestedTasks: response.tasks,
      };
      setMessages(prev => [...prev, assistantMessage]);
    }, 800);
  };

  const handleQuickPrompt = (prompt: QuickPrompt) => {
    handleSendMessage(prompt.label);
  };

  const toggleTaskSelection = (messageId: string, taskIndex: number) => {
    const key = `${messageId}-${taskIndex}`;
    setSelectedTasks(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleAddTasks = (messageId: string, tasks: string[]) => {
    const selectedIndices = tasks
      .map((_, index) => ({ key: `${messageId}-${index}`, index }))
      .filter(({ key }) => selectedTasks[key])
      .map(({ index }) => index);
    
    const tasksToAdd = selectedIndices.length > 0 
      ? selectedIndices.map(i => tasks[i])
      : tasks;
    
    tasksToAdd.forEach(title => {
      addTask(projectId, {
        title,
        phase: projectPhase,
      });
    });
    
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, tasksAdded: tasksToAdd.length }
        : msg
    ));
    
    const newSelected = { ...selectedTasks };
    tasks.forEach((_, index) => {
      delete newSelected[`${messageId}-${index}`];
    });
    setSelectedTasks(newSelected);
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
          {messages.length === 0 ? (
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
                    className="flex items-center gap-3 p-4 text-left bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-sm transition-all"
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
                          <p className="text-sm text-gray-700 mb-4">{message.content}</p>
                          
                          {message.suggestedTasks && message.suggestedTasks.length > 0 && (
                            <div className="space-y-2 mb-4">
                              {message.suggestedTasks.map((task, index) => (
                                <label 
                                  key={index} 
                                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!selectedTasks[`${message.id}-${index}`]}
                                    onChange={() => toggleTaskSelection(message.id, index)}
                                    className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-700">{task}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          
                          {message.tasksAdded ? (
                            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                              <CheckSquare className="w-4 h-4" />
                              <span>✅ {message.tasksAdded} tarefas adicionadas</span>
                            </div>
                          ) : message.suggestedTasks && (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                onClick={() => handleAddTasks(message.id, message.suggestedTasks!)}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                                Adicionar tarefas
                              </button>
                            </div>
                          )}
                          
                          {/* Action Links */}
                          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                            <button
                              onClick={navigateToChecklist}
                              className="flex items-center gap-1 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                            >
                              <CheckSquare className="w-4 h-4" />
                              Ver checklist completo
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
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
              {aiCreditsUsed} de {aiCreditsTotal} interações IA usadas este mês
            </span>
          </div>
          
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
              placeholder="Faz uma pergunta sobre a tua obra..."
              className="w-full pl-4 pr-12 py-3 bg-gray-100 border-0 rounded-xl text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
            />
            <button
              onClick={() => handleSendMessage(inputValue)}
              disabled={!inputValue.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
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
