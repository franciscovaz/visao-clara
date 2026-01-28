'use client';

import { useState } from 'react';
import { HiStar, HiPaperAirplane, HiX } from 'react-icons/hi2';
import { Card } from '@/components/ui/Card';
import AppLayout from '@/components/AppLayout';

type Rating = 'very_poor' | 'poor' | 'ok' | 'good' | 'excellent';

interface RatingOption {
  value: Rating;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const ratingOptions: RatingOption[] = [
  {
    value: 'very_poor',
    label: 'Muito ruim',
    icon: <HiStar className="w-6 h-6" />,
    color: 'text-red-500 border-red-500 bg-red-50'
  },
  {
    value: 'poor',
    label: 'Ruim',
    icon: <HiStar className="w-6 h-6" />,
    color: 'text-orange-500 border-orange-500 bg-orange-50'
  },
  {
    value: 'ok',
    label: 'Ok',
    icon: <HiStar className="w-6 h-6" />,
    color: 'text-yellow-500 border-yellow-500 bg-yellow-50'
  },
  {
    value: 'good',
    label: 'Bom',
    icon: <HiStar className="w-6 h-6" />,
    color: 'text-blue-500 border-blue-500 bg-blue-50'
  },
  {
    value: 'excellent',
    label: 'Excelente',
    icon: <HiStar className="w-6 h-6" />,
    color: 'text-green-500 border-green-500 bg-green-50'
  }
];

export default function FeedbackPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState<Rating | null>(null);
  const [comment, setComment] = useState('');
  const [allowContact, setAllowContact] = useState(false);

  const handleSubmit = () => {
    const feedbackData = {
      rating: selectedRating,
      comment: comment.trim(),
      allowContact,
      timestamp: new Date().toISOString()
    };
    
    console.log('Feedback submitted:', feedbackData);
    
    // Show a simple toast-like message
    alert('Obrigado pelo seu feedback!');
    
    // Reset form
    setSelectedRating(null);
    setComment('');
    setAllowContact(false);
  };

  const handleCancel = () => {
    // Clear form and navigate back to dashboard
    setSelectedRating(null);
    setComment('');
    setAllowContact(false);
    window.location.href = '/dashboard';
  };

  return (
    <AppLayout 
      currentPage="feedback"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Enviar Feedback</h1>
          <p className="text-gray-600 text-base">
            A sua opinião ajuda-nos a melhorar a Visão Clara. Partilhe a sua experiência connosco!
          </p>
        </div>

        {/* Rating Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Como avalia a sua experiência com a Visão Clara?
          </h2>
          
          {/* Rating Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {ratingOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedRating(option.value)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedRating === option.value
                    ? option.color
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <div className={selectedRating === option.value ? '' : 'text-gray-400'}>
                    {option.icon}
                  </div>
                  <span className={`text-sm font-medium ${
                    selectedRating === option.value ? '' : 'text-gray-600'
                  }`}>
                    {option.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Comment Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Tem alguma sugestão ou comentário? (opcional)
          </h2>
          
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Partilhe connosco a sua experiência, sugestões de melhoria ou qualquer comentário que considere relevante..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none h-32 text-gray-900 placeholder-gray-400"
          />
          
          <p className="text-sm text-gray-500 mt-2">
            Os seus comentários ajudam-nos a entender melhor as suas necessidades e a melhorar o nosso serviço.
          </p>
        </div>

        {/* Contact Permission */}
        <div className="mb-8">
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="allowContact"
              checked={allowContact}
              onChange={(e) => setAllowContact(e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <label htmlFor="allowContact" className="text-sm font-medium text-gray-900">
                Podem contactar-me sobre este feedback
              </label>
              <p className="text-sm text-gray-500 mt-1">
                Ao autorizar o contacto, a nossa equipa poderá entrar em consigo para esclarecer detalhes ou informar sobre melhorias implementadas com base no seu feedback.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-3 mb-8">
          <button
            onClick={handleCancel}
            className="w-full md:w-auto px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedRating}
            className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2"
          >
            <HiPaperAirplane className="w-4 h-4" />
            <span>Enviar Feedback</span>
          </button>
        </div>

        {/* Info Banner */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <HiStar className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-1">O seu feedback é valioso</h3>
              <p className="text-sm text-blue-700">
                Cada opinião recebida é analisada pela nossa equipa e contribui diretamente para as melhorias que implementamos na Visão Clara. Agradecemos o tempo dedicado a partilhar a sua experiência.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
