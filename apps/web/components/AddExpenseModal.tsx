'use client';

import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatDateForStorage } from '@/src/utils/dateUtils';
interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expense: {
    description: string;
    amount: number;
    date: string;
    category: string;
    supplier: string;
    warrantyExpiresAt?: string;
  }) => void;
}

export default function AddExpenseModal({ isOpen, onClose, onSubmit }: AddExpenseModalProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [supplier, setSupplier] = useState('');
  const [hasWarranty, setHasWarranty] = useState(false);
  const [warrantyDate, setWarrantyDate] = useState('');
  const [warrantyError, setWarrantyError] = useState('');

  const categories = ['Materiais', 'Mão de obra', 'Equipamentos', 'Aluguer', 'Taxas', 'Outros'];

  // Set default category on open
  useEffect(() => {
    if (isOpen && !category) {
      setCategory('Materiais');
    }
  }, [isOpen, category]);

  const handleSubmit = () => {
    if (hasWarranty && !warrantyDate) {
      setWarrantyError('A data de garantia é obrigatória quando tem garantia');
      return;
    }
    setWarrantyError('');
    
    onSubmit({
      description,
      amount: parseFloat(amount) || 0,
      date,
      category,
      supplier,
      warrantyExpiresAt: hasWarranty ? warrantyDate : undefined,
    });
    
    // Reset form
    setDescription('');
    setAmount('');
    setDate('');
    setCategory('Materiais');
    setSupplier('');
    setHasWarranty(false);
    setWarrantyDate('');
    setWarrantyError('');
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Adicionar Despesa">
      <div className="space-y-4">
        <div>
          <label htmlFor="expense-description" className="block text-sm font-medium text-gray-700 mb-2">
            Descrição
          </label>
          <Input
            id="expense-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Compra de materiais"
          />
        </div>

        <div>
          <label htmlFor="expense-amount" className="block text-sm font-medium text-gray-700 mb-2">
            Valor (€)
          </label>
          <Input
            id="expense-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
          />
        </div>

        <div>
          <label htmlFor="expense-date" className="block text-sm font-medium text-gray-700 mb-2">
            Data
          </label>
          <Input
            id="expense-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="expense-category" className="block text-sm font-medium text-gray-700 mb-2">
            Categoria
          </label>
          <Select
            id="expense-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="expense-supplier" className="block text-sm font-medium text-gray-700 mb-2">
            Fornecedor
          </label>
          <Input
            id="expense-supplier"
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
              id="has-warranty"
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
            <label htmlFor="has-warranty" className="text-sm font-medium text-gray-700">
              Tem garantia
            </label>
          </div>
          
          {hasWarranty && (
            <div className="ml-7">
              <label htmlFor="expense-warranty-date" className="block text-sm font-medium text-gray-700 mb-2">
                Garantia até
              </label>
              <Input
                id="expense-warranty-date"
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
      </div>

      {/* mt-6 (a margin, as before) so it collapses with the warranty row's bottom margin: same 24px gap */}
      <ModalFooter className="mt-6 pt-0">
        <Button type="button" size="full" onClick={handleSubmit}>
          Adicionar Despesa
        </Button>
      </ModalFooter>
    </Modal>
  );
}
