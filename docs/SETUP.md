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

Importe o repositório privado `amonn3/elo-calendar` na sua conta Vercel, selecione Next.js e configure as variáveis acima. Instalação: `npm ci`. Build: `npm run build`.

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
