'use client';

import { useState } from 'react';
import { Document, Download, Trash, Plus, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import AppLayout from '@/components/AppLayout';
import AddDocumentModal from '@/components/AddDocumentModal';
import { useProjectStore } from '@/src/store/projectStore';
import { supabase } from '@/lib/supabase/client';
import ProjectHeader from '@/src/components/ProjectHeader';

export default function DocumentsPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState('Todas as fases');
  const [typeFilter, setTypeFilter] = useState('Todos os tipos');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Get active project documents from store
  const projectId = useProjectStore(s => s.activeProjectId);
  const { getDocumentsForProject, addDocument, deleteDocument, projects } = useProjectStore();
  const documents = getDocumentsForProject(projectId);

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'PDF':
        return '📄';
      case 'EXCEL':
        return '📊';
      case 'OTHER':
        return '📄';
      default:
        return '📄';
    }
  };

  const handleDownload = (docId: string) => {
    console.log('Download document:', docId);
  };

  const handleDelete = (docId: string) => {
    deleteDocument(projectId, docId);
  };

  const handleAddDocument = async (newDocument: { name: string; type: string; phase: string; date: string }) => {
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

      const { data, error } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          tenant_id: tenantId,
          title: newDocument.name,
          doc_type: newDocument.type,
          category: newDocument.phase || null,
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
        };
        addDocument(projectId, persistedDocument);
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

      {/* Section Header */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-gray-900">Documentos</h2>
            <p className="text-gray-500 text-base">{documents.length} documentos</p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="w-fit flex items-center gap-2 px-5 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Novo Documento</span>
          </button>
        </div>
      </div>

      {/* Filters Card - Desktop */}
      <div className="hidden md:block mb-6">
        <Card>
          <div className="flex items-center justify-between p-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrar por Fase
              </label>
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
              >
                <option value="Todas as fases">Todas as fases</option>
                <option value="Planning">Planning</option>
                <option value="Design">Design</option>
                <option value="Construction">Construction</option>
                <option value="Finishing">Finishing</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="flex-1 ml-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrar por Tipo
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
              >
                <option value="Todos os tipos">Todos os tipos</option>
                <option value="PDF">PDF</option>
                <option value="Excel">Excel</option>
                <option value="Word">Word</option>
                <option value="Image">Image</option>
              </select>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters Card - Mobile */}
      <div className="md:hidden mt-6 mb-6">
        <Card>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="block text-base font-semibold text-gray-900">
                Filtrar por Fase
              </label>
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
              >
                <option value="Todas as fases">Todas as fases</option>
                <option value="Planning">Planning</option>
                <option value="Design">Design</option>
                <option value="Construction">Construction</option>
                <option value="Finishing">Finishing</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-base font-semibold text-gray-900">
                Filtrar por Tipo
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
              >
                <option value="Todos os tipos">Todos os tipos</option>
                <option value="PDF">PDF</option>
                <option value="Excel">Excel</option>
                <option value="Word">Word</option>
                <option value="Image">Image</option>
              </select>
            </div>
          </div>
        </Card>
      </div>


      {/* Documents List - Desktop */}
      <div className="hidden md:block">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentos ({documents.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Nome</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Tipo</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Fase</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Data</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8">
                        <EmptyState
                          icon={<FileText className="w-8 h-8" />}
                          title="Sem documentos adicionados"
                          description="Os documentos do projeto irão aparecer aqui."
                        />
                      </td>
                    </tr>
                  ) : (
                    documents.map((doc) => (
                      <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-2xl">{getFileIcon(doc.type)}</span>
                            <span className="font-medium text-gray-900">{doc.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">
                            {doc.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{doc.phase}</td>
                        <td className="py-3 px-4 text-gray-600">{doc.date}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleDownload(doc.id)}
                              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(doc.id)}
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

      {/* Documents List - Mobile */}
      <div className="md:hidden space-y-4 mb-24">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentos ({documents.length})</h3>
        {documents.length === 0 ? (
          <Card>
            <div className="p-8">
              <EmptyState
                icon={<FileText className="w-8 h-8" />}
                title="Sem documentos adicionados"
                description="Os documentos do projeto irão aparecer aqui."
              />
            </div>
          </Card>
        ) : (
          documents.map((doc) => (
            <Card key={doc.id}>
              <div className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="text-2xl">{getFileIcon(doc.type)}</div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{doc.name}</h4>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>Tipo: {doc.type}</span>
                      <span>Fase: {doc.phase}</span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Data: {doc.date}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDownload(doc.id)}
                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
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

      {/* Add Document Modal */}
      <AddDocumentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddDocument}
      />
    </AppLayout>
  );
}
