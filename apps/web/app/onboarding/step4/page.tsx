'use client';

import { useRouter } from 'next/navigation';
import { HiChevronLeft } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function OnboardingStep4() {
  const router = useRouter();

  const handleBack = () => {
    router.push('/onboarding/step3');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl mx-auto p-6 md:p-8">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
            Step 4 - Coming Soon
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            This step will be implemented in the next iteration.
          </p>
          <Button
            variant="secondary"
            onClick={handleBack}
            className="flex items-center space-x-2"
          >
            <HiChevronLeft className="w-4 h-4" />
            <span>Voltar</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
