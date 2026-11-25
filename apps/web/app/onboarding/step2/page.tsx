'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { OptionCard, OPTION_ICONS } from '@/components/OptionCard';
import { OnboardingShell, OptionGrid } from '@/components/OnboardingShell';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useAppContextStore } from '@/src/store/appContextStore';

const propertyTypes = [
  {
    id: 'house',
    icon: OPTION_ICONS.propertyType['house'],
    title: 'Casa',
  },
  {
    id: 'apartment',
    icon: OPTION_ICONS.propertyType['apartment'],
    title: 'Apartamento',
  },
  {
    id: 'other',
    icon: OPTION_ICONS.propertyType['other'],
    title: 'Outro',
  },
];

export default function OnboardingStep2() {
  const router = useRouter();
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [propertyDescription, setPropertyDescription] = useState('');
  const { setPendingOnboardingData, pendingOnboardingData } = useAppContextStore();

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
    
    // Save step data to store
    setPendingOnboardingData({
      projectType: pendingOnboardingData?.projectType || '',
      propertyType: selectedProperty || '',
      propertyDescription: selectedProperty === 'other' ? propertyDescription : undefined,
      currentPhase: pendingOnboardingData?.currentPhase || '',
      goal: pendingOnboardingData?.goal || '',
      budget: pendingOnboardingData?.budget,
      projectDescription: pendingOnboardingData?.projectDescription,
    });
    
    router.push('/onboarding/step3');
  };

  const handleBack = () => {
    router.push('/onboarding/step1');
  };

  return (
    <OnboardingShell
      step={2}
      totalSteps={5}
      title="Tipo de imóvel"
      description="Que tipo de imóvel?"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleBack} className="h-10 gap-2 px-3">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar
          </Button>
          <Button size="sm" onClick={handleNext} disabled={!selectedProperty || (selectedProperty === 'other' && !propertyDescription.trim())} className="h-10 gap-2">
            Seguinte
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <OptionGrid label="Tipo de imóvel" columns={3}>
          {propertyTypes.map((property) => (
            <OptionCard
              key={property.id}
              icon={property.icon}
              title={property.title}
              selected={selectedProperty === property.id}
              onClick={() => handlePropertySelect(property.id)}
            />
          ))}
        </OptionGrid>

        {/* Conditional Description Input */}
        {selectedProperty === 'other' && (
            <div className="sm:ml-auto sm:max-w-md">
              <Label htmlFor="property-description">Descrição (opcional)</Label>
              <Input
                id="property-description"
                type="text"
                value={propertyDescription}
                onChange={(e) => setPropertyDescription(e.target.value)}
                placeholder="Ex: Remodelação parcial, Projeto misto..."
                maxLength={80}
                aria-describedby="property-description-count"
              />
              <p id="property-description-count" className="mt-1.5 text-xs text-gray-500">
                {propertyDescription.length}/80 caracteres
              </p>
            </div>
        )}
      </div>
    </OnboardingShell>
  );
}
