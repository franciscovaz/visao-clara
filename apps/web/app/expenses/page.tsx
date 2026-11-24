'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, DollarSign, TrendingUp, TrendingDown, Pencil, Receipt, ShieldCheck, Shield, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
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

// Display only: values and calculations stay in euros as numbers
const eurFormatter = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

// Display only: ISO dates (YYYY-MM-DD) as pt-PT, built in local time so the day never shifts; other values as stored
const formatDisplayDate = (value?: string | null): string => {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('pt-PT');
};

type SummaryCardProps = {
  title: string;
  icon: LucideIcon;
  iconClassName: string;
  value: React.ReactNode;
  valueClassName?: string;
  caption: React.ReactNode;
  children?: React.ReactNode;
};

// Figma summary card: small title with a small coloured icon, prominent value, caption, optional bar
function SummaryCard({ title, icon: Icon, iconClassName, value, valueClassName, caption, children }: SummaryCardProps) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${iconClassName}`} aria-hidden="true" />
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums wrap-anywhere ${valueClassName ?? 'text-gray-900'}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-500">{caption}</p>
      {children && <div className="mt-3">{children}</div>}
    </Card>
  );
}

function WarrantyIndicator({ expiresAt }: { expiresAt?: string | null }) {
  const status = getWarrantyStatus(expiresAt);
  if (status === 'none') {
    return <span className="text-sm text-gray-400" aria-label="Sem garantia">—</span>;
  }
  const label = status === 'valid'
    ? `Garantia válida até ${formatDisplayDate(expiresAt)}`
    : `Garantia expirada em ${formatDisplayDate(expiresAt)}`;
  const Icon = status === 'valid' ? ShieldCheck : Shield;
  return (
    // Focusable so the tooltip also appears on keyboard focus
    <span tabIndex={0} role="img" aria-label={label} className="group relative inline-flex rounded outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Icon className={`h-4 w-4 ${status === 'valid' ? 'text-green-600' : 'text-red-600'}`} aria-hidden="true" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {label}
      </span>
    </span>
  );
}

function ExpenseActions({ description, onEdit, onDelete, compact = false }: { description: string; onEdit: () => void; onDelete: () => void; compact?: boolean }) {
  const sizeClass = compact ? 'h-8 w-8' : '';
  return (
    <div className="flex flex-shrink-0 justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Editar despesa: ${description}`} title="Editar despesa" className={`text-gray-500 hover:text-gray-900 ${sizeClass}`}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`Eliminar despesa: ${description}`} title="Eliminar despesa" className={`text-red-500 hover:bg-red-50 hover:text-red-600 ${sizeClass}`}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
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

      <div className="space-y-6">
      {/* Page Header (Figma: title + description, primary action) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Despesas</h1>
          <p className="mt-1 text-sm text-gray-500">Regista e acompanha os gastos do projeto</p>
        </div>
        <Button size="sm" onClick={handleNewExpense} className="w-fit gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nova Despesa
        </Button>
      </div>

      {/* Summary Cards (same values and calculations as before; titled so each figure is explicit) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total de Despesas"
          icon={DollarSign}
          iconClassName="text-blue-600"
          value={summaryValue(eurFormatter.format(currentMonthTotal), 'h-7 w-28')}
          caption={summaryValue(`${expenses.length} ${expenses.length === 1 ? 'transação' : 'transações'}`, 'h-4 w-20')}
        />
        <SummaryCard
          title="Orçamento Utilizado"
          icon={TrendingUp}
          iconClassName="text-orange-600"
          value={summaryValue(`${budgetPercentage.toFixed(0)}%`, 'h-7 w-16')}
          caption={summaryValue(`${eurFormatter.format(currentMonthTotal)} de ${eurFormatter.format(totalBudget)}`, 'h-4 w-32')}
        >
          {areTotalsKnown && (
            <ProgressBar current={budgetPercentage} total={100} label="Orçamento utilizado" showLabel={false} />
          )}
        </SummaryCard>
        <SummaryCard
          title="Orçamento Restante"
          icon={TrendingDown}
          iconClassName={remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}
          value={summaryValue(eurFormatter.format(remainingBudget), 'h-7 w-28')}
          valueClassName={areTotalsKnown && remainingBudget < 0 ? 'text-red-600' : undefined}
          caption={`De ${eurFormatter.format(totalBudget)} planeado`}
        />
      </div>

      {/* Refresh failed while expenses are already shown */}
      {contentState === 'list' && expensesStatus === 'error' && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-700">{expensesError || 'Não foi possível carregar as despesas.'}</p>
          <Button variant="secondary" size="sm" onClick={handleRetry}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Expenses list: table from xl (narrower content areas beside the sidebar get stacked rows) */}
      <Card className="p-4 md:p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{expensesTitle}</h2>
        {contentState === 'loading' ? (
          renderLoading()
        ) : contentState === 'error' ? (
          renderError()
        ) : contentState === 'empty' ? (
          <EmptyState
            icon={<Receipt className="w-8 h-8" />}
            title="Sem despesas registadas"
            description="As despesas do projeto irão aparecer aqui."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="-mx-3 hidden overflow-x-auto xl:block">
              <table className="w-full">
                <thead className="border-b border-gray-200">
                  <tr className="text-left text-sm text-gray-600">
                    <th scope="col" className="pb-3 pl-3 pr-2 font-medium">Descrição</th>
                    <th scope="col" className="px-2 pb-3 font-medium">Fornecedor</th>
                    <th scope="col" className="px-2 pb-3 font-medium">Categoria</th>
                    <th scope="col" className="px-2 pb-3 font-medium">Data</th>
                    <th scope="col" className="w-20 px-2 pb-3 text-center font-medium">Garantia</th>
                    <th scope="col" className="px-2 pb-3 text-right font-medium">Valor</th>
                    <th scope="col" className="w-24 pb-3 pl-2 pr-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="min-w-[7rem] py-3 pl-3 pr-2">
                        {/* wrap-anywhere lowers the cell's minimum width, so long unbroken text can't push Valor/Ações out of view */}
                        <span className="wrap-anywhere text-sm font-medium text-gray-900">{expense.description}</span>
                      </td>
                      <td className="break-words px-2 py-3 text-sm text-gray-600">{expense.supplier || '—'}</td>
                      <td className="px-2 py-3 text-sm text-gray-600">{expense.category || '—'}</td>
                      <td className="whitespace-nowrap px-2 py-3 text-sm text-gray-600">{formatDisplayDate(expense.date)}</td>
                      <td className="px-2 py-3">
                        <div className="flex justify-center">
                          <WarrantyIndicator expiresAt={expense.warrantyExpiresAt} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right text-sm font-semibold text-gray-900 tabular-nums">
                        {eurFormatter.format(expense.amount)}
                      </td>
                      <td className="py-1.5 pl-2 pr-3 text-right">
                        <ExpenseActions
                          compact
                          description={expense.description}
                          onEdit={() => handleEditExpense(expense)}
                          onDelete={() => handleDelete(expense.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="space-y-3 xl:hidden">
              {expenses.map((expense) => {
                const warrantyStatus = getWarrantyStatus(expense.warrantyExpiresAt);
                return (
                  <li key={expense.id} className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium text-gray-900">{expense.description}</p>
                        {expense.supplier && <p className="mt-0.5 break-words text-xs text-gray-500">{expense.supplier}</p>}
                      </div>
                      <ExpenseActions
                        description={expense.description}
                        onEdit={() => handleEditExpense(expense)}
                        onDelete={() => handleDelete(expense.id)}
                      />
                    </div>
                    {(expense.category || warrantyStatus !== 'none') && (
                      <div className="flex flex-wrap gap-2">
                        {expense.category && <Badge variant="secondary">{expense.category}</Badge>}
                        {warrantyStatus !== 'none' && (
                          <Badge variant={warrantyStatus === 'valid' ? 'success' : 'destructive'} className="gap-1">
                            {warrantyStatus === 'valid'
                              ? <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                              : <Shield className="h-3 w-3" aria-hidden="true" />}
                            {warrantyStatus === 'valid' ? 'Garantia válida' : 'Garantia expirada'}
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-2">
                      <span className="text-xs text-gray-500">{formatDisplayDate(expense.date)}</span>
                      <span className="text-base font-semibold text-gray-900 tabular-nums">{eurFormatter.format(expense.amount)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
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
