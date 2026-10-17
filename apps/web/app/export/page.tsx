'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, FolderDown, FileText, Lock, Info } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import AppLayout from '@/components/AppLayout';
import ProjectHeader from '@/src/components/ProjectHeader';
import { useProjectStore } from '@/src/store/projectStore';
import { supabase } from '@/lib/supabase/client';

export default function ExportPage() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingDocuments, setIsExportingDocuments] = useState(false);
  const [isExportingComplete, setIsExportingComplete] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);
  
  // Get billing entitlements
  const { can, activeProjectId } = useProjectStore();
  const isExportEnabled = can('exportEnabled');
  const isLocked = !isExportEnabled;

  const handleUpgrade = () => {
    router.replace(`/${activeProjectId}/profile?tab=plans`);
  };

  const handleExportExpenses = async () => {
    if (isLocked || !activeProjectId) return;

    setIsExporting(true);
    setExportError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setExportError('Sessão não encontrada. Por favor, faça login novamente.');
        return;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      
      const response = await fetch(`${supabaseUrl}/functions/v1/export-project-expenses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
          'x-user-jwt': session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ project_id: activeProjectId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          setExportError('Não autorizado. Verifique as suas permissões.');
        } else if (response.status === 403) {
          setExportError('Permissões insuficientes. Esta funcionalidade requer plano Pro.');
        } else {
          setExportError(`Erro ao exportar: ${errorText}`);
        }
        return;
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'despesas.xlsx';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      setExportError('Erro ao exportar despesas. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDocuments = async () => {
    if (isLocked || !activeProjectId) return;

    setIsExportingDocuments(true);
    setDocumentsError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setDocumentsError('Sessão não encontrada. Por favor, faça login novamente.');
        return;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      // Step 1: Request authorization
      const authResponse = await fetch(`${supabaseUrl}/functions/v1/authorize-project-documents-export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
          'x-user-jwt': session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ project_id: activeProjectId }),
      });

      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        if (authResponse.status === 401) {
          setDocumentsError('Não autorizado. Verifique as suas permissões.');
        } else if (authResponse.status === 403) {
          setDocumentsError('Permissões insuficientes. Esta funcionalidade requer plano Pro.');
        } else if (authResponse.status === 404) {
          setDocumentsError('Não existem documentos para exportar.');
        } else {
          setDocumentsError(`Erro ao autorizar exportação: ${errorText}`);
        }
        return;
      }

      const authData = await authResponse.json();
      if (!authData.ok || !authData.export_token) {
        setDocumentsError('Erro ao obter token de exportação.');
        return;
      }

      // Step 2: Initiate browser download from Worker
      const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL;
      if (!workerUrl) {
        setDocumentsError('Configuração do Worker não encontrada.');
        return;
      }

      const downloadUrl = `${workerUrl}/?token=${authData.export_token}`;
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error('Export documents error:', error);
      setDocumentsError('Erro ao exportar documentos. Tente novamente.');
    } finally {
      setIsExportingDocuments(false);
    }
  };

  const handleExportComplete = async () => {
    if (isLocked || !activeProjectId) return;

    setIsExportingComplete(true);
    setCompleteError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCompleteError('Sessão não encontrada. Por favor, faça login novamente.');
        return;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      // Step 1: Request authorization for full export
      const authResponse = await fetch(`${supabaseUrl}/functions/v1/authorize-project-documents-export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
          'x-user-jwt': session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ project_id: activeProjectId, export_type: 'full' }),
      });

      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        if (authResponse.status === 401) {
          setCompleteError('Não autorizado. Verifique as suas permissões.');
        } else if (authResponse.status === 403) {
          setCompleteError('Permissões insuficientes. Esta funcionalidade requer plano Pro.');
        } else {
          setCompleteError(`Erro ao autorizar exportação: ${errorText}`);
        }
        return;
      }

      const authData = await authResponse.json();
      if (!authData.ok || !authData.export_token) {
        setCompleteError('Erro ao obter token de exportação.');
        return;
      }

      // Step 2: Initiate browser download from Worker
      const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL;
      if (!workerUrl) {
        setCompleteError('Configuração do Worker não encontrada.');
        return;
      }

      const downloadUrl = `${workerUrl}/?token=${authData.export_token}`;
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error('Export complete error:', error);
      setCompleteError('Erro ao exportar dados completos. Tente novamente.');
    } finally {
      setIsExportingComplete(false);
    }
  };

  return (
    <AppLayout 
      currentPage="export"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      {/* Project Header */}
      <ProjectHeader />

      {/* Top Banner - Locked State */}
      {isLocked && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Lock className="w-5 h-5 text-orange-600" />
              <div>
                <h3 className="text-sm font-medium text-orange-900">Exportações não disponíveis</h3>
                <p className="text-xs text-orange-700">Disponível no plano Pro</p>
              </div>
            </div>
            <button
              onClick={handleUpgrade}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
            >
              Ver planos
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Exportar Dados</h2>
        <p className="text-gray-600 text-sm">Faça download dos dados do seu projeto</p>
      </div>

      <div className="hidden md:grid grid-cols-3 gap-6 mb-6">
        <Card className="relative">
          <div className="p-6 pb-20">
            {/* Lock Icon - Top Right */}
            {isLocked && (
              <div className="absolute top-4 right-4">
                <Lock className="w-4 h-4 text-gray-400" />
              </div>
            )}
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <FileSpreadsheet className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Exportar Despesas</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">Baixe todas as despesas em formato CSV para análise em planilhas</p>
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Inclui:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  Descrição das despesas
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  Valores e categorias
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  Datas de transação
                </li>
              </ul>
            </div>
            <button
              onClick={handleExportExpenses}
              disabled={isLocked || isExporting}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-colors ${
                isLocked
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : isExporting
                  ? 'bg-blue-600 text-white cursor-wait'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>A gerar...</span>
                </>
              ) : isLocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Bloqueado</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Exportar</span>
                </>
              )}
            </button>
            {exportError && (
              <p className="absolute bottom-16 left-6 right-6 text-xs text-center text-red-600">
                {exportError}
              </p>
            )}
            {isLocked && (
              <p className="absolute bottom-16 left-6 right-6 text-xs text-center text-gray-500">
                Disponível no plano Pro
              </p>
            )}
          </div>
        </Card>

        <Card className="relative">
          <div className="p-6 pb-20">
            {/* Lock Icon - Top Right */}
            {isLocked && (
              <div className="absolute top-4 right-4">
                <Lock className="w-4 h-4 text-gray-400" />
              </div>
            )}
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                <FolderDown className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Exportar Documentos</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">Baixe todos os documentos do projeto em um arquivo ZIP</p>
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Inclui:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  Todos os arquivos enviados
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  Organizados por fase
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  Mantêm nomes originais
                </li>
              </ul>
            </div>
            <button
              onClick={handleExportDocuments}
              disabled={isLocked || isExportingDocuments}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-colors ${
                isLocked
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : isExportingDocuments
                  ? 'bg-green-600 text-white cursor-wait'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isExportingDocuments ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>A gerar...</span>
                </>
              ) : isLocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Bloqueado</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Exportar</span>
                </>
              )}
            </button>
            {documentsError && (
              <p className="absolute bottom-16 left-6 right-6 text-xs text-center text-red-600">
                {documentsError}
              </p>
            )}
            {isLocked && (
              <p className="absolute bottom-16 left-6 right-6 text-xs text-center text-gray-500">
                Disponível no plano Pro
              </p>
            )}
          </div>
        </Card>

        <Card className="relative">
          <div className="p-6 pb-20">
            {/* Lock Icon - Top Right */}
            {isLocked && (
              <div className="absolute top-4 right-4">
                <Lock className="w-4 h-4 text-gray-400" />
              </div>
            )}
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Exportação Completa</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">Baixe despesas e documentos em um único arquivo ZIP</p>
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Inclui:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  Relatório de despesas em Excel
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  Todos os documentos enviados
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  Mantêm nomes originais
                </li>
              </ul>
            </div>
            <button
              onClick={handleExportComplete}
              disabled={isLocked || isExportingComplete}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-colors ${
                isLocked
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : isExportingComplete
                  ? 'bg-purple-600 text-white cursor-wait'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {isExportingComplete ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>A gerar...</span>
                </>
              ) : isLocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Bloqueado</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Exportar</span>
                </>
              )}
            </button>
            {completeError && (
              <p className="absolute bottom-16 left-6 right-6 text-xs text-center text-red-600">
                {completeError}
              </p>
            )}
            {isLocked && (
              <p className="absolute bottom-16 left-6 right-6 text-xs text-center text-gray-500">
                Disponível no plano Pro
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="md:hidden space-y-4 mb-6">
        <Card className="relative">
          <div className="p-6 pb-20">
            {/* Lock Icon - Top Right */}
            {isLocked && (
              <div className="absolute top-4 right-4">
                <Lock className="w-4 h-4 text-gray-400" />
              </div>
            )}
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <FileSpreadsheet className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Exportar Despesas</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">Baixe todas as despesas em formato CSV para análise em planilhas</p>
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Inclui:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  Descrição das despesas
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  Valores e categorias
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  Datas de transação
                </li>
              </ul>
            </div>
            <button
              onClick={handleExportExpenses}
              disabled={isLocked || isExporting}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-colors ${
                isLocked
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : isExporting
                  ? 'bg-blue-600 text-white cursor-wait'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>A gerar...</span>
                </>
              ) : isLocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Bloqueado</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Exportar</span>
                </>
              )}
            </button>
            {exportError && (
              <p className="absolute bottom-16 left-6 right-6 text-xs text-center text-red-600">
                {exportError}
              </p>
            )}
            {isLocked && (
              <p className="absolute bottom-16 left-6 right-6 text-xs text-center text-gray-500">
                Disponível no plano Pro
              </p>
            )}
          </div>
        </Card>

        <Card className="relative">
          <div className="p-6 pb-20">
            {/* Lock Icon - Top Right */}
            {isLocked && (
              <div className="absolute top-4 right-4">
                <Lock className="w-4 h-4 text-gray-400" />
              </div>
            )}
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                <FolderDown className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Exportar Documentos</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">Baixe todos os documentos do projeto em um arquivo ZIP</p>
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Inclui:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  Todos os arquivos enviados
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  Organizados por fase
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  Mantêm nomes originais
                </li>
              </ul>
            </div>
            <button
              onClick={handleExportDocuments}
              disabled={isLocked || isExportingDocuments}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-colors ${
                isLocked
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : isExportingDocuments
                  ? 'bg-green-600 text-white cursor-wait'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isExportingDocuments ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>A gerar...</span>
                </>
              ) : isLocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Bloqueado</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Exportar</span>
                </>
              )}
            </button>
            {documentsError && (
              <p className="absolute bottom-16 left-6 right-6 text-xs text-center text-red-600">
                {documentsError}
              </p>
            )}
            {isLocked && (
              <p className="absolute bottom-16 left-6 right-6 text-xs text-center text-gray-500">
                Disponível no plano Pro
              </p>
            )}
          </div>
        </Card>

        <Card className="relative">
          <div className="p-6 pb-20">
            {/* Lock Icon - Top Right */}
            {isLocked && (
              <div className="absolute top-4 right-4">
                <Lock className="w-4 h-4 text-gray-400" />
              </div>
            )}
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Exportação Completa</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">Baixe despesas e documentos em um único arquivo ZIP</p>
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Inclui:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  Relatório de despesas em Excel
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  Todos os documentos enviados
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  Mantêm nomes originais
                </li>
              </ul>
            </div>
            <button
              onClick={handleExportComplete}
              disabled={isLocked || isExportingComplete}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md font-medium transition-colors ${
                isLocked
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : isExportingComplete
                  ? 'bg-purple-600 text-white cursor-wait'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {isExportingComplete ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>A gerar...</span>
                </>
              ) : isLocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Bloqueado</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Exportar</span>
                </>
              )}
            </button>
            {completeError && (
              <p className="absolute bottom-16 left-6 right-6 text-xs text-center text-red-600">
                {completeError}
              </p>
            )}
            {isLocked && (
              <p className="absolute bottom-16 left-6 right-6 text-xs text-center text-gray-500">
                Disponível no plano Pro
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card className="bg-blue-50">
        <div className="p-6">
          <div className="flex items-start">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sobre as Exportações</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Os arquivos exportados contêm todos os dados visíveis na plataforma. As exportações são geradas em tempo real e refletem o estado atual do projeto. Os documentos mantêm sua estrutura e organização original.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </AppLayout>
  );
}
