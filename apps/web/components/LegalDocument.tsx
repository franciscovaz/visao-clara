import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Marks a statement the owner / legal adviser must confirm or complete before launch.
 * Rendered highlighted so nothing unconfirmed can pass for settled text.
 */
export function Pending({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-yellow-100 px-1 py-0.5 font-medium text-yellow-900">
      [A CONFIRMAR: {children}]
    </mark>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

interface LegalDocumentProps {
  title: string;
  children: ReactNode;
}

/** Public, static page shell for the legal texts (no authentication, no data loading). */
export default function LegalDocument({ title, children }: LegalDocumentProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-8">
      <main className="mx-auto w-full max-w-3xl rounded-xl bg-white p-6 shadow-sm md:p-10">
        <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700">
          ← Voltar
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-slate-900 md:text-3xl">{title}</h1>

        <div
          role="note"
          className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900"
        >
          <p className="font-semibold">Rascunho para a versão beta privada, em revisão</p>
          <p className="mt-1">
            Este texto foi preparado como rascunho, a 16 de novembro de 2026, e ainda não foi revisto por um
            advogado. Os pontos assinalados a amarelo estão por confirmar pelo proprietário ou pela assessoria
            jurídica e não devem ser considerados definitivos.
          </p>
        </div>

        {children}

        <p className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
          Ver também:{' '}
          <Link href="/privacidade" className="underline hover:text-slate-700">
            Política de Privacidade
          </Link>{' '}
          ·{' '}
          <Link href="/termos" className="underline hover:text-slate-700">
            Termos de Serviço
          </Link>
        </p>
      </main>
    </div>
  );
}
