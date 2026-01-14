'use client';

import { useState } from 'react';
import { HiDocument, HiDownload, HiTrash, HiPlus } from 'react-icons/hi';
import { Card } from '@/components/ui/Card';
import AppLayout from '@/components/AppLayout';
import AddDocumentModal from '@/components/AddDocumentModal';

export default function DocumentsPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState('Todas as fases');
  const [typeFilter, setTypeFilter] = useState('Todos os tipos');

  // Mock data for documents
  const [documents, setDocuments] = useState([
    {
      id: '1',
      name: 'Project Proposal.pdf',
      type: 'PDF',
      phase: 'Planning',
      date: '05/01/2026',
    },
    {
      id: '2',
      name: 'Budget Estimate.xlsx',
      type: 'Excel',
      phase: 'Planning',
      date: '08/01/2026',
    },
    {
      id: '3',
      name: 'Floor Plan v1.pdf',
      type: 'PDF',
      phase: 'Design',
      date: '10/01/2026',
    },
  ]);

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'PDF':
        return '📄';
      case 'Excel':
        return '📊';
      default:
        return '📄';
    }
  };

  const handleDownload = (docId: string) => {
    console.log('Download document:', docId);
  };

  const handleDelete = (docId: string) => {
    console.log('Delete document:', docId);
  };

  const handleAddDocument = (newDocument: {
    name: string;
    supplier: string;
    type: string;
    phase: string;
    file?: File;
  }) => {
    const newDoc = {
      id: Date.now().toString(),
      name: newDocument.name,
      type: newDocument.type,
      phase: newDocument.phase,
      date: new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '/'),
    };
    
    setDocuments(prevDocs => [...prevDocs, newDoc]);
  };

  return (
    <AppLayout 
      currentPage="documentos"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      {/* Project Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Investimento</h1>
        <p className="text-gray-600 text-lg">Apartamento • Fase: completed</p>
        <div className="w-full h-px bg-gray-300 mt-4"></div>
      </div>

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Documentos</h2>
          <p className="text-gray-600 text-sm">{documents.length} documentos</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <HiPlus className="w-4 h-4" />
          <span>Novo Documento</span>
        </button>
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
      <div className="md:hidden mb-6">
        <Card>
          <div className="p-6 space-y-4">
            <div>
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
            <div>
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
                  {documents.map((doc) => (
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
                            <HiDownload className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
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

      {/* Documents List - Mobile */}
      <div className="md:hidden space-y-4 mb-24">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentos ({documents.length})</h3>
        {documents.map((doc) => (
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
                    <HiDownload className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
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

      {/* Add Document Modal */}
      <AddDocumentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddDocument}
      />
    </AppLayout>
  );
}
