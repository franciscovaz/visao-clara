-- Add documents schema (metadata and files)

-- A) public.documents
CREATE TABLE IF NOT EXISTS public.documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    doc_type text,
    category text,
    tags text[] NOT NULL DEFAULT '{}',
    issued_on date,
    supplier_name text,
    expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_project_created_at ON public.documents(project_id, created_at DESC);
CREATE INDEX idx_documents_tenant_project ON public.documents(tenant_id, project_id);
CREATE INDEX idx_documents_doc_type ON public.documents(doc_type);

-- B) public.document_files
CREATE TABLE IF NOT EXISTS public.document_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
    checksum_sha256 text,
    r2_bucket text,
    r2_key text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'failed', 'deleted')),
    uploaded_at timestamptz,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_files_document_created_at ON public.document_files(document_id, created_at DESC);
CREATE INDEX idx_document_files_project_created_at ON public.document_files(project_id, created_at DESC);
CREATE INDEX idx_document_files_tenant_project ON public.document_files(tenant_id, project_id);
CREATE INDEX idx_document_files_r2_key ON public.document_files(r2_key) WHERE r2_key IS NOT NULL;

-- C) public.expense_documents (join table)
CREATE TABLE IF NOT EXISTS public.expense_documents (
    expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (expense_id, document_id)
);

CREATE INDEX idx_expense_documents_project_created_at ON public.expense_documents(project_id, created_at DESC);
CREATE INDEX idx_expense_documents_tenant_project ON public.expense_documents(tenant_id, project_id);
