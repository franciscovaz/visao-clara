'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

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
          <Input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Digite o título da tarefa"
            required
          />
        </div>

        <div>
          <label htmlFor="phase" className="block text-sm font-medium text-gray-700 mb-2">
            Fase *
          </label>
          <Select
            id="phase"
            value={phase}
            onChange={(e) => setPhase(e.target.value as TaskPhaseDB)}
            required
          >
            {PHASES.map(p => (
              <option key={p} value={p}>{PHASE_LABELS[p]}</option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
            Prazo (opcional)
          </label>
          <Input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <Button type="submit" size="sm" className="w-full">
          Adicionar Tarefa
        </Button>
      </form>
    </Modal>
  );
}
