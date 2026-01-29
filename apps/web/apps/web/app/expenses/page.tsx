'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { HiPlus, HiPencil, HiTrash, HiArrowTrendingUp, HiArrowTrendingDown, HiCurrencyDollar } from 'react-icons/hi2';

import AppLayout from '@/components/AppLayout';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useProjectStore } from '@/src/store/projectStore';
import ProjectHeader from '@/src/components/ProjectHeader';
import AddExpenseModal from '@/components/AddExpenseModal';
import EditExpenseModal from '@/components/EditExpenseModal';
import { formatDate } from '@/src/utils/dateUtils';

export default function ExpensesPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  
  // Get active project expenses from store
  const projectId = useProjectStore(s => s.activeProjectId);
  const { getExpensesForProject, addExpense, updateExpense, deleteExpense } = useProjectStore();
  const expenses = getExpensesForProject(projectId);

  const currentMonthTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalBudget = 50000;
  const remainingBudget = totalBudget - currentMonthTotal;
  const budgetPercentage = (currentMonthTotal / totalBudget) * 100;

  const handleDelete = (id: string) => {
    deleteExpense(projectId, id);
  };

  const handleEditExpense = (expense: any) => {
    setEditingExpense(expense);
    setIsEditModalOpen(true);
  };

  const handleUpdateExpense = (updatedExpense: any) => {
    updateExpense(projectId, updatedExpense.id, updatedExpense);
    setIsEditModalOpen(false);
    setEditingExpense(null);
  };

  const handleNewExpense = () => {
    setIsModalOpen(true);
  };

  const handleAddExpense = (newExpense: {
    description: string;
    amount: number;
    date: string;
    category: string;
    supplier: string;
  }) => {
    addExpense(projectId, newExpense);
    setIsModalOpen(false);
  };

  return (
    <AppLayout 
      currentPage="expenses"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      {/* Project Header */}
      <ProjectHeader />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Despesas</h2>
          <p className="text-gray-600 text-sm">Gerencie e acompanhe seus gastos</p>
        </div>
        <button 
          onClick={handleNewExpense}
          className="flex items-center space-x-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <HiPlus className="w-4 h-4" />
          <span>Nova Despesa</span>
        </button>
      </div>

      {/* Summary Cards - Desktop */}
      <div className="hidden md:grid grid-cols-3 gap-6 mb-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">€{currentMonthTotal.toLocaleString()}</p>
                <p className="text-sm text-gray-600">{expenses.length} transações</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <HiCurrencyDollar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">€{currentMonthTotal.toLocaleString()}</p>
                <p className="text-sm text-gray-600">{budgetPercentage.toFixed(0)}% do orçamento</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <HiArrowTrendingUp className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">€{remainingBudget.toLocaleString()}</p>
                <p className="text-sm text-gray-600">De €{totalBudget.toLocaleString()} planeado</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <HiArrowTrendingDown className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Summary Cards - Mobile */}
      <div className="md:hidden space-y-4 mb-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold text-gray-900">€{currentMonthTotal.toLocaleString()}</p>
                <p className="text-sm text-gray-600">{expenses.length} transações</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <HiCurrencyDollar className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold text-gray-900">€{currentMonthTotal.toLocaleString()}</p>
                <p className="text-sm text-gray-600">{budgetPercentage.toFixed(0)}% do orçamento</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <HiArrowTrendingUp className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold text-gray-900">€{remainingBudget.toLocaleString()}</p>
                <p className="text-sm text-gray-600">De €{totalBudget.toLocaleString()} planeado</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <HiArrowTrendingDown className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Expenses Table - Desktop */}
      <div className="hidden md:block">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Todas as Despesas ({expenses.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Descrição</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Fornecedor</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Categoria</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Data</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Valor</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{expense.description}</td>
                      <td className="py-3 px-4 text-gray-600">{expense.supplier}</td>
                      <td className="py-3 px-4 text-gray-600">{expense.category}</td>
                      <td className="py-3 px-4 text-gray-600">{formatDate(expense.date)}</td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">€{expense.amount.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditExpense(expense)}
                            className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <HiPencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(expense.id)}
                            className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <HiTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>

      {/* Expenses List - Mobile */}
      <div className="md:hidden space-y-4 mb-24">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Todas as Despesas ({expenses.length})</h3>
        {expenses.map((expense) => (
          <Card key={expense.id}>
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-1">{expense.description}</h4>
                  <p className="text-sm text-gray-500 mb-1">{expense.supplier}</p>
                  <p className="text-sm text-gray-500 mb-2">{expense.category}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{formatDate(expense.date)}</span>
                    <span className="font-bold text-gray-900">€{expense.amount.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleEditExpense(expense)}
                    className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <HiPencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <HiTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddExpense}
      />

      {/* Edit Expense Modal */}
      <EditExpenseModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingExpense(null);
        }}
        onSubmit={handleUpdateExpense}
        expense={editingExpense}
      />
    </AppLayout>
  );
}
