'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Download, Trash2, Plus, FileText, FileSpreadsheet, FileImage, File } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import AppLayout from '@/components/AppLayout';
import AddDocumentModal from '@/components/AddDocumentModal';
import { useProjectStore } from '@/src/store/projectStore';
import type { Document } from '@/src/mocks/documents';
import { supabase } from '@/lib/supabase/client';
import ProjectHeader from '@/src/components/ProjectHeader';
import { pickUploadHeaders, resolveUploadMime, validateUploadFile } from '@/src/utils/uploadPolicy';

const NO_DOCUMENTS: Document[] = [];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Values as stored by AddDocumentModal (documents.category / documents.doc_type)
const DOCUMENT_PHASES = ['Planeamento', 'Design', 'Licenças', 'Construção', 'Acabamentos', 'Concluído'];
const DOCUMENT_TYPES = [
  { value: 'PDF', label: 'PDF' },
  { value: 'Word', label: 'Word' },
  { value: 'Excel', label: 'Excel' },
  { value: 'Image', label: 'Imagem' },
];

const FILTER_SELECT_CLASS =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-900';

// Display only: pt-PT label for the stored type (legacy values such as EXCEL/OTHER included)
const getDocumentTypeLabel = (type?: string | null): string => {
  const normalized = (type || '').toLowerCase();
  if (normalized === 'image') return 'Imagem';
  if (normalized === 'other' || !normalized) return 'Outro';
  if (normalized === 'excel') return 'Excel';
  if (normalized === 'word') return 'Word';
  return type as string;
};

