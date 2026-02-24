-- Enable RLS and add policies for documents, document_files, and expense_documents

-- Enable RLS

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_documents ENABLE ROW LEVEL SECURITY;

-- A) public.documents policies

CREATE POLICY "documents_select_member" ON public.documents
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

CREATE POLICY "documents_insert_member" ON public.documents
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_member(tenant_id) AND (created_by IS NULL OR created_by = auth.uid()));

CREATE POLICY "documents_update_member" ON public.documents
    FOR UPDATE TO authenticated
    USING (public.is_tenant_member(tenant_id))
    WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "documents_delete_member" ON public.documents
    FOR DELETE TO authenticated
    USING (public.is_tenant_member(tenant_id));

-- B) public.document_files policies

CREATE POLICY "document_files_select_member" ON public.document_files
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

CREATE POLICY "document_files_insert_member" ON public.document_files
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_member(tenant_id) AND (created_by IS NULL OR created_by = auth.uid()));

CREATE POLICY "document_files_update_member" ON public.document_files
    FOR UPDATE TO authenticated
    USING (public.is_tenant_member(tenant_id))
    WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "document_files_delete_member" ON public.document_files
    FOR DELETE TO authenticated
    USING (public.is_tenant_member(tenant_id));

-- C) public.expense_documents policies

CREATE POLICY "expense_documents_select_member" ON public.expense_documents
    FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

CREATE POLICY "expense_documents_insert_member" ON public.expense_documents
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "expense_documents_delete_member" ON public.expense_documents
    FOR DELETE TO authenticated
    USING (public.is_tenant_member(tenant_id));
