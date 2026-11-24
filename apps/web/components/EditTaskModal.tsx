'use client';

import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
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

type Task = {
  id: string;
  title: string;
  phase: TaskPhaseDB;
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
  const [phase, setPhase] = useState<TaskPhaseDB>('planning');
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

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Editar Tarefa"
      description="Altere as informações da tarefa"
    >
      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title Input */}
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

        {/* Phase Select */}
        <div>
          <label htmlFor="phase" className="block text-sm font-medium text-gray-700 mb-2">
            Fase
          </label>
          <Select
            id="phase"
            value={phase}
            onChange={(e) => setPhase(e.target.value as TaskPhaseDB)}
          >
            {PHASES.map(p => (
              <option key={p} value={p}>{PHASE_LABELS[p]}</option>
            ))}
          </Select>
        </div>

        {/* Due Date Input */}
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

        {/* Action Buttons */}
        <ModalFooter>
          <Button type="button" variant="outline" size="sm" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" size="sm" className="flex-1">
            Guardar alterações
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
