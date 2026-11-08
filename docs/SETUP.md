# Configuração do elo

## 1. Login local

O projeto já tem cadastro e login por e-mail/senha. Rode `npm ci` e `npm run dev`, abra `http://127.0.0.1:5173/login` e crie sua própria conta. Nada é pré-cadastrado.

O SQLite em `.data/elo.sqlite` serve somente ao desenvolvimento. Não apague esse arquivo se quiser conservar os usuários e conexões locais. A chave `TOKEN_ENCRYPTION_KEY` deve continuar a mesma para ler conexões já cadastradas; gerar outra chave exige reconectar as contas.

## 2. Banco de produção

Crie um PostgreSQL, por exemplo pelo marketplace da Vercel. Copie a URL de conexão para `DATABASE_URL` nas variáveis de ambiente do projeto Vercel. Prefira a URL com pool de conexões fornecida pelo serviço. Preserve os parâmetros TLS da URL.

Adicione também:

| Variável | Conteúdo |
| --- | --- |
| `APP_URL` | Origem HTTPS estável do app, sem caminho, por exemplo `https://seu-app.vercel.app` |
| `DATABASE_URL` | URL privada do PostgreSQL |
| `TOKEN_ENCRYPTION_KEY` | 32 bytes aleatórios codificados em base64 |
| `GOOGLE_CLIENT_ID` | Client ID OAuth do Google, quando configurado |
| `GOOGLE_CLIENT_SECRET` | Client secret OAuth do Google |
| `MICROSOFT_CLIENT_ID` | Application/client ID do Microsoft Entra |
| `MICROSOFT_CLIENT_SECRET` | Valor do client secret do Microsoft Entra |
| `MICROSOFT_TENANT_ID` | `common` para contas pessoais e organizacionais |

Gere a chave com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` e salve-a apenas nas configurações privadas do ambiente. Não envie segredos em commits, issues ou mensagens.

Com as variáveis do banco carregadas no ambiente, aplique o esquema:

```bash
npm run db:migrate
```

A migração é idempotente. Produção não cria tabelas durante cada request. O modelo de workflow de deploy aplica a migração antes de publicar quando ativado. Usuários locais não são copiados para o banco de produção; crie sua conta no ambiente publicado.

## 3. Google Calendar

No Google Cloud Console:

1. Crie um projeto e habilite a **Google Calendar API**.
2. Configure a tela de consentimento OAuth; durante os testes, adicione os e-mails que irão autorizar o app como usuários de teste.
3. Crie credenciais OAuth do tipo **Web application**.
4. Cadastre a URI de redirecionamento exata: `APP_URL/api/connections/google/callback`, substituindo `APP_URL` pela origem do ambiente.
5. Salve o Client ID e Client secret nas variáveis privadas do ambiente e reinicie/republique.

O app solicita identificação da conta, leitura da lista de agendas e acesso aos eventos. Após entrar no elo, clique **Conectar conta → Google**, escolha uma conta e autorize. Repita para as outras contas.

Referência: [OAuth para aplicações web](https://developers.google.com/identity/protocols/oauth2/web-server), [Google Calendar API](https://developers.google.com/workspace/calendar/api/guides/overview).

## 4. Microsoft Calendar

No Microsoft Entra admin center:

1. Registre um aplicativo, escolhendo os tipos de conta que pretende aceitar. Para contas pessoais e organizacionais, use a opção correspondente a ambos.
2. Em Authentication, adicione a plataforma **Web** e a URI `APP_URL/api/connections/microsoft/callback`.
3. Adicione permissões **delegadas** do Microsoft Graph: `User.Read` e `Calendars.ReadWrite`; o fluxo solicita também `offline_access`.
4. Crie um client secret e salve o **valor** nas variáveis privadas, junto ao Application/client ID.
5. Reinicie/republique e conecte a conta pelo elo.

Para testar OAuth local com Microsoft, use uma URI de loopback permitida pelo Entra; se optar por `http://localhost:5173`, ajuste `APP_URL` e abra o elo nesse mesmo host, do login até o callback. Cookies de `localhost` e `127.0.0.1` são distintos. Em produção, use a URL HTTPS estável.

