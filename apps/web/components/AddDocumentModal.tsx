'use client';

import { useState } from 'react';
import { HiCloudUpload } from 'react-icons/hi';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
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
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Adicionar Documento"
      // An upload in progress cannot be dismissed (Escape, backdrop and the close button are blocked)
      dismissible={!isSubmitting}
    >
      {/* Upload Area */}
      <div className="mb-6">
        {/* A label wrapping the real (visually hidden) file input: clicking it opens the picker natively,
            and keyboard users reach the input with Tab and open it with Enter/Space */}
        <label
          className={`block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 has-[:focus-visible]:ring-offset-2 ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <HiCloudUpload className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
          <span className="block text-gray-900 font-medium mb-2">Clique para fazer upload</span>
          <span className="block text-gray-500 text-sm">ou arraste e solte aqui</span>
          <span className="block text-gray-400 text-xs mt-2">{UPLOAD_FORMATS_LABEL} · máx. 20 MB</span>
          <input
            id="file-input"
            type="file"
            onChange={handleFileSelect}
            className="sr-only"
            accept={UPLOAD_ACCEPT}
            aria-describedby={fileError ? 'file-input-error' : undefined}
          />
        </label>
        {fileError && (
          <div id="file-input-error" role="alert" className="mt-2 text-sm text-red-600">{fileError}</div>
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
          <label htmlFor="document-name" className="block text-sm font-medium text-gray-700 mb-2">
            Nome do Documento
          </label>
          <Input
            id="document-name"
            type="text"
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder="Ex: Planta Baixa Final.pdf"
          />
        </div>

        {/* Supplier Name */}
        <div>
          <label htmlFor="document-supplier" className="block text-sm font-medium text-gray-700 mb-2">
            Nome do fornecedor
          </label>
          <Input
            id="document-supplier"
            type="text"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="Ex: Construtora Silva"
          />
        </div>

        {/* Type */}
        <div>
          <label htmlFor="document-type" className="block text-sm font-medium text-gray-700 mb-2">
            Tipo
          </label>
          <Select
            id="document-type"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
          >
            <option value="PDF">PDF</option>
            <option value="Word">Word</option>
            <option value="Excel">Excel</option>
            <option value="Image">Image</option>
          </Select>
        </div>

        {/* Phase */}
        <div>
          <label htmlFor="document-phase" className="block text-sm font-medium text-gray-700 mb-2">
            Fase
          </label>
          <Select
            id="document-phase"
            value={documentPhase}
            onChange={(e) => setDocumentPhase(e.target.value)}
          >
            <option value="Planeamento">Planeamento</option>
            <option value="Design">Design</option>
            <option value="Licenças">Licenças</option>
            <option value="Construção">Construção</option>
            <option value="Acabamentos">Acabamentos</option>
            <option value="Concluído">Concluído</option>
          </Select>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 text-sm text-red-600">{error}</div>
      )}

      {/* mt-6 as before; the page keeps the modal open on errors and closes it after a successful upload */}
      <ModalFooter className="mt-6 pt-0">
        {/* loading disables the button (no double submission) and shows the shared spinner */}
        <Button type="button" size="full" onClick={handleSubmit} disabled={!!fileError} loading={isSubmitting}>
          {isSubmitting ? 'A carregar...' : 'Adicionar Documento'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
