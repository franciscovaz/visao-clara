import type { Metadata } from 'next';
import LegalDocument, { LegalSection, Pending } from '@/components/LegalDocument';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
};

// DRAFT for the private beta. Every <Pending> is a statement or fact the owner / legal adviser must
// confirm or complete: no company, contact or legal detail is invented here.
export default function PrivacyPolicyPage() {
  return (
    <LegalDocument title="Política de Privacidade">
      <LegalSection title="1. Quem é o responsável pelo tratamento">
        <p>
          O responsável pelo tratamento dos dados pessoais tratados através do Visão Clara é{' '}
          <Pending>denominação social, NIF, morada e contacto da entidade responsável</Pending>.
        </p>
        <p>
          Para questões de privacidade e para exercer os seus direitos, contacte{' '}
          <Pending>endereço de email de contacto para privacidade</Pending>.
        </p>
        <p>
          Encarregado de proteção de dados:{' '}
          <Pending>indicar o contacto, ou que a designação não é obrigatória</Pending>.
        </p>
      </LegalSection>

      <LegalSection title="2. Que dados tratamos">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Conta:</strong> email, nome e palavra-passe (esta é guardada apenas de forma protegida pelo
            fornecedor de autenticação). Se escolher &ldquo;Continuar com Google&rdquo;, recebemos da Google os dados
            básicos de perfil (nome e email).
          </li>
          <li>
            <strong>Perfil e configuração inicial:</strong> as respostas que dá ao configurar a conta e o primeiro
            projeto e, se os indicar, outros dados de perfil como o telemóvel.
          </li>
          <li>
            <strong>Dados dos projetos:</strong> a informação que introduz: tarefas, despesas (valores, datas,
            fornecedores, garantias) e responsáveis de obra (por exemplo, nome, empresa, cidade e contactos de
            terceiros que decida registar).
          </li>
          <li>
            <strong>Documentos:</strong> os ficheiros que carrega (PDF, DOC, DOCX, XLS, XLSX, JPEG e PNG, até 20 MB
            cada), que ficam guardados em armazenamento privado.
          </li>
          <li>
            <strong>Funcionalidades de IA:</strong> as mensagens que escreve ao assistente e a informação do projeto
            necessária para gerar sugestões de checklist, bem como a contagem de utilização para aplicar os limites
            do plano.
          </li>
          <li>
            <strong>Feedback:</strong> as mensagens que nos enviar através da aplicação.
          </li>
          <li>
            <strong>Dados técnicos:</strong> registos de funcionamento e segurança gerados pela infraestrutura (por
            exemplo, endereço IP e data e hora dos pedidos).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Para que usamos os dados e com que fundamento">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Prestar o serviço (criar a conta, gerir projetos, guardar documentos, exportar dados e fornecer as
            funcionalidades de IA).
          </li>
          <li>Enviar comunicações de serviço, como a confirmação de email e a recuperação da palavra-passe.</li>
          <li>Garantir a segurança, prevenir abusos e aplicar os limites de utilização de cada plano.</li>
          <li>Cumprir obrigações legais.</li>
        </ul>
        <p>
          Fundamentos de licitude:{' '}
          <Pending>
            confirmar, para cada finalidade, o fundamento (execução de contrato, interesse legítimo, obrigação legal
            ou consentimento)
          </Pending>
          .
        </p>
        <p>
          Atualmente a aplicação não usa ferramentas de analítica nem de publicidade e usa o armazenamento local do
          browser apenas para manter a sessão iniciada e guardar preferências de funcionamento.{' '}
          <Pending>confirmar esta informação antes do lançamento e se é necessário aviso de cookies</Pending>.
        </p>
      </LegalSection>

      <LegalSection title="4. Com quem partilhamos os dados (subcontratantes)">
        <p>
          Recorremos aos prestadores abaixo para fornecer o serviço. Tratam os dados em nosso nome e segundo as nossas
          instruções.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Supabase</strong>: base de dados, autenticação e funções de servidor (projeto de produção alojado
            na região da UE, Irlanda).
          </li>
          <li>
            <strong>Cloudflare</strong>: armazenamento privado dos documentos e exportação em ZIP.{' '}
            <Pending>confirmar a jurisdição/região do armazenamento (por exemplo, UE)</Pending>.
          </li>
          <li>
            <strong>OpenAI</strong>: processamento das funcionalidades de IA (sugestões de checklist e assistente).{' '}
            <Pending>
              confirmar o contrato com a OpenAI, incluindo se os dados são usados para treino de modelos e o período de
              conservação
            </Pending>
            .
          </li>
          <li>
            <strong>Netlify</strong>: alojamento da aplicação web.
          </li>
          <li>
            <strong>Fornecedor de envio de emails</strong>: <Pending>nome do fornecedor (ainda por definir)</Pending>.
          </li>
          <li>
            <strong>Google</strong>: apenas se escolher iniciar sessão com a sua conta Google.
          </li>
        </ul>
        <p>
          <Pending>
            confirmar que não cedemos nem vendemos dados pessoais a terceiros para fins próprios, e rever a lista de
            subcontratantes e os respetivos acordos de tratamento de dados
          </Pending>
        </p>
      </LegalSection>

      <LegalSection title="5. Transferências para fora do Espaço Económico Europeu">
        <p>
          Alguns prestadores (por exemplo, a OpenAI) podem tratar dados fora do Espaço Económico Europeu.{' '}
          <Pending>
            indicar as garantias aplicáveis (por exemplo, cláusulas contratuais-tipo ou decisão de adequação)
          </Pending>
          .
        </p>
      </LegalSection>

      <LegalSection title="6. Durante quanto tempo conservamos os dados">
        <p>
          Conservamos os dados enquanto a sua conta estiver ativa. A aplicação ainda não tem eliminação de conta
          automática: pode pedir a eliminação da conta e dos dados através do contacto indicado acima e o pedido é
          tratado manualmente.{' '}
          <Pending>
            prazos de conservação após o cancelamento, tratamento das cópias de segurança e obrigações legais de
            conservação
          </Pending>
          .
        </p>
      </LegalSection>

      <LegalSection title="7. Os seus direitos">
        <p>
          Tem direito de acesso, retificação, apagamento, limitação, oposição e portabilidade dos seus dados, bem como
          o direito de retirar o consentimento quando o tratamento nele se basear. Pode exercê-los através do contacto
          indicado acima. Tem ainda o direito de apresentar reclamação à Comissão Nacional de Proteção de Dados
          (CNPD), em www.cnpd.pt.
        </p>
      </LegalSection>

      <LegalSection title="8. Segurança">
        <p>
          Os dados de cada utilizador ficam isolados por conta e os documentos são guardados em armazenamento privado,
          com ligações de transferência temporárias. Nenhum sistema é totalmente seguro; em caso de violação de dados
          pessoais, atuaremos nos termos da lei.{' '}
          <Pending>confirmar o procedimento interno de notificação de violações de dados</Pending>.
        </p>
      </LegalSection>

      <LegalSection title="9. Alterações a esta política">
        <p>
          Podemos atualizar esta política, por exemplo quando o produto mudar. Indicaremos a data da versão em vigor.{' '}
          <Pending>data de entrada em vigor e forma de comunicar alterações aos utilizadores</Pending>.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
