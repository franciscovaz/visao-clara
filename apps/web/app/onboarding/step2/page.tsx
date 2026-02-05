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
  const [propertyDescription, setPropertyDescription] = useState('');

  const handlePropertySelect = (propertyId: string) => {
    setSelectedProperty(propertyId);
    // Clear description when switching away from 'other'
    if (propertyId !== 'other') {
      setPropertyDescription('');
    }
  };

  const handleNext = () => {
    // Validation: if 'other' is selected, description is required
    if (selectedProperty === 'other' && !propertyDescription.trim()) {
      return;
    }
    console.log('Selected property:', selectedProperty, 'Description:', propertyDescription);
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

        <div className="space-y-4 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {propertyTypes.map((property) => (
              <PropertyTypeCard
                key={property.id}
                icon={property.icon}
                title={property.title}
                selected={selectedProperty === property.id}
                onClick={() => handlePropertySelect(property.id)}
              />
            ))}
          </div>

          {/* Conditional Description Input */}
          {selectedProperty === 'other' && (
            <div className="md:ml-auto md:max-w-md">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Descrição (opcional)
              </label>
              <input
                type="text"
                value={propertyDescription}
                onChange={(e) => setPropertyDescription(e.target.value)}
                placeholder="Ex: Remodelação parcial, Projeto misto..."
                maxLength={80}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none text-slate-900"
              />
              <p className="text-xs text-slate-500 mt-1">
                {propertyDescription.length}/80 caracteres
              </p>
            </div>
          )}
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
            disabled={!selectedProperty || (selectedProperty === 'other' && !propertyDescription.trim())}
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
