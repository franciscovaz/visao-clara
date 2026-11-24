'use client';

import { useState } from 'react';
import { Frown, Meh, Smile, Star, Send } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import AppLayout from '@/components/AppLayout';
import { supabase } from '../../lib/supabase/client';

type RatingValue = 'terrible' | 'bad' | 'okay' | 'good' | 'amazing';
type DbRating = 'very_bad' | 'bad' | 'ok' | 'good' | 'excellent';

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
    label: 'Muito mau',
    icon: Frown,
    color: 'text-red-500',
    hoverColor: 'hover:bg-red-50 hover:border-red-300',
  },
  {
    value: 'bad',
    label: 'Mau',
    icon: Frown,
    color: 'text-orange-500',
    hoverColor: 'hover:bg-orange-50 hover:border-orange-300',
  },
  {
    value: 'okay',
    label: 'Razoável',
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Get user's existing project for redirect
  const getUserProjectForRedirect = async (): Promise<string> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return '/proj_1/dashboard';

      const { data: tenantMembers } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1);

      if (tenantMembers && tenantMembers.length > 0) {
        const userTenantId = tenantMembers[0].tenant_id;
        
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('tenant_id', userTenantId)
          .eq('status', 'active')
          .limit(1);

        if (projects && projects.length > 0) {
          return `/${projects[0].id}/dashboard`;
        }
      }
      
      return '/proj_1/dashboard';
    } catch (error) {
      console.error('Error getting user project for redirect:', error);
      return '/proj_1/dashboard';
    }
  };

  const ratingToDb: Record<RatingValue, DbRating> = {
    terrible: 'very_bad',
    bad: 'bad',
    okay: 'ok',
    good: 'good',
    amazing: 'excellent',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRating) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSubmitError('Utilizador não autenticado');
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        rating: ratingToDb[selectedRating],
        comment: comment.trim() || null,
        can_contact: allowContact,
      });

      if (error) {
        setSubmitError('Erro ao enviar feedback. Tente novamente.');
        console.error('Feedback insert error:', error);
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      setSelectedRating(null);
      setComment('');
      setAllowContact(false);
    } catch (err) {
      setSubmitError('Erro ao enviar feedback. Tente novamente.');
      console.error('Feedback submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    // Clear form and navigate back to project
    setSelectedRating(null);
    setComment('');
    setAllowContact(false);
    
    // Redirect to user's actual project
    //const redirectUrl = await getUserProjectForRedirect();
    //window.location.href = redirectUrl;
  };

  return (
    <AppLayout 
      currentPage="feedback"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="p-4 md:p-6">
          {/* Header (Figma: title inside the form card) */}
          <h1 className="text-2xl font-bold text-gray-900">Enviar Feedback</h1>
          <p className="mt-2 text-sm text-gray-500">
            A sua opinião ajuda-nos a melhorar a Visão Clara. Partilhe a sua experiência connosco!
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {/* Rating */}
            <fieldset className="space-y-3">
              <legend className="mb-3 text-sm font-medium text-gray-900">
                Como avalia a sua experiência com a Visão Clara?
              </legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {ratingOptions.map((option) => {
                  const IconComponent = option.icon;
                  const isSelected = selectedRating === option.value;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setSelectedRating(option.value)}
                      aria-pressed={isSelected}
                      className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        isSelected ? 'border-blue-500 bg-blue-50 shadow-sm' : `border-gray-200 bg-white ${option.hoverColor}`
                      }`}
                    >
                      <IconComponent
                        className={`mb-2 h-8 w-8 transition-colors ${isSelected ? 'text-blue-600' : option.color}`}
                        aria-hidden="true"
                      />
                      <span className={`text-center text-xs font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Comment */}
            <div className="space-y-2">
              <label htmlFor="feedback-comment" className="block text-sm font-medium text-gray-900">
                Tem alguma sugestão ou comentário? (opcional)
              </label>
              <Textarea
                id="feedback-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={6}
                aria-describedby="feedback-comment-help"
                placeholder="Partilhe connosco a sua experiência, sugestões de melhoria ou qualquer comentário que considere relevante..."
                className="min-h-32"
              />
              <p id="feedback-comment-help" className="text-xs text-gray-500">
                Os seus comentários ajudam-nos a entender melhor as suas necessidades e a melhorar o nosso serviço.
              </p>
            </div>

            {/* Contact permission */}
            <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-4">
              <input
                type="checkbox"
                id="allowContact"
                checked={allowContact}
                onChange={(e) => setAllowContact(e.target.checked)}
                aria-describedby="allowContact-help"
                className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded border-gray-300"
              />
              <div className="min-w-0">
                <label htmlFor="allowContact" className="cursor-pointer text-sm font-medium text-gray-900">
                  Podem contactar-me sobre este feedback
                </label>
                <p id="allowContact-help" className="mt-1 text-xs text-gray-500">
                  Ao autorizar o contacto, a nossa equipa poderá entrar em contacto consigo para esclarecer detalhes ou informar sobre melhorias implementadas com base no seu feedback.
                </p>
              </div>
            </div>

            {/* Messages */}
            {submitError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {submitError}
              </div>
            )}
            {isSuccess && (
              <div role="status" className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <Star className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" aria-hidden="true" />
                <p>Obrigado pelo seu feedback! Foi enviado com sucesso.</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
              <Button type="button" variant="outline" size="sm" onClick={handleCancel} className="h-10 w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!selectedRating}
                loading={isSubmitting}
                className="h-10 w-full gap-2 sm:ml-auto sm:w-auto"
              >
                {isSubmitting ? 'A enviar...' : (
                  <>
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Enviar Feedback
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>

        {/* Help callout (Figma) */}
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
            <Smile className="h-4 w-4 text-blue-600" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-blue-900">O seu feedback é valioso</h2>
            <p className="mt-1 text-sm text-blue-700">
              Cada opinião recebida é analisada pela nossa equipa e contribui diretamente para as melhorias que implementamos na Visão Clara. Agradecemos o tempo dedicado a partilhar a sua experiência.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
