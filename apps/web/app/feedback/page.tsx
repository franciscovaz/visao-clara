'use client';

import { useState } from 'react';
import { Frown, Meh, Smile, Star, Send } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import AppLayout from '@/components/AppLayout';

type RatingValue = 'terrible' | 'bad' | 'okay' | 'good' | 'amazing';

interface RatingOption {
  value: RatingValue;
  label: string;
  icon: any; // lucide-react icon component
  color: string;
  hoverColor: string;
}

const ratingOptions: RatingOption[] = [
  {
    value: 'terrible',
    label: 'Muito ruim',
    icon: Frown,
    color: 'text-red-500',
    hoverColor: 'hover:bg-red-50 hover:border-red-300',
  },
  {
    value: 'bad',
    label: 'Ruim',
    icon: Frown,
    color: 'text-orange-500',
    hoverColor: 'hover:bg-orange-50 hover:border-orange-300',
  },
  {
    value: 'okay',
    label: 'Ok',
    icon: Meh,
    color: 'text-yellow-500',
    hoverColor: 'hover:bg-yellow-50 hover:border-yellow-300',
  },
  {
    value: 'good',
    label: 'Bom',
    icon: Smile,
    color: 'text-blue-500',
    hoverColor: 'hover:bg-blue-50 hover:border-blue-300',
  },
  {
    value: 'amazing',
    label: 'Excelente',
    icon: Star,
    color: 'text-green-500',
    hoverColor: 'hover:bg-green-50 hover:border-green-300',
  },
];

export default function FeedbackPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState<RatingValue | null>(null);
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
    // Clear form and navigate back to project dashboard
    setSelectedRating(null);
    setComment('');
    setAllowContact(false);
    window.location.href = '/proj_1/dashboard';
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
            {ratingOptions.map((option) => {
              const IconComponent = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => setSelectedRating(option.value)}
                  className={`p-4 rounded-lg border-2 transition-all bg-white ${
                    selectedRating === option.value
                      ? `${option.color.replace('text-', 'border-')} bg-${option.color.replace('text-', '').replace('-500', '-50')}`
                      : 'border-gray-200'
                  } ${selectedRating !== option.value ? option.hoverColor : ''}`}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <IconComponent 
                      className={`w-6 h-6 ${option.color}`}
                    />
                    <span className={`text-sm font-medium ${
                      selectedRating === option.value ? 'text-gray-900' : 'text-gray-600'
                    }`}>
                      {option.label}
                    </span>
                  </div>
                </button>
              );
            })}
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
            <Send className="w-4 h-4" />
            <span>Enviar Feedback</span>
          </button>
        </div>

        {/* Info Banner */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Star className="w-4 h-4 text-blue-600" />
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
