'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';

// Database-safe phase values (must match tasks_phase_check constraint)
type TaskPhaseDB = 'planning' | 'design' | 'licensing' | 'construction' | 'finishes' | 'general' | 'done';

// Display labels in Portuguese
const PHASE_LABELS: Record<TaskPhaseDB, string> = {
  planning: 'Planeamento',
  design: 'Design',
  licensing: 'Licenças',
  construction: 'Construção',
  finishes: 'Acabamentos',
  general: 'Geral',
  done: 'Concluído',
};

const PHASES: TaskPhaseDB[] = ['planning', 'design', 'licensing', 'construction', 'finishes', 'general', 'done'];

type NewTask = {
  title: string;
  phase: TaskPhaseDB;
  dueDate?: string;
};

type NewTaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: NewTask) => void;
  defaultPhase?: TaskPhaseDB;
};

export default function NewTaskModal({ isOpen, onClose, onSubmit, defaultPhase }: NewTaskModalProps) {
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<TaskPhaseDB>(defaultPhase || 'planning');
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
    setPhase(defaultPhase || 'planning');
    onClose();
  };

  const handleClose = () => {
    // Reset form
    setTitle('');
    setDueDate('');
    setPhase(defaultPhase || 'planning');
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Adicionar Nova Tarefa"
      description="Adicione uma nova tarefa ao seu checklist"
    >
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
            onChange={(e) => setPhase(e.target.value as TaskPhaseDB)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
            required
          >
            {PHASES.map(p => (
              <option key={p} value={p}>{PHASE_LABELS[p]}</option>
            ))}
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
    </Modal>
  );
}
