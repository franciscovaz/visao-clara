'use client';

import { useState, useEffect } from 'react';
import { HiX } from 'react-icons/hi';
import { useProjectStore } from '@/src/store/projectStore';

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

  // Get project categories from store (same as AddExpenseModal)
  const { activeProjectId, getActiveExpenseCategoriesForProject } = useProjectStore();
  const projectCategories = getActiveExpenseCategoriesForProject(activeProjectId);

  // Set default category when categories are loaded
  useEffect(() => {
    if (projectCategories.length > 0 && !category) {
      setCategory(projectCategories[0].name);
    }
  }, [projectCategories, category]);

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
            <h2 className="text-xl font-bold text-gray-900 mb-2">Editar Despesa</h2>
            <p className="text-gray-600">Altere as informações da despesa</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Descrição *
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
                placeholder="Ex: Compra de materiais"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Valor (€) *
              </label>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
                placeholder="0.00"
                required
              />
            </div>

            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                Data *
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Categoria *
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
                required
              >
                {projectCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Supplier */}
            <div>
              <label htmlFor="supplier" className="block text-sm font-medium text-gray-700 mb-2">
                Fornecedor
              </label>
              <input
                id="supplier"
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Garantia até
                  </label>
                  <input
                    type="date"
                    value={warrantyDate}
                    onChange={(e) => {
                      setWarrantyDate(e.target.value);
                      if (e.target.value) setWarrantyError('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
                    required={hasWarranty}
                  />
                  {warrantyError && (
                    <p className="mt-1 text-sm text-red-600">{warrantyError}</p>
                  )}
                </div>
              )}
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