function DocumentTypeIcon({ type }: { type?: string | null }) {
  const normalized = (type || '').toLowerCase();
  const [Icon, color] =
    normalized === 'pdf' ? [FileText, 'text-red-600']
    : normalized === 'word' ? [FileText, 'text-blue-600']
    : normalized === 'excel' ? [FileSpreadsheet, 'text-green-600']
    : normalized === 'image' ? [FileImage, 'text-purple-600']
    : [File, 'text-gray-500'];
  return <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${color}`} aria-hidden="true" />;
}

type DocumentActionsProps = {
  name: string;
  isDeleting: boolean;
  onDownload: () => void;
  onDelete: () => void;
  compact?: boolean;
};

function DocumentActions({ name, isDeleting, onDownload, onDelete, compact = false }: DocumentActionsProps) {
  const sizeClass = compact ? 'h-8 w-8' : '';
  return (
    <div className="flex flex-shrink-0 justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={onDownload} aria-label={`Transferir documento: ${name}`} title="Transferir documento" className={`text-gray-500 hover:text-gray-900 ${sizeClass}`}>
        <Download className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete} loading={isDeleting} aria-label={`Eliminar documento: ${name}`} title="Eliminar documento" className={`text-red-500 hover:bg-red-50 hover:text-red-600 ${sizeClass}`}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

export default function DocumentsPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState('Todas as fases');
  const [typeFilter, setTypeFilter] = useState('Todos os tipos');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deletingDocIds, setDeletingDocIds] = useState<Set<string>>(() => new Set());
  // Deletion awaiting confirmation: document and project are captured together when the dialog opens.
  // The ref is the source of truth for confirmDelete (cleared synchronously, so a repeated confirm
  // can never start a second request); the state only drives the dialog's visibility.
  const pendingDeleteRef = useRef<{ docId: string; projectId: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ docId: string; projectId: string } | null>(null);

  // Route projectId is the source of truth; the store value covers the legacy /documents route
  const params = useParams();
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const projectId = (params.projectId as string | undefined) || activeProjectId;
  const { addDocument, deleteDocument, projects, fetchDocumentsForProject } = useProjectStore();
  const documents = useProjectStore(s => s.documentsByProjectId[projectId] ?? NO_DOCUMENTS);
  const documentsStatus = useProjectStore(s => s.documentsStatusByProjectId[projectId] ?? 'idle');
  const documentsError = useProjectStore(s => s.documentsErrorByProjectId[projectId] ?? null);

  // Shares the layout's request when one is already in flight for this project
  useEffect(() => {
    if (projectId) {
      fetchDocumentsForProject(projectId);
    }
  }, [projectId, fetchDocumentsForProject]);

  const hasDocuments = documents.length > 0;
  // Existing documents stay visible while refreshing or after a failed refresh
  const contentState: 'loading' | 'error' | 'empty' | 'list' =
    hasDocuments ? 'list'
    : documentsStatus === 'success' ? 'empty'
    : documentsStatus === 'error' ? 'error'
    : 'loading';
  const isRefreshing = hasDocuments && documentsStatus === 'loading';
  const documentsCountLabel = contentState === 'list' || contentState === 'empty'
    ? `${documents.length} ${documents.length === 1 ? 'documento' : 'documentos'}`
    : contentState === 'loading' ? 'A carregar documentos...' : '';

  // Client-side filters over the loaded documents (order preserved). Case-insensitive so legacy
  // values (e.g. EXCEL) match the same option as current ones (Excel).
  const ALL_PHASES = 'Todas as fases';
  const ALL_TYPES = 'Todos os tipos';
  const isFiltering = phaseFilter !== ALL_PHASES || typeFilter !== ALL_TYPES;
  const normalizeValue = (value?: string | null) => (value || '').trim().toLowerCase();
  const filteredDocuments = documents.filter(doc =>
    (phaseFilter === ALL_PHASES || normalizeValue(doc.phase) === normalizeValue(phaseFilter)) &&
    (typeFilter === ALL_TYPES || normalizeValue(doc.type) === normalizeValue(typeFilter))
  );
  const clearFilters = () => {
    setPhaseFilter(ALL_PHASES);
    setTypeFilter(ALL_TYPES);
  };

  const handleRetry = () => {
    if (projectId) {
      fetchDocumentsForProject(projectId);
    }
  };

  const renderLoading = () => (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">A carregar documentos...</p>
    </div>
  );

  const renderError = () => (
    <div className="text-center py-8">
      <p className="text-red-600 font-medium mb-1">{documentsError || 'Não foi possível carregar os documentos.'}</p>
      <p className="text-sm text-gray-500 mb-4">Verifica a tua ligação e tenta novamente.</p>
      <Button variant="secondary" size="sm" onClick={handleRetry}>
        Tentar novamente
      </Button>
    </div>
  );

  const handleDownload = async (docId: string) => {
    // Only persisted documents (database UUIDs) have files to download
    if (!UUID_RE.test(docId)) {
      alert('Este documento ainda não foi guardado corretamente. Atualize a página e tente novamente.');
      console.error('Download blocked: document id is not a persisted UUID', docId);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Sessão não encontrada. Por favor, faça login novamente.');
        return;
      }

      const { data: documentFiles, error: filesError } = await supabase
        .from('document_files')
        .select('id')
        .eq('document_id', docId)
        .eq('status', 'uploaded')
        .limit(1);

      if (filesError) {
        alert('Não foi possível verificar o ficheiro. Tente novamente.');
        console.error('Fetch document files error:', filesError);
        return;
      }

      if (!documentFiles || documentFiles.length === 0) {
        alert('Ficheiro não disponível para download');
        return;
      }

      const documentFileId = documentFiles[0].id;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/r2-sign-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          document_file_id: documentFileId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || 'Erro ao obter URL de download');
        console.error('Sign download error:', errorData);
        return;
      }

      const data = await response.json();
      const downloadUrl = data.download?.url;

      if (!downloadUrl) {
        alert('URL de download não recebida');
        return;
      }

      window.open(downloadUrl, '_blank');
    } catch (err) {
      alert('Erro ao fazer download do documento');
      console.error('Download error:', err);
    }
  };

  // Existing pre-confirmation guards, then open the confirmation for this document
  const requestDelete = (docId: string) => {
    // Captured so a project switch mid-request still updates the right project
    const docProjectId = projectId;
    if (!docProjectId || deletingDocIds.has(docId)) return;
    // The server only knows persisted documents (database UUIDs)
    if (!UUID_RE.test(docId)) {
      alert('Este documento ainda não foi guardado corretamente. Atualize a página e tente novamente.');
      console.error('Delete blocked: document id is not a persisted UUID', docId);
      return;
    }
    const target = { docId, projectId: docProjectId };
    pendingDeleteRef.current = target;
    setPendingDelete(target);
  };

  const cancelDelete = () => {
    pendingDeleteRef.current = null;
    setPendingDelete(null);
  };

  const confirmDelete = () => {
    const target = pendingDeleteRef.current;
    if (!target) return;
    pendingDeleteRef.current = null;
    setPendingDelete(null);
    void runDelete(target.docId, target.projectId);
  };

  // Deletion itself, unchanged; runs only after confirmation, with the captured document and project
  const runDelete = async (docId: string, docProjectId: string) => {
    setDeletingDocIds(prev => new Set(prev).add(docId));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Sessão não encontrada. Por favor, faça login novamente.');
        return;
      }

      // Same header convention as the export functions (verify_jwt enabled):
      // the gateway checks the anon key, requireUser() validates x-user-jwt
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
          'x-user-jwt': session.access_token,
        },
        body: JSON.stringify({ document_id: docId, project_id: docProjectId }),
      });

      if (response.ok) {
        deleteDocument(docProjectId, docId);
        return;
      }

      const errorData = await response.json().catch(() => ({}));
      console.error('Delete document error:', response.status, errorData);

      // Only the function's explicit code means the document no longer exists
      // (e.g. a retried request already removed it); other 404s stay errors
      if (response.status === 404 && errorData.code === 'DOCUMENT_NOT_FOUND') {
        deleteDocument(docProjectId, docId);
        return;
      }

      if (response.status === 401) {
        // requireUser() rejects an invalid/expired user token with this code;
        // any other 401 (e.g. gateway) is not a session problem
        alert(errorData.error === 'UNAUTHORIZED'
          ? 'Sessão expirada. Por favor, faça login novamente.'
          : 'Não foi possível autenticar o pedido. Tente novamente ou contacte o suporte.');
        return;
      }

      alert(errorData.ok === false && typeof errorData.error === 'string'
        ? errorData.error
        : 'Erro ao eliminar documento. Tente novamente.');
    } catch (err) {
      alert('Erro ao eliminar documento. Verifique a sua ligação e tente novamente.');
      console.error('Delete document error:', err);
    } finally {
      setDeletingDocIds(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  const handleAddDocument = async (newDocument: { name: string; type: string; phase: string; supplier: string; file: File | null }) => {
    if (!projectId) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSubmitError('Utilizador não autenticado');
        setIsSubmitting(false);
        return;
      }

      const project = projects.find(p => p.id === projectId);
      const tenantId = project?.tenant_id;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      if (newDocument.file) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setSubmitError('Sessão não encontrada');
          setIsSubmitting(false);
          return;
        }

        const file = newDocument.file;
        const fileName = file.name;

        // Early feedback (the backend and R2 enforce the same limits)
        const fileProblem = validateUploadFile(file);
        const mimeType = resolveUploadMime(file);
        if (fileProblem || !mimeType) {
          setSubmitError(fileProblem || 'Tipo de ficheiro não suportado.');
          setIsSubmitting(false);
          return;
        }

        const signUploadResponse = await fetch(`${supabaseUrl}/functions/v1/r2-sign-upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            project_id: projectId,
            document: {
              title: newDocument.name,
              doc_type: newDocument.type,
              category: newDocument.phase || null,
              supplier_name: newDocument.supplier || null,
            },
            files: [{
              file_name: fileName,
              mime_type: mimeType,
              size_bytes: file.size,
            }],
          }),
        });

        if (!signUploadResponse.ok) {
          const errorData = await signUploadResponse.json().catch(() => ({}));
          setSubmitError(errorData.details || errorData.error || 'Erro ao obter URL de upload');
          console.error('Sign upload error:', errorData);
          setIsSubmitting(false);
          return;
        }

        const signUploadData = await signUploadResponse.json();

        if (!signUploadData.ok || !signUploadData.uploads || signUploadData.uploads.length === 0) {
          setSubmitError('Resposta inválida do servidor');
          setIsSubmitting(false);
          return;
        }

        const uploadInfo = signUploadData.uploads[0];
        const uploadUrl = uploadInfo.upload?.url;
        const documentFileId = uploadInfo.document_file?.id;

        if (!uploadUrl || !documentFileId) {
          setSubmitError('URL de upload não recebida');
          setIsSubmitting(false);
          return;
        }

        // Send exactly the headers the URL was signed with. Content-Length is set by the
        // browser from the body and must not (cannot) be set here.
        let uploadStatus: number;
        try {
          const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: pickUploadHeaders(uploadInfo.upload?.headers, mimeType),
            body: file,
          });
          uploadStatus = uploadResponse.status;
        } catch (uploadErr) {
          console.error('Upload network error:', uploadErr);
          setSubmitError('Não foi possível enviar o ficheiro. Verifique a ligação e tente novamente.');
          setIsSubmitting(false);
          return;
        }

        // 412: storage already holds an object under this key (the first attempt succeeded but
        // its response was lost). Never overwritten; the confirm step below verifies what is there.
        if (uploadStatus !== 412 && !(uploadStatus >= 200 && uploadStatus < 300)) {
          setSubmitError(uploadStatus === 403
            ? 'O envio foi recusado (ligação expirada ou ficheiro diferente do indicado). Tente novamente.'
            : 'Erro ao fazer upload do ficheiro');
          console.error('Upload error status:', uploadStatus);
          setIsSubmitting(false);
          return;
        }

        const confirmUploadResponse = await fetch(`${supabaseUrl}/functions/v1/r2-confirm-upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            document_file_id: documentFileId,
          }),
        });

        if (!confirmUploadResponse.ok) {
          const errorData = await confirmUploadResponse.json().catch(() => ({}));
          setSubmitError(confirmUploadResponse.status === 422
            ? 'O ficheiro enviado é inválido ou não corresponde ao tipo indicado. Escolha outro ficheiro.'
            : errorData.error || 'Erro ao confirmar upload');
          console.error('Confirm upload error:', errorData);
          setIsSubmitting(false);
          return;
        }

        const documentData = signUploadData.document;
        if (documentData) {
          const persistedDocument = {
            id: documentData.id,
            projectId: documentData.project_id,
            name: documentData.title,
            date: new Date(documentData.created_at).toLocaleDateString('pt-PT'),
            type: documentData.doc_type,
            phase: documentData.category || '',
            supplierName: documentData.supplier_name || '',
          };
          addDocument(projectId, persistedDocument);
        }
      } else {
        const { data, error } = await supabase
          .from('documents')
          .insert({
            project_id: projectId,
            tenant_id: tenantId,
            title: newDocument.name,
            doc_type: newDocument.type,
            category: newDocument.phase || null,
            supplier_name: newDocument.supplier || null,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) {
          setSubmitError('Erro ao criar documento. Tente novamente.');
          console.error('Error creating document:', error);
          setIsSubmitting(false);
          return;
        }

        if (data) {
          const persistedDocument = {
            id: data.id,
            projectId: data.project_id,
            name: data.title,
            date: new Date(data.created_at).toLocaleDateString('pt-PT'),
            type: data.doc_type,
            phase: data.category || '',
            supplierName: data.supplier_name || '',
          };
          addDocument(projectId, persistedDocument);
        }
      }

      setIsModalOpen(false);
      setSubmitError(null);
    } catch (err) {
      setSubmitError('Erro ao criar documento. Tente novamente.');
      console.error('Failed to create document:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout 
      currentPage="documents"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      {/* Project Header */}
      <ProjectHeader />

      <div className="space-y-6">
      {/* Section Header (Figma: title + count, primary action) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
          <p className="mt-1 text-sm text-gray-500">{documentsCountLabel}</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)} className="w-fit gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Novo Documento
        </Button>
      </div>

      {/* Filters (values match what documents store: pt-PT phase labels and PDF/Word/Excel/Image) */}
      <Card className="p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="documents-phase-filter" className="block text-sm font-medium text-gray-900">Filtrar por fase</label>
            <select
              id="documents-phase-filter"
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="Todas as fases">Todas as fases</option>
              {DOCUMENT_PHASES.map((phase) => (
                <option key={phase} value={phase}>{phase}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="documents-type-filter" className="block text-sm font-medium text-gray-900">Filtrar por tipo</label>
            <select
              id="documents-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="Todos os tipos">Todos os tipos</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>
        {isFiltering && (
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-3">
              Limpar filtros
            </Button>
          </div>
        )}
      </Card>

      {/* Refresh failed while documents are already shown */}
      {contentState === 'list' && documentsStatus === 'error' && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-700">{documentsError || 'Não foi possível carregar os documentos.'}</p>
          <Button variant="secondary" size="sm" onClick={handleRetry}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Documents list: table from lg (enough width beside the sidebar for six columns), stacked rows below */}
      <Card className="p-4 md:p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          {contentState === 'list' || contentState === 'empty'
            ? isFiltering && contentState === 'list'
              ? `Documentos (${filteredDocuments.length} de ${documents.length})`
              : `Documentos (${documents.length})`
            : 'Documentos'}
          {isRefreshing && <span className="ml-2 text-sm font-normal text-gray-500">A atualizar...</span>}
        </h2>
        {contentState === 'loading' ? (
          renderLoading()
        ) : contentState === 'error' ? (
          renderError()
        ) : contentState === 'empty' ? (
          <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title="Sem documentos adicionados"
            description="Os documentos do projeto irão aparecer aqui."
          />
        ) : filteredDocuments.length === 0 ? (
          <div className="py-8 text-center">
            <FileText className="mx-auto mb-2 h-8 w-8 text-gray-400" aria-hidden="true" />
            <p className="text-sm text-gray-500">Nenhum documento corresponde aos filtros</p>
            <Button variant="secondary" size="sm" onClick={clearFilters} className="mt-4">
              Limpar filtros
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop table (cell padding as on Expenses: 12px outer edges, 8px between columns) */}
            <div className="-mx-3 hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead className="border-b border-gray-200">
                  <tr className="text-left text-sm text-gray-600">
                    <th scope="col" className="pb-3 pl-3 pr-2 font-medium">Nome</th>
                    <th scope="col" className="px-2 pb-3 font-medium">Tipo</th>
                    <th scope="col" className="px-2 pb-3 font-medium">Fase</th>
                    <th scope="col" className="px-2 pb-3 font-medium">Fornecedor</th>
                    <th scope="col" className="px-2 pb-3 font-medium">Data</th>
                    <th scope="col" className="w-24 pb-3 pl-2 pr-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="min-w-[10rem] py-3 pl-3 pr-2">
                        <div className="flex items-start gap-2">
                          <DocumentTypeIcon type={doc.type} />
                          {/* wrap-anywhere: long names without spaces wrap instead of widening the table */}
                          <span className="min-w-0 wrap-anywhere text-sm font-medium text-gray-900">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3"><Badge variant="secondary">{getDocumentTypeLabel(doc.type)}</Badge></td>
                      <td className="px-2 py-3 text-sm text-gray-600">{doc.phase || '—'}</td>
                      <td className="break-words px-2 py-3 text-sm text-gray-600">{doc.supplierName || '—'}</td>
                      <td className="whitespace-nowrap px-2 py-3 text-sm text-gray-600">{doc.date || '—'}</td>
                      <td className="py-1.5 pl-2 pr-3 text-right">
                        <DocumentActions
                          name={doc.name}
                          compact
                          isDeleting={deletingDocIds.has(doc.id)}
                          onDownload={() => handleDownload(doc.id)}
                          onDelete={() => requestDelete(doc.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Stacked rows (mobile and narrow content areas) */}
            <ul className="space-y-3 lg:hidden">
              {filteredDocuments.map((doc) => (
                <li key={doc.id} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-start gap-3">
                    <DocumentTypeIcon type={doc.type} />
                    {/* min-w-0 + break-words: long file names without spaces (e.g. "Orcamento_..._v3.pdf") must wrap
                        instead of widening the card and the page */}
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium text-gray-900">{doc.name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{getDocumentTypeLabel(doc.type)}</Badge>
                        {doc.phase && <span className="text-xs text-gray-500">{doc.phase}</span>}
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        {[doc.supplierName, doc.date].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                    <DocumentActions
                      name={doc.name}
                      isDeleting={deletingDocIds.has(doc.id)}
                      onDownload={() => handleDownload(doc.id)}
                      onDelete={() => requestDelete(doc.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar documento"
        description="Tem a certeza de que pretende eliminar este documento? Esta ação não pode ser revertida."
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {/* Add Document Modal */}
      {/* Mounted only while open, so every opening starts from an empty form */}
      {isModalOpen && <AddDocumentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSubmitError(null);
        }}
        onSubmit={handleAddDocument}
        isSubmitting={isSubmitting}
        error={submitError}
      />}
    </AppLayout>
  );
}
