'use client';

import { useState, useEffect } from 'react';
import { HiX } from 'react-icons/hi';
import { formatDateForStorage } from '@/src/utils/dateUtils';
import { useProjectStore } from '@/src/store/projectStore';

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

  // Get project categories from store
  const { activeProjectId, getActiveExpenseCategoriesForProject } = useProjectStore();
  const projectCategories = getActiveExpenseCategoriesForProject(activeProjectId);

  // Focus first input when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const firstInput = document.getElementById('expense-description') as HTMLInputElement;
        if (firstInput) {
          firstInput.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Set default category when categories are loaded
  useEffect(() => {
    if (projectCategories.length > 0 && !category) {
      setCategory(projectCategories[0].name);
    }
  }, [projectCategories, category]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)' }}
        onClick={onClose}
      />
      
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <HiX className="w-5 h-5" />
        </button>
        
        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Adicionar Despesa</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição
              </label>
              <input
                id="expense-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
                placeholder="Ex: Compra de materiais"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor (€)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
              >
                {projectCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fornecedor
              </label>
              <input
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
          </div>

          <button
            onClick={handleSubmit}
            className="mt-6 w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Adicionar Despesa
          </button>
        </div>
      </div>
    </div>
  );
}
