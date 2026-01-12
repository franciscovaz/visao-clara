'use client';

import { Card } from '@/components/ui/Card';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl mx-auto p-6 md:p-8">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
            Dashboard - Coming Soon
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            Congratulations! Onboarding completed. The dashboard will be implemented in the next iteration.
          </p>
          <div className="space-y-4 text-left">
            <h2 className="text-xl font-semibold text-slate-800">Onboarding Summary:</h2>
            <ul className="list-disc list-inside space-y-2 text-slate-600">
              <li>Project Type: Selected</li>
              <li>Property Type: Selected</li>
              <li>Current Phase: Selected</li>
              <li>Main Goal: Selected</li>
              <li>Budget: Optional (completed)</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
