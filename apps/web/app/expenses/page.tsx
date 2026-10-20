'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash, DollarSign, TrendingUp, TrendingDown, Pencil, Receipt, ShieldCheck, Shield, Minus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import AppLayout from '@/components/AppLayout';
import AddExpenseModal from '@/components/AddExpenseModal';
import EditExpenseModal from '@/components/EditExpenseModal';
import { useProjectStore } from '@/src/store/projectStore';
import ProjectHeader from '@/src/components/ProjectHeader';
import { supabase } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';
import type { Expense } from '@/src/mocks/expenses';

const NO_EXPENSES: Expense[] = [];

function getWarrantyStatus(expiresAt?: string | null): 'valid' | 'expired' | 'none' {
  if (!expiresAt) return 'none';
  
  const [day, month, year] = expiresAt.split('/');
  const expiryDate = new Date(`${year}-${month}-${day}`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return expiryDate >= today ? 'valid' : 'expired';
}

export default function ExpensesPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  // Route projectId is the source of truth; the store value covers the legacy /expenses route
  const params = useParams();
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const projectId = (params.projectId as string | undefined) || activeProjectId;
  const { addExpense, updateExpense, deleteExpense, projects, fetchExpensesForProject } = useProjectStore();
  const expenses = useProjectStore(s => s.expensesByProjectId[projectId] ?? NO_EXPENSES);
  const expensesStatus = useProjectStore(s => s.expensesStatusByProjectId[projectId] ?? 'idle');
  const expensesError = useProjectStore(s => s.expensesErrorByProjectId[projectId] ?? null);

  // Shares the layout's request when one is already in flight for this project
  useEffect(() => {
    if (projectId) {
      fetchExpensesForProject(projectId);
    }
  }, [projectId, fetchExpensesForProject]);

  const hasExpenses = expenses.length > 0;
  // Existing expenses stay visible while refreshing or after a failed refresh
  const contentState: 'loading' | 'error' | 'empty' | 'list' =
    hasExpenses ? 'list'
    : expensesStatus === 'success' ? 'empty'
    : expensesStatus === 'error' ? 'error'
    : 'loading';
  const areTotalsKnown = contentState === 'list' || contentState === 'empty';
  const expensesTitle = areTotalsKnown ? `Todas as Despesas (${expenses.length})` : 'Todas as Despesas';

  const handleRetry = () => {
    if (projectId) {
      fetchExpensesForProject(projectId);
    }
  };

  // Placeholder for summary values until expenses are confirmed by the backend
  const summaryValue = (value: string, skeletonClassName: string) =>
    areTotalsKnown ? value : <span className={`inline-block align-middle bg-gray-100 rounded animate-pulse ${skeletonClassName}`} />;

  const renderLoading = () => (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">A carregar despesas...</p>
    </div>
  );

  const renderError = () => (
    <div className="text-center py-8">
      <p className="text-red-600 font-medium mb-1">{expensesError || 'Não foi possível carregar as despesas.'}</p>
      <p className="text-sm text-gray-500 mb-4">Verifica a tua ligação e tenta novamente.</p>
      <Button variant="secondary" size="sm" onClick={handleRetry}>
        Tentar novamente
      </Button>
    </div>
  );

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

  const handleUpdateExpense = async (updatedExpense: any) => {
    if (!projectId) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          title: updatedExpense.description,
          description: updatedExpense.description,
          amount_cents: Math.round(updatedExpense.amount * 100),
          category: updatedExpense.category,
          supplier_name: updatedExpense.supplier,
          expense_date: updatedExpense.date || null,
          warranty_expires_at: updatedExpense.warrantyExpiresAt || null,
        })
        .eq('id', updatedExpense.id);

      if (error) {
        console.error('Error updating expense:', error);
        return;
      }

      updateExpense(projectId, updatedExpense.id, updatedExpense);
    } catch (err) {
      console.error('Failed to update expense:', err);
    }

    setIsEditModalOpen(false);
    setEditingExpense(null);
  };

  const handleNewExpense = () => {
    setIsModalOpen(true);
  };

  const handleAddExpense = async (newExpense: {
    description: string;
    amount: number;
    date: string;
    category: string;
    supplier: string;
    warrantyExpiresAt?: string;
  }) => {
    if (!projectId) return;

    try {
      const project = projects.find(p => p.id === projectId);
      const tenantId = project?.tenant_id;

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          project_id: projectId,
          tenant_id: tenantId,
          title: newExpense.description,
          description: newExpense.description,
          amount_cents: Math.round(newExpense.amount * 100),
          currency: 'EUR',
          category: newExpense.category,
          supplier_name: newExpense.supplier,
          expense_date: newExpense.date || null,
          status: 'planned',
          warranty_expires_at: newExpense.warrantyExpiresAt || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating expense:', error);
        return;
      }

      if (data) {
        const persistedExpense = {
          id: data.id,
          description: data.description || data.title,
          amount: data.amount_cents / 100,
          date: data.expense_date,
          category: data.category,
          supplier: data.supplier_name,
          warrantyExpiresAt: data.warranty_expires_at,
          projectId: data.project_id,
        };
        addExpense(projectId, persistedExpense);
      }
    } catch (err) {
      console.error('Failed to create expense:', err);
    }

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
            onClick={() => setIsModalOpen(true)}
            className="w-fit flex items-center gap-2 px-5 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Nova Despesa</span>
          </button>
      </div>

      {/* Summary Cards - Desktop */}
      <div className="hidden md:grid grid-cols-3 gap-6 mb-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{summaryValue(`€${currentMonthTotal.toLocaleString()}`, 'h-7 w-28')}</p>
                <p className="text-sm text-gray-600">{summaryValue(`${expenses.length} transações`, 'h-4 w-20')}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{summaryValue(`€${currentMonthTotal.toLocaleString()}`, 'h-7 w-28')}</p>
                <p className="text-sm text-gray-600">{summaryValue(`${budgetPercentage.toFixed(0)}% do orçamento`, 'h-4 w-24')}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{summaryValue(`€${remainingBudget.toLocaleString()}`, 'h-7 w-28')}</p>
                <p className="text-sm text-gray-600">De €{totalBudget.toLocaleString()} planeado</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-green-600" />
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
                <p className="text-xl font-bold text-gray-900">{summaryValue(`€${currentMonthTotal.toLocaleString()}`, 'h-7 w-28')}</p>
                <p className="text-sm text-gray-600">{summaryValue(`${expenses.length} transações`, 'h-4 w-20')}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold text-gray-900">{summaryValue(`€${currentMonthTotal.toLocaleString()}`, 'h-7 w-28')}</p>
                <p className="text-sm text-gray-600">{summaryValue(`${budgetPercentage.toFixed(0)}% do orçamento`, 'h-4 w-24')}</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold text-gray-900">{summaryValue(`€${remainingBudget.toLocaleString()}`, 'h-7 w-28')}</p>
                <p className="text-sm text-gray-600">De €{totalBudget.toLocaleString()} planeado</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Refresh failed while expenses are already shown */}
      {contentState === 'list' && expensesStatus === 'error' && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-700">{expensesError || 'Não foi possível carregar as despesas.'}</p>
          <Button variant="secondary" size="sm" onClick={handleRetry}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Expenses Table - Desktop */}
      <div className="hidden md:block">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{expensesTitle}</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Descrição</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Fornecedor</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Categoria</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Data</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Garantia</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {contentState === 'loading' ? (
                    <tr>
                      <td colSpan={6}>{renderLoading()}</td>
                    </tr>
                  ) : contentState === 'error' ? (
                    <tr>
                      <td colSpan={6}>{renderError()}</td>
                    </tr>
                  ) : contentState === 'empty' ? (
                    <tr>
                      <td colSpan={6} className="py-8">
                        <EmptyState
                          icon={<Receipt className="w-8 h-8" />}
                          title="Sem despesas registadas"
                          description="As despesas do projeto irão aparecer aqui."
                        />
                      </td>
                    </tr>
                  ) : (
                    expenses.map((expense) => (
                      <tr key={expense.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-900">{expense.description}</td>
                        <td className="py-3 px-4 text-gray-600">{expense.supplier}</td>
                        <td className="py-3 px-4 text-gray-600">{expense.category}</td>
                        <td className="py-3 px-4 text-gray-600">{expense.date}</td>
                        <td className="py-3 px-4">
                          {(() => {
                            const status = getWarrantyStatus(expense.warrantyExpiresAt);
                            
                            if (status === 'none') {
                              return <span className="text-gray-400">—</span>;
                            }
                            
                            const tooltipText = status === 'valid' 
                              ? `Garantia válida até ${expense.warrantyExpiresAt}`
                              : `Garantia expirada em ${expense.warrantyExpiresAt}`;
                            
                            return (
                              <div className="relative group">
                                {status === 'valid' ? (
                                  <ShieldCheck className="w-5 h-5 text-green-500" />
                                ) : (
                                  <Shield className="w-5 h-5 text-red-500" />
                                )}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                  {tooltipText}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-gray-900">€{expense.amount.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleEditExpense(expense)}
                              className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(expense.id)}
                              className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>

      {/* Expenses List - Mobile */}
      <div className="md:hidden space-y-4 mb-24">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{expensesTitle}</h3>
        {contentState === 'loading' ? (
          <Card>
            <div className="p-8">{renderLoading()}</div>
          </Card>
        ) : contentState === 'error' ? (
          <Card>
            <div className="p-8">{renderError()}</div>
          </Card>
        ) : contentState === 'empty' ? (
          <Card>
            <div className="p-8">
              <EmptyState
                icon={<Receipt className="w-8 h-8" />}
                title="Sem despesas registadas"
                description="As despesas do projeto irão aparecer aqui."
              />
            </div>
          </Card>
        ) : (
          expenses.map((expense) => (
            <Card key={expense.id}>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-1">{expense.description}</h4>
                    <p className="text-sm text-gray-500 mb-1">{expense.supplier}</p>
                    <p className="text-sm text-gray-500 mb-2">{expense.category}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">{expense.date}</span>
                        {(() => {
                          const status = getWarrantyStatus(expense.warrantyExpiresAt);
                          
                          if (status === 'none') return null;
                          
                          const tooltipText = status === 'valid' 
                            ? `Garantia válida até ${expense.warrantyExpiresAt}`
                            : `Garantia expirada em ${expense.warrantyExpiresAt}`;
                          
                          return (
                            <div className="relative group">
                              {status === 'valid' ? (
                                <ShieldCheck className="w-4 h-4 text-green-500" />
                              ) : (
                                <Shield className="w-4 h-4 text-red-500" />
                              )}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                {tooltipText}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <span className="font-bold text-gray-900">€{expense.amount.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleEditExpense(expense)}
                      className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
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
