'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, FolderArchive, FileText, Lock, Info, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import AppLayout from '@/components/AppLayout';
import ProjectHeader from '@/src/components/ProjectHeader';
import { useProjectStore } from '@/src/store/projectStore';
import { supabase } from '@/lib/supabase/client';

type ExportCardProps = {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  description: string;
  includes: string[];
  actionLabel: string;
  isLocked: boolean;
  isExporting: boolean;
  error: string | null;
  onExport: () => void;
};

// Figma export card: coloured icon (lock badge when restricted), title, description, contents, action
function ExportCard({ icon: Icon, iconClassName, title, description, includes, actionLabel, isLocked, isExporting, error, onExport }: ExportCardProps) {
  return (
    <Card className="flex h-full flex-col p-4 md:p-6">
      <div className="relative mb-4">
        <Icon className={`h-10 w-10 ${iconClassName}`} aria-hidden="true" />
        {isLocked && <Lock className="absolute right-0 top-0 h-5 w-5 text-gray-400" aria-label="Bloqueado" />}
      </div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
      <div className="mt-4 flex-1 text-sm text-gray-600">
        <p className="mb-1 font-medium text-gray-700">Inclui:</p>
        <ul className="list-inside list-disc space-y-1">
          {includes.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
      <div className="mt-6 space-y-2">
        <Button
          size="sm"
          onClick={onExport}
          disabled={isLocked}
          loading={isExporting}
          className="h-10 w-full gap-2"
        >
          {isExporting ? 'A gerar...' : isLocked ? (
            <>
              <Lock className="h-4 w-4" aria-hidden="true" />
              Bloqueado
            </>
          ) : (
            <>
              <Download className="h-4 w-4" aria-hidden="true" />
              {actionLabel}
            </>
          )}
        </Button>
        {isLocked && <p className="text-center text-xs text-gray-500">Disponível no plano Pro</p>}
        {error && <p role="alert" className="text-center text-xs text-red-600">{error}</p>}
      </div>
    </Card>
  );
}

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
      // window.open returns null when the browser blocks the pop-up (common after an async request)
      if (!window.open(downloadUrl, '_blank')) {
        setDocumentsError('O browser bloqueou a transferência. Permita pop-ups para este site e tente novamente.');
      }
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
      if (!window.open(downloadUrl, '_blank')) {
        setCompleteError('O browser bloqueou a transferência. Permita pop-ups para este site e tente novamente.');
      }
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

      <div className="space-y-6">
        {/* Page header (Figma) */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exportar Dados</h1>
          <p className="mt-1 text-sm text-gray-500">Descarregue os dados do seu projeto</p>
        </div>

        {/* Locked state (plan without exports) */}
        {isLocked && (
          <Card className="border-orange-200 bg-orange-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Lock className="h-5 w-5 flex-shrink-0 text-orange-600" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-orange-900">Exportações não disponíveis</p>
                <p className="mt-1 text-xs text-orange-700">Disponível no plano Pro</p>
              </div>
              <Button size="sm" onClick={handleUpgrade}>Ver planos</Button>
            </div>
          </Card>
        )}

        {/* Export options: one responsive grid (third column only when the content area is wide enough) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <ExportCard
            icon={FileSpreadsheet}
            iconClassName="text-green-600"
            title="Exportar Despesas"
            description="Descarregue todas as despesas num ficheiro Excel para análise em folha de cálculo"
            includes={['Descrição das despesas', 'Valores e categorias', 'Datas das despesas']}
            actionLabel="Descarregar Excel"
            isLocked={isLocked}
            isExporting={isExporting}
            error={exportError}
            onExport={handleExportExpenses}
          />
          <ExportCard
            icon={FolderArchive}
            iconClassName="text-blue-600"
            title="Exportar Documentos"
            description="Descarregue todos os documentos do projeto num ficheiro ZIP"
            includes={['Todos os ficheiros carregados', 'Organizados por fase', 'Mantêm os nomes originais']}
            actionLabel="Descarregar ZIP"
            isLocked={isLocked}
            isExporting={isExportingDocuments}
            error={documentsError}
            onExport={handleExportDocuments}
          />
          <ExportCard
            icon={FileText}
            iconClassName="text-purple-600"
            title="Exportação Completa"
            description="Descarregue as despesas e os documentos num único ficheiro ZIP"
            includes={['Relatório de despesas em Excel', 'Todos os documentos carregados', 'Mantêm os nomes originais']}
            actionLabel="Descarregar tudo"
            isLocked={isLocked}
            isExporting={isExportingComplete}
            error={completeError}
            onExport={handleExportComplete}
          />
        </div>

        {/* About exports */}
        <Card className="border-blue-200 bg-blue-50 p-4 md:p-6">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="font-medium text-blue-900">Sobre as exportações</h2>
              <p className="mt-1 text-sm text-blue-700">
                Os ficheiros exportados contêm os dados visíveis na plataforma. As exportações são geradas no momento e refletem o estado atual do projeto. Os documentos mantêm a estrutura e a organização originais.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
