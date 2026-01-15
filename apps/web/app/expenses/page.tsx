'use client';

import { useState } from 'react';
import { HiPlus, HiTrash, HiCurrencyDollar, HiTrendingUp, HiTrendingDown } from 'react-icons/hi';
import { Card } from '@/components/ui/Card';
import AppLayout from '@/components/AppLayout';

export default function ExpensesPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expenses, setExpenses] = useState([
    {
      id: '1',
      description: 'Architectural consultation',
      category: 'Professional Services',
      date: '05/01/2026',
      amount: 2500,
    },
    {
      id: '2',
      description: 'Site survey',
      category: 'Professional Services',
      date: '08/01/2026',
      amount: 800,
    },
    {
      id: '3',
      description: 'Permits and fees',
      category: 'Legal',
      date: '10/01/2026',
      amount: 1200,
    },
    {
      id: '4',
      description: 'Initial materials deposit',
      category: 'Materials',
      date: '12/01/2026',
      amount: 5000,
    },
  ]);

  const currentMonthTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalBudget = 50000;
  const remainingBudget = totalBudget - currentMonthTotal;
  const budgetPercentage = (currentMonthTotal / totalBudget) * 100;

  const handleDelete = (id: string) => {
    setExpenses(prev => prev.filter(expense => expense.id !== id));
  };

  const handleNewExpense = () => {
    console.log('New expense clicked');
  };

  return (
    <AppLayout 
      currentPage="expenses"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      {/* Project Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Investment</h1>
        <p className="text-gray-600 text-lg">House • Phase: completed</p>
        <div className="w-full h-px bg-gray-300 mt-4"></div>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Expenses</h2>
          <p className="text-gray-600 text-sm">Manage and track your expenses</p>
        </div>
        <button 
          onClick={handleNewExpense}
          className="flex items-center space-x-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <HiPlus className="w-4 h-4" />
          <span>New Expense</span>
        </button>
      </div>

      {/* Summary Cards - Desktop */}
      <div className="hidden md:grid grid-cols-3 gap-6 mb-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">€{currentMonthTotal.toLocaleString()}</p>
                <p className="text-sm text-gray-600">{expenses.length} transactions</p>
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
                <p className="text-sm text-gray-600">{budgetPercentage.toFixed(0)}% of budget</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <HiTrendingUp className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">€{remainingBudget.toLocaleString()}</p>
                <p className="text-sm text-gray-600">From €{totalBudget.toLocaleString()} planned</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <HiTrendingDown className="w-6 h-6 text-green-600" />
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
                <p className="text-sm text-gray-600">{expenses.length} transactions</p>
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
                <p className="text-sm text-gray-600">{budgetPercentage.toFixed(0)}% of budget</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <HiTrendingUp className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold text-gray-900">€{remainingBudget.toLocaleString()}</p>
                <p className="text-sm text-gray-600">From €{totalBudget.toLocaleString()} planned</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <HiTrendingDown className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Expenses Table - Desktop */}
      <div className="hidden md:block">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">All Expenses ({expenses.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Category</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{expense.description}</td>
                      <td className="py-3 px-4 text-gray-600">{expense.category}</td>
                      <td className="py-3 px-4 text-gray-600">{expense.date}</td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">€{expense.amount.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <HiTrash className="w-4 h-4" />
                        </button>
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">All Expenses ({expenses.length})</h3>
        {expenses.map((expense) => (
          <Card key={expense.id}>
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-1">{expense.description}</h4>
                  <p className="text-sm text-gray-500 mb-2">{expense.category}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{expense.date}</span>
                    <span className="font-bold text-gray-900">€{expense.amount.toLocaleString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(expense.id)}
                  className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <HiTrash className="w-4 h-4" />
                </button>
              </div>
              </div>
            </Card>
        ))}
      </div>
    </AppLayout>
  );
}
