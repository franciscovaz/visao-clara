'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PropertyTypeCard } from '@/components/PropertyTypeCard';

const propertyTypes = [
  {
    id: 'house',
    icon: '🏠',
    title: 'Casa',
  },
  {
    id: 'apartment',
    icon: '🏢',
    title: 'Apartamento',
  },
  {
    id: 'other',
    icon: '🏗️',
    title: 'Outro',
  },
];

export default function OnboardingStep2() {
  const router = useRouter();
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);

  const handlePropertySelect = (propertyId: string) => {
    setSelectedProperty(propertyId);
  };

  const handleNext = () => {
    console.log('Selected property:', selectedProperty);
    router.push('/onboarding/step3');
  };

  const handleBack = () => {
    router.push('/onboarding/step1');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <ProgressBar current={2} total={5} label="Etapa 2 de 5" />
        </div>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Tipo de Imóvel
          </h1>
          <p className="text-lg text-slate-600">
            Qual tipo de imóvel?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {propertyTypes.map((property) => (
            <PropertyTypeCard
              key={property.id}
              icon={property.icon}
              title={property.title}
              selected={selectedProperty === property.id}
              onClick={() => handlePropertySelect(property.id)}
              className={property.id === 'other' ? 'md:col-span-2' : ''}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-slate-200">
          <Button
            variant="secondary"
            onClick={handleBack}
            className="flex items-center space-x-2"
          >
            <HiChevronLeft className="w-4 h-4" />
            <span>Voltar</span>
          </Button>

          <Button
            onClick={handleNext}
            disabled={!selectedProperty}
            className="flex items-center space-x-2"
          >
            <span>Próximo</span>
            <HiChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
