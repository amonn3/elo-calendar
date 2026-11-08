# elo

Calendário unificado para agendas Google e Microsoft. Nome provisório.

**Produção:** https://elo-calendar.vercel.app

Hospedado na Vercel com PostgreSQL Neon. A integração Git publica atualizações da `main` automaticamente. Cadastro/login estão disponíveis; a conexão das agendas depende das credenciais OAuth de cada provedor.

## Rodar localmente

Requer Node.js 22.13+.

```bash
npm ci
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Coloque o valor gerado em TOKEN_ENCRYPTION_KEY dentro de .env.local.
npm run dev
```

Abra **http://127.0.0.1:5173**. A primeira tela é o login. Use **Criar conta** para cadastrar seu usuário real; nenhuma conta é criada automaticamente. O banco SQLite local é criado em `.data/elo.sqlite`, fora do Git. Não existe senha padrão nem entrada automática com dados fictícios.

Cadastro, login e logout funcionam localmente sem serviços externos. Google/Microsoft só ficam disponíveis quando suas credenciais OAuth estiverem configuradas.

## O que funciona

- Cadastro com e-mail/senha e sessões persistentes no servidor; logout revoga a sessão.
- Autorização individual por usuário em todas as rotas de agendas e eventos.
- Conexão OAuth de várias contas Google e Microsoft, com PKCE e proteção contra replay.
- Listagem das agendas de cada conta, eventos recorrentes expandidos e paginação.
- Criação, edição e exclusão no calendário de origem escolhido.
- Atualização das agendas ao navegar, ao salvar e pelo botão Atualizar. Não há sincronização em tempo real por webhooks nesta versão.
- Calendário semanal, diário, mensal e agenda; busca, conflitos e cores por conta.
- Tema claro/escuro persistido e interface responsiva.

Tokens de provedores são criptografados no servidor com AES-256-GCM. Senhas usam scrypt com salt individual. O navegador recebe somente um cookie de sessão HttpOnly; não recebe tokens dos provedores. Os eventos são consultados nos provedores e não são guardados no localStorage.

## Produção e OAuth

Veja [o guia de configuração e deploy](docs/SETUP.md). Modelos de CI e deploy estão em `docs/workflows/`, prontos para ativação após autorizar o escopo `workflow` no GitHub. Produção usa PostgreSQL: o SQLite local **não** é usado na Vercel. `.env.local`, `.data/` e `.vercel/` não são versionados.

## Verificar

```bash
npm test
npm run typecheck
npm run build
```

Teste opcional com Chrome instalado e servidor local rodando:

```bash
npm test -- --browser
```

O teste de navegador cria um usuário temporário de QA, verifica cadastro, login, agenda vazia, tema e logout, e remove o usuário ao terminar. Screenshots ficam em `outputs/`, fora do Git. Para outro executável Chrome, use a variável `ELO_CHROME_PATH`.

## Limites atuais

O fuso exibido é Fortaleza (GMT−3). Eventos de dia inteiro e eventos que atravessam dias são exibidos, mas a edição deles deve ser feita no provedor. Agendas sem permissão de escrita são somente leitura. Um evento existente permanece na agenda original; para mudar de agenda, recrie-o no destino. Ainda não há envio de e-mail para confirmação cadastral ou recuperação de senha.

Os testes automatizados usam respostas simuladas dos provedores. O consentimento OAuth e a sincronização com contas reais precisam de validação depois que as credenciais externas forem configuradas.
