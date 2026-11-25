'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, CheckSquare, FileText, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const features = [
  {
    icon: CheckSquare,
    title: 'Organização',
    description: 'Mantenha todos os seus documentos e informações num só lugar',
  },
  {
    icon: FileText,
    title: 'Controlo',
    description: 'Acompanhe despesas, orçamentos e progresso do projeto em tempo real',
  },
  {
    icon: TrendingUp,
    title: 'Clareza',
    description: 'Tenha uma visão completa das próximas etapas e decisões importantes',
  },
];

export function WelcomePage() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/onboarding/step1');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-12">
      <div className="mx-auto w-full max-w-3xl space-y-10 text-center">
        <div className="space-y-4">
          <div className="flex justify-center">
            <Building2 className="h-16 w-16 text-blue-600" aria-hidden="true" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">Visão Clara</h1>
          <p className="mx-auto max-w-xl text-lg text-gray-600 sm:text-xl">
            Faça a gestão dos seus projetos imobiliários com clareza e controlo. Do planeamento à entrega,
            acompanhe cada etapa, documento e despesa num só lugar.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {features.map((feature) => {
            const IconComponent = feature.icon;
            return (
              <Card key={feature.title} className="text-center">
                <IconComponent className="mx-auto mb-3 h-8 w-8 text-blue-600" aria-hidden="true" />
                <h2 className="mb-2 font-semibold text-gray-900">{feature.title}</h2>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </Card>
            );
          })}
        </div>

        <div>
          <Button size="lg" className="gap-2 px-10" onClick={handleStart}>
            Começar
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
