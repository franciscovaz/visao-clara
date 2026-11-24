'use client';

import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
type Expense = {
  id: string;
  description: string;
  supplier: string;
  category: string;
  date: string;
  amount: number;
  warrantyExpiresAt?: string;
};

type EditExpenseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expense: Expense) => void;
  expense: Expense | null;
};

export default function EditExpenseModal({ isOpen, onClose, onSubmit, expense }: EditExpenseModalProps) {
  const [description, setDescription] = useState('');
  const [supplier, setSupplier] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [hasWarranty, setHasWarranty] = useState(false);
  const [warrantyDate, setWarrantyDate] = useState('');
  const [warrantyError, setWarrantyError] = useState('');

  const categories = ['Materiais', 'Mão de obra', 'Equipamentos', 'Aluguer', 'Taxas', 'Outros'];

  useEffect(() => {
    if (expense) {
      setDescription(expense.description);
      setSupplier(expense.supplier);
      setCategory(expense.category);
      setDate(expense.date);
      setAmount(expense.amount.toString());
      setHasWarranty(!!expense.warrantyExpiresAt);
      setWarrantyDate(expense.warrantyExpiresAt || '');
      setWarrantyError('');
    }
  }, [expense]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim() || !amount || parseFloat(amount) <= 0 || !expense) {
      return;
    }
    
    if (hasWarranty && !warrantyDate) {
      setWarrantyError('A data de garantia é obrigatória quando tem garantia');
      return;
    }
    setWarrantyError('');

    onSubmit({
      id: expense.id,
      description: description.trim(),
      supplier: supplier.trim(),
      category,
      date,
      amount: parseFloat(amount),
      warrantyExpiresAt: hasWarranty ? warrantyDate : undefined,
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
      title="Editar Despesa"
      description="Altere as informações da despesa"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Descrição *
          </label>
          <Input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Compra de materiais"
            required
          />
        </div>

        {/* Amount */}
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
            Valor (€) *
          </label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        {/* Date */}
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
            Data *
          </label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
            Categoria *
          </label>
          <Select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
        </div>

        {/* Supplier */}
        <div>
          <label htmlFor="supplier" className="block text-sm font-medium text-gray-700 mb-2">
            Fornecedor
          </label>
          <Input
            id="supplier"
            type="text"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Ex: Leroy Merlin"
          />
        </div>

        {/* Warranty Section */}
        <div className="pt-2 border-t border-gray-200">
          <div className="flex items-center space-x-3 mb-3">
            <input
              type="checkbox"
              id="has-warranty-edit"
              checked={hasWarranty}
              onChange={(e) => {
                setHasWarranty(e.target.checked);
                if (!e.target.checked) {
                  setWarrantyDate('');
                  setWarrantyError('');
                }
              }}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="has-warranty-edit" className="text-sm font-medium text-gray-700">
              Tem garantia
            </label>
          </div>
          
          {hasWarranty && (
            <div className="ml-7">
              <label htmlFor="warranty-date-edit" className="block text-sm font-medium text-gray-700 mb-2">
                Garantia até
              </label>
              <Input
                id="warranty-date-edit"
                aria-invalid={warrantyError ? true : undefined}
                type="date"
                value={warrantyDate}
                onChange={(e) => {
                  setWarrantyDate(e.target.value);
                  if (e.target.value) setWarrantyError('');
                }}
                required={hasWarranty}
              />
              {warrantyError && (
                <p className="mt-1 text-sm text-red-600">{warrantyError}</p>
              )}
            </div>
          )}
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
