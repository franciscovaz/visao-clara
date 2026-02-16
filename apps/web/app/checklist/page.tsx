'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Trash, Plus, Pencil, CheckSquare, Sparkles, Wand2, Crown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import NewTaskModal from '@/components/NewTaskModal';
import EditTaskModal from '@/components/EditTaskModal';
import AppLayout from '@/components/AppLayout';
import { useProjectStore } from '@/src/store/projectStore';
import ProjectHeader from '@/src/components/ProjectHeader';

type TaskPhase = 'Planeamento' | 'Design' | 'Licenças' | 'Construção' | 'Acabamentos' | 'Geral' | 'Concluído';

type Task = {
  id: string;
  title: string;
  phase: TaskPhase;
  dueDate?: string;
  completed: boolean;
};

type AISuggestion = {
  id: string;
  title: string;
  phase: TaskPhase;
  priority: 'Alta' | 'Média' | 'Baixa';
  reason: string;
};

export default function ChecklistPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TaskPhase>('Planeamento');
  const [showCompleted, setShowCompleted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // AI Suggestions state
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [selectedAiPhase, setSelectedAiPhase] = useState<TaskPhase>('Planeamento');
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState<string | null>(null);
  
  const projectId = useProjectStore(s => s.activeProjectId);
  const billing = useProjectStore(s => s.billing);
  const { getTasksForProject, toggleTaskCompletion, addTask, updateTask, getActiveProject, incrementAICredits, getLimit } = useProjectStore();
  const tasks = getTasksForProject(projectId);
  const project = getActiveProject();

  // AI Credits from store
  const aiCreditsUsed = billing.aiCreditsUsedThisMonth;
  const aiCreditsTotal = getLimit('aiCreditsMonthly');
  const isUnlimited = aiCreditsTotal === 'unlimited';
  const hasReachedLimit = !isUnlimited && aiCreditsUsed >= (aiCreditsTotal as number);

  // Calculate task counts dynamically (exclude completed tasks)
  const getTaskCounts = () => {
    const counts: Record<string, number> = {};
    const phases: TaskPhase[] = ['Planeamento', 'Design', 'Licenças', 'Construção', 'Acabamentos', 'Geral', 'Concluído'];
    
    phases.forEach(phase => {
      counts[phase] = tasks.filter(task => task.phase === phase && !task.completed).length;
    });
    
    return counts;
  };

  const taskCounts = getTaskCounts();

  const phaseTabs = [
    { id: 'Planeamento', label: 'Planeamento', count: taskCounts['Planeamento'] || 0 },
    { id: 'Design', label: 'Design', count: taskCounts['Design'] || 0 },
    { id: 'Licenças', label: 'Licenças', count: taskCounts['Licenças'] || 0 },
    { id: 'Construção', label: 'Construção', count: taskCounts['Construção'] || 0 },
    { id: 'Acabamentos', label: 'Acabamentos', count: taskCounts['Acabamentos'] || 0 },
    { id: 'Geral', label: 'Geral', count: taskCounts['Geral'] || 0 },
    { id: 'Concluído', label: 'Concluído', count: taskCounts['Concluído'] || 0 },
  ];

  const currentTasks = tasks
    .filter(task => task.phase === activeTab)
    .filter(task => showCompleted || !task.completed);

  const totalPendingTasks = tasks.filter(task => !task.completed).length;

  const handleAddTask = (newTask: Omit<Task, 'id' | 'completed'>) => {
    addTask(projectId, newTask);
  };

  const handleDeleteTask = (taskId: string) => {
    console.log('Delete task:', taskId);
    // TODO: Implement actual task deletion when state management is added
    // For now, just log the deletion since we're using static mock data
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  const handleUpdateTask = (updatedTask: Omit<Task, 'id' | 'completed'>) => {
    if (!editingTask) return;
    updateTask(projectId, editingTask.id, updatedTask);
    setIsEditModalOpen(false);
    setEditingTask(null);
  };

  const handleToggleTask = (taskId: string) => {
    toggleTaskCompletion(projectId, taskId);
  };

  const mockSuggestionGenerator = (phase: TaskPhase, projectName: string): AISuggestion[] => {
    const baseSuggestions: Record<TaskPhase, { title: string; priority: 'Alta' | 'Média' | 'Baixa'; reason: string }[]> = {
      Planeamento: [
        { title: 'Contratar arquiteto licenciado', priority: 'Alta', reason: 'Obrigatório para projetos de casas' },
        { title: 'Aprovar plantas arquitetónicas', priority: 'Alta', reason: 'Essencial antes de avançar para licenças' },
        { title: 'Definir materiais de construção', priority: 'Média', reason: 'Comum nesta fase para casas' },
        { title: 'Planear distribuição de divisões', priority: 'Alta', reason: 'Fundamental para o projeto' },
        { title: 'Escolher sistemas de climatização', priority: 'Média', reason: 'Necessário para orçamentação' },
      ],
      Design: [
        { title: 'Revisar propostas de design', priority: 'Alta', reason: 'Antes de aprovar orçamentos' },
        { title: 'Selecionar acabamentos interiores', priority: 'Média', reason: 'Impacta no prazo de entrega' },
        { title: 'Aprovar mockups 3D', priority: 'Alta', reason: 'Evita alterações em obra' },
        { title: 'Confirmar mobiliário', priority: 'Média', reason: 'Prazos de fabrico longos' },
        { title: 'Definir iluminação', priority: 'Média', reason: 'Afeta instalações elétricas' },
      ],
      Licenças: [
        { title: 'Pedir licença de construção', priority: 'Alta', reason: 'Obrigatório antes de iniciar obra' },
        { title: 'Obter alvará de lote', priority: 'Alta', reason: 'Necessário para legalização' },
        { title: 'Aprovação da CM', priority: 'Alta', reason: 'Requerido para novas construções' },
        { title: 'Certificado energético', priority: 'Média', reason: 'Obrigatório para habitação' },
        { title: 'Licença de estaleiro', priority: 'Média', reason: 'Para obras de grande dimensão' },
      ],
      Construção: [
        { title: 'Marcar início de fundações', priority: 'Alta', reason: 'Ponto crítico do projeto' },
        { title: 'Inspeção de estrutura', priority: 'Alta', reason: 'Segurança estrutural' },
        { title: 'Instalações elétricas', priority: 'Alta', reason: 'Não pode ser adiado' },
        { title: 'Redes hidráulicas', priority: 'Média', reason: 'Interdependente com outras' },
        { title: 'Isolamento térmico', priority: 'Média', reason: 'Antes de fechar paredes' },
      ],
      Acabamentos: [
        { title: 'Escolher pavimentos', priority: 'Alta', reason: 'Impacto visual final' },
        { title: 'Pinturas finais', priority: 'Média', reason: 'Etapa demorada' },
        { title: 'Instalação de cozinha', priority: 'Alta', reason: 'Coordenação com fornecedores' },
        { title: 'Sanitários e loiças', priority: 'Média', reason: 'Prazos de entrega' },
        { title: 'Limpeza final', priority: 'Baixa', reason: 'Preparação para entrega' },
      ],
      Geral: [
        { title: 'Reunião de coordenação', priority: 'Alta', reason: 'Sincronizar equipas' },
        { title: 'Atualização de cronograma', priority: 'Média', reason: 'Manter prazos realistas' },
        { title: 'Verificação de segurança', priority: 'Alta', reason: 'Obrigatório mensal' },
        { title: 'Documentação fotográfica', priority: 'Baixa', reason: 'Para arquivo' },
        { title: 'Relatório de progresso', priority: 'Média', reason: 'Para cliente' },
      ],
      Concluído: [
        { title: 'Vistoria final', priority: 'Alta', reason: 'Antes da entrega' },
        { title: 'Obter certificado final', priority: 'Alta', reason: 'Para legalização' },
        { title: 'Entrega ao cliente', priority: 'Alta', reason: 'Formalização' },
        { title: 'Arquivar documentação', priority: 'Média', reason: 'Para futuras referências' },
        { title: 'Garantia de obra', priority: 'Média', reason: 'Documento importante' },
      ],
    };

    const suggestions = baseSuggestions[phase] || baseSuggestions.Geral;
    return suggestions.map((s, i) => ({
      id: `ai_sugg_${Date.now()}_${i}`,
      title: s.title,
      phase,
      priority: s.priority,
      reason: s.reason,
    }));
  };

  const handleGenerateSuggestions = () => {
    if (hasReachedLimit) return;
    
    const suggestions = mockSuggestionGenerator(selectedAiPhase, project?.name || 'Projeto');
    setAiSuggestions(suggestions);
    incrementAICredits();
    setHasGenerated(true);
    setSelectedSuggestions(new Set());
    setShowConfirmation(null);
  };

  const handleSelectAll = () => {
    if (selectedSuggestions.size === aiSuggestions.length) {
      setSelectedSuggestions(new Set());
    } else {
      setSelectedSuggestions(new Set(aiSuggestions.map(s => s.id)));
    }
  };

  const toggleSuggestion = (id: string) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
  });
  };

  const handleAddSelectedTasks = () => {
    const tasksToAdd = aiSuggestions.filter(s => selectedSuggestions.has(s.id));
    
    tasksToAdd.forEach(suggestion => {
      addTask(projectId, {
        title: suggestion.title,
        phase: suggestion.phase,
      });
    });
    
    setShowConfirmation(`✅ ${tasksToAdd.length} tarefas adicionadas`);
    setSelectedSuggestions(new Set());
    
    setTimeout(() => setShowConfirmation(null), 3000);
  };

  const handleLoadMore = () => {
    if (hasReachedLimit) return;
    const moreSuggestions = mockSuggestionGenerator(selectedAiPhase, project?.name || 'Projeto');
    setAiSuggestions(prev => [...prev, ...moreSuggestions.map((s: AISuggestion, i: number) => ({ ...s, id: `${s.id}_more_${i}` }))]);
    incrementAICredits();
  };

  return (
    <AppLayout 
      currentPage="checklist"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      {/* Project Header */}
      <ProjectHeader />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Checklist</h1>
          <p className="text-gray-600 text-lg">{totalPendingTasks} tarefas pendentes</p>
        </div>
        <div className="flex items-center space-x-4 mt-4 sm:mt-0">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Mostrar concluídas</span>
          </label>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Tarefa</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {phaseTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {currentTasks.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {phaseTabs.find(tab => tab.id === activeTab)?.label}
            </h3>
            {currentTasks.map((task) => (
              <div key={task.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => handleToggleTask(task.id)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
                <div className="flex-1">
                  <h4 className={`font-medium text-gray-900 ${task.completed ? 'line-through opacity-60' : ''}`}>
                    {task.title}
                  </h4>
                  {task.dueDate && (
                    <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                      <Calendar className="w-4 h-4" />
                      <span className={task.completed ? 'opacity-60' : ''}>Prazo: {task.dueDate}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => handleEditTask(task)}
                    className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CheckSquare className="w-8 h-8" />}
            title="Sem tarefas no checklist"
            description="As tarefas do projeto irão aparecer aqui."
          />
        )}
      </div>

      {/* AI Suggestions Section */}
      <Card className="mt-6 overflow-hidden">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Sugestões com IA</h2>
            </div>
            <span className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded-full">
              Beta
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Sugestões de tarefas para esta fase com base no teu projeto
          </p>
        </div>

        {/* AI Usage Bar */}
        <div className="px-4 md:px-6 py-3 bg-purple-50/50 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-700">
              {isUnlimited 
                ? 'Sugestões IA ilimitadas'
                : `${aiCreditsUsed} de ${aiCreditsTotal} sugestões IA usadas este mês`
              }
            </span>
            {!isUnlimited && (
              <span className="text-xs text-purple-600">
                {Math.max(0, (aiCreditsTotal as number) - aiCreditsUsed)} restantes
              </span>
            )}
          </div>
          <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-600 rounded-full transition-all duration-300"
              style={{ width: isUnlimited ? '100%' : `${Math.min(100, (aiCreditsUsed / (aiCreditsTotal as number)) * 100)}%` }}
            />
          </div>
          
          {/* Upgrade CTA when limit reached */}
          {hasReachedLimit && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Crown className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-amber-900 text-sm">
                    Limite de sugestões atingido
                  </h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Faz upgrade para o plano Pro para sugestões ilimitadas.
                  </p>
                  <button
                    onClick={() => router.push(`/${projectId}/profile?tab=plans`)}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Ver planos
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 md:p-6 border-b border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Fase</label>
              <select
                value={selectedAiPhase}
                onChange={(e) => setSelectedAiPhase(e.target.value as TaskPhase)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-gray-900 bg-white"
              >
                <option value="Planeamento">Planeamento</option>
                <option value="Design">Design</option>
                <option value="Licenças">Licenças</option>
                <option value="Construção">Construção</option>
                <option value="Acabamentos">Acabamentos</option>
                <option value="Geral">Geral</option>
                <option value="Concluído">Concluído</option>
              </select>
            </div>
            <div className="md:pt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2 md:hidden">Ação</label>
              <button
                onClick={handleGenerateSuggestions}
                disabled={hasReachedLimit}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>Gerar sugestões</span>
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="p-4 md:p-6">
          {!hasGenerated ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wand2 className="w-6 h-6 text-purple-600" />
              </div>
              <p className="text-sm text-gray-500">
                Seleciona a fase e clica em "Gerar sugestões" para começar
              </p>
            </div>
          ) : (
            <>
              {/* Results Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-600">
                  {aiSuggestions.length} sugestões encontradas
                </span>
                <button
                  onClick={handleSelectAll}
                  className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                >
                  {selectedSuggestions.size === aiSuggestions.length ? 'Desselecionar tudo' : 'Selecionar tudo'}
                </button>
              </div>

              {/* Confirmation Message */}
              {showConfirmation && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                  {showConfirmation}
                </div>
              )}

              {/* Suggestions List */}
              <div className="space-y-3 mb-6">
                {aiSuggestions.map((suggestion) => (
                  <label
                    key={suggestion.id}
                    className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSuggestions.has(suggestion.id)}
                      onChange={() => toggleSuggestion(suggestion.id)}
                      className="mt-0.5 w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 text-sm mb-1">
                        {suggestion.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-500">Fase: {suggestion.phase}</span>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${
                          suggestion.priority === 'Alta' 
                            ? 'bg-red-100 text-red-700'
                            : suggestion.priority === 'Média'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          Prioridade: {suggestion.priority}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 italic">
                        Motivo: {suggestion.reason}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleAddSelectedTasks}
                  disabled={selectedSuggestions.size === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar tarefas selecionadas
                </button>
                <button
                  onClick={handleLoadMore}
                  disabled={hasReachedLimit}
                  className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  Ver mais sugestões
                </button>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* New Task Modal */}
      <NewTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddTask}
        defaultPhase={activeTab}
      />

      <EditTaskModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleUpdateTask}
        task={editingTask}
      />
    </AppLayout>
  );
}