Referência: [Fluxo de autorização Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [restrições de redirect URI](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url), [Microsoft Graph Calendar](https://learn.microsoft.com/en-us/graph/api/resources/calendar).

## 5. Vercel

### Ambiente de produção configurado

- URL: https://elo-calendar.vercel.app
- Dashboard: https://vercel.com/amons-projects-84315a95/elo-calendar
- Projeto: `elo-calendar` (`prj_whaghFshIkidJuWgQUMjlQigvDrL`).
- Equipe: Amon's projects (`team_FktXqk96Xa88M1jKOx78ACyN`).
- Runtime: Next.js com Node.js 24.x.
- Banco: Neon PostgreSQL `elo-calendar-db`, plano Free (`free_v3`), região `iad1`, conectado ao ambiente Production.
- Esquema de usuários, sessões e conexões aplicado ao PostgreSQL.
- `APP_URL`, `DATABASE_URL` e `TOKEN_ENCRYPTION_KEY` cadastradas na Vercel; a chave é um Secret.
- Repositório `amonn3/elo-calendar` conectado pelo GitHub App da Vercel, com `main` como Production Branch e sem Ignored Build Step.

A primeira publicação chegou a `READY`. Cadastro, login, API protegida, agenda vazia e revogação da sessão foram verificados por HTTP na produção; o usuário temporário de QA foi removido. Credenciais Google/Microsoft ainda precisam ser cadastradas para habilitar as agendas.

O GitHub App da Vercel precisa manter acesso ao repositório privado. Se o vínculo deixar de encontrar o repositório, confira a autorização em https://github.com/apps/vercel/installations/new.

O destino deste app é o projeto **elo-calendar**, no escopo **amons-projects-84315a95** (equipe Amon's projects, `team_FktXqk96Xa88M1jKOx78ACyN`). Use a sessão já autenticada da CLI Vercel. O projeto `vamo-radar` é apenas referência e não deve ser modificado nem ter seu ID copiado.

Configure **Next.js**, Node.js **24.x**, instalação `npm ci`, build `npm run build` e diretório de saída automático do Next.js. Este app tem rotas de servidor e não usa a saída estática `dist` do vamo-radar.

### Deploy automático em cada merge na main

Use a integração Git nativa da Vercel:

- Repositório conectado: `https://github.com/amonn3/elo-calendar.git`.
- Production Branch: `main`.
- Deployments habilitados; sem Ignored Build Step que pule commits da main.
- O `vercel.json` declara explicitamente `git.deploymentEnabled.main: true`.

Com o vínculo remoto concluído, cada merge ou push na `main` dispara um deployment de produção. O manifesto sozinho não cria o projeto, não instala o acesso ao repositório na Vercel e não configura a Production Branch remota.

A integração nativa não depende de GitHub Actions, do escopo `workflow` no token do GitHub ou de adicionar um `VERCEL_TOKEN` ao repositório. Não ative ao mesmo tempo um workflow que publique a mesma alteração.

Referências: [integração Git](https://vercel.com/docs/git), [configuração de branches](https://vercel.com/docs/project-configuration/git-configuration).

### Vínculo pela CLI

Verifique primeiro a identidade e os projetos da equipe:

```bash
vercel whoami
vercel teams ls
vercel project inspect elo-calendar --scope amons-projects-84315a95 --json
```

Se o projeto ainda não existir, crie-o com `vercel project create elo-calendar --scope amons-projects-84315a95`. Depois configure e conecte:

```bash
vercel project update elo-calendar --scope amons-projects-84315a95 --framework nextjs --node-version 24.x --install-command 'npm ci' --build-command 'npm run build' --auto-detect output-directory --yes
vercel link --yes --scope amons-projects-84315a95 --project elo-calendar
vercel git connect https://github.com/amonn3/elo-calendar.git --yes --scope amons-projects-84315a95
vercel project inspect elo-calendar --scope amons-projects-84315a95 --json
```

Confirme na resposta/configuração remota que `link.productionBranch` é `main`; ajuste a Production Branch no painel se necessário. A CLI grava o vínculo real em `.vercel/project.json`, ignorado pelo Git. Não preencha esse arquivo com o ID de outro projeto.

Após configurar as variáveis e aplicar o esquema, publique a primeira versão e confirme o estado `READY`. Para verificar o gatilho Git, observe o deployment criado por um commit/merge real na `main` e compare seu SHA com o commit publicado.

Se as consultas de identidade falharem por bloqueio de rede do ambiente, o vínculo remoto ainda não está confirmado. Credenciais locais existentes não significam que a tarefa tenha acesso à API da Vercel.

Antes do primeiro uso, aplique o esquema no banco de produção. As credenciais Google/Microsoft podem ser adicionadas depois; enquanto estiverem ausentes, os respectivos botões de conexão ficam indisponíveis. Cadastro/login precisam do banco configurado, mesmo sem OAuth.

Os modelos de CI e deploy estão em `docs/workflows/`. A credencial GitHub usada nesta implementação tem escopo `repo`, mas não `workflow`, portanto os modelos não estão ativos. Para ativá-los, autorize o escopo `workflow` na sua credencial e mova os arquivos para `.github/workflows/`. Depois configure os secrets do repositório para o workflow manual **Deploy to Vercel**:

- `VERCEL_TOKEN`: token de deploy da sua conta.
- `VERCEL_ORG_ID`: ID da sua conta/time Vercel.
- `VERCEL_PROJECT_ID`: ID do projeto importado.

O workflow baixa as variáveis de produção da Vercel, valida a configuração, aplica o esquema, compila e publica. Não há secrets incluídos no código. Use somente um mecanismo de deploy por alteração para evitar publicações duplicadas.

Depois de publicar, teste: cadastrar → sair → entrar → conectar suas três contas → confirmar agendas e horários → criar um evento em uma conta → conferir no calendário original.

## 6. Contribuições no GitHub

Os commits representam mudanças reais e usam os horários reais da implementação. Para contabilização no perfil, o e-mail do autor precisa estar associado à sua conta; commits na branch principal atendem à parte de branch da regra. Em um repositório privado, habilite a exibição de contribuições privadas se quiser que apareçam no gráfico público.

Referência: [Critérios de contribuição do GitHub](https://docs.github.com/en/account-and-profile/how-tos/setting-up-and-managing-your-github-profile/managing-contribution-settings-on-your-profile/troubleshooting-missing-contributions).
