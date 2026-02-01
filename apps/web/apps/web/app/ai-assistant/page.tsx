'use client';

import AppLayout from '@/components/AppLayout';

export default function AIAssistantPage() {
  return (
    <AppLayout currentPage="ai-assistant">
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Assistente IA</h1>
          <p className="text-gray-600">Assistente IA em breve</p>
        </div>
      </div>
    </AppLayout>
  );
}
