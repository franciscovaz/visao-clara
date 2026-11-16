'use client';

import { useState } from 'react';
import { HiX, HiCloudUpload } from 'react-icons/hi';
import { UPLOAD_ACCEPT, UPLOAD_FORMATS_LABEL, validateUploadFile } from '@/src/utils/uploadPolicy';

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (document: {
    name: string;
    supplier: string;
    type: string;
    phase: string;
    file: File | null;
  }) => void;
  isSubmitting?: boolean;
  /** Error from the last submit attempt (pt-PT); the modal stays open so the user can retry */
  error?: string | null;
}

export default function AddDocumentModal({ isOpen, onClose, onSubmit, isSubmitting, error }: AddDocumentModalProps) {
  const [documentName, setDocumentName] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [documentType, setDocumentType] = useState('PDF');
  const [documentPhase, setDocumentPhase] = useState('Planeamento');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  if (!isOpen) return null;

  const acceptFile = (file: File) => {
    const problem = validateUploadFile(file);
    setFileError(problem);
    if (problem) {
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    // Auto-fill document name from file if empty
    if (!documentName) {
      setDocumentName(file.name);
    }
  };

  const handleSubmit = () => {
    // The page closes the modal when the document was saved; on errors it stays open
    onSubmit({
      name: documentName,
      supplier: supplierName,
      type: documentType,
      phase: documentPhase,
      file: selectedFile || null,
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      acceptFile(file);
    }
    // Allow choosing the same file again after an error
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      acceptFile(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)' }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <HiX className="w-5 h-5" />
        </button>
        
        {/* Modal Content */}
        <div className="p-6">
          {/* Title */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Adicionar Documento</h2>
          </div>

          {/* Upload Area */}
          <div className="mb-6">
            <div
              className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <HiCloudUpload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-900 font-medium mb-2">Clique para fazer upload</p>
              <p className="text-gray-500 text-sm">ou arraste e solte aqui</p>
              <p className="text-gray-400 text-xs mt-2">{UPLOAD_FORMATS_LABEL} · máx. 20 MB</p>
              <input
                id="file-input"
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept={UPLOAD_ACCEPT}
              />
            </div>
            {fileError && (
              <div role="alert" className="mt-2 text-sm text-red-600">{fileError}</div>
            )}
            {selectedFile && (
              <div className="mt-2 text-sm text-gray-600">
                Ficheiro selecionado: <span className="font-medium text-gray-900">{selectedFile.name}</span>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            {/* Document Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Documento
              </label>
              <input
                type="text"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
                placeholder="Ex: Planta Baixa Final.pdf"
              />
            </div>

            {/* Supplier Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome do fornecedor
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
                placeholder="Ex: Construtora Silva"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
              >
                <option value="PDF">PDF</option>
                <option value="Word">Word</option>
                <option value="Excel">Excel</option>
                <option value="Image">Image</option>
              </select>
            </div>

            {/* Phase */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fase
              </label>
              <select
                value={documentPhase}
                onChange={(e) => setDocumentPhase(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-gray-900"
              >
                <option value="Planeamento">Planeamento</option>
                <option value="Design">Design</option>
                <option value="Licenças">Licenças</option>
                <option value="Construção">Construção</option>
                <option value="Acabamentos">Acabamentos</option>
                <option value="Concluído">Concluído</option>
              </select>
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-4 text-sm text-red-600">{error}</div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !!fileError}
            className="mt-6 w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>A carregar...</span>
              </>
            ) : (
              <span>Adicionar Documento</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
