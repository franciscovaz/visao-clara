import type { Metadata } from 'next';
import Link from 'next/link';
import LegalDocument, { LegalSection, Pending } from '@/components/LegalDocument';

export const metadata: Metadata = {
  title: 'Termos de Serviço',
};

// DRAFT for the private beta. Every <Pending> is a statement or fact the owner / legal adviser must
// confirm or complete: no company, price, liability or jurisdiction detail is invented here.
export default function TermsOfServicePage() {
  return (
    <LegalDocument title="Termos de Serviço">
      <LegalSection title="1. Quem somos e âmbito">
        <p>
          O Visão Clara é uma aplicação para gerir obras e remodelações (checklist por fase, despesas, documentos e
          responsáveis de obra), disponibilizada por{' '}
          <Pending>denominação social, NIF e morada da entidade responsável</Pending>. Ao criar uma conta ou usar o
          serviço, aceita estes termos.
        </p>
      </LegalSection>

      <LegalSection title="2. Versão beta privada">
        <p>
          O serviço está numa fase beta privada. Pode ter erros, ser alterado ou ficar indisponível, e funcionalidades
          podem mudar ou ser removidas. Não garantimos, nesta fase, um nível de disponibilidade.{' '}
          <Pending>confirmar se existe algum compromisso de disponibilidade, de suporte ou de cópias de segurança</Pending>
          .
        </p>
        <p>
          O acesso é concedido a utilizadores convidados.{' '}
          <Pending>confirmar as condições de acesso à beta e se esta é gratuita</Pending>.
        </p>
      </LegalSection>

      <LegalSection title="3. Conta e segurança">
        <ul className="list-disc space-y-2 pl-5">
          <li>Tem de fornecer dados verdadeiros e manter a sua palavra-passe confidencial.</li>
          <li>É responsável pela atividade realizada na sua conta.</li>
          <li>Avise-nos de imediato se suspeitar de acesso não autorizado.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Utilização aceitável">
        <p>Não pode usar o serviço para:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>atividades ilegais, ou para violar direitos de terceiros;</li>
          <li>carregar ficheiros com vírus, código malicioso ou conteúdo ilícito;</li>
          <li>tentar aceder a dados de outras contas, contornar limites do plano ou perturbar o serviço;</li>
          <li>
            registar dados pessoais de terceiros (por exemplo, contactos de empreiteiros) sem ter legitimidade para o
            fazer.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. O seu conteúdo">
        <p>
          Os dados e ficheiros que introduz continuam a ser seus. Dá-nos apenas a autorização necessária para os
          guardar, tratar e disponibilizar-lhos através do serviço, conforme descrito na{' '}
          <Link href="/privacidade" className="text-blue-600 underline hover:text-blue-700">
            Política de Privacidade
          </Link>
          . É responsável por ter os direitos necessários sobre o que carrega e por manter cópias dos documentos
          importantes.
        </p>
      </LegalSection>

      <LegalSection title="6. Funcionalidades de IA">
        <p>
          As sugestões de checklist e as respostas do assistente são geradas automaticamente, podem conter erros ou
          estar incompletas e não substituem aconselhamento profissional (técnico, jurídico, fiscal ou financeiro).
          Deve confirmar a informação relevante antes de tomar decisões.{' '}
          <Pending>confirmar a redação desta exclusão e os limites de utilização de cada plano</Pending>.
        </p>
      </LegalSection>

      <LegalSection title="7. Planos e preços">
        <p>
          Algumas funcionalidades (por exemplo, a exportação) dependem do plano da conta.{' '}
          <Pending>preços, faturação, período de teste, renovação e política de reembolso (ou que a beta é gratuita)</Pending>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Limitação de responsabilidade">
        <p>
          <Pending>
            cláusula de limitação de responsabilidade, a redigir ou rever por assessoria jurídica, respeitando os
            limites imperativos da lei aplicável, incluindo os direitos dos consumidores
          </Pending>
        </p>
      </LegalSection>

      <LegalSection title="9. Suspensão e cessação">
        <p>
          Pode deixar de usar o serviço e pedir a eliminação da conta quando quiser, através do contacto indicado abaixo.
          Podemos suspender ou encerrar contas que violem estes termos ou comprometam a segurança do serviço.{' '}
          <Pending>prazo de aviso e o que acontece aos dados após o encerramento</Pending>.
        </p>
      </LegalSection>

      <LegalSection title="10. Alterações aos termos">
        <p>
          Podemos alterar estes termos. As alterações relevantes serão comunicadas e a versão em vigor indicará a
          respetiva data.{' '}
          <Pending>data de entrada em vigor e forma de comunicação das alterações</Pending>.
        </p>
      </LegalSection>

      <LegalSection title="11. Lei aplicável e litígios">
        <p>
          <Pending>lei aplicável, foro competente e, se aplicável, informação sobre resolução alternativa de litígios de consumo</Pending>
        </p>
      </LegalSection>

      <LegalSection title="12. Contacto">
        <p>
          <Pending>endereço de email e, se aplicável, morada para contacto e suporte</Pending>
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
