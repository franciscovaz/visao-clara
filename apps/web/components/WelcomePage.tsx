'use client';

import { useRouter } from 'next/navigation';
import { HiHome, HiChartBar, HiCheckCircle } from 'react-icons/hi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const features = [
  {
    icon: HiHome,
    title: 'Organização',
    description: 'Mantenha todos os seus documentos e informações em um só lugar',
  },
  {
    icon: HiChartBar,
    title: 'Controle',
    description: 'Acompanhe despesas, orçamentos e progresso do projeto em tempo real',
  },
  {
    icon: HiCheckCircle,
    title: 'Clareza',
    description: 'Tenha visão completa das próximas etapas e decisões importantes',
  },
];

export function WelcomePage() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/onboarding/step1');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
              <HiHome className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Visão Clara
          </h1>
          
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Gerencie seus projetos imobiliários com clareza e controle. 
            Desde o planeamento até a entrega, acompanhe cada etapa, 
            documento e despesa em um só lugar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Card key={index} className="text-center hover:shadow-md transition-shadow duration-200">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <IconComponent className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </div>

        <div className="text-center">
          <Button size="lg" className="px-8 py-4 text-lg" onClick={handleStart}>
            Começar
          </Button>
        </div>
      </div>
    </div>
  );
}
