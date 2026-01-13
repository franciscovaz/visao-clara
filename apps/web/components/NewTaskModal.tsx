'use client';

import { useState, useEffect } from 'react';
import { HiX } from 'react-icons/hi';

type TaskPhase = 'Planejamento' | 'Design' | 'Licenças' | 'Construção' | 'Acabamentos' | 'Concluído';

type NewTask = {
  title: string;
  phase: TaskPhase;
  dueDate?: string;
};

type NewTaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: NewTask) => void;
  defaultPhase?: TaskPhase;
};

export default function NewTaskModal({ isOpen, onClose, onSubmit, defaultPhase }: NewTaskModalProps) {
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<TaskPhase>(defaultPhase || 'Planejamento');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (defaultPhase) {
      setPhase(defaultPhase);
    }
  }, [defaultPhase]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      return;
    }

    onSubmit({
      title: title.trim(),
      phase,
      dueDate: dueDate || undefined,
    });

    // Reset form
    setTitle('');
    setDueDate('');
    setPhase(defaultPhase || 'Planejamento');
    onClose();
  };

  const handleClose = () => {
    // Reset form
    setTitle('');
    setDueDate('');
    setPhase(defaultPhase || 'Planejamento');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.25)' }}
        onClick={handleClose}
      />
      
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <HiX className="w-5 h-5" />
        </button>

        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Adicionar Nova Tarefa</h2>
            <p className="text-gray-600">Adicione uma nova tarefa ao seu checklist</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Título da Tarefa *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
                placeholder="Digite o título da tarefa"
                required
              />
            </div>

            <div>
              <label htmlFor="phase" className="block text-sm font-medium text-gray-700 mb-2">
                Fase *
              </label>
              <select
                id="phase"
                value={phase}
                onChange={(e) => setPhase(e.target.value as TaskPhase)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
                required
              >
                <option value="Planejamento">Planejamento</option>
                <option value="Design">Design</option>
                <option value="Licenças">Licenças</option>
                <option value="Construção">Construção</option>
                <option value="Acabamentos">Acabamentos</option>
                <option value="Concluído">Concluído</option>
              </select>
            </div>

            <div>
              <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
                Prazo (opcional)
              </label>
              <input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Adicionar Tarefa
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
