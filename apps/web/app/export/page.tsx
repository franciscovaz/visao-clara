'use client';

import { useState } from 'react';
import { HiDownload, HiDocumentText, HiFolder, HiClipboardList, HiInformationCircle } from 'react-icons/hi';
import { Card } from '@/components/ui/Card';
import AppLayout from '@/components/AppLayout';
import ProjectHeader from '@/src/components/ProjectHeader';

export default function ExportPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleExportExpenses = () => {
    console.log('Export expenses CSV');
    // Placeholder: show toast or handle export
  };

  const handleExportDocuments = () => {
    console.log('Export documents ZIP');
    // Placeholder: show toast or handle export
  };

  const handleExportComplete = () => {
    console.log('Export complete report');
    // Placeholder: show toast or handle export
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

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Exportar Dados</h2>
        <p className="text-gray-600 text-sm">Faça download dos dados do seu projeto</p>
      </div>

      <div className="hidden md:grid grid-cols-3 gap-6 mb-6">
        <Card className="relative">
          <div className="p-6 pb-20">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <HiDocumentText className="w-6 h-6 text-blue-600" />
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
              className="absolute bottom-4 left-6 right-6 flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <HiDownload className="w-4 h-4" />
              <span>Baixar CSV</span>
            </button>
          </div>
        </Card>

        <Card className="relative">
          <div className="p-6 pb-20">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                <HiFolder className="w-6 h-6 text-green-600" />
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
              className="absolute bottom-4 left-6 right-6 flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <HiDownload className="w-4 h-4" />
              <span>Baixar ZIP</span>
            </button>
          </div>
        </Card>

        <Card className="relative">
          <div className="p-6 pb-20">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                <HiClipboardList className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Exportação Completa</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">Baixe um relatório completo do projeto incluindo todos os dados</p>
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Inclui:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  Informações do projeto
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  Checklist completo
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  Lista de documentos
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  Relatório de despesas
                </li>
              </ul>
            </div>
            <button
              onClick={handleExportComplete}
              className="absolute bottom-4 left-6 right-6 flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <HiDownload className="w-4 h-4" />
              <span>Baixar Relatório</span>
            </button>
          </div>
        </Card>
      </div>

      <div className="md:hidden space-y-4 mb-6">
        <Card className="relative">
          <div className="p-6 pb-20">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <HiDocumentText className="w-6 h-6 text-blue-600" />
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
              className="absolute bottom-4 left-6 right-6 flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <HiDownload className="w-4 h-4" />
              <span>Baixar CSV</span>
            </button>
          </div>
        </Card>

        <Card className="relative">
          <div className="p-6 pb-20">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                <HiFolder className="w-6 h-6 text-green-600" />
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
              className="absolute bottom-4 left-6 right-6 flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <HiDownload className="w-4 h-4" />
              <span>Baixar ZIP</span>
            </button>
          </div>
        </Card>

        <Card className="relative">
          <div className="p-6 pb-20">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                <HiClipboardList className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Exportação Completa</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">Baixe um relatório completo do projeto incluindo todos os dados</p>
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Inclui:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  Informações do projeto
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  Checklist completo
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  Lista de documentos
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  Relatório de despesas
                </li>
              </ul>
            </div>
            <button
              onClick={handleExportComplete}
              className="absolute bottom-4 left-6 right-6 flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <HiDownload className="w-4 h-4" />
              <span>Baixar Relatório</span>
            </button>
          </div>
        </Card>
      </div>

      <Card className="bg-blue-50">
        <div className="p-6">
          <div className="flex items-start">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
              <HiInformationCircle className="w-5 h-5 text-blue-600" />
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
