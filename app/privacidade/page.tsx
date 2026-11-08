import type { Metadata } from 'next';
import Link from 'next/link';
import { Link2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidade — elo',
  description: 'Como o elo trata seus dados e o acesso às suas agendas Google e Microsoft.',
};

const UPDATED_AT = '8 de novembro de 2026';
const CONTACT = 'aamonnlimaa@gmail.com';

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <Link href="/login" className="brand legal-brand" aria-label="elo — voltar para o login">
          <span className="brand-mark"><Link2 size={22} /></span>
          <span>elo<span className="brand-period">.</span></span>
        </Link>

        <h1>Política de Privacidade</h1>
        <p className="legal-updated">Última atualização: {UPDATED_AT}</p>

        <p>
          O elo é um calendário que reúne, em uma só tela, as agendas das contas Google e Microsoft que você decide
          conectar. Esta página explica quais dados o elo usa, para quê e como você mantém o controle sobre eles.
        </p>

        <h2>1. Dados da sua conta no elo</h2>
        <p>Para criar e manter sua conta, o elo armazena:</p>
        <ul>
          <li>seu nome e e-mail;</li>
          <li>sua senha, guardada somente como hash (scrypt com salt individual) — a senha em si nunca é armazenada;</li>
          <li>sessões de login ativas, identificadas por um cookie HttpOnly que o navegador não expõe a scripts.</li>
        </ul>

        <h2>2. Dados das contas Google e Microsoft</h2>
        <p>
          Quando você conecta uma conta, a autorização acontece diretamente na tela do Google ou da Microsoft. O elo
          nunca recebe sua senha desses provedores. Com a sua permissão, o elo acessa:
        </p>
        <ul>
          <li>
            <strong>Identificação básica da conta</strong> (nome, e-mail e identificador) — para mostrar qual conta está
            conectada.
          </li>
          <li>
            <strong>Lista de agendas</strong> — para exibir suas agendas e permitir escolher onde criar eventos.
          </li>
          <li>
            <strong>Eventos</strong> — para exibir seus compromissos e para criar, editar ou excluir eventos quando
            você pedir isso explicitamente na interface.
          </li>
        </ul>
        <p>
          Os eventos são consultados nos provedores no momento em que você abre ou atualiza o calendário. Eles{' '}
          <strong>não são armazenados</strong> no servidor do elo. O elo guarda apenas o necessário para manter a
          conexão: nome, e-mail e identificador da conta, a cor escolhida e os tokens de acesso, criptografados com
          AES-256-GCM. Os tokens nunca são enviados ao navegador.
        </p>
        <p>
          No navegador, o elo usa o armazenamento local apenas para preferências de exibição, como o tema e quais
          agendas ficam ocultas.
        </p>

        <h2>3. Uso limitado dos dados do Google</h2>
        <p>
          O uso e a transferência, para qualquer outro aplicativo, de informações recebidas das APIs do Google seguem
          a{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
            Política de Dados do Usuário dos Serviços de API do Google
          </a>
          , incluindo os requisitos de Uso Limitado. Os dados das suas agendas são usados exclusivamente para oferecer
          as funções do calendário a você. Eles não são vendidos, não são usados para publicidade, não são
          compartilhados com terceiros e não são usados para treinar modelos de inteligência artificial.
        </p>

        <h2>4. Com quem os dados são compartilhados</h2>
        <p>
          Com ninguém, além da infraestrutura necessária para o app funcionar: a hospedagem na Vercel e o banco de
          dados PostgreSQL na Neon, que processam os dados descritos acima em nome do elo. As consultas às agendas
          vão diretamente do servidor do elo para o Google ou a Microsoft.
        </p>

        <h2>5. Seu controle sobre o acesso</h2>
        <ul>
          <li>
            <strong>Desconectar uma conta</strong> no elo apaga imediatamente os tokens e os dados dessa conexão. Seus
            eventos continuam intactos no provedor.
          </li>
          <li>
            Você também pode revogar o acesso diretamente no provedor:{' '}
            <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">
              Conta do Google → Apps e serviços de terceiros
            </a>{' '}
            ou{' '}
            <a href="https://account.live.com/consent/Manage" target="_blank" rel="noreferrer">
              Conta Microsoft → Apps com acesso
            </a>
            .
          </li>
          <li>
            Para excluir sua conta no elo e todos os dados associados, escreva para{' '}
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </li>
        </ul>

        <h2>6. Segurança</h2>
        <p>
          Todo o tráfego usa HTTPS. Tokens de provedores são criptografados no servidor, o fluxo de autorização usa
          PKCE e proteção contra reutilização, e cada usuário só tem acesso às próprias conexões.
        </p>

        <h2>7. Alterações e contato</h2>
        <p>
          Se esta política mudar, a data no topo da página será atualizada. Dúvidas sobre privacidade podem ser
          enviadas para <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <p className="legal-back">
          <Link href="/login">← Voltar para o elo</Link>
        </p>
      </article>
    </main>
  );
}
