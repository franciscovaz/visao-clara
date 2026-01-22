'use client';

import { useState, useEffect } from 'react';
import { HiX } from 'react-icons/hi';

type TaskPhase = 'Planejamento' | 'Design' | 'Licenças' | 'Construção' | 'Acabamentos' | 'Concluído';

type Task = {
  id: string;
  title: string;
  phase: TaskPhase;
  dueDate?: string;
  completed: boolean;
};

type EditTaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Omit<Task, 'id' | 'completed'>) => void;
  task: Task | null;
};

export default function EditTaskModal({ isOpen, onClose, onSubmit, task }: EditTaskModalProps) {
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<TaskPhase>('Planejamento');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setPhase(task.phase);
      setDueDate(task.dueDate || '');
    }
  }, [task]);

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

    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)' }}
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <HiX className="w-5 h-5" />
        </button>

        {/* Modal Content */}
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Editar Tarefa</h2>
            <p className="text-gray-600">Altere as informações da tarefa</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title Input */}
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

            {/* Phase Select */}
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

            {/* Due Date Input */}
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

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Guardar alterações
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
